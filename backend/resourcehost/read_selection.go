package resource

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

// selectedResourceRead is detached metadata from an actual verified Get. It
// becomes reusable only after registration of the complete selected bundle.
type selectedResourceRead struct {
	definitionCache *definitionCacheReference
	connection      Connection
	pin             identity.ResolvedResource
	result          primitive.GetResult
	key             string
}
type selectedDatasourceBundle struct {
	parent       identity.ResolvedResource
	target       []byte
	alias        string
	descriptor   string
	fingerprint  string
	resources    map[string]selectedResourceRead
	verifyTarget func(context.Context) error
	admissions   map[string]func(context.Context) error
}

func selectionResourceID(connection Connection, pin identity.ResolvedResource) string {
	pin.ValidUntil = pin.ValidUntil.UTC()
	raw, _ := json.Marshal(struct {
		Connection Connection
		Pin        identity.ResolvedResource
	}{connection, pin})
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}

// GetResult contains scalar identities and explicit byte/slice carriers. Copy
// those carriers directly, preserving exact approved bytes and nil values.
// JSON round-tripping needlessly reparses large immutable report definitions.
func detachedGet(result *primitive.GetResult) (primitive.GetResult, error) {
	if result == nil {
		return primitive.GetResult{}, identity.ErrResourceDenied
	}
	out := *result
	if result.Resource != nil {
		resource := *result.Resource
		resource.Definition = bytes.Clone(result.Resource.Definition)
		resource.DefinitionBytes = bytes.Clone(result.Resource.DefinitionBytes)
		if result.Resource.Dependencies != nil {
			resource.Dependencies = append([]primitive.Dependency{}, result.Resource.Dependencies...)
		}
		out.Resource = &resource
	}
	if result.ResolvedResource != nil {
		pin := *result.ResolvedResource
		out.ResolvedResource = &pin
	}
	if result.ExecutionProof != nil {
		proof := *result.ExecutionProof
		out.ExecutionProof = &proof
	}
	if result.MenuProjection != nil {
		menu := *result.MenuProjection
		menu.DefinitionBytes = bytes.Clone(result.MenuProjection.DefinitionBytes)
		out.MenuProjection = &menu
	}
	return out, nil
}
func (s *resourceReadSequence) selectionKey(ctx context.Context, read selectedResourceRead) (string, error) {
	actor, err := s.gateway.actor(ctx)
	if err != nil {
		return "", err
	}
	uri, err := identity.ParseResourceURI(read.pin.URI)
	if err != nil {
		return "", err
	}
	if source, covered, err := s.gateway.publishedForURI(read.connection, uri); covered {
		if err != nil {
			return "", err
		}
		admission, err := source.source.AdmissionKey(ctx)
		if err != nil {
			return "", err
		}
		if admission == "" {
			return "", identity.ErrResourceDenied
		}
		return publishedAuthority(actor, source, uri, read.pin.ContentFingerprint, admission), nil
	}
	options, err := s.gateway.Manager.Options(ctx, read.connection.Name)
	if err != nil {
		return "", err
	}
	client, err := s.gateway.client(ctx, read.connection.Name)
	if err != nil {
		return "", err
	}
	return s.gateway.namespaceReadKey(ctx, actor, read.connection.Name, options, client)
}

func (s *resourceReadSequence) selectedRead(ctx context.Context, connection Connection, pin *identity.ResolvedResource, bindingKey string) (primitive.GetResult, *definitionCacheReference, bool, error) {
	if pin == nil {
		return primitive.GetResult{}, nil, false, nil
	}
	s.mu.Lock()
	if s.closed || s.failed != nil {
		s.mu.Unlock()
		return primitive.GetResult{}, nil, false, identity.ErrResourceDenied
	}
	if !s.active || s.selection == nil {
		s.mu.Unlock()
		return primitive.GetResult{}, nil, false, nil
	}
	read, found := s.selection.resources[selectionResourceID(connection, *pin)]
	s.mu.Unlock()
	if !found {
		return primitive.GetResult{}, nil, false, nil
	}
	if bindingKey != read.key || !identity.MetadataExpiryValid(read.pin.ValidUntil, s.gateway.now()) || read.result.ResolvedResource != nil && !identity.MetadataExpiryValid(read.result.ResolvedResource.ValidUntil, s.gateway.now()) || read.result.ExecutionProof != nil && !read.result.ExecutionProof.Resource.ValidUntil.After(s.gateway.now()) {
		err := identity.ErrResourceDenied
		s.mu.Lock()
		s.failed = err
		s.mu.Unlock()
		return primitive.GetResult{}, nil, false, err
	}
	if read.result.Resource == nil {
		return primitive.GetResult{}, nil, false, nil
	}
	result, err := detachedGet(&read.result)
	return result, read.definitionCache, err == nil, err
}

