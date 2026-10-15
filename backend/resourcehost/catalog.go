// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
)

// CatalogQuery and CatalogPage use the same local query contract for every kind.
type CatalogQuery = primitive.CatalogQuery

type NamespacePage = primitive.CatalogPage[DiscoveredNamespace]

func (g *Gateway) catalog(ctx context.Context, kind, category string, load func(context.Context) ([]primitive.CatalogItem[json.RawMessage], error), sourceLease ...func() time.Time) (*primitive.Catalog[json.RawMessage], identity.VerifiedActor, error) {
	catalogPhase := observe.Phase("catalog.snapshot")
	discoveryPhase := observe.Phase("catalog.discovery")
	if identity.ValidResourceKind(category) {
		catalogPhase = observe.Phase("catalog." + category + ".snapshot")
		discoveryPhase = observe.Phase("catalog." + category + ".discovery")
	}
	catalogTiming := observe.Start(ctx, catalogPhase, observe.Labels{})
	catalogSucceeded := false
	defer func() {
		if catalogSucceeded {
			catalogTiming.End(observe.OK, observe.CacheUnknown)
		} else {
			catalogTiming.End(observe.Error, observe.CacheUnknown)
		}
	}()
	actor, err := g.actor(ctx)
	if err != nil {
		return nil, actor, err
	}
	names, err := g.catalogConnectionNames(ctx)
	if err != nil {
		return nil, actor, err
	}
	sort.Strings(names)
	// A kind's snapshot depends on providers that currently expose that kind.
	// Discover every configured provider on each call so a newly supporting
	// provider changes the dependency set without coupling this snapshot to
	// unrelated servers' connection and tool-list churn.
	dependencies := names
	scopeNames := make([]string, 0, len(names))
	var standardLease time.Time
	if category != "" {
		dependencies = nil
	}
	discoveryTiming := observe.Start(ctx, discoveryPhase, observe.Labels{})
	// Provider capability reads are independent. Bound cold fan-out, then apply
	// results in sorted connection order so collision/error handling is stable.
	type discovered struct {
		caps capabilities
		err  error
	}
	results := make([]discovered, len(names))
	semaphore := make(chan struct{}, 4)
	var discoveryWG sync.WaitGroup
	for i, name := range names {
		discoveryWG.Add(1)
		go func() {
			defer discoveryWG.Done()
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				results[i].err = ctx.Err()
				return
			}
			results[i].caps, results[i].err = g.catalogCapability(ctx, actor, name)
		}()
	}
	discoveryWG.Wait()
	for i, name := range names {
		caps, discoverErr := results[i].caps, results[i].err
		if aggregateLinkRequired(discoverErr) {
			continue
		}
		if discoverErr != nil && !errors.Is(discoverErr, ErrUnavailable) {
			discoveryTiming.End(observe.OutcomeFor(discoverErr), observe.CacheUnknown)
			return nil, actor, discoverErr
		}
		if category == "" {
			scopeNames = append(scopeNames, name)
		}
		if category != "" && discoverErr == nil {
			for _, namespace := range caps.namespaces {
				if supports(caps, namespace.Namespace, category, "list") {
					dependencies = append(dependencies, name)
					scopeNames = append(scopeNames, name)
					if caps.standardResources && (standardLease.IsZero() || discoveryCacheUntil(caps).Before(standardLease)) {
						standardLease = discoveryCacheUntil(caps)
					}
					break
				}
			}
		}
		if category == "" && discoverErr == nil && caps.standardResources && (standardLease.IsZero() || discoveryCacheUntil(caps).Before(standardLease)) {
			standardLease = discoveryCacheUntil(caps)
		}
	}
	discoveryTiming.End(observe.OK, observe.CacheUnknown)
	// Unlinked connectors do not participate in transport initialization. Their
	// configured definitions still fence this catalog and its original cursor.
	configuredScope := func() (string, error) {
		definitions := make([]any, 0, len(names))
		for _, name := range names {
			options, err := g.Manager.Options(ctx, name)
			if err != nil {
				return "", err
			}
			definitions = append(definitions, struct {
				Name    string
				Options any
			}{name, options})
		}
		raw, err := json.Marshal(definitions)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%x", sha256.Sum256(raw)), nil
	}
	partition := g.Manager.WithCatalogSources(ctx, g.Manager.CatalogPartition(ctx, catalogPrincipalScope(actor), category), dependencies)
	scope, cacheable, err := g.Manager.CatalogScopeForResources(ctx, "", scopeNames, dependencies)
	if err != nil {
		return nil, actor, err
	}
	configuration, err := configuredScope()
	if err != nil {
		return nil, actor, err
	}
	until := actor.ValidUntil
	if !cacheable {
		until = g.now()
	}
	if !standardLease.IsZero() {
		until = identity.MinimumMetadataExpiry(until, standardLease)
	}
	generation := g.catalogGeneration(scopeNames)
	key := fmt.Sprintf("primitive:%p:%s:%s:%s:%x", g, actorKey(actor, "", 0), scope+":"+configuration, kind, generation)

	indexTiming := observe.Start(ctx, observe.Phase("catalog.index"), observe.Labels{})
	index, err := g.Manager.VisibleCatalogInPartition(ctx, key, partition, until, load, sourceLease...)
	indexTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, actor, err
	}
	current, _, err := g.Manager.CatalogScopeForResources(ctx, "", scopeNames, dependencies)
	if err != nil {
		return nil, actor, err
	}
	currentConfiguration, configErr := configuredScope()
	if configErr != nil {
		return nil, actor, configErr
	}
	if current != scope || currentConfiguration != configuration || generation != g.catalogGeneration(scopeNames) {
		return nil, actor, primitive.ErrCatalogCursor
	}
	if err = g.final(ctx, actor); err != nil {
		return nil, actor, err
	}
	catalogSucceeded = true
	return index, actor, nil
}

