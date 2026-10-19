// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/provider/contract/observe"
	"reflect"
	"strings"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

// MenuActionVisibility is a trusted host check for each authored action. It
// receives the current verified actor and logical menu identity, never an owner
// or server URL inferred from the action. Execution still uses backend guards.
type MenuVisibilityProjection func(context.Context, identity.VerifiedActor, identity.ResourceURI, json.RawMessage) (json.RawMessage, error)

type MenuActionVisibility func(context.Context, identity.VerifiedActor, identity.ResourceURI, json.RawMessage) (bool, error)

// ValidateMenu validates the portable navigation envelope. Node fields remain
// lossless JSON so host title/icon/parameters/action contracts survive delivery.
// A leaf without an action must explicitly set disabled to true. Such a label
// does not grant access to a destination; authored actions always need visibility.
func ValidateMenu(version int64, raw json.RawMessage) error {
	if len(raw) > 4<<20 {
		return fmt.Errorf("menu definition exceeds size limit")
	}
	if version != 1 {
		return fmt.Errorf("unsupported menu format")
	}
	var envelope map[string]json.RawMessage
	if json.Unmarshal(raw, &envelope) != nil || envelope == nil {
		return identity.ErrResource
	}
	for key := range envelope {
		if key != "schemaVersion" && key != "applications" && key != "name" && key != "icon" {
			return identity.ErrResource
		}
	}
	for _, field := range []string{"name", "icon"} {
		if raw, exists := envelope[field]; exists {
			var value string
			if json.Unmarshal(raw, &value) != nil || strings.TrimSpace(value) == "" || len(value) > 256 || strings.ContainsAny(value, "\x00\r\n") {
				return identity.ErrResource
			}
		}
	}
	var schemaVersion int
	if json.Unmarshal(envelope["schemaVersion"], &schemaVersion) != nil || schemaVersion != 1 {
		return identity.ErrResource
	}
	var applications []json.RawMessage
	if json.Unmarshal(envelope["applications"], &applications) != nil || applications == nil {
		return identity.ErrResource
	}
	_, err := filterMenuNodes(context.Background(), applications, func(json.RawMessage) (bool, error) { return true, nil }, 0)
	return err
}

func filterMenuNodes(ctx context.Context, nodes []json.RawMessage, visible func(json.RawMessage) (bool, error), depth int) ([]json.RawMessage, error) {
	if depth > 32 || len(nodes) > 10000 {
		return nil, identity.ErrResource
	}
	out := make([]json.RawMessage, 0, len(nodes))
	for _, raw := range nodes {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		var node map[string]json.RawMessage
		if json.Unmarshal(raw, &node) != nil || node == nil {
			return nil, identity.ErrResource
		}
		if action, exists := node["action"]; exists {
			var object map[string]json.RawMessage
			if json.Unmarshal(action, &object) != nil || object == nil {
				return nil, identity.ErrResource
			}
			allowed, err := visible(action)
			if err != nil {
				return nil, err
			}
			if !allowed {
				continue
			}
		}
		childKey := "menus"
		if _, exists := node["children"]; exists {
			if _, ambiguous := node["menus"]; ambiguous {
				return nil, identity.ErrResource
			}
			childKey = "children"
		}
		if children, exists := node[childKey]; exists {
			var values []json.RawMessage
			if json.Unmarshal(children, &values) != nil || values == nil {
				return nil, identity.ErrResource
			}
			filtered, err := filterMenuNodes(ctx, values, visible, depth+1)
			if err != nil {
				return nil, err
			}
			if len(filtered) == 0 {
				if _, hasAction := node["action"]; !hasAction {
					continue
				}
			}
			node[childKey], err = json.Marshal(filtered)
			if err != nil {
				return nil, err
			}
		} else if _, hasAction := node["action"]; !hasAction {
			// A disabled label can describe an unavailable destination without
			// inventing an executable action. Actions, when present, still pass
			// the visibility check above even if presentation is disabled.
			var disabled bool
			if json.Unmarshal(node["disabled"], &disabled) != nil || !disabled {
				return nil, identity.ErrResource
			}
		}
		encoded, err := json.Marshal(node)
		if err != nil {
			return nil, err
		}
		out = append(out, encoded)
	}
	return out, nil
}

func (p *LocalProvider) projectMenu(ctx context.Context, actor identity.VerifiedActor, uri identity.ResourceURI, raw json.RawMessage) (timingValue json.RawMessage, timingErr error) {
	if observe.Enabled(ctx) {
		span := p.timing(ctx, observe.MenuVisibility, "navigation", uri.Namespace)
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheBypass) }()
	}
	if p.menuVisibilityProjection != nil {
		visible, err := p.menuVisibilityProjection(ctx, actor, uri, append(json.RawMessage(nil), raw...))
		if err != nil {
			return nil, err
		}
		if ValidateMenu(1, visible) != nil || !menuProjectionSubset(raw, visible) {
			return nil, identity.ErrResourceDenied
		}
		return visible, nil
	}
	if p.menuActionVisibility == nil {
		return nil, identity.ErrResourceDenied
	}
	var envelope map[string]json.RawMessage
	if json.Unmarshal(raw, &envelope) != nil {
		return nil, identity.ErrResource
	}
	var applications []json.RawMessage
	if json.Unmarshal(envelope["applications"], &applications) != nil {
		return nil, identity.ErrResource
	}
	filtered, err := filterMenuNodes(ctx, applications, func(action json.RawMessage) (bool, error) {
		return p.menuActionVisibility(ctx, actor, uri, append(json.RawMessage(nil), action...))
	}, 0)
	if err != nil {
		return nil, err
	}
	envelope["applications"], err = json.Marshal(filtered)
	if err != nil {
		return nil, err
	}
	return json.Marshal(envelope)
}

