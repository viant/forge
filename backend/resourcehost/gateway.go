// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
// Package resource federates delegated primitive providers. A gateway never
// exports its aggregate catalog as a local authoritative provider.
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
	"github.com/viant/jsonrpc"
	namespaces "github.com/viant/mcp-protocol/extension/namespaces"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"
)

var ErrCollision = errors.New("primitive provider identity collision")

type ActorResolver = producer.ActorResolver
type ActorVerifier = producer.ActorVerifier

// Connection is a transport locator, separate from canonical resource identity.
type Connection struct {
	Name             string `json:"name"`
	ProviderIdentity string `json:"providerIdentity"`
	Generation       uint64 `json:"generation"`
}
type LocatedResource struct {
	ResolvedResource *identity.ResolvedResource `json:"resolvedResource,omitempty"`
	Connection       Connection                 `json:"connection"`
	Resource         primitive.ResourceState    `json:"resource"`
}
type capabilities struct {
	cacheKey               string
	sharedIndex            bool
	standardResources      bool
	cacheUntil             time.Time
	indexedResources       map[string]primitive.ResourceState
	actor                  identity.VerifiedActor
	connection             Connection
	namespaces             []primitive.NamespaceCapabilities
	installed              map[string]bool
	bindingKey             string
	resourceVersion        [2]uint64
	publicResourceMetadata bool
	expires                time.Time
}

func discoveryCacheUntil(c capabilities) time.Time {
	if !c.cacheUntil.IsZero() {
		return c.cacheUntil
	}
	return c.expires
}

type Gateway struct {
	Manager                 *manager.Manager
	Actor                   ActorResolver
	Verify                  ActorVerifier
	GatewayProviderIdentity string
	Now                     func() time.Time
	mu                      sync.Mutex
	generations             map[string]uint64
	cache                   map[string]capabilities
	capabilityHints         map[string]capabilityHint
	discoveryInflight       map[string]*discoveryCall
	stopChanges             func()
	stopResourceChanges     func()
	closed                  bool
	observedOwners          map[string]string
}

type discoveryCall struct {
	ready chan struct{}
	err   error
}

type capabilityHint struct {
	connection, cacheKey string
	// A provider without primitives is still a stable discovery result. Keep
	// it briefly so ordinary MCP servers are not probed for every datasource.
	unavailableUntil time.Time
}

