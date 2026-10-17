// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"sort"
	"strings"
)

type ReportResourceSummary struct {
	URI           string
	Namespace     string
	Name          string
	Title         string
	Description   string
	OwnerID       string
	BuilderRef    string
	BuilderWindow string
	ReportID      string
}
type ReportResourceOptions struct {
	Options registry.Options
	// DefaultNamespace is explicit host configuration for unmigrated assets.
	// Migrated definitions declare resourceUri/namespace/name themselves.
	DefaultNamespace string
	BuilderWindows   map[string]string
	// DataSources returns trusted complete declarative descriptor bytes. The
	// envelope fingerprints them; credentials must never be put in descriptors.
	DataSources func(context.Context, *registry.Asset) (map[string]json.RawMessage, error)
}
type ReportResourceSource struct{ options ReportResourceOptions }

func NewReportResourceSource(options ReportResourceOptions) (*ReportResourceSource, error) {
	if options.Options.WorkspaceRoot == "" {
		return nil, fmt.Errorf("report workspace root required")
	}
	if options.DefaultNamespace != "" {
		if _, err := identity.ParseResourceURI("report://" + options.DefaultNamespace + "/validation"); err != nil {
			return nil, err
		}
	}
	return &ReportResourceSource{options: options}, nil
}
func (s *ReportResourceSource) inventory(ctx context.Context) (*registry.Registry, map[string]*registry.Asset, error) {
	if s == nil {
		return nil, nil, identity.ErrResourceDenied
	}
	definitions, err := registry.Discover(ctx, s.options.Options)
	if err != nil {
		return nil, nil, err
	}
	result := map[string]*registry.Asset{}
	for _, asset := range definitions.Reports {
		namespace := asset.Namespace
		if namespace == "" {
			namespace = s.options.DefaultNamespace
		}
		name := asset.Name
		if name == "" {
			name = asset.ID
		}
		ref := asset.ResourceURI
		if ref == "" {
			ref = "report://" + namespace + "/" + name
		}
		uri, err := identity.ParseResourceURI(ref)
		if err != nil || uri.Kind != "report" || asset.Namespace != "" && asset.Namespace != uri.Namespace || asset.Name != "" && asset.Name != uri.Name {
			return nil, nil, fmt.Errorf("invalid report resource identity for %s", asset.ID)
		}
		if result[ref] != nil {
			return nil, nil, fmt.Errorf("report namespace/name conflict: %s", ref)
		}
		asset.ResourceURI, asset.Namespace, asset.Name = ref, uri.Namespace, uri.Name
		result[ref] = asset
	}
	return definitions, result, nil
}
func (s *ReportResourceSource) List(ctx context.Context) ([]ReportResourceSummary, error) {
	_, assets, err := s.inventory(ctx)
	if err != nil {
		return nil, err
	}
	result := []ReportResourceSummary{}
	for uri, asset := range assets {
		result = append(result, ReportResourceSummary{URI: uri, Namespace: asset.Namespace, Name: asset.Name, Title: asset.Label, Description: asset.Description, OwnerID: asset.OwnerID, BuilderRef: asset.BuilderRef, BuilderWindow: s.options.BuilderWindows[asset.BuilderRef], ReportID: uri})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].URI < result[j].URI })
	return result, nil
}
func (s *ReportResourceSource) load(ctx context.Context, uri identity.ResourceURI) (json.RawMessage, error) {
	definitions, assets, err := s.inventory(ctx)
	if err != nil {
		return nil, err
	}
	asset := assets[uri.String()]
	if asset == nil {
		return nil, identity.ErrResourceDenied
	}
	builder := definitions.Builder(asset.BuilderRef)
	if builder == nil {
		return nil, fmt.Errorf("report builder dependency unavailable")
	}
	builderRaw, err := json.Marshal(builder.Raw)
	if err != nil {
		return nil, err
	}
	authoredRaw, err := json.Marshal(asset.Raw)
	if err != nil {
		return nil, err
	}
	builderConfig := mapValue(builder.Raw["reportBuilder"])
	base := mapValue(builderConfig["document"])
	if len(base) == 0 {
		base = mapValue(builderConfig["reportDocument"])
	}
	// Registry discovery has already expanded authored fragment references.
	document := mapValue(asset.Raw["document"])
	if len(document) == 0 {
		document = mergeReportMap(base, mapValue(asset.Raw["documentPatch"]))
	}
	if len(document) == 0 {
		return nil, fmt.Errorf("report document is required")
	}
	if stringValue(document["title"]) == "" {
		document = cloneMap(document)
		document["title"] = asset.Label
	}
	state := mergeReportMap(mapValue(builderConfig["state"]), mapValue(asset.Raw["statePatch"]))
	if len(state) == 0 {
		state = map[string]any{}
	}
	documentRaw, err := json.Marshal(document)
	if err != nil {
		return nil, err
	}
	stateRaw, err := json.Marshal(state)
	if err != nil {
		return nil, err
	}
	dependencies := []registry.ReportDependency{{Kind: "report", ID: asset.ResourceURI, ContentFingerprint: identity.ContentFingerprint(authoredRaw)}, {Kind: "builder", ID: builder.ID, ContentFingerprint: identity.ContentFingerprint(builderRaw)}}
	envelope := registry.ReportEnvelope{SchemaVersion: 1, Format: registry.AuthoredReportFormat, ReportDocument: documentRaw, BuilderRef: builder.ID, BuilderDefinition: builderRaw, State: stateRaw, Dependencies: dependencies}
	if metadata, exists := asset.Raw["metadata"]; exists {
		envelope.Metadata, err = json.Marshal(metadata)
		if err != nil {
			return nil, err
		}
	}
	if s.options.DataSources != nil {
		sources, err := s.options.DataSources(ctx, builder)
		if err != nil {
			return nil, err
		}
		envelope.DataSources = make(map[string]json.RawMessage, len(sources))
		ids := make([]string, 0, len(sources))
		for id := range sources {
			ids = append(ids, id)
		}
		sort.Strings(ids)
		for _, id := range ids {
			// Native MCP maps and YAML imports reorder object keys. Emit canonical
			// descriptor bytes before hashing so portable reports retain exact pins.
			descriptor, err := types.CanonicalWindowDescriptor(sources[id])
			if err != nil {
				return nil, fmt.Errorf("report datasource descriptor invalid: %w", err)
			}
			envelope.DataSources[id] = descriptor
			envelope.Dependencies = append(envelope.Dependencies, registry.ReportDependency{Kind: "datasource", ID: id, ContentFingerprint: identity.ContentFingerprint(descriptor)})
		}
	}
	return json.Marshal(envelope)
}
func mergeReportMap(base, patch map[string]any) map[string]any {
	result := cloneMap(base)
	if result == nil {
		result = map[string]any{}
	}
	for key, value := range patch {
		nested := mapValue(value)
		if nested != nil {
			result[key] = mergeReportMap(mapValue(result[key]), nested)
		} else {
			result[key] = cloneValue(value)
		}
	}
	return result
}
func (s *ReportResourceSource) Candidates(ctx context.Context, uri identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	raw, err := s.load(ctx, uri)
	if err != nil {
		return nil, err
	}
	return []identity.ResourceCandidate{{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(raw)}}, nil
}
func (s *ReportResourceSource) ReadCandidate(ctx context.Context, uri identity.ResourceURI, c identity.ResourceCandidate) (json.RawMessage, error) {
	if !c.Valid() || c.Kind != identity.WorkingCandidate {
		return nil, identity.ErrResourceDenied
	}
	return s.load(ctx, uri)
}

// Materialize returns the exact complete trusted envelope bytes used for a
// mutable candidate. Importers persist these bytes directly as a draft.
func (s *ReportResourceSource) Materialize(ctx context.Context, uriText string) (json.RawMessage, error) {
	uri, err := identity.ParseResourceURI(uriText)
	if err != nil || uri.Kind != "report" {
		return nil, identity.ErrResourceDenied
	}
	return s.load(ctx, uri)
}

func cloneMap(value map[string]any) map[string]any {
	result := make(map[string]any, len(value))
	for key, item := range value {
		result[key] = cloneValue(item)
	}
	return result
}

func cloneValue(value any) any {
	switch actual := value.(type) {
	case []any:
		result := make([]any, len(actual))
		for index, item := range actual {
			result[index] = cloneValue(item)
		}
		return result
	case map[string]any:
		return cloneMap(actual)
	default:
		return actual
	}
}

func mapValue(value any) map[string]any { result, _ := value.(map[string]any); return result }
func stringValue(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}
