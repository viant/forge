package resource

import (
	"context"

	identity "github.com/viant/forge/backend/resource"
)

type authoredTestPolicy struct{ actor identity.VerifiedActor }

func (p authoredTestPolicy) SelectRevision(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	if len(c) != 1 {
		return identity.ResourceDecision{}, identity.ErrResourceDenied
	}
	return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "public-authored", ValidUntil: p.actor.ValidUntil}, nil
}