func NewGateway(m *manager.Manager, a ActorResolver, v ActorVerifier, localIdentity string) *Gateway {
	g := &Gateway{Manager: m, Actor: a, Verify: v, GatewayProviderIdentity: localIdentity, generations: map[string]uint64{}, cache: map[string]capabilities{}, capabilityHints: map[string]capabilityHint{}, discoveryInflight: map[string]*discoveryCall{}, observedOwners: map[string]string{}}
	if m != nil {
		g.stopChanges = m.OnCatalogChange(g.Invalidate)
		g.stopResourceChanges = m.OnResourceCatalogChange(func(name string) {
			g.mu.Lock()
			defer g.mu.Unlock()
			for key, c := range g.cache {
				if c.connection.Name == name {
					delete(g.cache, key)
				}
			}
			for key, hint := range g.capabilityHints {
				if hint.connection == name {
					delete(g.capabilityHints, key)
				}
			}
		})
	}
	return g
}
func (g *Gateway) now() time.Time {
	if g.Now != nil {
		return g.Now()
	}
	return time.Now()
}
func (g *Gateway) Close() {
	if g == nil {
		return
	}
	g.mu.Lock()
	g.closed = true
	g.cache = map[string]capabilities{}
	g.capabilityHints = map[string]capabilityHint{}
	stop := g.stopChanges
	stopResource := g.stopResourceChanges
	g.stopResourceChanges = nil
	g.stopChanges = nil
	g.mu.Unlock()
	if stop != nil {
		stop()
	}
	if stopResource != nil {
		stopResource()
	}
}
func (g *Gateway) Invalidate(connection string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.generations[connection]++
	for key, c := range g.cache {
		if c.connection.Name == connection {
			delete(g.cache, key)
		}
	}
	for key, hint := range g.capabilityHints {
		if hint.connection == connection {
			delete(g.capabilityHints, key)
		}
	}
}
func (g *Gateway) generation(name string) uint64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.generations[name]
}
func (g *Gateway) actor(ctx context.Context) (identity.VerifiedActor, error) {
	if g == nil || g.Manager == nil || g.Actor == nil || g.Verify == nil {
		return identity.VerifiedActor{}, identity.ErrResourceDenied
	}
	g.mu.Lock()
	closed := g.closed
	g.mu.Unlock()
	if closed {
		return identity.VerifiedActor{}, identity.ErrResourceDenied
	}
	var scopeErr error
	ctx, scopeErr = ReadContext(ctx)
	if scopeErr != nil {
		return identity.VerifiedActor{}, scopeErr
	}
	a, e := g.Actor(ctx)
	if e != nil {
		return a, e
	}
	if !a.ReadValid(g.now()) || ctx.Err() != nil {
		return a, identity.ErrResourceDenied
	}
	if e = g.Verify(ctx, a); e != nil {
		return a, e
	}
	if sequence := sequenceFromContext(ctx); sequence != nil {
		if sequence.gateway != g {
			return a, identity.ErrResourceDenied
		}
		if e = sequence.checkActor(a); e != nil {
			return a, e
		}
	}
	return a, nil
}
func (g *Gateway) final(ctx context.Context, a identity.VerifiedActor) error {
	g.mu.Lock()
	closed := g.closed
	g.mu.Unlock()
	if closed {
		return identity.ErrResourceDenied
	}
	var scopeErr error
	ctx, scopeErr = ReadContext(ctx)
	if scopeErr != nil {
		return scopeErr
	}
	if sequence := sequenceFromContext(ctx); sequence != nil {
		if sequence.gateway != g {
			return identity.ErrResourceDenied
		}
		if err := sequence.checkActor(a); err != nil {
			return err
		}
	}
	if !a.ReadValid(g.now()) || ctx.Err() != nil {
		return identity.ErrResourceDenied
	}
	return g.Verify(ctx, a)
}
func actorKey(a identity.VerifiedActor, name string, generation uint64) string {
	raw, _ := json.Marshal([]any{a.PublicRead, a.Issuer, a.Subject, a.TenantID, a.AccountID, a.IdentityRevision, name, generation})
	return string(raw)
}
func (g *Gateway) client(ctx context.Context, name string) (mcpclient.Interface, error) {
	client, err := g.Manager.Get(g.Manager.WithAuthTokenContext(ctx, name), "", name)
	if err != nil {
		return nil, err
	}
	return &gatewayAuthClient{Interface: client, manager: g.Manager, name: name}, nil
}
func toolRaw(ctx context.Context, c mcpclient.Interface, method string, in any) (output json.RawMessage, failure error) {
	labels := observe.Labels{}
	if observe.Enabled(ctx) {
		if client, ok := c.(*gatewayAuthClient); ok {
			labels.Provider = client.name
		}
		prefix, _, _ := strings.Cut(method, "/")
		labels.Kind = primitive.Kind(prefix)
	}
	total := observe.Start(ctx, observe.Phase("gateway.tool"), labels)
	defer func() { total.End(observe.OutcomeFor(failure), observe.CacheUnknown) }()
	encoding := observe.Start(ctx, observe.Phase("gateway.request.encode"), labels)
	raw, e := json.Marshal(in)
	if e != nil {
		encoding.End(observe.OutcomeFor(e), observe.CacheUnknown)
		return nil, e
	}
	var args map[string]any
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.UseNumber()
	if e = decoder.Decode(&args); e != nil {
		encoding.End(observe.OutcomeFor(e), observe.CacheUnknown)
		return nil, e
	}
	encoding.End(observe.OK, observe.CacheUnknown)
	dispatch := observe.Start(ctx, observe.Phase("gateway.mcp.call"), labels)
	result, e := c.CallTool(ctx, &schema.CallToolRequestParams{Name: method, Arguments: args}, mcpclient.WithNoRetry())
	if e != nil {
		dispatch.End(observe.OutcomeFor(e), observe.CacheUnknown)
		return nil, e
	}
	if result == nil || result.IsError != nil && *result.IsError {
		dispatch.End(observe.Denied, observe.CacheUnknown)
		return nil, identity.ErrResourceDenied
	}
	dispatch.End(observe.OK, observe.CacheUnknown)
	decoding := observe.Start(ctx, observe.Phase("gateway.response.decode"), labels)
	defer func() { decoding.End(observe.OutcomeFor(failure), observe.CacheUnknown) }()
	if result.StructuredContent != nil {
		return json.Marshal(result.StructuredContent)
	}
	for _, content := range result.Content {
		if text, ok := content.(schema.TextContent); ok && json.Valid([]byte(text.Text)) {
			return json.RawMessage(text.Text), nil
		}
		if object, ok := content.(map[string]any); ok {
			kind, _ := object["type"].(string)
			text, _ := object["text"].(string)
			if kind == "text" && json.Valid([]byte(text)) {
				return json.RawMessage(text), nil
			}
		}
	}
	return nil, identity.ErrResource
}
func call[T any](ctx context.Context, c mcpclient.Interface, method string, in any) (T, error) {
	var out T
	raw, e := toolRaw(ctx, c, method, in)
	if e != nil {
		return out, e
	}
	e = json.Unmarshal(raw, &out)
	return out, e
}

func (g *Gateway) discover(ctx context.Context, a identity.VerifiedActor, name string, binding ...*resourceReadBinding) (capabilities, error) {
	return g.discoverMode(ctx, a, name, false, binding...)
}