// catalogCapability reuses the existing capability entry after a scoped
// credential/configuration and notification-generation check. It never caches
// a resource Get or an authorization decision; selected reads still reach the
// owning MCP and retain their original lease.
func (g *Gateway) catalogCapability(ctx context.Context, actor identity.VerifiedActor, name string) (capabilities, error) {
	probe := observe.Start(ctx, observe.Phase("catalog.capability.hint"), observe.Labels{})
	if sequenceFromContext(ctx) != nil {
		probe.End(observe.OK, observe.CacheBypass)
		return g.discover(ctx, actor, name)
	}
	scope, cacheable, scopeErr := g.Manager.CatalogScopeForResources(ctx, "", []string{name}, []string{name})
	if scopeErr != nil || !cacheable {
		probe.End(observe.OutcomeFor(scopeErr), observe.CacheBypass)
		return g.discover(ctx, actor, name)
	}
	hintKey := actorKey(actor, name, g.generation(name)) + ":" + scope
	g.mu.Lock()
	hint, found := g.capabilityHints[hintKey]
	cached, present := g.cache[hint.cacheKey]
	g.mu.Unlock()
	if found && hint.unavailableUntil.After(g.now()) {
		probe.End(observe.OK, observe.CacheHit)
		return capabilities{}, ErrUnavailable
	}
	if found && present && cached.connection.Name == name && cached.connection.Generation == g.generation(name) && cached.resourceVersion == g.Manager.ResourceCatalogGeneration(ctx, name) && identity.MetadataExpiryValid(discoveryCacheUntil(cached), g.now()) {
		probe.End(observe.OK, observe.CacheHit)
		return cached, nil
	}
	probe.End(observe.OK, observe.CacheMiss)
	resolved, err := g.discover(ctx, actor, name)
	if err == nil && resolved.cacheKey != "" || errors.Is(err, ErrUnavailable) {
		g.mu.Lock()
		if len(g.capabilityHints) >= 512 {
			g.capabilityHints = map[string]capabilityHint{}
		}
		hint := capabilityHint{connection: name, cacheKey: resolved.cacheKey}
		if errors.Is(err, ErrUnavailable) {
			hint.unavailableUntil = g.now().Add(30 * time.Second)
		}
		g.capabilityHints[hintKey] = hint
		g.mu.Unlock()
	}
	return resolved, err
}

