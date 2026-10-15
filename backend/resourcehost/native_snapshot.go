// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"sync"
	"sync/atomic"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
	"github.com/viant/forge/backend/types"
	workspacewindow "github.com/viant/forge/backend/window/source"
	"github.com/viant/jsonrpc/transport"
)

// NativeSnapshotDefinition declares a deterministic authored-content loader.
// Load must not read actor/roles/grants/request data or make authorization
// decisions. File/import bytes and static native enrichment are its only input.
// Every authorization/lease decision remains in LocalProvider and its policy.
type NativeSnapshotDefinition struct {
	// RawDocument is an internal standard-MCP document, never a primitive kind.
	RawDocument   bool
	URI           string
	Title         string
	FormatVersion int64
	File          string
	Load          ExtensionLoader
}

// StaticWorkspaceWindowEnricher promises actor-independent authored enrichment.
// Static registry state is captured by BeforeCompile during startup or Reload.
type StaticWorkspaceWindowEnricher func(context.Context, *types.Window) error
type NativeSnapshotOptions struct {
	// BeforeCompile prepares static authored dependencies before initial capture
	// or explicit Reload. It must not make identity or permission decisions.
	BeforeCompile func(context.Context, *ExtensionReader) error
	// Validators binds additional resource kinds to host-owned definition validation.
	Validators map[string]LocalResourceValidator
}

type nativeSnapshotValue struct {
	raw         json.RawMessage
	fingerprint string
	kind        string
	version     int64
}

// NativeAssetSnapshot captures validated authored bytes once. Reads use the
// captured map until explicit Reload or restart; no filesystem polling or asset
// manifest is maintained. Actors, policies, grants and leases remain fresh.
type NativeAssetSnapshot struct {
	changes      producer.ResourceChanges
	root         string
	anchor       os.FileInfo
	definitions  []NativeSnapshotDefinition
	options      NativeSnapshotOptions
	mu           sync.RWMutex
	reloadMu     sync.Mutex
	values       map[string]nativeSnapshotValue
	compilations atomic.Uint64
}

