// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"errors"
	"github.com/viant/authz"
	"time"
)

var ErrGateInvalid = errors.New("authorization gate decision invalid")

// GateCheck is the host adapter for mandatory account, entity, and entitlement
// requirements. It must use trusted server mappings and the verified account;
// an ACL allow never bypasses a configured gate.
type GateCheck func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error)

type GateResult struct {
	Allow      bool
	Revision   string
	ValidUntil time.Time
}

// EvaluatorBridge is implemented by the shared gating.Evaluator without
// importing its module into Core's older published authz dependency. The host
// supplies the typed evaluator and Core validates every returned binding.
type EvaluatorBridge interface {
	Check(context.Context, authz.Resource, string, []authz.Entity) (bool, string, time.Time, string, string, string, string, error)
}

// RequirementsOnlyBridge is used only after a trusted host has established an
// inherited or public-consumption ACL grant. Its result cannot grant access by
// itself; the shared evaluator still enforces all mandatory requirements.
type RequirementsOnlyBridge interface {
	CheckRequirementsOnly(context.Context, authz.Resource, string, []authz.Entity) (bool, string, time.Time, string, string, string, string, error)
}

func GateFromEvaluator(evaluator EvaluatorBridge) GateCheck {
	if evaluator == nil {
		return nil
	}
	return func(ctx context.Context, expected authz.Facts, accountID string, resource authz.Resource, action string, selected *authz.Entity) (GateResult, error) {
		var selection []authz.Entity
		if selected != nil {
			selection = []authz.Entity{*selected}
		}
		allow, revision, validUntil, subject, issuer, tenant, account, err := evaluator.Check(hostIdentityContext(ctx), resource, action, selection)
		if err != nil {
			return GateResult{}, err
		}
		if subject != expected.Subject || issuer != expected.Issuer || tenant != expected.Tenant || account != accountID || revision == "" || !validUntil.After(time.Now()) {
			return GateResult{}, ErrGateInvalid
		}
		return GateResult{Allow: allow, Revision: revision, ValidUntil: validUntil}, nil
	}
}
