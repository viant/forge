package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

// Independent synthetic gateways model configuration lookup during a caller's
// selected resource operation. A failed foreign lookup must not poison that
// caller, while a failed selected read on the owning gateway remains terminal.
func TestMCPReferenceForeignMetadataFailurePreservesCallerSequence(t *testing.T) {
	caller, _, _, _ := readSequenceFixture(t)
	configuration, _, _, _ := readSequenceFixture(t)
	ctx, finish, err := caller.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	reader := &MCPReferenceReader{gateway: configuration}
	metadataCtx := reader.metadataContext(ctx)
	_, err = configuration.GetForProvider(metadataCtx, "owned", identity.ResourceRef{URI: "window://example/missing"}, nil)
	require.Error(t, err)
	_, err = ReadContext(ctx)
	require.NoError(t, err, "foreign metadata failure must not poison an unrelated selected operation")
	_, err = caller.GetForProvider(ctx, "owned", identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.NoError(t, err, "healthy caller resource remains available after foreign metadata failure")
	require.NoError(t, finish())
}

func TestMCPReferenceOwningMetadataFailureRemainsTerminal(t *testing.T) {
	caller, _, _, _ := readSequenceFixture(t)
	ctx, finish, err := caller.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	reader := &MCPReferenceReader{gateway: caller}
	_, err = caller.GetForProvider(reader.metadataContext(ctx), "owned", identity.ResourceRef{URI: "window://example/missing"}, nil)
	require.Error(t, err)
	_, err = ReadContext(ctx)
	require.Error(t, err, "a selected read failure on the actual owner cannot be masked")
	require.Error(t, finish())
}