func NewNativeAssetSnapshot(ctx context.Context, root string, definitions []NativeSnapshotDefinition, options ...NativeSnapshotOptions) (*NativeAssetSnapshot, error) {
	if ctx == nil || ctx.Err() != nil || len(definitions) == 0 || len(options) > 1 {
		return nil, fmt.Errorf("native snapshot requires deterministic definitions")
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	opened, err := os.OpenRoot(absolute)
	if err != nil {
		return nil, err
	}
	anchor, err := opened.Stat(".")
	opened.Close()
	if err != nil {
		return nil, err
	}
	snapshot := &NativeAssetSnapshot{root: absolute, anchor: anchor, definitions: append([]NativeSnapshotDefinition(nil), definitions...)}
	if len(options) == 1 {
		snapshot.options = options[0]
	}

	seen := map[string]bool{}
	for _, definition := range snapshot.definitions {
		uri, err := identity.ParseResourceURI(definition.URI)
		if definition.RawDocument && (err != nil || uri.Kind != "agently-runtime" || definition.FormatVersion != 0) {
			return nil, fmt.Errorf("invalid native raw document")
		}
		if err != nil || definition.Load == nil || !extensionPath(definition.File) || seen[definition.URI] || !(definition.RawDocument && definition.FormatVersion == 0 || !definition.RawDocument && definition.FormatVersion > 0) {
			return nil, fmt.Errorf("unsupported or duplicate native snapshot definition")
		}
		seen[definition.URI] = true
	}
	if err = snapshot.Reload(ctx); err != nil {
		return nil, err
	}
	return snapshot, nil
}
func (s *NativeAssetSnapshot) CompileCount() uint64 {
	if s == nil {
		return 0
	}
	return s.compilations.Load()
}

// Reload compiles off the read path and publishes one complete validated
// generation atomically. Failed or canceled reloads retain the prior bytes.
// A standard resource-change notification follows successful publication.
func (s *NativeAssetSnapshot) Reload(ctx context.Context) error {
	if s == nil || ctx == nil || ctx.Err() != nil {
		return identity.ErrResourceDenied
	}
	s.reloadMu.Lock()
	defer s.reloadMu.Unlock()
	if ctx.Err() != nil {
		return ctx.Err()
	}

	// Static compilation receives no caller values, actor, grants or request data.
	requestCtx := ctx
	compileCtx, cancel := context.WithCancel(context.Background())
	stop := context.AfterFunc(ctx, cancel)
	defer func() { stop(); cancel() }()
	ctx = compileCtx

	root, err := os.OpenRoot(s.root)
	if err != nil {
		return err
	}
	defer root.Close()
	current, err := root.Stat(".")
	if err != nil {
		return err
	}
	if !os.SameFile(s.anchor, current) {
		return identity.ErrResourceStale
	}
	reader := &ExtensionReader{root: root}
	defer reader.close()
	if s.options.BeforeCompile != nil {
		if err = s.options.BeforeCompile(ctx, reader); err != nil {
			return err
		}
	}
	values := map[string]nativeSnapshotValue{}
	for _, definition := range s.definitions {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		raw, err := definition.Load(ctx, reader, definition.File)
		if err != nil {
			return err
		}
		uri, _ := identity.ParseResourceURI(definition.URI)
		validator := s.options.Validators[uri.Kind]
		if validator == nil {
			switch uri.Kind {
			case "window":
				validator = ValidateWindowBundle
			case "report":
				validator = ValidateReportEnvelope
			default:
				return fmt.Errorf("native snapshot kind %q requires a host validator", uri.Kind)
			}
		}
		if !definition.RawDocument {
			if err = validator(definition.FormatVersion, raw); err != nil {
				return err
			}
		}
		values[definition.URI] = nativeSnapshotValue{raw: append(json.RawMessage(nil), raw...), fingerprint: identity.ContentFingerprint(raw), kind: uri.Kind, version: definition.FormatVersion}
		s.compilations.Add(1)
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	if err := requestCtx.Err(); err != nil {
		s.mu.Unlock()
		return err
	}
	if err := ctx.Err(); err != nil {
		s.mu.Unlock()
		return err
	}
	s.values = values
	s.mu.Unlock()
	s.changes.Publish(context.Background())
	return nil
}
func (s *NativeAssetSnapshot) value(ctx context.Context, uri identity.ResourceURI) (nativeSnapshotValue, error) {
	if s == nil || ctx == nil || ctx.Err() != nil || !uri.Valid() {
		return nativeSnapshotValue{}, identity.ErrResourceDenied
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	value, ok := s.values[uri.String()]
	if !ok {
		return nativeSnapshotValue{}, identity.ErrResourceDenied
	}
	return value, nil
}

// WindowIndex returns trusted metadata without loading/resolving any definition
// or permission. The caller applies declared group visibility and namespace/
// private-owner isolation freshly, then checks this shared index again.
func (s *NativeAssetSnapshot) WindowIndex(ctx context.Context) ([]primitive.ResourceState, error) {
	if s == nil || ctx == nil || ctx.Err() != nil {
		return nil, identity.ErrResourceDenied
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := []primitive.ResourceState{}
	for _, definition := range s.definitions {
		uri, _ := identity.ParseResourceURI(definition.URI)
		if uri.Kind != "window" {
			continue
		}
		value := s.values[definition.URI]
		result = append(result, primitive.ResourceState{Kind: "window", Namespace: uri.Namespace, Name: uri.Name, URI: uri.String(), Title: definition.Title, Lifecycle: identity.WorkingCandidate, Revision: identity.WorkingCandidate, FormatVersion: definition.FormatVersion, ContentFingerprint: value.fingerprint})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].URI < result[j].URI })
	return result, nil
}
func (s *NativeAssetSnapshot) Candidates(ctx context.Context, uri identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	value, err := s.value(ctx, uri)
	if err != nil {
		return nil, err
	}
	return []identity.ResourceCandidate{{Kind: identity.WorkingCandidate, ContentFingerprint: value.fingerprint}}, nil
}
func (s *NativeAssetSnapshot) ReadCandidate(ctx context.Context, uri identity.ResourceURI, candidate identity.ResourceCandidate) (json.RawMessage, error) {
	if !candidate.Valid() || candidate.Kind != identity.WorkingCandidate {
		return nil, identity.ErrResourceDenied
	}
	value, err := s.value(ctx, uri)
	if err != nil {
		return nil, err
	}
	if candidate.ContentFingerprint != value.fingerprint {
		return nil, identity.ErrResourceStale
	}
	return append(json.RawMessage(nil), value.raw...), nil
}
func (s *NativeAssetSnapshot) localDefinitionCurrent(ctx context.Context, uri identity.ResourceURI, candidate identity.ResourceCandidate) error {
	value, err := s.value(ctx, uri)
	if err != nil {
		return err
	}
	if candidate.Kind != identity.WorkingCandidate || candidate.ContentFingerprint != value.fingerprint {
		return identity.ErrResourceStale
	}
	return nil
}
func (s *NativeAssetSnapshot) localDefinitionValidated(kind string, version int64, fingerprint string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, value := range s.values {
		if value.kind == kind && value.version == version && value.fingerprint == fingerprint {
			return true
		}
	}
	return false
}
func (s *NativeAssetSnapshot) Bindings(provider string, policy LocalRevisionPolicyFactory) ([]LocalResourceBinding, error) {
	if s == nil || provider == "" || policy == nil {
		return nil, fmt.Errorf("native bindings require provider and host policy")
	}
	result := make([]LocalResourceBinding, 0, len(s.definitions))
	for _, definition := range s.definitions {
		if definition.RawDocument {
			continue
		}
		uri, _ := identity.ParseResourceURI(definition.URI)
		result = append(result, LocalResourceBinding{Changes: s, URI: definition.URI, Title: definition.Title, FormatVersion: definition.FormatVersion, Resolver: func(ctx context.Context, actor identity.VerifiedActor, action string) (*identity.ResourceResolver, error) {
			p, err := policy(ctx, actor, uri, action)
			if err != nil {
				return nil, err
			}
			if p == nil {
				return nil, identity.ErrResourceDenied
			}
			return &identity.ResourceResolver{ProviderIdentity: provider, Source: s, Policy: p}, nil
		}})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].URI < result[j].URI })
	return result, nil
}