// recordSelectedRead fills a POST slot only for the original catalog-verified
// closed association. Arbitrary successful Gets cannot register themselves.
func (s *resourceReadSequence) recordSelectedRead(ctx context.Context, connection Connection, pin *identity.ResolvedResource, result *primitive.GetResult, bindingKey string, cacheReference *definitionCacheReference) error {
	if pin == nil {
		return nil
	}
	id := selectionResourceID(connection, *pin)
	s.mu.Lock()
	if !s.active || s.selection == nil {
		s.mu.Unlock()
		return nil
	}
	held, found := s.selection.resources[id]
	original := s.originalSelection
	s.mu.Unlock()
	if !found || held.result.Resource != nil {
		return nil
	}
	if original == nil {
		return identity.ErrResourceDenied
	}
	if bindingKey != held.key || !sameSelectedContent(original.resources[id].result, *result) {
		return identity.ErrResourceDenied
	}
	detached, err := detachedGet(result)
	if err != nil {
		return err
	}
	prior := original.resources[id].result
	detached.ExecutionProof = prior.ExecutionProof
	detached.ResolvedResource.ValidUntil = identity.MinimumMetadataExpiry(detached.ResolvedResource.ValidUntil, prior.ResolvedResource.ValidUntil)
	held.result = detached
	held.definitionCache = cacheReference
	// The first fresh POST result must retain the original proof too, rather
	// than exposing a newly issued proof while only the memo keeps provenance.
	returned, err := detachedGet(&detached)
	if err != nil {
		return err
	}
	*result = returned
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.failed != nil || !s.active || s.selection == nil {
		return identity.ErrResourceDenied
	}
	if s.ending {
		return nil
	} // Barrier callbacks cannot extend the selected read set.
	s.selection.resources[id] = held
	return nil
}

