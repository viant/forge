// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/types"
	"strings"
	"time"
)

// Project evaluates presentation guards using only the current principal's
// roles/exposures. It does not bind or request an entity or its permissions.
func (r *Runtime) Project(ctx context.Context, window *types.Window, presentation ...*BoundView) (*Result, error) {
	if window == nil {
		return nil, fmt.Errorf("permitted view: window is required")
	}
	// The gateway's selected window is caller-owned. Only presentation trees
	// enter projection; owner descriptors, arguments and routing metadata retain
	// their exact decoded values and are never reconstructed through JSON.
	type presentationParts struct {
		View    types.View     `json:"view"`
		Dialogs []types.Dialog `json:"dialogs,omitempty"`
	}
	raw, err := json.Marshal(presentationParts{View: window.View, Dialogs: window.Dialogs})
	if err != nil {
		return nil, err
	}
	var tree map[string]any
	if err = json.Unmarshal(raw, &tree); err != nil {
		return nil, err
	}
	if !hasPresentationGuard(tree["view"]) && !hasPresentationGuard(tree["dialogs"]) {
		return &Result{Window: window}, nil
	}
	if err = validateProjectionGuards(tree["dialogs"]); err != nil {
		return nil, err
	}
	if err = validateProjectionGuards(tree["view"]); err != nil {
		return nil, err
	}
	var snapshot *Snapshot
	var selectedResource *Resource
	contextualFacts := false
	if r != nil && r.Resolver != nil {
		if contextual, ok := r.Resolver.(interface {
			ResolvePresentation(context.Context, *BoundView) (*Snapshot, error)
		}); ok && len(presentation) > 0 && presentation[0] != nil {
			contextualFacts = true
			bound := presentation[0]
			snapshot, err = contextual.ResolvePresentation(ctx, bound)
			if snapshot != nil {
				key := bound.ResourceIDString
				if key == "" && bound.ResourceID > 0 {
					key = fmt.Sprint(bound.ResourceID)
				}
				selectedResource = snapshot.Resources[key]
			}
		} else {
			snapshot, err = r.Resolver.Resolve(ctx, &Request{IncludePrincipal: true})
		}
		if err != nil {
			return nil, err
		}
		now := time.Now()
		if r.Now != nil {
			now = r.Now()
		}
		if snapshot == nil || snapshot.AuthorizationVersion == "" || !snapshot.ExpiresAt.After(now) {
			return nil, fmt.Errorf("permitted view: principal snapshot is unavailable")
		}
	}
	if snapshot != nil && !contextualFacts {
		snapshot = &Snapshot{AuthorizationVersion: snapshot.AuthorizationVersion, ExpiresAt: snapshot.ExpiresAt, Principal: map[string]any{"roles": snapshot.Principal["roles"], "features": snapshot.Principal["features"], "exposures": snapshot.Principal["exposures"]}}
	}
	scope := authorizationScope(snapshot, selectedResource)
	for _, key := range []string{"view", "dialogs"} {
		if part, exists := tree[key]; exists {
			compiled, keep := compileNode(part, scope)
			if keep {
				tree[key] = compiled
			} else {
				delete(tree, key)
			}
		}
	}
	compiled := tree
	raw, err = json.Marshal(compiled)
	if err != nil {
		return nil, err
	}
	var parts presentationParts
	if err = json.Unmarshal(raw, &parts); err != nil {
		return nil, err
	}
	projected := *window
	projected.View, projected.Dialogs = parts.View, parts.Dialogs
	if snapshot != nil {
		raw, err = json.Marshal(snapshot)
		if err != nil {
			return nil, err
		}
		if err = json.Unmarshal(raw, &projected.AuthorizationSnapshot); err != nil {
			return nil, err
		}
	}
	return &Result{Window: &projected, Authorization: snapshot}, nil
}
func hasPresentationGuard(value any) bool {
	switch v := value.(type) {
	case []any:
		for _, child := range v {
			if hasPresentationGuard(child) {
				return true
			}
		}
	case map[string]any:
		for key, child := range v {
			switch key {
			case "visibleWhen", "hiddenWhen", "disabledWhen", "readOnlyWhen":
				if hasAuthorizationCondition(child) {
					return true
				}
			}
			if hasPresentationGuard(child) {
				return true
			}
		}
	}
	return false
}

// Browser-owned conditions remain dynamic. Validate only the authorization
// portions this projection evaluates, including mixed all/any/not expressions.
func validateProjectionGuards(value any) error {
	switch v := value.(type) {
	case []any:
		for _, item := range v {
			if err := validateProjectionGuards(item); err != nil {
				return err
			}
		}
	case map[string]any:
		for key, item := range v {
			switch key {
			case "visibleWhen", "hiddenWhen", "disabledWhen", "readOnlyWhen":
				if err := validateProjectionCondition(item); err != nil {
					return err
				}
			default:
				if err := validateProjectionGuards(item); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
func validateProjectionCondition(value any) error {
	condition, ok := value.(map[string]any)
	if !ok {
		return fmt.Errorf("presentation condition must be an object")
	}
	if strings.EqualFold(stringValue(condition["source"]), "authorization") {
		return validateCondition(condition)
	}
	for _, op := range []string{"all", "any"} {
		if items, found := condition[op]; found {
			list, ok := items.([]any)
			if !ok || len(list) == 0 || len(condition) != 1 {
				return fmt.Errorf("malformed %s condition", op)
			}
			for _, item := range list {
				if err := validateProjectionCondition(item); err != nil {
					return err
				}
			}
			return nil
		}
	}
	if item, found := condition["not"]; found {
		if len(condition) != 1 {
			return fmt.Errorf("malformed not condition")
		}
		return validateProjectionCondition(item)
	}
	return nil
}

func hasAuthorizationCondition(value any) bool {
	switch v := value.(type) {
	case []any:
		for _, child := range v {
			if hasAuthorizationCondition(child) {
				return true
			}
		}
	case map[string]any:
		if strings.EqualFold(stringValue(v["source"]), "authorization") {
			return true
		}
		for _, key := range []string{"all", "any", "not"} {
			if hasAuthorizationCondition(v[key]) {
				return true
			}
		}
	}
	return false
}