// SnapshotWindowDefinitions uses explicit native logical entries; fragments and
// target branches never become independent resources.
func SnapshotWindowDefinitions(ctx context.Context, root string, bindings []workspacewindow.ResourceBinding, enrich StaticWorkspaceWindowEnricher) ([]NativeSnapshotDefinition, error) {
	local, err := ConfinedWindowBindings(ctx, root, bindings, func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) (identity.ResourceRevisionPolicy, error) {
		return nil, nil
	}, workspacewindow.WorkspaceWindowEnricher(enrich))
	if err != nil {
		return nil, err
	}
	result := make([]NativeSnapshotDefinition, 0, len(local))
	for _, binding := range local {
		// The supplied policy factory is deliberately non-authorizing; expose the
		// already trusted entry point directly rather than fabricating an actor.
		var original workspacewindow.ResourceBinding
		for _, candidate := range bindings {
			if candidate.URI == binding.URI {
				original = candidate
				break
			}
		}
		rootHandle, err := os.OpenRoot(root)
		if err != nil {
			return nil, err
		}
		reader := &ExtensionReader{root: rootHandle}
		file := ""
		for _, candidate := range []string{filepath.ToSlash(filepath.Join("extension/forge/windows", original.WindowKey+".yaml")), filepath.ToSlash(filepath.Join("extension/forge/windows", original.WindowKey, "main.yaml")), filepath.ToSlash(filepath.Join("extension/forge/windows", original.WindowKey, "shared/main.yaml"))} {
			if err := reader.check(candidate); err == nil {
				file = candidate
				break
			} else if !os.IsNotExist(err) {
				reader.close()
				rootHandle.Close()
				return nil, err
			}
		}
		reader.close()
		rootHandle.Close()
		if file == "" {
			return nil, identity.ErrResourceDenied
		}
		result = append(result, NativeSnapshotDefinition{URI: binding.URI, Title: binding.Title, FormatVersion: 2, File: file, Load: NativeWindowLoader([]workspacewindow.ResourceBinding{original}, workspacewindow.WorkspaceWindowEnricher(enrich))})
	}
	return result, nil
}

func pureLocalValidator(kind string, validator LocalResourceValidator) bool {
	if validator == nil {
		return false
	}
	pointer := reflect.ValueOf(validator).Pointer()
	return kind == "window" && pointer == reflect.ValueOf(ValidateWindowBundle).Pointer() || kind == "report" && pointer == reflect.ValueOf(ValidateReportEnvelope).Pointer()
}

// CheckCandidate compares captured validated content against an exact original
// candidate without reading the filesystem. It makes no identity or permission decision.
func (s *NativeAssetSnapshot) CheckCandidate(ctx context.Context, uri identity.ResourceURI, candidate identity.ResourceCandidate) error {
	if s == nil || !candidate.Valid() {
		return identity.ErrResourceStale
	}
	return s.localDefinitionCurrent(ctx, uri, candidate)
}

func (s *NativeAssetSnapshot) SubscribeResources(sink transport.Notifier) func() {
	return s.changes.SubscribeResources(sink)
}
