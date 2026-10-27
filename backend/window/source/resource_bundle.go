// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"

	metaURL "github.com/viant/afs/url"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	meta "github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
	wsmeta "github.com/viant/forge/backend/window/source/internal/meta"
	view "github.com/viant/forge/backend/window/view"
	"gopkg.in/yaml.v3"
)

// These profiles cover the existing web/mobile client contracts. Additional
// profiles are explicit trusted ResourceBinding.Targets, never guessed from a
// requested client path. Each declared profile is materialized independently
// unless its actual source branch precedence is identical to another profile.
func standardWindowTargets() []types.WindowTarget {
	return []types.WindowTarget{{}, {Platform: "web"}, {Platform: "web", FormFactor: "desktop"}, {Platform: "web", FormFactor: "phone"}, {Platform: "web", FormFactor: "tablet"}, {Platform: "ios"}, {Platform: "ios", FormFactor: "phone"}, {Platform: "ios", FormFactor: "tablet"}, {Platform: "android"}, {Platform: "android", FormFactor: "phone"}, {Platform: "android", FormFactor: "tablet"}, {Surface: "app"}, {FormFactor: "phone"}, {FormFactor: "tablet"}}
}

func StandardWindowTargets() []types.WindowTarget { return standardWindowTargets() }
func (s *WorkspaceResourceSource) loadBundle(ctx context.Context, uri identity.ResourceURI) (json.RawMessage, error) {
	return s.LoadBundleWithOptions(ctx, uri, LoaderOptions{})
}

// LoadBundleWithOptions materializes every native target using one confined host filesystem.
func (s *WorkspaceResourceSource) LoadBundleWithOptions(ctx context.Context, uri identity.ResourceURI, options LoaderOptions) (result json.RawMessage, failure error) {
	return s.loadBundleWithBase(ctx, uri, options, nil)
}

// LoadTargetWithOptions materializes only the requested native target. Target
// equivalence indexing is unnecessary when there is exactly one profile. The
// canonical default binding aliases that same variant without another load.
func (s *WorkspaceResourceSource) LoadTargetWithOptions(ctx context.Context, uri identity.ResourceURI, target types.WindowTarget, options LoaderOptions) (json.RawMessage, error) {
	normalized, err := target.Normalize()
	if err != nil || normalized.SelectionToken != "" || len(normalized.Capabilities) > 0 || len(normalized.DependencyPins) > 0 || normalized.ExecutionProof != nil {
		return nil, fmt.Errorf("invalid declared target profile")
	}
	return s.loadBundleProfilesWithBase(ctx, uri, options, nil, []types.WindowTarget{normalized})
}

// LoadComposedWindowBundleWithOptionsAt composes a trusted linked window with
// the same authored workspace assignment closure as native windows. The loader
// is startup-owned; request actors and authorization never enter compilation.
func LoadComposedWindowBundleWithOptionsAt(ctx context.Context, root string, binding ResourceBinding, load func(context.Context, *types.WindowTarget) (*types.Window, error), enrich WorkspaceWindowEnricher, options LoaderOptions) (json.RawMessage, error) {
	if load == nil {
		return nil, identity.ErrResourceDenied
	}
	source, err := NewWorkspaceResourceSource(root, []ResourceBinding{binding}, enrich)
	if err != nil {
		return nil, err
	}
	uri, err := identity.ParseResourceURI(binding.URI)
	if err != nil {
		return nil, err
	}
	return source.loadBundleWithBase(ctx, uri, options, load)
}

func (s *WorkspaceResourceSource) loadBundleWithBase(ctx context.Context, uri identity.ResourceURI, options LoaderOptions, base func(context.Context, *types.WindowTarget) (*types.Window, error)) (result json.RawMessage, failure error) {
	return s.loadBundleProfilesWithBase(ctx, uri, options, base, nil)
}

