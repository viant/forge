// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"errors"
	"github.com/viant/authz"
	"time"
)

// ActionAuthorizer is the common backend check for host-owned datasource,
// report and mutation mappings. Its callers choose exact resources/actions;
// this type composes shared ACL decisions with mandatory gates and named entity
// permissions without interpreting policy rules itself.
type ActionAuthorizer struct {
	Service                   *authz.Service
	Account                   func(context.Context, authz.Facts) (string, error)
	Gate                      GateCheck
	GateEvaluator             EvaluatorBridge
	EntityPermission          func(context.Context, authz.Facts, authz.Entity, string) (bool, error)
	EntityPermissionWithLease func(context.Context, authz.Facts, authz.Entity, string) (bool, time.Time, error)
}

func (a *ActionAuthorizer) Authorize(ctx context.Context, resource authz.Resource, action string, selected *authz.Entity, permission string) error {
	var selection []authz.Entity
	if selected != nil {
		selection = []authz.Entity{*selected}
	}
	return a.AuthorizeMany(ctx, resource, action, selection, permission)
}

func (a *ActionAuthorizer) AuthorizeMany(ctx context.Context, resource authz.Resource, action string, selected []authz.Entity, permission string) error {
	return a.authorizeMany(ctx, resource, action, selected, permission, nil)
}

// AuthorizeManyWithLease returns the effective authority deadline after all ACL,
// gate, selected-permission and identity checks. Consumers may narrow this lease.
func (a *ActionAuthorizer) AuthorizeManyWithLease(ctx context.Context, resource authz.Resource, action string, selected []authz.Entity, permission string) (time.Time, error) {
	var lease time.Time
	err := a.authorizeMany(ctx, resource, action, selected, permission, &lease)
	return lease, err
}

