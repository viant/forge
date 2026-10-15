// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"time"
)

// CapabilityBinding is a server-owned translation from authored UI vocabulary
// to the exact ACL action and optional selected business-entity type.
type CapabilityBinding struct {
	UseResolvedResource bool           `json:"useResolvedResource,omitempty"`
	ResourceType        string         `json:"resourceType"`
	Capability          string         `json:"capability"`
	Global              bool           `json:"global"`
	Resource            authz.Resource `json:"resource"`
	Action              string         `json:"action"`
	EntityType          string         `json:"entityType,omitempty"`
}

type capabilityBindingKey struct {
	resourceType, capability string
	global                   bool
}

func NewStaticCapabilityMappings(bindings []CapabilityBinding) (CapabilityMapping, CapabilityMappingV2, error) {
	index := make(map[capabilityBindingKey]CapabilityBinding, len(bindings))
	for _, binding := range bindings {
		binding.ResourceType = strings.ToLower(strings.TrimSpace(binding.ResourceType))
		if binding.ResourceType == "" || binding.Capability == "" || strings.TrimSpace(binding.Capability) != binding.Capability || (!binding.UseResolvedResource && (binding.Resource.Kind == "" || binding.Resource.ID == "" || binding.Resource.Version == "" || binding.Resource.Tenant == "")) || (binding.UseResolvedResource && (binding.Resource.Kind != "" || binding.Resource.ID != "" || binding.Resource.Version != "" || binding.Resource.Tenant == "" || binding.Resource.Tenant == "*")) || binding.Action == "" || (binding.Global && binding.EntityType != "") || (!binding.Global && binding.EntityType == "") {
			return nil, nil, fmt.Errorf("invalid UI capability binding")
		}
		key := capabilityBindingKey{binding.ResourceType, binding.Capability, binding.Global}
		if _, exists := index[key]; exists {
			return nil, nil, fmt.Errorf("duplicate UI capability binding")
		}
		index[key] = binding
	}
	lookup := func(ctx context.Context, resourceType, capability string, global bool) (CapabilityBinding, error) {
		if ctx == nil || ctx.Err() != nil {
			return CapabilityBinding{}, authz.ErrDenied
		}
		binding, ok := index[capabilityBindingKey{strings.ToLower(strings.TrimSpace(resourceType)), capability, global}]
		if !ok {
			return CapabilityBinding{}, authz.ErrDenied
		}
		if binding.UseResolvedResource {
			pin, found := requestctx.ResolvedResourceFromContext(ctx)
			if !found || pin == nil || !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) || pin.AuthorityBinding == "" || !pin.ResourceCandidate.Valid() {
				return CapabilityBinding{}, authz.ErrDenied
			}
			uri, err := identity.ParseResourceURI(pin.URI)
			if err != nil {
				return CapabilityBinding{}, authz.ErrDenied
			}
			binding.Resource = authz.Resource{Kind: uri.Kind, ID: pin.URI, Version: pin.Selector(), Tenant: binding.Resource.Tenant}
		}
		return binding, nil
	}
	v1 := func(ctx context.Context, resourceType string, id int, capability string, global bool) (authz.Resource, string, *authz.Entity, error) {
		binding, err := lookup(ctx, resourceType, capability, global)
		if err != nil || global && id != 0 || !global && id <= 0 {
			return authz.Resource{}, "", nil, authz.ErrDenied
		}
		if global {
			return binding.Resource, binding.Action, nil, nil
		}
		return binding.Resource, binding.Action, &authz.Entity{Type: binding.EntityType, ID: strconv.Itoa(id)}, nil
	}
	v2 := func(ctx context.Context, resourceType, id, capability string, global bool) (authz.Resource, string, *authz.Entity, error) {
		binding, err := lookup(ctx, resourceType, capability, global)
		if err != nil || global && id != "" || !global && (id == "" || strings.TrimSpace(id) != id) {
			return authz.Resource{}, "", nil, authz.ErrDenied
		}
		if global {
			return binding.Resource, binding.Action, nil, nil
		}
		return binding.Resource, binding.Action, &authz.Entity{Type: binding.EntityType, ID: id}, nil
	}
	return v1, v2, nil
}
