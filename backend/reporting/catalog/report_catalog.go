// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package catalog

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/viant/forge/backend/reporting/registry"
	"sort"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	identity "github.com/viant/forge/backend/resource"
)

// ReportCatalogCandidate is trusted inventory metadata, never an authorization
// result. An inventory's storage/provenance cannot grant describe or execution.
type ReportCatalogCandidate struct {
	URI           string   `json:"resourceUri"`
	Title         string   `json:"title"`
	Description   string   `json:"description,omitempty"`
	OwnerID       string   `json:"ownerId,omitempty"`
	BuilderRef    string   `json:"builderRef,omitempty"`
	BuilderWindow string   `json:"builderWindow,omitempty"`
	ReportID      string   `json:"reportId,omitempty"`
	ArtifactID    string   `json:"artifactId,omitempty"`
	OrderIDs      []string `json:"orderIds,omitempty"`
	ReportType    string   `json:"reportType,omitempty"`
	CreatedAt     string   `json:"createdAt,omitempty"`
	UpdatedAt     string   `json:"updatedAt,omitempty"`
}
type ReportCapabilities struct {
	Open      bool `json:"open"`
	Run       bool `json:"run"`
	Edit      bool `json:"edit"`
	Duplicate bool `json:"duplicate"`
	Rename    bool `json:"rename"`
	Export    bool `json:"export"`
	Delete    bool `json:"delete"`
	RunRange  bool `json:"runRange"`
	// Host support for forwarding declared chart choices through run and export.
	// This is not an additional data-access permission and defaults to false.
	ChartMetricSelection bool `json:"chartMetricSelection,omitempty"`
}
type ReportCatalogEntry struct {
	ReportCatalogCandidate
	Namespace          string                     `json:"namespace"`
	Name               string                     `json:"name"`
	OwnedByCurrentUser bool                       `json:"ownedByCurrentUser"`
	Resource           *identity.ResolvedResource `json:"resource"`
	Capabilities       ReportCapabilities         `json:"capabilities"`
}
type ReportCatalogQuery struct {
	Namespace       string `json:"namespace,omitempty"`
	ResourceURI     string `json:"resourceUri,omitempty"`
	CurrentUserOnly bool   `json:"currentUserOnly,omitempty"`
	Cursor          string `json:"cursor,omitempty"`
	Limit           int    `json:"limit,omitempty"`
}
type ReportCatalogResult struct {
	Reports    []ReportCatalogEntry `json:"reports"`
	NextCursor string               `json:"nextCursor,omitempty"`
}
type ReportInventory interface {
	ListReportResources(context.Context, identity.VerifiedActor) ([]ReportCatalogCandidate, error)
}
type ReportInventoryFunc func(context.Context, identity.VerifiedActor) ([]ReportCatalogCandidate, error)

func (f ReportInventoryFunc) ListReportResources(ctx context.Context, actor identity.VerifiedActor) ([]ReportCatalogCandidate, error) {
	return f(ctx, actor)
}

// ReportCatalogService is one metadata path for authored and stored reports.
// Identity and inventories are trusted host bindings. Capabilities must be
// resolved from current action policy; metadata visibility grants no actions.
type ReportCatalogService struct {
	BeginMetadataRead func(context.Context) (context.Context, func() error, error)
	BuilderWindows    map[string]string
	Identity          func(context.Context) (identity.VerifiedActor, error)
	Resolver          func(context.Context) (*identity.ResourceResolver, error)
	Inventories       []ReportInventory
	Capabilities      func(context.Context, identity.VerifiedActor, ReportCatalogCandidate, identity.ResolvedResource) (ReportCapabilities, error)
}