func (a *ActionAuthorizer) authorizeMany(ctx context.Context, resource authz.Resource, action string, selected []authz.Entity, permission string, leaseOut *time.Time) error {
	if a == nil || a.Service == nil || a.Service.Provider == nil || a.Account == nil || (a.Gate == nil && a.GateEvaluator == nil) || ctx == nil || ctx.Err() != nil || resource.Kind == "" || resource.ID == "" || resource.Tenant == "" || action == "" || (len(selected) == 0 && permission != "") {
		return ErrDenied
	}
	facts, err := a.Service.Provider.Resolve(ctx)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return ErrIdentityRejected
		}
		return err
	}
	if facts.Subject == "" || facts.Issuer == "" || facts.Tenant == "" || !facts.ValidUntil.After(time.Now()) || (resource.Tenant != "*" && resource.Tenant != facts.Tenant) {
		return ErrIdentityRejected
	}
	accountID, err := a.Account(ctx, facts)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return ErrIdentityRejected
		}
		return err
	}
	if accountID == "" {
		return ErrIdentityRejected
	}
	operationLease := facts.ValidUntil
	reconfirm := func() error {
		current, err := a.Service.Provider.Resolve(ctx)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return ErrIdentityRejected
			}
			return err
		}
		if !SameAuthorityFacts(facts, current, time.Now()) {
			return ErrIdentityRejected
		}
		currentAccount, err := a.Account(ctx, current)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return ErrIdentityRejected
			}
			return err
		}
		if currentAccount != accountID {
			return ErrIdentityRejected
		}
		if current.ValidUntil.Before(operationLease) {
			operationLease = current.ValidUntil
		}
		if !current.ValidUntil.After(time.Now()) {
			return ErrIdentityRejected
		}
		return nil
	}
	decision, current, err := AuthorizeSharedSelection(a.Service, ctx, authz.Request{Resource: resource, Action: action}, selected)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			if checkErr := reconfirm(); checkErr != nil {
				return checkErr
			}
			return ErrDenied
		}
		return err
	}
	if current.Subject != "" && !SameAuthorityFacts(facts, current, time.Now()) {
		return ErrIdentityRejected
	}
	if decision.Bounded {
		if len(selected) == 0 {
			return ErrDenied
		}
		for _, requested := range selected {
			found := false
			for _, entity := range decision.Entities {
				found = found || entity == requested
			}
			if !found {
				return ErrDenied
			}
		}
	}
	if current.Subject != "" && current.ValidUntil.Before(operationLease) {
		operationLease = current.ValidUntil
	}
	if a.GateEvaluator != nil {
		allow, revision, lease, subject, issuer, tenant, account, err := a.GateEvaluator.Check(hostIdentityContext(ctx), resource, action, selected)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				if checkErr := reconfirm(); checkErr != nil {
					return checkErr
				}
				return ErrDenied
			}
			return err
		}
		if revision == "" || !lease.After(time.Now()) || subject != facts.Subject || issuer != facts.Issuer || tenant != facts.Tenant || account != accountID {
			return ErrGateInvalid
		}
		if !allow {
			return ErrDenied
		}
		if lease.Before(operationLease) {
			operationLease = lease
		}
	} else {
		if len(selected) > 1 {
			return ErrDenied
		}
		var entity *authz.Entity
		if len(selected) == 1 {
			entity = &selected[0]
		}
		gate, err := a.Gate(ctx, facts, accountID, resource, action, entity)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				if checkErr := reconfirm(); checkErr != nil {
					return checkErr
				}
				return ErrDenied
			}
			return err
		}
		if gate.Revision == "" || !gate.ValidUntil.After(time.Now()) {
			return ErrGateInvalid
		}
		if !gate.Allow {
			return ErrDenied
		}
		if gate.ValidUntil.Before(operationLease) {
			operationLease = gate.ValidUntil
		}
	}
	if permission != "" {
		if a.EntityPermission == nil && a.EntityPermissionWithLease == nil {
			return ErrDenied
		}
		for _, entity := range selected {
			var allowed bool
			var permissionLease time.Time
			if a.EntityPermissionWithLease != nil {
				allowed, permissionLease, err = a.EntityPermissionWithLease(ctx, facts, entity, permission)
			} else {
				allowed, err = a.EntityPermission(ctx, facts, entity, permission)
			}
			if err != nil {
				if errors.Is(err, authz.ErrDenied) {
					if checkErr := reconfirm(); checkErr != nil {
						return checkErr
					}
					return ErrDenied
				}
				return err
			}
			if !allowed {
				return ErrDenied
			}
			if a.EntityPermissionWithLease != nil {
				if !permissionLease.After(time.Now()) {
					return ErrGateInvalid
				}
				if permissionLease.Before(operationLease) {
					operationLease = permissionLease
				}
			}
		}
	}
	if err := reconfirm(); err != nil {
		return err
	}
	if !operationLease.After(time.Now()) {
		return ErrGateInvalid
	}
	if leaseOut != nil {
		*leaseOut = operationLease
	}
	return nil
}

// WindowCallback adapts whole-window admission to Forge's catalog callback.
// It runs on every list candidate and direct get/open. Explicit denials are
// hidden; service failures remain visible to the host as errors.
func (a *ActionAuthorizer) WindowCallback(mapper func(context.Context, string, Candidate) (authz.Resource, string, error)) func(context.Context, string) (bool, error) {
	return func(ctx context.Context, id string) (bool, error) {
		if mapper == nil {
			return false, ErrDenied
		}
		resource, action, err := mapper(ctx, OperationWindowView, Candidate{ID: id, Kind: "window"})
		if err != nil {
			if errors.Is(err, ErrIdentityRejected) {
				return false, err
			}
			if errors.Is(err, ErrDenied) || errors.Is(err, authz.ErrDenied) {
				return false, nil
			}
			return false, err
		}
		err = a.Authorize(ctx, resource, action, nil, "")
		if errors.Is(err, ErrIdentityRejected) {
			return false, err
		}
		if errors.Is(err, ErrDenied) || errors.Is(err, authz.ErrDenied) {
			return false, nil
		}
		return err == nil, err
	}
}