// registerSelectedDatasource is called only after the target and complete
// dependency/descriptor mapping have been verified by the owning catalog.
func (c *WindowCatalog) registerSelectedDatasource(ctx context.Context, parent identity.ResolvedResource, target *types.WindowTarget, alias string, variant *types.WindowResourceVariant, reads []selectedResourceRead) error {
	s := sequenceFromContext(ctx)
	if s == nil {
		return nil
	}
	s.mu.Lock()
	active := s.active
	ending := s.ending
	closed := s.closed
	failed := s.failed
	s.mu.Unlock()
	if closed || failed != nil || ending {
		if ending {
			s.mu.Lock()
			s.failed = identity.ErrResourceDenied
			s.mu.Unlock()
		}
		return identity.ErrResourceDenied
	}
	if !active {
		return nil
	}
	targetBytes, err := json.Marshal(target)
	if err != nil {
		return err
	}
	var resolved dsproto.DataSource
	if json.Unmarshal(variant.DataSources[alias], &resolved) != nil || resolved.ID != alias {
		return identity.ErrResourceDenied
	}
	resolvedBytes, err := json.Marshal(&resolved)
	if err != nil {
		return err
	}
	// Match the integration descriptor that existing callbacks receive. Exact
	// source bytes and full variant fingerprint stay separately pinned below.
	descriptor, err := types.WindowDescriptorFingerprint(resolvedBytes)
	if err != nil {
		return err
	}
	bundle := &selectedDatasourceBundle{parent: parent, target: targetBytes, alias: alias, descriptor: descriptor, fingerprint: variant.Fingerprint, resources: map[string]selectedResourceRead{}, admissions: map[string]func(context.Context) error{}}
	// Capture the target; every barrier compares the caller's target and verifies
	// its original selection proof before using the owning-provider resources.
	bundle.verifyTarget = func(checkCtx context.Context) error {
		current, err := json.Marshal(target)
		if err != nil || !bytes.Equal(current, targetBytes) {
			return identity.ErrResourceDenied
		}
		var held types.WindowTarget
		if json.Unmarshal(targetBytes, &held) != nil {
			return identity.ErrResourceDenied
		}
		return c.VerifyWindowTarget(checkCtx, parent, held, variant.Fingerprint)
	}
	if target.ExecutionProof != nil {
		if !target.ExecutionProof.Resource.ValidUntil.After(s.gateway.now()) {
			return identity.ErrResourceDenied
		}
		s.constrainLease(target.ExecutionProof.Resource.ValidUntil)
	}
	for _, read := range reads {
		if read.result.ExecutionProof != nil {
			if !read.result.ExecutionProof.Resource.ValidUntil.After(s.gateway.now()) {
				return identity.ErrResourceDenied
			}
			s.constrainLease(read.result.ExecutionProof.Resource.ValidUntil)
		}
		detached, err := detachedGet(&read.result)
		if err != nil {
			return err
		}
		read.result = detached
		read.key, err = s.selectionKey(ctx, read)
		if err != nil {
			return err
		}
		bundle.resources[selectionResourceID(read.connection, read.pin)] = read
	}
	if len(bundle.resources) != len(reads) {
		return identity.ErrResourceDenied
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.failed != nil || !s.active || s.ending {
		if s.ending {
			s.failed = identity.ErrResourceDenied
		}
		return identity.ErrResourceDenied
	}
	original := s.originalSelection
	if original != nil {
		if original.parent != parent || original.alias != alias || original.descriptor != descriptor || original.fingerprint != bundle.fingerprint || !bytes.Equal(original.target, targetBytes) || len(original.resources) != len(bundle.resources) {
			s.failed = identity.ErrResourceDenied
			return s.failed
		}
		for id, read := range bundle.resources {
			held, ok := original.resources[id]
			if !ok || held.key != read.key || !sameSelectedContent(held.result, read.result) {
				s.failed = identity.ErrResourceDenied
				return s.failed
			}
			// Opaque original provenance and its lease cannot renew in a later phase.
			read.result.ExecutionProof = held.result.ExecutionProof
			read.result.ResolvedResource.ValidUntil = identity.MinimumMetadataExpiry(read.result.ResolvedResource.ValidUntil, held.result.ResolvedResource.ValidUntil)
			bundle.resources[id] = read
		}
		bundle.admissions = original.admissions
	} else {
		s.originalSelection = bundle
	}
	s.selection = bundle
	return nil
}
func sameSelectedContent(left, right primitive.GetResult) bool {
	return left.Resource != nil && right.Resource != nil && left.ResolvedResource != nil && right.ResolvedResource != nil && left.ResolvedResource.ProviderIdentity == right.ResolvedResource.ProviderIdentity && left.ResolvedResource.URI == right.ResolvedResource.URI && left.ResolvedResource.ResourceCandidate == right.ResolvedResource.ResourceCandidate && left.ResolvedResource.AuthorityBinding == right.ResolvedResource.AuthorityBinding && bytes.Equal(left.Resource.Definition, right.Resource.Definition)
}

// RegisterDatasourceSelectionAdmission installs a trusted host callback, never
// its allow result. Only the catalog's exact registered alias can add a check.
func RegisterDatasourceSelectionAdmission(ctx context.Context, parent identity.ResolvedResource, target *types.WindowTarget, alias, descriptor string, check func(context.Context) error) error {
	s := sequenceFromContext(ctx)
	if s == nil {
		return nil
	}
	raw, err := json.Marshal(target)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.failed != nil {
		return identity.ErrResourceDenied
	}
	if !s.active {
		return nil
	}
	if s.ending {
		s.failed = identity.ErrResourceDenied
		return s.failed
	}
	if s.selection == nil {
		return nil
	} // local/standalone paths retain their existing fresh checks.
	if check == nil || s.selection.parent != parent || s.selection.alias != alias || s.selection.descriptor != descriptor || !bytes.Equal(s.selection.target, raw) {
		s.failed = identity.ErrResourceDenied
		return s.failed
	}
	s.selection.admissions[alias] = check
	return nil
}

// Admissions run before the barrier's forced catalog checks. A trusted host
// callback may observe changing configuration; its work cannot make a changed
// method contract invisible to the effect or release boundary.
func (s *resourceReadSequence) checkSelectedAdmissions(ctx context.Context) error {
	s.mu.Lock()
	bundle := s.selection
	checks := []func(context.Context) error{}
	if bundle != nil {
		for _, check := range bundle.admissions {
			checks = append(checks, check)
		}
	}
	s.mu.Unlock()
	if bundle == nil {
		return nil
	}
	if err := bundle.verifyTarget(ctx); err != nil {
		return err
	}
	for _, check := range checks {
		if err := check(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (s *resourceReadSequence) refreshSelectedResources(ctx context.Context) error {
	s.mu.Lock()
	bundle := s.selection
	resources := map[string]selectedResourceRead{}
	originals := map[string]selectedResourceRead{}
	if bundle != nil {
		for id, read := range bundle.resources {
			resources[id] = read
		}
		if s.originalSelection != nil {
			for id, read := range s.originalSelection.resources {
				originals[id] = read
			}
		}
	}
	s.mu.Unlock()
	if bundle == nil {
		return nil
	}
	ids := make([]string, 0, len(resources))
	for id := range resources {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		held := resources[id]
		key, err := s.selectionKey(ctx, held)
		if err != nil || key != held.key {
			return identity.ErrResourceDenied
		}
		routed, found, err := s.gateway.configuredOwnerNamespaceConnection(ctx, held.pin.ProviderIdentity, resourceNamespace(held.pin.URI))
		if err != nil || found && routed != held.connection {
			return identity.ErrResourceDenied
		}
		if !found {
			routed, err = s.gateway.ConnectionForNamespace(ctx, held.pin.ProviderIdentity, resourceNamespace(held.pin.URI))
			if err != nil || routed != held.connection {
				return identity.ErrResourceDenied
			}
		}
		if held.pin.Kind == identity.PublishedCandidate {
			if err := s.gateway.verifyPublishedPin(ctx, held.connection, held.pin); err != nil {
				return err
			}
			continue
		}
		current, err := get[json.RawMessage](ctx, s.gateway, held.connection, identity.ResourceRef{URI: held.pin.URI, Revision: held.pin.Selector()}, &held.pin, true, false)
		if err != nil {
			return err
		}
		expected := held.result
		if expected.Resource == nil {
			expected = originals[id].result
		}
		if !sameSelectedContent(expected, current.GetResult) {
			return identity.ErrResourceStale
		}
	}
	return bundle.verifyTarget(ctx)
}