// ListPage queries one cached visible metadata snapshot. Legacy List and all
// Get/data execution paths remain fresh and do not consume this snapshot.
func ListPage[T any](ctx context.Context, g *Gateway, kind string, query CatalogQuery, hydrateDefinitions ...bool) (*primitive.CatalogPage[Located[T]], error) {
	if !identity.ValidResourceKind(kind) {
		return nil, identity.ErrResource
	}
	hydrated := len(hydrateDefinitions) > 0 && hydrateDefinitions[0]
	catalogKind := kind
	if hydrated {
		catalogKind += ":definitions"
	}
	var definitionLease time.Time
	index, actor, err := g.catalog(ctx, catalogKind, kind, func(ctx context.Context) ([]primitive.CatalogItem[json.RawMessage], error) {
		rows, err := g.List(ctx, kind, "")
		if err != nil {
			return nil, err
		}
		if hydrated && len(rows) > primitive.MaxCatalogPageSize {
			return nil, identity.ErrResource
		}
		items := make([]primitive.CatalogItem[json.RawMessage], 0, len(rows))
		for _, row := range rows {
			if hydrated {
				fresh, e := Get[json.RawMessage](ctx, g, row.Connection, identity.ResourceRef{URI: row.Resource.URI, Revision: row.Resource.Revision}, nil)
				if errors.Is(e, identity.ErrResourceDenied) && !resourceIdentityRejected(e) {
					continue
				}
				if e != nil {
					return nil, e
				}
				if row.Resource.ContentFingerprint != "" && row.Resource.ContentFingerprint != fresh.Resource.ContentFingerprint {
					return nil, identity.ErrResourceStale
				}
				if fresh.ResolvedResource == nil {
					return nil, identity.ErrResourceDenied
				}
				if definitionLease.IsZero() || fresh.ResolvedResource.ValidUntil.Before(definitionLease) {
					definitionLease = fresh.ResolvedResource.ValidUntil
				}
				row.ResolvedResource = fresh.ResolvedResource
				row.Resource = *fresh.Resource
				row.Resource.Definition = fresh.Definition
				row.Resource.DefinitionBytes = nil // One exact definition carrier in the private snapshot.
			}
			raw, err := json.Marshal(row)
			if err != nil {
				return nil, err
			}
			items = append(items, primitive.CatalogItem[json.RawMessage]{Name: row.Resource.Name, Description: row.Resource.Description, Namespace: row.Resource.Namespace, URI: row.Resource.URI, Provider: row.Connection.ProviderIdentity, OwnerID: row.Resource.OwnerID, Value: raw})
		}
		return items, nil
	}, func() time.Time { return definitionLease })
	if err != nil {
		return nil, err
	}
	page, err := index.Page(ctx, query)
	if err != nil {
		return nil, err
	}
	result := &primitive.CatalogPage[Located[T]]{NextCursor: page.NextCursor, Complete: page.Complete, Total: page.Total, Items: make([]Located[T], 0, len(page.Items))}
	for _, raw := range page.Items {
		var located LocatedResource
		if err = json.Unmarshal(raw, &located); err != nil {
			return nil, err
		}
		definition, err := decodeDefinition[T](located.Resource.Definition)
		if err != nil {
			return nil, err
		}
		result.Items = append(result.Items, Located[T]{LocatedResource: located, Definition: definition})
	}
	if err = g.final(ctx, actor); err != nil {
		return nil, err
	}
	if err = g.Manager.CheckVisibleCatalog(ctx, index); err != nil {
		return nil, err
	}
	return result, nil
}
func (g *Gateway) ListPage(ctx context.Context, kind string, query CatalogQuery) (*primitive.CatalogPage[Located[json.RawMessage]], error) {
	return ListPage[json.RawMessage](ctx, g, kind, query)
}

// NamespacePage describes explicitly published provider metadata and declared
// supported operations; it never invents capabilities or fetches definitions.
func (g *Gateway) NamespacePage(ctx context.Context, query CatalogQuery) (*NamespacePage, error) {
	index, actor, err := g.catalog(ctx, "namespace", "namespace", func(ctx context.Context) ([]primitive.CatalogItem[json.RawMessage], error) {
		namespaces, err := g.Discover(ctx)
		if err != nil {
			return nil, err
		}
		items := make([]primitive.CatalogItem[json.RawMessage], 0, len(namespaces))
		for _, namespace := range namespaces {
			raw, err := json.Marshal(namespace)
			if err != nil {
				return nil, err
			}
			items = append(items, primitive.CatalogItem[json.RawMessage]{Name: namespace.Namespace, Description: namespace.Description, Namespace: namespace.Namespace, URI: namespace.Namespace, Provider: namespace.Connection.ProviderIdentity, Value: raw})
		}
		return items, nil
	})
	if err != nil {
		return nil, err
	}
	page, err := index.Page(ctx, query)
	if err != nil {
		return nil, err
	}
	result := &NamespacePage{NextCursor: page.NextCursor, Complete: page.Complete, Total: page.Total, Items: make([]DiscoveredNamespace, 0, len(page.Items))}
	for _, raw := range page.Items {
		var item DiscoveredNamespace
		if err = json.Unmarshal(raw, &item); err != nil {
			return nil, err
		}
		result.Items = append(result.Items, item)
	}
	if err = g.final(ctx, actor); err != nil {
		return nil, err
	}
	if err = g.Manager.CheckVisibleCatalog(ctx, index); err != nil {
		return nil, err
	}
	return result, nil
}

func (g *Gateway) catalogGeneration(names []string) [32]byte {
	generations := make([]uint64, len(names))
	g.mu.Lock()
	for i, name := range names {
		generations[i] = g.generations[name]
	}
	g.mu.Unlock()
	raw, _ := json.Marshal(generations)
	return sha256.Sum256(raw)
}

// Full catalog keys retain account/revision/credential isolation. Mutation tags
// identify the stable user realm so successful writes also expire that user's
// older account/revision/session variants without touching other principals.
func catalogPrincipalScope(actor identity.VerifiedActor) string {
	raw, _ := json.Marshal([]any{actor.PublicRead, actor.Issuer, actor.Subject, actor.TenantID})
	return string(raw)
}
