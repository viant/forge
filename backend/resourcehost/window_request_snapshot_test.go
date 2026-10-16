package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

func TestTypedWindowDecodeStillHonorsGenerationBarrier(t *testing.T) {
	source := provider("owning-provider")
	gateway, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": source})
	defer gateway.Close()
	rows, err := gateway.List(context.Background(), "window", "example")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	result, err := Get[genericWindow](context.Background(), gateway, rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil, func(raw json.RawMessage) (genericWindow, error) {
		var window genericWindow
		decodeErr := json.Unmarshal(raw, &window)
		gateway.Invalidate("remote")
		return window, decodeErr
	})
	require.ErrorIs(t, err, identity.ErrResourceStale)
	require.Nil(t, result, "generation invalidation during typed decode cannot release the admitted frame")
}