func (g *Gateway) discoverMode(ctx context.Context, a identity.VerifiedActor, name string, force bool, bindings ...*resourceReadBinding) (resolved capabilities, retErr error) {
	var scopeErr error
	ctx, scopeErr = ReadContext(ctx)
	if scopeErr != nil {
		return capabilities{}, scopeErr
	}
	var binding *resourceReadBinding
	if len(bindings) > 0 {
		binding = bindings[0]
	}
	var options *cfg.MCPClient
	var c mcpclient.Interface
	var e error
	if binding != nil {
		if binding.manager != g.Manager || binding.name != name {
			return capabilities{}, identity.ErrResourceDenied
		}
		options, c = binding.options, binding.client
	} else {
		binding, e = g.resolveReadBinding(ctx, a, name)
		if e != nil {
			return capabilities{}, e
		}
		options, c = binding.options, binding.client
	}
	restrictions := append([]string(nil), options.PrimitiveNamespaces...)
	sort.Strings(restrictions)
	restrictionKey, _ := json.Marshal(restrictions)
	generation := g.generation(name)
	resourceVersion := g.Manager.ResourceCatalogGeneration(ctx, name)
	catalogKey := binding.capabilityKey()
	key := actorKey(a, name, generation) + string(restrictionKey) + options.PrimitiveProviderIdentity + catalogKey
	g.mu.Lock()
	cached, ok := g.cache[key]
	g.mu.Unlock()
	sequence := sequenceFromContext(ctx)
	readKey := ""
	if sequence != nil && !force {
		if binding != nil {
			readKey = binding.key
		} else {
			readKey, e = g.namespaceReadKey(ctx, a, name, options, c)
			if e != nil {
				return capabilities{}, e
			}
		}
		if read, found, err := sequence.lookup(name, readKey); found || err != nil {
			if err != nil {
				return capabilities{}, err
			}
			if err := g.final(ctx, a); err != nil {
				return capabilities{}, err
			}
			return read, nil
		}
	}
	if !force && ok && identity.MetadataExpiryValid(discoveryCacheUntil(cached), g.now()) && cached.bindingKey == catalogKey && cached.resourceVersion == resourceVersion {
		if e = g.checkReadBinding(ctx, a, binding); e != nil {
			return capabilities{}, e
		}
		if e = g.final(ctx, a); e != nil {
			return capabilities{}, e
		}
		if sequence != nil {
			if e = sequence.record(name, binding.key, cached); e != nil {
				return capabilities{}, e
			}
		}
		return cached, nil
	}
	if !force {
		g.mu.Lock()
		if current, found := g.cache[key]; found && identity.MetadataExpiryValid(discoveryCacheUntil(current), g.now()) && current.bindingKey == catalogKey && current.resourceVersion == resourceVersion {
			g.mu.Unlock()
			return g.discoverMode(ctx, a, name, false, binding)
		}
		if g.discoveryInflight == nil {
			g.discoveryInflight = map[string]*discoveryCall{}
		}
		if pending := g.discoveryInflight[key]; pending != nil {
			g.mu.Unlock()
			select {
			case <-pending.ready:
				if pending.err != nil {
					if (errors.Is(pending.err, context.Canceled) || errors.Is(pending.err, context.DeadlineExceeded)) && ctx.Err() == nil {
						return g.discoverMode(ctx, a, name, false, binding)
					}
					return capabilities{}, pending.err
				}
				return g.discoverMode(ctx, a, name, false, binding)
			case <-ctx.Done():
				return capabilities{}, ctx.Err()
			}
		}
		pending := &discoveryCall{ready: make(chan struct{})}
		g.discoveryInflight[key] = pending
		g.mu.Unlock()
		defer func() {
			g.mu.Lock()
			pending.err = retErr
			if g.discoveryInflight[key] == pending {
				delete(g.discoveryInflight, key)
			}
			close(pending.ready)
			g.mu.Unlock()
		}()
	}
	installed := map[string]bool{}
	sharedContract := false
	seenTools := map[string]bool{}
	owners := map[string]bool{}
	configuredOwner := options.PrimitiveProviderIdentity
	if configuredOwner != "" {
		// Trusted configured provenance permits direct namespace discovery. Its
		// methods are metadata contracts; each resource call is still managed
		// and authorized freshly by the owning endpoint.
		installed["namespaces/list"], installed["namespaces/get"] = true, true
		owners[configuredOwner] = true
	} else {
		toolCursor := (*string)(nil)
		for page := 0; page < 100; page++ {
			tools, e := c.ListTools(ctx, toolCursor)
			if e != nil {
				var rpc *jsonrpc.Error
				if errors.As(e, &rpc) && rpc.Code == -32601 {
					break // Resource-only MCP servers need not implement tools/list.
				}
				return capabilities{}, e
			}
			if tools == nil {
				return capabilities{}, ErrUnavailable
			}
			for _, tool := range tools.Tools {
				if seenTools[tool.Name] {
					return capabilities{}, identity.ErrResource
				}
				seenTools[tool.Name] = true
				if tool.Name == "namespaces/get" {
					var shape struct {
						Properties map[string]json.RawMessage `json:"properties"`
					}
					raw, _ := json.Marshal(tool.InputSchema)
					if json.Unmarshal(raw, &shape) == nil && shape.Properties["uri"] != nil {
						sharedContract = true
					}
				}

				raw, _ := json.Marshal(tool.Meta[primitive.AuthoringExtension])
				var meta struct {
					Version          int    `json:"version"`
					ProviderIdentity string `json:"providerIdentity"`
					Transport        string `json:"transport"`
				}
				if json.Unmarshal(raw, &meta) == nil && meta.Version == 1 && meta.ProviderIdentity != "" && meta.Transport == "tools/call" {
					installed[tool.Name] = true
					owners[meta.ProviderIdentity] = true
				}
			}
			if tools.NextCursor == nil || *tools.NextCursor == "" {
				break
			}
			if page == 99 || toolCursor != nil && *toolCursor == *tools.NextCursor {
				return capabilities{}, identity.ErrResource
			}
			toolCursor = tools.NextCursor
		}

	}
	if sharedContract {
		for _, method := range []string{"namespaces/list", "namespaces/get", "resource/get"} {
			if seenTools[method] {
				installed[method] = true
			}
		}
	}
	if !installed["namespaces/list"] || !installed["namespaces/get"] {
		standardCapable := standardResourceReadSupported(ctx, c)
		if standardCapable {
			standard, supported, standardErr := g.discoverStandardResources(ctx, a, name, binding, options, c, generation, resourceVersion)
			if standardErr != nil {
				return capabilities{}, standardErr
			}
			if supported {
				currentRestrictions := append([]string(nil), options.PrimitiveNamespaces...)
				sort.Strings(currentRestrictions)
				currentRestrictionKey, _ := json.Marshal(currentRestrictions)
				if !bytes.Equal(currentRestrictionKey, restrictionKey) {
					return capabilities{}, primitive.ErrCatalogCursor
				}
				return g.publishDiscovery(ctx, a, name, binding, key, generation, resourceVersion, force, standard)
			}
		}
		return capabilities{}, ErrUnavailable
	}
	var result capabilities
	var owner string
	var listRequest any = primitive.NamespaceListRequest{Limit: 100}
	if sharedContract || configuredOwner != "" {
		listRequest = struct{}{}
	}
	listedRaw, e := toolRaw(ctx, c, "namespaces/list", listRequest)
	if e != nil {
		return capabilities{}, e
	}
	if sharedContract && !sharedNamespaceIndex(listedRaw) {
		return capabilities{}, identity.ErrResource
	}
	if sharedNamespaceIndex(listedRaw) {
		if configuredOwner != "" {
			// Only a shared-index response needs ordinary tool/schema discovery;
			// declared legacy sources keep their existing direct metadata path.
			cursor := (*string)(nil)
			seen := map[string]bool{}
			for page := 0; page < 100; page++ {
				tools, err := c.ListTools(ctx, cursor)
				if err != nil {
					return capabilities{}, err
				}
				if tools == nil {
					return capabilities{}, ErrUnavailable
				}
				for _, tool := range tools.Tools {
					if tool.Name == "namespaces/list" || tool.Name == "namespaces/get" || tool.Name == "resource/get" {
						installed[tool.Name] = true
					}
				}
				if tools.NextCursor == nil {
					break
				}
				if *tools.NextCursor == "" || seen[*tools.NextCursor] || page == 99 {
					return capabilities{}, identity.ErrResource
				}
				seen[*tools.NextCursor] = true
				cursor = tools.NextCursor
			}
		}
		owner = configuredOwner
		if owner == "" {
			owner = name
		}
		if owner == g.GatewayProviderIdentity {
			return capabilities{}, ErrCollision
		}
		allowed := map[string]bool{}
		for _, namespace := range options.PrimitiveNamespaces {
			allowed[namespace] = true
		}
		result = capabilities{actor: a, connection: Connection{Name: name, ProviderIdentity: owner, Generation: generation}, expires: a.ValidUntil, installed: installed, bindingKey: catalogKey, resourceVersion: resourceVersion}
		for _, scope := range options.ResourceCacheScopes {
			if scope == cfg.ResourceCachePublic {
				result.publicResourceMetadata = true
				break
			}
		}
		standardRead := !installed[namespaces.ResourceGetToolName] && standardResourceReadSupported(ctx, c)
		result, e = g.discoverNamespaceIndex(ctx, c, listedRaw, result, allowed, standardRead)
		if e != nil {
			return capabilities{}, e
		}
	} else {
		if len(owners) != 1 {
			return capabilities{}, ErrCollision
		}
		var listedFirst primitive.NamespaceListResult
		if e = json.Unmarshal(listedRaw, &listedFirst); e != nil {
			return capabilities{}, e
		}
		owner = listedFirst.ProviderIdentity
		if owner == "" || !owners[owner] || owner == g.GatewayProviderIdentity {
			return capabilities{}, ErrCollision
		}
		if options.PrimitiveProviderIdentity != "" && owner != options.PrimitiveProviderIdentity {
			return capabilities{}, ErrCollision
		}
		g.mu.Lock()
		priorOwner := g.observedOwners[name]
		g.mu.Unlock()
		if priorOwner != "" && priorOwner != owner && options.PrimitiveProviderIdentity != owner {
			return capabilities{}, ErrCollision
		}
		ext := c
		allowed := map[string]bool{}
		for _, ns := range options.PrimitiveNamespaces {
			allowed[ns] = true
		}
		result = capabilities{actor: a, connection: Connection{Name: name, ProviderIdentity: owner, Generation: generation}, expires: a.ValidUntil, installed: installed, bindingKey: catalogKey, resourceVersion: resourceVersion}
		for _, scope := range options.ResourceCacheScopes {
			if scope == cfg.ResourceCachePublic {
				result.publicResourceMetadata = true
				break
			}
		}
		// Namespace metadata is notification-bound unless the managing actor supplies a real deadline.
		seen := map[string]bool{}
		cursor := ""
		for page := 0; page < 100; page++ {
			listed := listedFirst
			if page > 0 {
				listed, e = call[primitive.NamespaceListResult](ctx, ext, "namespaces/list", primitive.NamespaceListRequest{Cursor: cursor, Limit: 100})
				if e != nil {
					return capabilities{}, e
				}
			}
			if listed.ProviderIdentity != "" && listed.ProviderIdentity != owner {
				return capabilities{}, ErrCollision
			}
			for _, ns := range listed.Namespaces {
				if seen[ns.Name] {
					return capabilities{}, identity.ErrResource
				}
				seen[ns.Name] = true
				if len(allowed) > 0 && !allowed[ns.Name] {
					continue
				}
				detail, e := call[primitive.NamespaceCapabilities](ctx, ext, "namespaces/get", primitive.NamespaceGetRequest{Namespace: ns.Name})
				if e != nil {
					return capabilities{}, e
				}
				if detail.ProviderIdentity != owner || detail.Namespace != ns.Name {
					return capabilities{}, ErrCollision
				}
				if detail.Description == "" {
					detail.Description = ns.Description
				}
				if len(detail.UseCases) == 0 {
					detail.UseCases = append([]string(nil), ns.UseCases...)
				}
				seenKinds := map[string]bool{}
				for _, kind := range detail.Kinds {
					if !identity.ValidResourceKind(kind.Kind) || seenKinds[kind.Kind] {
						return capabilities{}, identity.ErrResource
					}
					seenKinds[kind.Kind] = true
					for _, operation := range kind.Operations {
						method := kind.Methods[operation]
						if method == "" || configuredOwner == "" && !installed[method] {
							return capabilities{}, identity.ErrResource
						}
						if configuredOwner != "" {
							installed[method] = true
						}
					}
				}
				result.namespaces = append(result.namespaces, detail)
			}
			if listed.Complete {
				if listed.NextCursor != "" {
					return capabilities{}, identity.ErrResource
				}
				break
			}
			if listed.NextCursor == "" || listed.NextCursor == cursor || page == 99 {
				return capabilities{}, identity.ErrResource
			}
			cursor = listed.NextCursor
		}

	}
	return g.publishDiscovery(ctx, a, name, binding, key, generation, resourceVersion, force, result)
}

