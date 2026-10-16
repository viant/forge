// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"time"
)

type BackendMapper func(context.Context, string, string, map[string]interface{}) (authz.Resource, string, []authz.Entity, string, error)

// ErrBackendUnmapped identifies only a missing exact static binding. It is a
// denial to callers, but a trusted host may resolve it from its own store.
var ErrBackendUnmapped = fmt.Errorf("%w: backend action is not mapped", ErrDenied)

// ChainBackendMappers consults a host-owned dynamic mapper only when no exact
// static binding exists. Errors from an existing static binding never fall
// through, including malformed entity selections.
func ChainBackendMappers(static, dynamic BackendMapper) BackendMapper {
	return func(ctx context.Context, operation, id string, inputs map[string]interface{}) (authz.Resource, string, []authz.Entity, string, error) {
		if static == nil {
			return authz.Resource{}, "", nil, "", ErrDenied
		}
		resource, action, selected, permission, err := static(ctx, operation, id, inputs)
		if !errors.Is(err, ErrBackendUnmapped) || dynamic == nil {
			return resource, action, selected, permission, err
		}
		resource, action, selected, permission, err = dynamic(ctx, operation, id, inputs)
		if err != nil {
			return authz.Resource{}, "", nil, "", err
		}
		if resource.Kind == "" || resource.ID == "" || resource.Version == "" || resource.Tenant == "" || action == "" {
			return authz.Resource{}, "", nil, "", ErrDenied
		}
		return resource, action, selected, permission, nil
	}
}

// BackendBinding maps one trusted host operation and opaque backend ID to an
// ACL action. Entity input remains a hint verified by ACL/gating providers.
type BackendBinding struct {
	UseResolvedResource bool           `json:"useResolvedResource,omitempty"`
	SelectionPath       string         `json:"selectionPath,omitempty"`
	SelectionIDFormat   string         `json:"selectionIdFormat,omitempty"`
	Operation           string         `json:"operation"`
	ID                  string         `json:"id"`
	Resource            authz.Resource `json:"resource"`
	Action              string         `json:"action"`
	EntityType          string         `json:"entityType,omitempty"`
	Permission          string         `json:"permission,omitempty"`
	SelectionParameter  string         `json:"selectionParameter,omitempty"`
	SelectionMode       string         `json:"selectionMode,omitempty"` // single or multiple
}

type backendBindingKey struct{ operation, id string }