func (s *ReportCatalogService) List(ctx context.Context, input ReportCatalogQuery) (out *ReportCatalogResult, resultErr error) {
	if ctx == nil || ctx.Err() != nil {
		return nil, identity.ErrResourceDenied
	}
	if s != nil && s.BeginMetadataRead != nil {
		scoped, finish, err := s.BeginMetadataRead(ctx)
		if err != nil {
			return nil, err
		}
		if scoped == nil || finish == nil {
			return nil, identity.ErrResourceDenied
		}
		ctx = scoped
		defer func() {
			if err := finish(); err != nil {
				out = nil
				resultErr = err
			}
		}()
	}
	return s.list(ctx, input)
}
func (s *ReportCatalogService) list(ctx context.Context, input ReportCatalogQuery) (*ReportCatalogResult, error) {
	if s == nil || s.Identity == nil || s.Resolver == nil || len(s.Inventories) == 0 || ctx == nil || ctx.Err() != nil || input.Limit < 0 || input.Limit > 1000 {
		return nil, identity.ErrResourceDenied
	}
	if input.ResourceURI != "" {
		uri, err := identity.ParseResourceURI(input.ResourceURI)
		if err != nil || uri.Kind != "report" || input.Namespace != "" && input.Namespace != uri.Namespace || input.Cursor != "" {
			return nil, identity.ErrResource
		}
	}
	actor, err := s.Identity(ctx)
	if err != nil || !actor.Valid(time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	resolver, err := s.Resolver(ctx)
	if err != nil || resolver == nil {
		return nil, identity.ErrResourceDenied
	}
	var after string
	if input.Cursor != "" {
		raw, err := base64.RawURLEncoding.DecodeString(input.Cursor)
		if err != nil {
			return nil, identity.ErrResource
		}
		after = string(raw)
		uri, err := identity.ParseResourceURI(after)
		if err != nil || uri.Kind != "report" || base64.RawURLEncoding.EncodeToString(raw) != input.Cursor {
			return nil, identity.ErrResource
		}
	}
	candidates := []ReportCatalogCandidate{}
	seen := map[string]bool{}
	for _, inventory := range s.Inventories {
		if inventory == nil {
			return nil, identity.ErrResourceDenied
		}
		entries, err := inventory.ListReportResources(ctx, actor)
		if err != nil {
			return nil, err
		}
		for _, entry := range entries {
			uri, err := identity.ParseResourceURI(entry.URI)
			if err != nil || uri.Kind != "report" || strings.TrimSpace(entry.Title) == "" || seen[entry.URI] {
				return nil, fmt.Errorf("invalid or conflicting report catalog identity")
			}
			seen[entry.URI] = true
			if input.Namespace != "" && input.Namespace != uri.Namespace || input.ResourceURI != "" && entry.URI != input.ResourceURI || entry.URI <= after || input.CurrentUserOnly && entry.OwnerID != actor.Subject {
				continue
			}
			candidates = append(candidates, entry)
		}
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].URI < candidates[j].URI })
	result := &ReportCatalogResult{Reports: []ReportCatalogEntry{}}
	limit := input.Limit
	if limit == 0 {
		limit = 1000
	}
	resolveCandidate := func(ctx context.Context, candidate ReportCatalogCandidate) (*ReportCatalogEntry, error) {
		pin, err := resolver.Resolve(ctx, identity.ResourceRef{URI: candidate.URI})
		if errors.Is(err, identity.ErrResourceDenied) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		// Exact bytes and the same authority bind metadata/get/run paths.
		raw, refreshed, readErr := resolver.ReadResolved(ctx, *pin)
		pin = refreshed
		err = readErr
		if err != nil {
			return nil, err
		}
		var envelope registry.ReportEnvelope
		if json.Unmarshal(raw, &envelope) != nil {
			return nil, identity.ErrResource
		}
		if envelope.BuilderRef != "" {
			if candidate.BuilderRef != envelope.BuilderRef {
				candidate.BuilderWindow = ""
			}
			candidate.BuilderRef = envelope.BuilderRef
			if len(s.BuilderWindows) > 0 {
				candidate.BuilderWindow = s.BuilderWindows[envelope.BuilderRef]
				if candidate.BuilderWindow == "" {
					return nil, identity.ErrResource
				}
			}
		}
		candidate.ReportID = pin.URI
		capabilities := ReportCapabilities{}
		if s.Capabilities != nil {
			capabilities, err = s.Capabilities(ctx, actor, candidate, *pin)
			if err != nil {
				return nil, err
			}
		}
		uri, _ := identity.ParseResourceURI(candidate.URI)
		entry := &ReportCatalogEntry{ReportCatalogCandidate: candidate, Namespace: uri.Namespace, Name: uri.Name, OwnedByCurrentUser: candidate.OwnerID != "" && candidate.OwnerID == actor.Subject, Resource: pin, Capabilities: capabilities}
		return entry, nil
	}
	for start := 0; start < len(candidates) && len(result.Reports) <= limit; {
		// Never start candidates beyond the page's remaining lookahead. A
		// failure there must not fail a page the serial reader already completed.
		batchSize := min(8, limit+1-len(result.Reports))
		end := start + batchSize
		if end > len(candidates) {
			end = len(candidates)
		}
		batch := make([]*ReportCatalogEntry, end-start)
		group, groupCtx := errgroup.WithContext(ctx)
		for index := start; index < end; index++ {
			index := index
			group.Go(func() error {
				entry, err := resolveCandidate(groupCtx, candidates[index])
				batch[index-start] = entry
				return err
			})
		}
		if err := group.Wait(); err != nil {
			return nil, err
		}
		for _, entry := range batch {
			if entry == nil {
				continue
			}
			result.Reports = append(result.Reports, *entry)
			if len(result.Reports) > limit {
				result.Reports = result.Reports[:limit]
				result.NextCursor = base64.RawURLEncoding.EncodeToString([]byte(result.Reports[limit-1].URI))
				break
			}
		}
		if result.NextCursor != "" {
			break
		}
		start = end
	}
	fresh, err := s.Identity(ctx)
	if err != nil || !fresh.Valid(time.Now()) || fresh.Subject != actor.Subject || fresh.Issuer != actor.Issuer || fresh.TenantID != actor.TenantID || fresh.AccountID != actor.AccountID || fresh.IdentityRevision != actor.IdentityRevision {
		return nil, identity.ErrResourceDenied
	}
	return result, nil
}

