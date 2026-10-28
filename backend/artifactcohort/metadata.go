package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"sort"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

// MetadataSource projects only the locally admitted, producer-closed artifacts.
// The immutable payload is authoritative; no revision is selected or retrieved
// here. All methods are local and errors never initiate synchronization.
type MetadataSource struct {
	replica    *Replica
	namespaces []string
}

func NewMetadataSource(replica *Replica, namespaces []string) (*MetadataSource, error) {
	if replica == nil || !replica.Enabled() || len(namespaces) == 0 {
		return nil, ErrInvalid
	}
	seen := map[string]bool{}
	for _, namespace := range namespaces {
		if !(identity.ResourceURI{Kind: "window", Namespace: namespace, Name: "probe"}).Valid() || seen[namespace] {
			return nil, ErrInvalid
		}
		seen[namespace] = true
	}
	return &MetadataSource{replica: replica, namespaces: append([]string(nil), namespaces...)}, nil
}
func (s *MetadataSource) claims(namespace string) bool {
	for _, name := range s.namespaces {
		if name == namespace {
			return true
		}
	}
	return false
}
func (s *MetadataSource) roots(ctx context.Context) ([]RootRef, error) {
	if err := s.replica.EnsureAdmitted(ctx); err != nil {
		return nil, err
	}
	return s.replica.PermittedRoots(ctx)
}
func (s *MetadataSource) Namespaces(ctx context.Context) (result []primitive.NamespaceCapabilities, failure error) {
	defer func() { failure = metadataAdmissionError(failure) }()
	roots, err := s.roots(ctx)
	if err != nil {
		return nil, err
	}
	kinds := map[string]map[string]bool{}
	for _, namespace := range s.namespaces {
		kinds[namespace] = map[string]bool{}
	}
	for _, root := range roots {
		uri, err := identity.ParseResourceURI(root.URI)
		if err != nil || !s.claims(uri.Namespace) {
			return nil, ErrInvalid
		}
		kinds[uri.Namespace][root.Kind] = true
	}
	result = make([]primitive.NamespaceCapabilities, 0, len(s.namespaces))
	for _, namespace := range s.namespaces {
		capability := primitive.NamespaceCapabilities{ProviderIdentity: s.replica.cfg.Source, Namespace: namespace}
		names := []string{}
		for kind := range kinds[namespace] {
			names = append(names, kind)
		}
		sort.Strings(names)
		for _, kind := range names {
			capability.Kinds = append(capability.Kinds, primitive.KindSupport{Kind: kind, Operations: []string{"list", "get"}})
		}
		result = append(result, capability)
	}
	return result, nil
}
func (s *MetadataSource) List(ctx context.Context, kind, namespace string) (result []primitive.ResourceState, failure error) {
	defer func() { failure = metadataAdmissionError(failure) }()
	if namespace != "" && !s.claims(namespace) {
		return nil, ErrDenied
	}
	roots, err := s.roots(ctx)
	if err != nil {
		return nil, err
	}
	result = []primitive.ResourceState{}
	for _, root := range roots {
		uri, err := identity.ParseResourceURI(root.URI)
		if err != nil || !s.claims(uri.Namespace) {
			return nil, ErrInvalid
		}
		if root.Kind != kind || namespace != "" && namespace != uri.Namespace {
			continue
		}
		// Listing needs identity only. Opening below supplies the exact bytes and
		// declared envelope version without enumerating unrelated artifact bodies.
		result = append(result, primitive.ResourceState{URI: root.URI, Kind: root.Kind, Namespace: uri.Namespace, Name: uri.Name, Title: uri.Name, Lifecycle: identity.PublishedCandidate, ContentFingerprint: root.Hash})
	}
	return result, nil
}
func (s *MetadataSource) Get(ctx context.Context, uriText string) (result *primitive.ResourceState, failure error) {
	defer func() { failure = metadataAdmissionError(failure) }()
	uri, err := identity.ParseResourceURI(uriText)
	if err != nil || !s.claims(uri.Namespace) {
		return nil, ErrDenied
	}
	if err = s.replica.EnsureAdmitted(ctx); err != nil {
		return nil, err
	}
	view, err := s.replica.Open(ctx, uriText)
	if err != nil {
		return nil, err
	}
	payload := view.Payload()
	// Version one is the native primitive format (including MCP definitions).
	// Versioned envelopes carry their own schemaVersion, already checked by the
	// producer at publication. This is projection, not schema revalidation.
	header := struct {
		SchemaVersion int64  `json:"schemaVersion"`
		Title         string `json:"title"`
	}{}
	if err = json.Unmarshal(payload, &header); err != nil {
		return nil, ErrInvalid
	}
	version := header.SchemaVersion
	if version == 0 {
		version = 1
	}
	title := header.Title
	if title == "" {
		title = uri.Name
	}
	return &primitive.ResourceState{URI: uriText, Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, Title: title, Lifecycle: identity.PublishedCandidate, FormatVersion: version, ContentFingerprint: view.ETag(), DefinitionBytes: payload, Definition: json.RawMessage(payload)}, nil
}

// AdmissionKey identifies the locally established session/policy snapshot. It
// is not a bearer grant: every read still resolves the caller's session in the
// replica. Public configuration gateways use it to avoid cross-session reuse.
func (s *MetadataSource) AdmissionKey(ctx context.Context) (result string, failure error) {
	defer func() { failure = metadataAdmissionError(failure) }()
	if err := s.replica.EnsureAdmitted(ctx); err != nil {
		return "", err
	}
	session, err := s.replica.cfg.SessionKey(ctx)
	if err != nil || session == "" {
		return "", ErrDenied
	}
	s.replica.mu.RLock()
	defer s.replica.mu.RUnlock()
	admission, ok := s.replica.admissions[session]
	if !ok || admission.manifestHash != s.replica.latest.Hash {
		return "", ErrDenied
	}
	raw, err := json.Marshal([]string{s.replica.cfg.Source, s.replica.cfg.Tenant, s.replica.cfg.Account, session, admission.manifestHash})
	if err != nil {
		return "", err
	}
	return Hash(raw), nil
}

// CurrentHash fences delivery against a concurrent local selection update.
// It performs no payload hydration, parsing, hashing or producer access.
func (s *MetadataSource) CurrentHash(ctx context.Context, uriText string) (result string, failure error) {
	defer func() { failure = metadataAdmissionError(failure) }()
	uri, err := identity.ParseResourceURI(uriText)
	if err != nil || !s.claims(uri.Namespace) {
		return "", ErrDenied
	}
	if err = s.replica.EnsureAdmitted(ctx); err != nil {
		return "", err
	}
	key, err := s.replica.cfg.SessionKey(ctx)
	if err != nil || key == "" {
		return "", ErrDenied
	}
	selected, err := s.replica.selectedCohort(ctx)
	if err != nil {
		return "", err
	}
	if err = s.replica.ensureSelection(key, selected); err != nil {
		return "", err
	}
	s.replica.mu.RLock()
	defer s.replica.mu.RUnlock()
	ref, _, err := s.replica.openRefLocked(key, uriText, selected)
	if err != nil {
		return "", err
	}
	return ref.Hash, nil
}

// Optional application discovery can omit an inaccessible cohort while direct
// reads retain their terminal denial. This is a status classification, not a
// second policy check or a request to fall back to the producer.
type metadataDenied struct{ error }

func (e metadataDenied) Unwrap() error     { return e.error }
func (metadataDenied) HTTPStatusCode() int { return 403 }
func metadataAdmissionError(err error) error {
	if errors.Is(err, ErrDenied) {
		return metadataDenied{err}
	}
	return err
}
