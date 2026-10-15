// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package reporting

import (
	"context"

	identity "github.com/viant/forge/backend/resource"
)

type reportPolicyFunc func(context.Context, identity.ResourceRef, []identity.ResourceCandidate) (identity.ResourceDecision, error)

func (f reportPolicyFunc) SelectRevision(ctx context.Context, ref identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	return f(ctx, ref, c)
}