func (g *Gateway) publishDiscovery(ctx context.Context, a identity.VerifiedActor, name string, binding *resourceReadBinding, key string, generation uint64, resourceVersion [2]uint64, force bool, result capabilities) (capabilities, error) {
	if g.generation(name) != generation || g.Manager.ResourceCatalogGeneration(ctx, name) != resourceVersion {
		return capabilities{}, identity.ErrResourceStale
	}
	if err := g.checkReadBinding(ctx, a, binding); err != nil {
		return capabilities{}, err
	}
	if err := g.final(ctx, a); err != nil {
		return capabilities{}, err
	}
	g.mu.Lock()
	for k, v := range g.cache {
		if !identity.MetadataExpiryValid(discoveryCacheUntil(v), g.now()) {
			delete(g.cache, k)
		}
	}
	if len(g.cache) >= 128 {
		g.cache = map[string]capabilities{}
	}
	result.cacheKey = key
	g.cache[key] = result
	g.observedOwners[name] = result.connection.ProviderIdentity
	g.mu.Unlock()
	if sequence := sequenceFromContext(ctx); sequence != nil && !force {
		if err := sequence.record(name, binding.key, result); err != nil {
			return capabilities{}, err
		}
	}
	return result, nil
}

type DiscoveredNamespace struct {
	sharedIndex      bool
	indexedResources map[string]primitive.ResourceState
	Connection       Connection `json:"connection"`
	primitive.NamespaceCapabilities
}

