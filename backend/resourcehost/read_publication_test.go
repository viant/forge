package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
)

func TestReadPublicationPreservesOperationAndOriginalLease(t *testing.T) {
	g, p, _, _ := readSequenceFixture(t)
	ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	_, err = g.GetForProvider(ctx, "owned", identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.NoError(t, err)
	original := sequenceFromContext(ctx)
	lease := original.lease
	end, err := requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	require.NoError(t, end())
	namespaces := p.calls["namespaces/get"]
	require.NoError(t, requestctx.CheckResourceReadPublication(ctx))
	require.False(t, original.closed)
	require.True(t, original.active)
	require.Equal(t, lease, original.lease, "publication must not renew original authority")
	require.NotEmpty(t, original.originalReads)
	require.Equal(t, namespaces, p.calls["namespaces/get"], "publication must reuse the existing namespace contract")
	end, err = requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	require.NoError(t, end())
	require.NoError(t, finish())
}
func TestReadPublicationRejectsOutstandingDispatchAndRevocation(t *testing.T) {
	for _, change := range []string{"identity", "expiry", "cancel"} {
		t.Run(change, func(t *testing.T) {
			g, _, actor, _ := readSequenceFixture(t)
			base, cancel := context.WithCancel(context.Background())
			defer cancel()
			ctx, finish, err := g.BeginReadSequence(base, nil)
			require.NoError(t, err)
			_, err = g.GetForProvider(ctx, "owned", identity.ResourceRef{URI: "window://example/sales"}, nil)
			require.NoError(t, err)
			end, err := requestctx.BeginResourceReadDispatch(ctx)
			require.NoError(t, err)
			require.Error(t, requestctx.CheckResourceReadPublication(ctx), "cannot publish while a source is still active")
			require.NoError(t, end())
			switch change {
			case "identity":
				actor.IdentityRevision = "revoked"
			case "expiry":
				actor.ValidUntil = time.Now().Add(-time.Second)
			case "cancel":
				cancel()
			}
			require.Error(t, requestctx.CheckResourceReadPublication(ctx))
			require.Error(t, finish(), "observed denial remains terminal")
		})
	}
}
