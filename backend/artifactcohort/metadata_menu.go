package artifactcohort

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
)

type preparedMenus struct {
	roots   []RootRef
	visible map[string]*primitive.MenuProjection
	sources map[string]RootRef
	dynamic map[string]RootRef
}

// preparedNavigation caches static visibility and source-backed root identities
// once per local admitted selection. It never resolves source-backed data.
func (s *MetadataSource) preparedNavigation(ctx context.Context) (*preparedMenus, error) {
	key, err := s.AdmissionKey(ctx)
	if err != nil {
		return nil, err
	}
	s.menuMu.Lock()
	defer s.menuMu.Unlock()
	if cached := s.menus[s.menuBindings[key]]; cached != nil {
		current, err := s.AdmissionKey(ctx)
		if err != nil {
			return nil, err
		}
		if current != key {
			return nil, ErrUnavailable
		}
		return cached, nil
	}
	roots, err := s.replica.PermittedRoots(ctx)
	if err != nil {
		return nil, err
	}
	// PermittedRoots is canonically ordered and includes exact available source
	// pins. Content reuse is independent of actor/session authority. Only a new
	// security binding enumerates/hashes roots; warm reads use the binding map.
	rawRoots, err := json.Marshal(roots)
	if err != nil {
		return nil, err
	}
	contentKey := Hash(rawRoots)
	if cached := s.menus[contentKey]; cached != nil {
		current, err := s.AdmissionKey(ctx)
		if err != nil {
			return nil, err
		}
		if current != key {
			return nil, ErrUnavailable
		}
		if len(s.menuBindings) >= 128 {
			s.menuBindings = map[string]string{}
		}
		s.menuBindings[key] = contentKey
		return cached, nil
	}
	prepared := &preparedMenus{roots: roots, visible: map[string]*primitive.MenuProjection{}, sources: map[string]RootRef{}, dynamic: map[string]RootRef{}}
	permitted := make(map[string]bool, len(roots))
	for _, root := range roots {
		permitted[root.URI] = true
	}
	for _, root := range roots {
		if root.Kind != "navigation" {
			continue
		}
		view, err := s.replica.Open(ctx, root.URI)
		if err != nil {
			return nil, err
		}
		if view.Ref() != root {
			return nil, ErrUnavailable
		}
		// A source-backed definition is immutable configuration, but its rows are
		// request-scoped origin data. Discovery advertises it without execution.
		var envelope struct {
			Source json.RawMessage `json:"source"`
		}
		if err := json.Unmarshal(view.Payload(), &envelope); err != nil {
			return nil, err
		}
		if len(envelope.Source) != 0 {
			prepared.dynamic[root.URI] = root
			continue
		}
		projection, err := producer.ProjectMenuTargets(ctx, view.Payload(), permitted)
		if err != nil {
			return nil, fmt.Errorf("navigation %s: %w", root.URI, err)
		}
		if projection != nil {
			prepared.visible[root.URI] = projection
			prepared.sources[root.URI] = root
		}
	}
	current, err := s.AdmissionKey(ctx)
	if err != nil {
		return nil, err
	}
	if key != current {
		return nil, ErrUnavailable
	}
	// Bounded derived cache. Immutable source artifacts remain in their own store.
	if len(s.menus) >= 128 {
		s.menus = map[string]*preparedMenus{}
		s.menuBindings = map[string]string{}
	}
	if len(s.menuBindings) >= 128 {
		s.menuBindings = map[string]string{}
	}
	s.menus[contentKey] = prepared
	s.menuBindings[key] = contentKey
	return prepared, nil
}

// GetMenu returns source identity separately from prepared visible bytes.
// Ordinary Get deliberately cannot expose unprojected navigation.
func (s *MetadataSource) GetMenu(ctx context.Context, uriText string) (*primitive.GetResult, error) {
	return s.GetMenuWithParameters(ctx, uriText, nil)
}

// GetMenuWithParameters resolves source-backed menus at their configured origin
// on every pull. Parameters and the authenticated request context are transient;
// neither rows nor their projections enter the immutable artifact cache.
func (s *MetadataSource) GetMenuWithParameters(ctx context.Context, uriText string, parameters map[string]any) (result *primitive.GetResult, failure error) {
	defer func() { failure = metadataAdmissionError(failure) }()
	uri, err := identity.ParseResourceURI(uriText)
	if err != nil || uri.Kind != "navigation" || !s.claims(uri.Namespace) {
		return nil, ErrDenied
	}
	key, err := s.AdmissionKey(ctx)
	if err != nil {
		return nil, err
	}
	prepared, err := s.preparedNavigation(ctx)
	if err != nil {
		return nil, err
	}
	if ref, ok := prepared.dynamic[uriText]; ok {
		resolver, ok := s.replica.cfg.Caller.(MenuResolver)
		if !ok {
			return nil, ErrUnsupported
		}
		resolved, err := resolver.ResolveMenu(ctx, ref, parameters)
		if err != nil {
			return nil, err
		}
		if err := validateResolvedMenu(ref, resolved); err != nil {
			return nil, err
		}
		current, err := s.AdmissionKey(ctx)
		if err != nil {
			return nil, err
		}
		if current != key {
			return nil, ErrUnavailable
		}
		// Do not expose runtime execution provenance or unprojected definitions.
		resource := &primitive.ResourceState{URI: uriText, Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, Title: resolved.Resource.Title, Lifecycle: identity.PublishedCandidate, FormatVersion: 1, ContentFingerprint: ref.Hash}
		projection := *resolved.MenuProjection
		projection.DefinitionBytes = bytes.Clone(projection.DefinitionBytes)
		return &primitive.GetResult{Resource: resource, MenuProjection: &projection}, nil
	}
	projection := prepared.visible[uriText]
	if projection == nil {
		return nil, ErrDenied
	}
	copy := *projection
	copy.DefinitionBytes = bytes.Clone(projection.DefinitionBytes)
	ref := prepared.sources[uriText]
	return &primitive.GetResult{
		Resource:       &primitive.ResourceState{URI: uriText, Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, Title: uri.Name, Lifecycle: identity.PublishedCandidate, FormatVersion: 1, ContentFingerprint: ref.Hash},
		MenuProjection: &copy,
	}, nil
}