func (g *Gateway) Discover(ctx context.Context) ([]DiscoveredNamespace, error) {
	return g.discoverExcept(ctx, "")
}

func (g *Gateway) discoverExcept(ctx context.Context, excludedLocal string) ([]DiscoveredNamespace, error) {
	a, e := g.actor(ctx)
	if e != nil {
		return nil, e
	}
	names, e := g.catalogConnectionNames(ctx)
	if e != nil {
		return nil, e
	}
	sort.Strings(names)
	out := []DiscoveredNamespace{}
	owners := map[string]string{}
	if excludedLocal != "" {
		options, err := g.Manager.Options(ctx, excludedLocal)
		if err != nil || options == nil || options.PrimitiveProviderIdentity == "" {
			return nil, ErrCollision
		}
		// Reserve the known local owner even without contacting its endpoint.
		// A different connection claiming that owner is still a collision.
		owners[options.PrimitiveProviderIdentity] = excludedLocal
	}
	for _, name := range names {
		if name == excludedLocal {
			continue
		}
		c, e := g.discover(ctx, a, name)
		if errors.Is(e, ErrUnavailable) || aggregateLinkRequired(e) {
			continue
		}
		if e != nil {
			return nil, e
		}
		if !catalogRootMatches(ctx, c.connection) {
			return nil, ErrCollision
		}
		if prior := owners[c.connection.ProviderIdentity]; prior != "" && prior != name {
			return nil, ErrCollision
		}
		owners[c.connection.ProviderIdentity] = name
		// Export detached contract maps; caller mutation must not alter the
		// manager-bound metadata reused by internal Get/action dispatch.
		exported := cloneCapabilities(c)
		for _, ns := range exported.namespaces {
			out = append(out, DiscoveredNamespace{Connection: c.connection, NamespaceCapabilities: ns, sharedIndex: c.sharedIndex, indexedResources: c.indexedResources})
		}
	}
	if e = g.final(ctx, a); e != nil {
		return nil, e
	}
	return out, nil
}

