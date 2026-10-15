// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/window/authorization"
)

type authorizationObservationKey struct{}
type authorizationObservation struct{ validUntil time.Time }

func (s *Service) resolveAuthorization(ctx context.Context, backend *dsproto.Backend, args map[string]interface{}) (interface{}, error) {
	deny := func() (interface{}, error) {
		return nil, fmt.Errorf("invalid or unavailable datasource authorization binding")
	}
	binding := backend.Authorization
	if s.permissions == nil || binding == nil || ctx.Err() != nil || backend.Service != "" || backend.Method != "" || backend.Component != nil || backend.ProducerKind != "" || len(backend.Pinned) != 0 {
		return deny()
	}
	if binding.SchemaVersion != 1 && binding.SchemaVersion != 2 || binding.ResourceType == "" || strings.TrimSpace(binding.ResourceType) != binding.ResourceType || binding.ResourceIDsArgument == "" || binding.MaxResourceIDs < 1 || binding.MaxResourceIDs > 100 || len(binding.Capabilities) == 0 || len(binding.Capabilities) > 32 {
		return deny()
	}
	request := &permittedview.Request{IncludePrincipal: binding.IncludePrincipal, SchemaVersion: binding.SchemaVersion, ResourceType: binding.ResourceType, RequestedCapabilities: append([]string{}, binding.Capabilities...)}
	capabilities := map[string]bool{}
	for _, capability := range request.RequestedCapabilities {
		if capability == "" || strings.TrimSpace(capability) != capability || capabilities[capability] {
			return deny()
		}
		capabilities[capability] = true
	}
	raw, err := json.Marshal(args[binding.ResourceIDsArgument])
	if err != nil {
		return deny()
	}
	var ids []json.RawMessage
	if json.Unmarshal(raw, &ids) != nil || len(ids) == 0 || len(ids) > binding.MaxResourceIDs {
		return deny()
	}
	seen := map[string]bool{}
	for _, rawID := range ids {
		var key string
		if binding.SchemaVersion == 2 {
			if json.Unmarshal(rawID, &key) != nil || key == "" || len(key) > 256 || strings.TrimSpace(key) != key {
				return deny()
			}
			request.StringResourceIDs = append(request.StringResourceIDs, key)
		} else {
			value, err := strconv.ParseInt(string(rawID), 10, 64)
			if err != nil || value < 1 || value > 9007199254740991 || int64(int(value)) != value {
				return deny()
			}
			key = strconv.FormatInt(value, 10)
			request.ResourceIDs = append(request.ResourceIDs, int(value))
		}
		if seen[key] {
			return deny()
		}
		seen[key] = true
	}
	snapshot, err := s.permissions.Resolve(ctx, request)
	if err != nil {
		return nil, err
	}
	if snapshot == nil || snapshot.AuthorizationVersion == "" || !snapshot.ExpiresAt.After(s.now()) || ctx.Err() != nil || (binding.SchemaVersion == 2) != (snapshot.SchemaVersion == 2) {
		return deny()
	}
	if observed, ok := ctx.Value(authorizationObservationKey{}).(*authorizationObservation); ok {
		observed.validUntil = snapshot.ExpiresAt
	}
	// Return only the exact requested projection, even if a provider accidentally
	// supplies a broader snapshot. The datasource is never a principal cache.
	output := &permittedview.Snapshot{SchemaVersion: snapshot.SchemaVersion, AuthorizationVersion: snapshot.AuthorizationVersion, ExpiresAt: snapshot.ExpiresAt, Resources: map[string]*permittedview.Resource{}}
	if binding.IncludePrincipal {
		output.Principal = snapshot.Principal
		output.Account = snapshot.Account
	}
	for key, resource := range snapshot.Resources {
		if !seen[key] || resource == nil {
			continue
		}
		actualID := strconv.Itoa(resource.ID)
		if binding.SchemaVersion == 2 {
			actualID = resource.IDString
		}
		if resource.Type != binding.ResourceType || actualID != key {
			return deny()
		}
		projected := &permittedview.Resource{Type: resource.Type, ID: resource.ID, IDString: resource.IDString, Capabilities: map[string]bool{}}
		for capability := range capabilities {
			projected.Capabilities[capability] = resource.Capabilities[capability]
		}
		output.Resources[key] = projected
	}
	encoded, err := json.Marshal(output)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(encoded, &result); err != nil {
		return nil, err
	}
	return result, nil
}