// Read returns the exact envelope and pin. A supplied opened pin is rechecked
// without choosing a newer working copy; explicit requested stamps are checked.
func (s *ReportCatalogService) Read(ctx context.Context, ref identity.ResourceRef, pinned *identity.ResolvedResource) ([]byte, *identity.ResolvedResource, error) {
	if s == nil || s.Identity == nil || s.Resolver == nil || ctx == nil {
		return nil, nil, identity.ErrResourceDenied
	}
	actor, err := s.Identity(ctx)
	if err != nil || !actor.Valid(time.Now()) {
		return nil, nil, identity.ErrResourceDenied
	}
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil || uri.Kind != "report" {
		return nil, nil, identity.ErrResource
	}
	resolver, err := s.Resolver(ctx)
	if err != nil || resolver == nil {
		return nil, nil, identity.ErrResourceDenied
	}
	pin := pinned
	if pin == nil {
		pin, err = resolver.Resolve(ctx, ref)
		if err != nil {
			return nil, nil, err
		}
	}
	if pin.URI != ref.URI || ref.Revision != "" && pin.Selector() != ref.Revision {
		return nil, nil, identity.ErrResourceDenied
	}
	raw, fresh, err := resolver.ReadResolved(ctx, *pin)
	if err != nil {
		return nil, nil, err
	}
	current, err := s.Identity(ctx)
	if err != nil || current.Subject != actor.Subject || current.AccountID != actor.AccountID || current.TenantID != actor.TenantID || current.Issuer != actor.Issuer || current.IdentityRevision != actor.IdentityRevision || !current.Valid(time.Now()) {
		return nil, nil, identity.ErrResourceDenied
	}
	return raw, fresh, nil
}
