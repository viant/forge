package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

func TestWorkingDefinitionChangesAreReadWithoutCatalogNotification(t *testing.T) {
	for _, selector := range []string{"", identity.WorkingCandidate} {
		t.Run("selector="+selector, func(t *testing.T) {
			owner := provider("owner")
			gateway, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": owner})
			defer gateway.Close()
			ctx := context.Background()
			connections, err := gateway.Discover(ctx)
			require.NoError(t, err)
			ref := identity.ResourceRef{URI: "window://example/sales", Revision: selector}
			before, err := Get[json.RawMessage](ctx, gateway, connections[0].Connection, ref, nil)
			require.NoError(t, err)
			owner.definition = json.RawMessage(`{"schemaVersion":2,"view":{"title":"Updated at source"}}`)
			after, err := Get[json.RawMessage](ctx, gateway, connections[0].Connection, ref, nil)
			require.NoError(t, err)
			require.NotEqual(t, before.Definition, after.Definition)
			require.Contains(t, string(after.Definition), "Updated at source")
			require.Equal(t, 2, owner.calls["windows/get"], "a later operation must read the mutable selection from its owner")
		})
	}
}