func (p *LocalProvider) getMenuProjection(ctx context.Context, actor identity.VerifiedActor, binding LocalResourceBinding, uri identity.ResourceURI, raw json.RawMessage, pin *identity.ResolvedResource) (*primitive.GetResult, error) {
	projected, err := p.projectMenu(ctx, actor, uri, raw)
	if err != nil {
		return nil, err
	}
	// Re-read the exact source and repeat visibility after projection. Neither a
	// revoked child nor a changed source may be released under the earlier check.
	freshRaw, fresh, err := p.checkedRead(ctx, actor, binding, uri, "resource.get", pin.Selector())
	if err != nil {
		return nil, err
	}
	if fresh.ResourceCandidate != pin.ResourceCandidate || fresh.AuthorityBinding != pin.AuthorityBinding {
		return nil, identity.ErrResourceStale
	}
	again, err := p.projectMenu(ctx, actor, uri, freshRaw)
	if err != nil {
		return nil, err
	}
	if !reflect.DeepEqual(projected, again) {
		return nil, identity.ErrResourceDenied
	}
	_, current, err := p.checkedRead(ctx, actor, binding, uri, "resource.get", pin.Selector())
	if err != nil {
		return nil, err
	}
	if current.ResourceCandidate != pin.ResourceCandidate || current.AuthorityBinding != pin.AuthorityBinding {
		return nil, identity.ErrResourceStale
	}
	fresh.ValidUntil = identity.MinimumMetadataExpiry(fresh.ValidUntil, current.ValidUntil)
	if err = p.finishActor(ctx, actor); err != nil {
		return nil, err
	}
	if !identity.MetadataExpiryValid(pin.ValidUntil, p.nowTime()) || !identity.MetadataExpiryValid(fresh.ValidUntil, p.nowTime()) {
		return nil, identity.ErrResourceDenied
	}
	pin.ValidUntil = identity.MinimumMetadataExpiry(pin.ValidUntil, fresh.ValidUntil)
	fingerprint := identity.ContentFingerprint(projected)
	return &primitive.GetResult{Resource: &primitive.ResourceState{Kind: "navigation", Namespace: uri.Namespace, Name: uri.Name, URI: uri.String(), Title: binding.Title, Lifecycle: pin.Kind, Revision: pin.Selector(), FormatVersion: binding.FormatVersion, ContentFingerprint: pin.ContentFingerprint}, ResolvedResource: pin, MenuProjection: &primitive.MenuProjection{SchemaVersion: 1, DefinitionBytes: append([]byte(nil), projected...), ContentFingerprint: fingerprint}}, nil
}

// menuProjectionSubset permits filtering only. A trusted projection still may
// not rewrite an action, move it to another ancestor, reorder it or add fields.
func menuProjectionSubset(original, visible json.RawMessage) bool {
	var source, target map[string]json.RawMessage
	if json.Unmarshal(original, &source) != nil || json.Unmarshal(visible, &target) != nil {
		return false
	}
	if !reflect.DeepEqual(source["schemaVersion"], target["schemaVersion"]) || !reflect.DeepEqual(source["name"], target["name"]) || !reflect.DeepEqual(source["icon"], target["icon"]) {
		return false
	}
	var subset func(json.RawMessage, json.RawMessage) bool
	subset = func(a, b json.RawMessage) bool {
		var original, projected []json.RawMessage
		if json.Unmarshal(a, &original) != nil || json.Unmarshal(b, &projected) != nil {
			return false
		}
		index := 0
		for _, candidate := range projected {
			var desired map[string]json.RawMessage
			if json.Unmarshal(candidate, &desired) != nil {
				return false
			}
			matched := false
			for index < len(original) {
				var node map[string]json.RawMessage
				err := json.Unmarshal(original[index], &node)
				index++
				if err != nil {
					return false
				}
				if len(node) != len(desired) {
					continue
				}
				same := true
				for key, value := range node {
					other, ok := desired[key]
					if !ok {
						same = false
						break
					}
					if key == "menus" || key == "children" {
						if !subset(value, other) {
							same = false
							break
						}
					} else {
						var left, right any
						leftDecoder := json.NewDecoder(bytes.NewReader(value))
						leftDecoder.UseNumber()
						rightDecoder := json.NewDecoder(bytes.NewReader(other))
						rightDecoder.UseNumber()
						if leftDecoder.Decode(&left) != nil || rightDecoder.Decode(&right) != nil || !reflect.DeepEqual(left, right) {
							same = false
							break
						}
					}
				}
				if same {
					matched = true
					break
				}
			}
			if !matched {
				return false
			}
		}
		return true
	}
	return subset(source["applications"], target["applications"])
}