// Missing optional connector credentials do not make the aggregate catalog
// unavailable. Direct routing still returns the original typed link outcome.
// A joined failure can also contain integrity, authorization or network errors;
// it is not a pure optional-link outcome and must remain visible.
func aggregateLinkRequired(err error) bool {
	for current := err; current != nil; current = errors.Unwrap(current) {
		if _, joined := current.(interface{ Unwrap() []error }); joined {
			return false
		}
	}
	_, required := manager.LinkRequired(err)
	return required
}

func supports(c capabilities, namespace, kind, operation string) bool {
	for _, ns := range c.namespaces {
		if namespace != "" && ns.Namespace != namespace {
			continue
		}
		for _, k := range ns.Kinds {
			if k.Kind == kind {
				for _, op := range k.Operations {
					if op == operation && k.Methods[operation] != "" {
						return true
					}
				}
			}
		}
	}
	return false
}
func operationMethod(c capabilities, namespace, kind, operation string) string {
	for _, ns := range c.namespaces {
		if ns.Namespace == namespace {
			for _, k := range ns.Kinds {
				if k.Kind == kind {
					return k.Methods[operation]
				}
			}
		}
	}
	return ""
}
func plural(kind string) string { return primitive.Plural(kind) }

func (g *Gateway) List(ctx context.Context, kind, namespace string) ([]LocatedResource, error) {
	rows, err := List[json.RawMessage](ctx, g, kind, namespace)
	return untypedLocations(rows), err
}

func (g *Gateway) listExcludingLocalProvider(ctx context.Context, kind, namespace, owner string) ([]LocatedResource, error) {
	if owner == "" {
		return g.List(ctx, kind, namespace)
	}
	names, err := g.Manager.LocalProviderNames(ctx, owner)
	if err != nil {
		return nil, err
	}
	if len(names) > 1 {
		return nil, ErrCollision
	}
	excluded := ""
	if len(names) == 1 {
		excluded = names[0]
	}
	rows, err := list[json.RawMessage](ctx, g, kind, namespace, excluded)
	return untypedLocations(rows), err
}

func list[T any](ctx context.Context, g *Gateway, kind, namespace, excludedLocal string) ([]Located[T], error) {
	if !identity.ValidResourceKind(kind) {
		return nil, identity.ErrResource
	}
	a, e := g.actor(ctx)
	if e != nil {
		return nil, e
	}
	discovered, e := g.discoverExcept(ctx, excludedLocal)
	if e != nil {
		return nil, e
	}
	out := []Located[T]{}
	seen := map[string]bool{}
	for _, ns := range discovered {
		if namespace != "" && ns.Namespace != namespace {
			continue
		}
		caps := capabilities{namespaces: []primitive.NamespaceCapabilities{ns.NamespaceCapabilities}}
		if !supports(caps, ns.Namespace, kind, "list") {
			continue
		}
		if ns.sharedIndex {
			for _, resource := range ns.indexedResources {
				if resource.Kind != kind || resource.Namespace != ns.Namespace {
					continue
				}
				key := ns.Connection.ProviderIdentity + "\x00" + resource.URI
				if seen[key] {
					return nil, identity.ErrResource
				}
				seen[key] = true
				out = append(out, Located[T]{LocatedResource: LocatedResource{Connection: ns.Connection, Resource: resource}})
			}
			continue
		}
		ext, e := g.client(ctx, ns.Connection.Name)
		if e != nil {
			return nil, e
		}
		cursor := ""
		for page := 0; page < 100; page++ {
			raw, e := toolRaw(ctx, ext, operationMethod(caps, ns.Namespace, kind, "list"), primitive.ListRequest{Namespace: ns.Namespace, Cursor: cursor, Limit: 100})
			if e != nil {
				return nil, e
			}
			listed, e := primitive.DecodeList(raw, kind)
			if e != nil {
				return nil, e
			}
			for _, entry := range listed.Resources {
				uri, e := identity.ParseResourceURI(entry.URI)
				key := ns.Connection.ProviderIdentity + "\x00" + entry.URI
				if e != nil || uri.Kind != kind || uri.Namespace != ns.Namespace || entry.Kind != kind || entry.Namespace != uri.Namespace || entry.Name != uri.Name || seen[key] {
					return nil, identity.ErrResource
				}
				seen[key] = true
				definition, err := decodeDefinition[T](entry.Definition)
				if err != nil {
					return nil, err
				}
				out = append(out, Located[T]{LocatedResource: LocatedResource{Connection: ns.Connection, Resource: *entry}, Definition: definition})
			}
			complete, next := listed.Complete, listed.NextCursor
			if complete {
				if next != "" {
					return nil, identity.ErrResource
				}
				break
			}
			if next == "" || next == cursor || page == 99 {
				return nil, identity.ErrResource
			}
			cursor = next
		}
		if g.generation(ns.Connection.Name) != ns.Connection.Generation {
			return nil, identity.ErrResourceStale
		}
	}
	if e = g.final(ctx, a); e != nil {
		return nil, e
	}
	return out, nil
}