func NewStaticBackendMapper(bindings []BackendBinding) (BackendMapper, error) {
	index := make(map[backendBindingKey]BackendBinding, len(bindings))
	for _, binding := range bindings {
		if binding.Operation == "" || binding.ID == "" || (!binding.UseResolvedResource && (binding.Resource.Kind == "" || binding.Resource.ID == "" || binding.Resource.Version == "" || binding.Resource.Tenant == "")) || (binding.UseResolvedResource && (binding.Resource.Kind != "" || binding.Resource.ID != "" || binding.Resource.Version != "" || binding.Resource.Tenant == "" || binding.Resource.Tenant == "*")) || binding.Action == "" || strings.TrimSpace(binding.Operation) != binding.Operation || strings.TrimSpace(binding.ID) != binding.ID {
			return nil, fmt.Errorf("invalid backend authorization binding")
		}
		if binding.EntityType == "" {
			if binding.Permission != "" || binding.SelectionParameter != "" || binding.SelectionPath != "" || binding.SelectionIDFormat != "" || binding.SelectionMode != "" {
				return nil, fmt.Errorf("entity selection without entity type")
			}
		} else if binding.Permission == "" || (binding.SelectionParameter == "") == (binding.SelectionPath == "") || (binding.SelectionMode != "single" && binding.SelectionMode != "multiple") {
			return nil, fmt.Errorf("incomplete backend entity binding")
		}
		if binding.SelectionPath != "" {
			if _, err := parseSelectionPath(binding.SelectionPath); err != nil || binding.SelectionIDFormat != "positiveDecimal" && binding.SelectionIDFormat != "opaque" {
				return nil, fmt.Errorf("invalid typed backend selection path")
			}
		} else if binding.SelectionIDFormat != "" {
			return nil, fmt.Errorf("ID format requires explicit selection path")
		}
		key := backendBindingKey{binding.Operation, binding.ID}
		if _, exists := index[key]; exists {
			return nil, fmt.Errorf("duplicate backend authorization binding")
		}
		index[key] = binding
	}
	return func(ctx context.Context, operation, id string, inputs map[string]interface{}) (authz.Resource, string, []authz.Entity, string, error) {
		if ctx == nil || ctx.Err() != nil {
			return authz.Resource{}, "", nil, "", ErrDenied
		}
		binding, ok := index[backendBindingKey{operation, id}]
		if !ok {
			return authz.Resource{}, "", nil, "", ErrBackendUnmapped
		}
		if binding.UseResolvedResource {
			pin, found := requestctx.ResolvedResourceFromContext(ctx)
			if !found || pin == nil || !pin.ResourceCandidate.Valid() || pin.AuthorityBinding == "" || !pin.ValidUntil.After(time.Now()) {
				return authz.Resource{}, "", nil, "", ErrDenied
			}
			uri, err := identity.ParseResourceURI(pin.URI)
			if err != nil {
				return authz.Resource{}, "", nil, "", ErrDenied
			}
			binding.Resource = authz.Resource{Kind: uri.Kind, ID: pin.URI, Version: pin.Selector(), Tenant: binding.Resource.Tenant}
		}
		if binding.EntityType == "" {
			return binding.Resource, binding.Action, nil, "", nil
		}
		if binding.SelectionPath != "" {
			selected, err := resolveSelectionPath(inputs, binding)
			if err != nil {
				return authz.Resource{}, "", nil, "", err
			}
			return binding.Resource, binding.Action, selected, binding.Permission, nil
		}
		value, ok := inputs[binding.SelectionParameter]
		if !ok {
			return authz.Resource{}, "", nil, "", ErrDenied
		}
		var values []any
		switch actual := value.(type) {
		case []any:
			values = actual
		case []string:
			for _, item := range actual {
				values = append(values, item)
			}
		case []int:
			for _, item := range actual {
				values = append(values, item)
			}
		default:
			values = []any{value}
		}
		if len(values) == 0 || binding.SelectionMode == "single" && len(values) != 1 {
			return authz.Resource{}, "", nil, "", ErrDenied
		}
		ids := make([]string, 0, len(values))
		seen := map[string]bool{}
		for _, value := range values {
			id, err := exactBackendID(value)
			if err != nil {
				return authz.Resource{}, "", nil, "", err
			}
			if !seen[id] {
				seen[id] = true
				ids = append(ids, id)
			}
		}
		sort.Strings(ids)
		selected := make([]authz.Entity, len(ids))
		for i, id := range ids {
			selected[i] = authz.Entity{Type: binding.EntityType, ID: id}
		}
		return binding.Resource, binding.Action, selected, binding.Permission, nil
	}, nil
}

func exactBackendID(value any) (string, error) {
	const safe = float64(1<<53 - 1)
	switch actual := value.(type) {
	case string:
		if actual != "" && strings.TrimSpace(actual) == actual {
			return actual, nil
		}
	case int:
		if actual > 0 {
			return strconv.Itoa(actual), nil
		}
	case int64:
		if actual > 0 {
			return strconv.FormatInt(actual, 10), nil
		}
	case json.Number:
		parsed, err := strconv.ParseInt(string(actual), 10, 64)
		if err == nil && parsed > 0 {
			return strconv.FormatInt(parsed, 10), nil
		}
	case float64:
		if actual > 0 && !math.IsNaN(actual) && !math.IsInf(actual, 0) && math.Trunc(actual) == actual && actual <= safe {
			return strconv.FormatInt(int64(actual), 10), nil
		}
	}
	return "", ErrDenied
}

func (a *ActionAuthorizer) DatasourceCallback(mapper BackendMapper) func(context.Context, string, map[string]interface{}) error {
	return func(ctx context.Context, id string, inputs map[string]interface{}) error {
		if mapper == nil {
			return ErrDenied
		}
		resource, action, selected, permission, err := mapper(ctx, "datasource.fetch", id, inputs)
		if err != nil {
			return err
		}
		return a.AuthorizeMany(ctx, resource, action, selected, permission)
	}
}

func (a *ActionAuthorizer) ReportCallback(mapper BackendMapper) func(context.Context, string, string) error {
	return func(ctx context.Context, operation, id string) error {
		if mapper == nil {
			return ErrDenied
		}
		resource, action, selected, permission, err := mapper(ctx, operation, id, nil)
		if err != nil {
			return err
		}
		return a.AuthorizeMany(ctx, resource, action, selected, permission)
	}
}

func (a *ActionAuthorizer) ToolCallback(mapper BackendMapper) func(context.Context, string, map[string]interface{}) error {
	return func(ctx context.Context, name string, args map[string]interface{}) error {
		if mapper == nil {
			return ErrDenied
		}
		resource, action, selected, permission, err := mapper(ctx, "tool.execute", name, args)
		if err != nil {
			return err
		}
		return a.AuthorizeMany(ctx, resource, action, selected, permission)
	}
}
