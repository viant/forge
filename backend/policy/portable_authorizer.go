// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"

	"github.com/viant/authz"
	forgeservice "github.com/viant/forge/backend/provider"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

// PrimitiveResourceMapper resolves only host-owned publication/datasource
// identities. Inputs contain selected values, never authoritative actor facts.
type PrimitiveResourceMapper func(context.Context, string, string, string, map[string]any) (authz.Resource, string, []authz.Entity, string, error)

// PortableAuthorizer connects provider-side Forge admission to the same ACL,
// mandatory gates, and selected-entity authority used for local Core operations.
// The provider host remains responsible for publication revision and executing
// the exact mapped datasource with the verified current credential.
type PortableAuthorizer struct {
	Action            *ActionAuthorizer
	AuthorityRevision func(context.Context, authz.Facts, string) (string, time.Time, error)
	Map               PrimitiveResourceMapper
}

var _ forgeservice.PrimitiveAuthority = (*PortableAuthorizer)(nil)
var _ forgeservice.PrimitiveFetchAuthority = (*PortableAuthorizer)(nil)

func (a *PortableAuthorizer) Authenticate(ctx context.Context) (string, error) {
	if a == nil || a.Action == nil || a.Action.Service == nil || a.Action.Service.Provider == nil || a.Action.Account == nil || a.AuthorityRevision == nil || a.Map == nil || ctx == nil || ctx.Err() != nil {
		return "", ErrIdentityRejected
	}
	facts, err := a.Action.Service.Provider.Resolve(ctx)
	if err != nil {
		return "", err
	}
	if facts.Subject == "" || facts.Issuer == "" || facts.Tenant == "" || !facts.ValidUntil.After(time.Now()) {
		return "", ErrIdentityRejected
	}
	account, err := a.Action.Account(ctx, facts)
	if err != nil {
		return "", err
	}
	if account == "" {
		return "", ErrIdentityRejected
	}
	revision, lease, err := a.AuthorityRevision(ctx, facts, account)
	if err != nil {
		return "", err
	}
	if revision == "" || !lease.After(time.Now()) || !facts.ValidUntil.After(time.Now()) || ctx.Err() != nil {
		return "", ErrIdentityRejected
	}
	// Expiry is checked on each call, not hashed: shorter refreshed leases must
	// narrow authority without spuriously changing an otherwise stable identity.
	facts.ValidUntil = time.Time{}
	raw, err := json.Marshal(struct {
		Facts             authz.Facts
		Account, Revision string
	}{facts, account, revision})
	if err != nil {
		return "", ErrIdentityRejected
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}
func (a *PortableAuthorizer) verify(ctx context.Context, binding string) error {
	current, err := a.Authenticate(ctx)
	if err != nil {
		return err
	}
	if binding == "" || current != binding {
		return ErrIdentityRejected
	}
	return nil
}
func (a *PortableAuthorizer) Authorize(ctx context.Context, binding, operation, key, source string) error {
	if err := a.verify(ctx, binding); err != nil {
		return err
	}
	// Fetch's selected-entity check requires its actual inputs. Forge also checks
	// resource.describe on this definition, then invokes AuthorizeFetch before
	// dispatch. Do not run an unselected entity gate or invent an unrestricted grant.
	if operation == "resource.execute" && source != "" {
		return nil
	}
	resource, action, selected, permission, err := a.Map(ctx, operation, key, source, nil)
	if err != nil {
		return err
	}
	if err = a.Action.AuthorizeMany(ctx, resource, action, selected, permission); err != nil {
		return err
	}
	return a.verify(ctx, binding)
}
func (a *PortableAuthorizer) AuthorizeFetch(ctx context.Context, binding string, in *windowprotocol.FetchInput) error {
	if in == nil || in.ContractVersion != windowprotocol.Version || in.WindowKey == "" || in.DataSourceID == "" || in.DefinitionRevision == "" {
		return ErrDenied
	}
	if err := a.verify(ctx, binding); err != nil {
		return err
	}
	resource, action, selected, permission, err := a.Map(ctx, "datasource.fetch", in.WindowKey, in.DataSourceID, in.Inputs)
	if err != nil {
		return err
	}
	if err = a.Action.AuthorizeMany(ctx, resource, action, selected, permission); err != nil {
		return err
	}
	return a.verify(ctx, binding)
}