// Get reuses an exact provider locator. Passing a pin prevents default/current
// reselection; both provider drift and definition-byte drift fail closed.
func (g *Gateway) Get(ctx context.Context, connection Connection, ref identity.ResourceRef, pin *identity.ResolvedResource) (*primitive.GetResult, error) {
	result, err := get[json.RawMessage](ctx, g, connection, ref, pin, false, false)
	if err != nil {
		return nil, err
	}
	return &result.GetResult, nil
}

func get[T any](ctx context.Context, g *Gateway, connection Connection, ref identity.ResourceRef, pin *identity.ResolvedResource, force, menuRead bool, decoders ...DefinitionDecoder[T]) (out *Result[T], err error) {
	// A failed read is part of this operation's provenance. Restoring authority
	// later cannot revive its original selected metadata or release cached rows.
	defer func() { poisonReadSequence(ctx, err) }()
	var scopeErr error
	ctx, scopeErr = ReadContext(ctx)
	if scopeErr != nil {
		return nil, scopeErr
	}
	uri, e := identity.ParseResourceURI(ref.URI)
	if e != nil {
		return nil, identity.ErrResource
	}
	a, e := g.actor(ctx)
	if e != nil {
		return nil, e
	}
	binding, e := g.resolveReadBinding(ctx, a, connection.Name)
	if e != nil {
		return nil, e
	}
	c, e := g.discover(ctx, a, connection.Name, binding)
	if e != nil {
		return nil, e
	}
	if c.connection != connection || !supports(c, uri.Namespace, uri.Kind, "get") {
		return nil, identity.ErrResourceDenied
	}
	if pin != nil {
		if pin.URI != ref.URI || pin.ProviderIdentity != connection.ProviderIdentity || !identity.MetadataExpiryValid(pin.ValidUntil, g.now()) || !pin.ResourceCandidate.Valid() {
			return nil, identity.ErrResourceDenied
		}
		ref.Revision = pin.Selector()
	}
	ext := binding.client
	var result primitive.GetResult
	var cacheReference *definitionCacheReference
	found := false
	if sequence := sequenceFromContext(ctx); sequence != nil && !force {
		result, found, e = sequence.reportRead(connection, pin, binding.key)
		if e == nil && !found {
			result, found, e = sequence.selectedRead(ctx, connection, pin, binding.key)
		}
	}
	if e == nil {
		e = g.checkReadBinding(ctx, a, binding)
	}
	if e == nil && !found {
		if c.standardResources {
			// A standard resource read has no provider revision receipt or cache lease.
			// Keep the owning MCP authoritative on each selected read.
			result, e = standardDefinitionGet(ctx, ext, c, ref)
		} else {
			result, cacheReference, e = g.cachedDefinitionGet(ctx, a, binding, c, uri, ref, func(ctx context.Context) (primitive.GetResult, error) {
				if c.sharedIndex {
					return indexedDefinitionGet(ctx, ext, c, ref)
				}
				return call[primitive.GetResult](ctx, ext, operationMethod(c, uri.Namespace, uri.Kind, "get"), primitive.GetRequest{URI: ref.URI, Revision: ref.Revision})
			})
		}
	}
	if e != nil {
		return nil, e
	}
	if result.Resource == nil || result.ResolvedResource == nil {
		return nil, identity.ErrResourceDenied
	}
	actual := result.ResolvedResource
	if uri.Kind == "navigation" && !c.sharedIndex {
		if !menuRead || result.MenuProjection == nil || result.MenuProjection.SchemaVersion != 1 || result.Resource.FormatVersion != 1 || result.Resource.Lifecycle != actual.Kind || !declaresMenuFormat(c, uri.Namespace) || len(result.Resource.Definition) != 0 || len(result.Resource.DefinitionBytes) != 0 || ValidateMenu(1, result.MenuProjection.DefinitionBytes) != nil || identity.ContentFingerprint(result.MenuProjection.DefinitionBytes) != result.MenuProjection.ContentFingerprint {
			return nil, identity.ErrResourceDenied
		}
	} else if result.MenuProjection != nil {
		return nil, identity.ErrResourceDenied
	}
	if len(result.Resource.DefinitionBytes) > 0 {
		if identity.ContentFingerprint(result.Resource.DefinitionBytes) != actual.ContentFingerprint {
			return nil, identity.ErrResourceDenied
		}
		if len(result.Resource.Definition) > 0 && !bytes.Equal(result.Resource.Definition, result.Resource.DefinitionBytes) {
			left, leftErr := semanticJSON(result.Resource.Definition)
			right, rightErr := semanticJSON(result.Resource.DefinitionBytes)
			if leftErr != nil || rightErr != nil || !reflect.DeepEqual(left, right) {
				return nil, identity.ErrResourceDenied
			}
		}
		result.Resource.Definition = append(json.RawMessage(nil), result.Resource.DefinitionBytes...)
	}
	if actual.ProviderIdentity != connection.ProviderIdentity || actual.URI != ref.URI || !actual.ResourceCandidate.Valid() || !identity.MetadataExpiryValid(actual.ValidUntil, g.now()) || (!c.sharedIndex && actual.AuthorityBinding == "") || result.Resource.URI != ref.URI || result.Resource.ContentFingerprint != actual.ContentFingerprint || (uri.Kind != "navigation" && identity.ContentFingerprint(result.Resource.Definition) != actual.ContentFingerprint) {
		return nil, identity.ErrResourceDenied
	}
	if result.Resource.Kind != "" && result.Resource.Kind != uri.Kind || result.Resource.Namespace != "" && result.Resource.Namespace != uri.Namespace || result.Resource.Name != "" && result.Resource.Name != uri.Name || result.Resource.Revision != "" && result.Resource.Revision != actual.Selector() {
		return nil, identity.ErrResourceDenied
	}
	result.Resource.Kind, result.Resource.Namespace, result.Resource.Name = uri.Kind, uri.Namespace, uri.Name
	if ref.Revision != "" && actual.Selector() != ref.Revision {
		return nil, identity.ErrResourceDenied
	}
	if pin != nil {
		if actual.ResourceCandidate != pin.ResourceCandidate || actual.AuthorityBinding != pin.AuthorityBinding {
			return nil, identity.ErrResourceDenied
		}
		actual.ValidUntil = identity.MinimumMetadataExpiry(actual.ValidUntil, pin.ValidUntil)
	}
	if !c.sharedIndex {
		actual.ValidUntil = identity.MinimumMetadataExpiry(actual.ValidUntil, a.ValidUntil)
	}
	if sequence := sequenceFromContext(ctx); sequence != nil {
		sequence.constrainLease(actual.ValidUntil)
	}
	if g.generation(connection.Name) != connection.Generation {
		return nil, identity.ErrResourceStale
	}
	if e = g.checkReadBinding(ctx, a, binding); e != nil {
		return nil, e
	}
	if e = g.final(ctx, a); e != nil {
		return nil, e
	}
	if !identity.MetadataExpiryValid(actual.ValidUntil, g.now()) {
		return nil, identity.ErrResourceDenied
	}
	if sequence := sequenceFromContext(ctx); sequence != nil && !force && !found {
		if err := sequence.recordSelectedRead(ctx, connection, pin, &result, binding.key); err != nil {
			return nil, err
		}
	}
	raw := result.Resource.Definition
	if result.MenuProjection != nil {
		raw = result.MenuProjection.DefinitionBytes
	}
	var definition T
	if len(decoders) > 1 {
		return nil, identity.ErrResource
	}
	decodeTiming := observe.Start(ctx, observe.GatewayDefinitionDecode, observe.Labels{})
	if len(decoders) == 1 {
		if decoders[0] == nil {
			return nil, identity.ErrResource
		}
		definition, err = decoders[0](raw)
	} else {
		definition, err = decodeDefinition[T](raw)
	}
	decodeTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, err
	}
	// A host decoder may take time or consult request state. Typed delivery
	// retains the same final actor and lease checks as raw delivery.
	if g.generation(connection.Name) != connection.Generation {
		return nil, identity.ErrResourceStale
	}
	if e = g.final(ctx, a); e != nil {
		return nil, e
	}
	if !identity.MetadataExpiryValid(actual.ValidUntil, g.now()) {
		return nil, identity.ErrResourceDenied
	}
	return &Result[T]{GetResult: result, Definition: definition, definitionCache: cacheReference}, nil
}
func semanticJSON(raw []byte) (any, error) {
	if !json.Valid(raw) {
		return nil, identity.ErrResource
	}
	var value any
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.UseNumber()
	if e := decoder.Decode(&value); e != nil {
		return nil, e
	}
	return value, nil
}

// ResolveLocator refuses ambiguous URI owners. Explicit selection is required
// for overlapping namespaces; a connection is never chosen by sort order.
func ResolveLocator(resources []LocatedResource, uri, provider string) (Connection, error) {
	var result Connection
	for _, r := range resources {
		if r.Resource.URI == uri && (provider == "" || r.Connection.ProviderIdentity == provider) {
			if result.Name != "" && result != r.Connection {
				return Connection{}, ErrCollision
			}
			result = r.Connection
		}
	}
	if result.Name == "" {
		return result, fmt.Errorf("%w: resource owner", ErrUnavailable)
	}
	return result, nil
}