func (s *WorkspaceResourceSource) loadBundleProfilesWithBase(ctx context.Context, uri identity.ResourceURI, options LoaderOptions, base func(context.Context, *types.WindowTarget) (*types.Window, error), profiles []types.WindowTarget) (result json.RawMessage, failure error) {
	defer func() {
		if err := options.check(); err != nil {
			result = nil
			failure = err
		}
	}()
	if s == nil || ctx == nil || ctx.Err() != nil || !uri.Valid() || s.windows[uri.String()] == "" {
		return nil, identity.ErrResourceDenied
	}
	if profiles == nil {
		profiles = append(standardWindowTargets(), s.targets[uri.String()]...)
	}
	if len(profiles) > 128 {
		return nil, fmt.Errorf("too many window targets")
	}
	// Imports can select target branches below shared components too. Index all
	// actual Forge asset directories, then retain the existing loader's exact
	// ordered precedence. No content is cached across candidate reads.
	dirs := map[string]bool{}
	if len(profiles) == 1 {
		// A single profile never compares branches with another target.
	} else if options.AssetDirectories != nil {
		var err error
		dirs, err = options.AssetDirectories(ctx)
		if err != nil {
			return nil, err
		}
	} else {
		assetRoot := filepath.Join(s.root, "extension", "forge")
		if err := filepath.WalkDir(assetRoot, func(p string, d fs.DirEntry, e error) error {
			if e != nil {
				return e
			}
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if d.IsDir() {
				rel, e := filepath.Rel(assetRoot, p)
				if e != nil {
					return e
				}
				parts := strings.Split(filepath.ToSlash(rel), "/")
				for i := range parts {
					dirs[strings.Join(parts[i:], "/")] = true
				}
			}
			return nil
		}); err != nil {
			return nil, err
		}

	}
	svc := wsmeta.New(options.filesystem(), s.root)
	var paths map[string]string
	var err error
	if options.SourceCatalog != nil {
		options.SourceCatalog(true)
	}
	if options.StaticAssets != nil {
		var parsed *workspaceCatalog
		parsed, err = options.StaticAssets.load(ctx, s.root, svc)
		if err == nil {
			paths = parsed.dataSourcePaths
		}
	} else {
		_, paths, err = loadWorkspaceDataSources(ctx, svc)
	}
	if options.SourceCatalog != nil {
		options.SourceCatalog(false)
	}
	if err != nil {
		return nil, err
	}
	descriptors := map[string]json.RawMessage{}
	envelope := types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Variants: map[string]types.WindowResourceVariant{}}
	viewMetadataLoaded := false
	seen, materialized := map[string]bool{}, map[string]string{}
	for _, profile := range profiles {
		profile, err = profile.Normalize()
		if err != nil || profile.SelectionToken != "" {
			return nil, fmt.Errorf("invalid declared target profile")
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		key := profile.ProfileKey()
		if seen[key] {
			return nil, fmt.Errorf("duplicate declared window profile")
		}
		seen[key] = true
		var target *meta.TargetContext
		signature := "default"
		if key != (types.WindowTarget{}).ProfileKey() {
			target = &meta.TargetContext{Platform: profile.Platform, FormFactor: profile.FormFactor, Surface: profile.Surface}
			var branches []string
			for _, b := range meta.TargetBranchCandidates(target) {
				if dirs[b] {
					branches = append(branches, b)
				}
			}
			signature = "target:" + strings.Join(branches, "|")
		}
		// A linked loader owns a different target tree; workspace directory
		// precedence cannot prove two linked profiles equivalent.
		if base != nil {
			signature = "linked:" + key
		}
		variantID := materialized[signature]
		if variantID == "" {
			var window *types.Window
			var err error
			if base == nil {
				window, err = LoadWorkspaceWindowWithOptionsAt(ctx, s.root, s.windows[uri.String()], target, s.enrich, options)
			} else {
				var declared *types.WindowTarget
				if key != (types.WindowTarget{}).ProfileKey() {
					copied := profile
					declared = &copied
				}
				window, err = base(ctx, declared)
				if err == nil && window != nil {
					// Trusted loaders may return immutable shared declarations. Detach
					// before merging or stripping runtime metadata for this variant.
					window, err = cloneComposedWindowDeclaration(window)
					if err == nil {
						err = mergeWorkspaceForgeAssetsWithOptionsAt(ctx, s.root, window, nil, s.enrich, options)
					}
				}
			}
			if err != nil {
				return nil, err
			}
			if window == nil {
				return nil, identity.ErrResourceDenied
			}
			if !viewMetadataLoaded && base == nil {
				viewMetadataLoaded = true
				envelope.ViewMetadata, err = s.authoredViewMetadata(ctx, s.windows[uri.String()], target, options)
				if err != nil {
					return nil, err
				}
			}
			window.Resource = nil
			window.ResourceTarget = nil
			window.ResourceDependencies = map[string]string{}
			variant := types.WindowResourceVariant{Window: window, DataSources: map[string]json.RawMessage{}}
			for id, inline := range window.DataSource {
				descriptor := dsproto.DataSource{DataSource: inline, ID: id}
				if path := paths[id]; path != "" {
					base := descriptors[id]
					if base == nil {
						var global dsproto.DataSource
						if err := svc.Load(ctx, path, &global); err != nil {
							return nil, err
						}
						if global.ID == "" {
							global.ID = id
						}
						base, err = json.Marshal(global)
						if err != nil {
							return nil, err
						}
						descriptors[id] = base
					}
					// Decode into a fresh value: decoding into the inline value
					// would reuse and overwrite its shared parameter slices/maps.
					descriptor = dsproto.DataSource{}
					if json.Unmarshal(base, &descriptor) != nil {
						return nil, fmt.Errorf("invalid datasource descriptor")
					}
					producer := descriptor.DataSource
					// Backend/cache stay from the trusted producer declaration. The
					// selected window owns its effective inline schema, defaults,
					// parameter bindings, selectors and rendering contract.
					descriptor.DataSource = inline
					// The native browser loader projects service-less producers onto
					// a rows/dataInfo fetch envelope. Keep that browser projection in
					// Window.DataSource; execution must select the producer response.
					descriptor.Selectors = executionSelectors(producer, inline, id)
				}
				raw, err := json.Marshal(descriptor)
				if err != nil {
					return nil, err
				}
				raw, err = types.CanonicalWindowDescriptor(raw)
				if err != nil {
					return nil, err
				}
				variant.DataSources[id] = raw
				window.ResourceDependencies[id] = identity.ContentFingerprint(raw)
			}
			variantID, err = types.WindowVariantFingerprint(variant)
			if err != nil {
				return nil, err
			}
			envelope.Variants[variantID] = variant
			materialized[signature] = variantID
		}
		envelope.Targets = append(envelope.Targets, types.WindowTargetBinding{Target: profile, Variant: variantID})
	}
	// Canonical bundles require an explicit default. A selected profile supplies
	// that alias using its already materialized variant, never another load.
	if len(profiles) == 1 && profiles[0].ProfileKey() != (types.WindowTarget{}).ProfileKey() {
		envelope.Targets = append(envelope.Targets, types.WindowTargetBinding{Target: types.WindowTarget{}, Variant: envelope.Targets[0].Variant})
	}
	if err := envelope.Validate(); err != nil {
		return nil, err
	}
	return json.Marshal(envelope)
}

