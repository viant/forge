package resource

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	authctx "github.com/viant/mcp/client/auth/link"
)

// The two sources are synthetic: one fails validation and the other drains a
// cancelled dispatch. No producer data or application definitions are involved.
func TestReadSequenceCancelledSiblingPreservesProducerFailure(t *testing.T) {
	for _, change := range []string{"stable", "revoked", "credential", "owner-cancelled"} {
		t.Run(change, func(t *testing.T) {
			g, _, actor, _ := readSequenceFixture(t)
			base, cancelOwner := context.WithCancel(context.Background())
			defer cancelOwner()
			ctx, finish, err := g.BeginReadSequence(authctx.WithIDToken(base, "original"), nil)
			require.NoError(t, err)
			// Verify the caller credential as well as the live actor. Completing a
			// cancelled child must never replace its credential with the owner's.
			verify := g.Verify
			g.Verify = func(ctx context.Context, held identity.VerifiedActor) error {
				if authctx.IDToken(ctx) != "original" {
					return identity.ErrResourceDenied
				}
				return verify(ctx, held)
			}
			workCtx, cancelWork := context.WithCancel(ctx)
			defer cancelWork()
			finishSource, err := requestctx.BeginResourceReadDispatch(workCtx)
			require.NoError(t, err)
			siblingCtx := workCtx
			if change == "credential" {
				siblingCtx = authctx.WithIDToken(siblingCtx, "foreign")
			}
			finishSibling, err := requestctx.BeginResourceReadDispatch(siblingCtx)
			require.NoError(t, err)
			producerErr := errors.New("synthetic source: required input missing")
			require.NoError(t, finishSource())
			if change == "revoked" {
				actor.IdentityRevision = "revoked"
			}
			if change == "owner-cancelled" {
				cancelOwner()
			}
			cancelWork() // report workers cancel siblings after receiving producerErr
			siblingErr := finishSibling()
			resultErr := errors.Join(producerErr, finish())
			require.ErrorIs(t, resultErr, producerErr)
			if change == "stable" {
				require.NoError(t, siblingErr, "shared POST phase belongs to the live report operation")
				require.NotErrorIs(t, resultErr, identity.ErrResourceDenied, "cancelled sibling must not turn a producer failure into denial")
			} else {
				require.ErrorIs(t, siblingErr, identity.ErrResourceDenied)
				require.ErrorIs(t, resultErr, identity.ErrResourceDenied, "real authority failures remain terminal")
			}
		})
	}
}