// Keep the authored routing descriptor on publications just as native window
// snapshots do. The existing reader supplies the admitted resource URI; these
// descriptive fields never select a provider or grant access.
func (s *WorkspaceResourceSource) authoredViewMetadata(ctx context.Context, key string, target *meta.TargetContext, options LoaderOptions) (json.RawMessage, error) {
	root := "file://" + filepath.ToSlash(filepath.Join(s.root, "extension", "forge", "windows"))
	loader := meta.New(options.filesystem(), root)
	var err error
	target, err = workspaceWindowSourceTarget(ctx, loader, root, key, target, options.SharedDefault)
	if err != nil {
		return nil, err
	}
	var node yaml.Node
	if base, err := loader.ResolveWindowBase(ctx, metaURL.Join(root, key, "main"), target); err == nil {
		if err := loader.LoadWithURLAndTarget(ctx, base+".yaml", &node, target); err != nil {
			return nil, err
		}
	} else {
		loader := wsmeta.New(options.filesystem(), s.root)
		if err := loader.Load(ctx, filepath.Join("extension", "forge", "windows", key+".yaml"), &node); err != nil {
			return nil, err
		}
	}
	var header struct {
		ID        string `yaml:"id"`
		WindowKey string `yaml:"windowKey"`
	}
	if err := node.Decode(&header); err != nil {
		return nil, err
	}
	if header.ID == "" || header.WindowKey == "" {
		return nil, nil
	}
	var spec view.Spec
	if err := node.Decode(&spec); err != nil {
		return nil, err
	}
	return json.Marshal(spec)
}

// cloneComposedWindowDeclaration detaches authored interface values without
// routing identifiers and defaults through float64 during static compilation.
func cloneComposedWindowDeclaration(source *types.Window) (*types.Window, error) {
	raw, err := json.Marshal(source)
	if err != nil {
		return nil, err
	}
	var detached *types.Window
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err = decoder.Decode(&detached); err != nil {
		return nil, err
	}
	return detached, nil
}
