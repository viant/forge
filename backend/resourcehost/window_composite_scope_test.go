package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type scopedLocalWindowCatalog struct {
	localCatalogStub
	finish func() error
}

func (c scopedLocalWindowCatalog) BeginWindowList(ctx context.Context) (context.Context, func() error, error) {
	return ctx, c.finish, nil
}

func TestCompositeWindowListFinalAuthorityFailureDiscardsCombinedRows(t *testing.T) {
	for _, finalErr := range []error{nil, identity.ErrResourceDenied, context.Canceled} {
		p := provider("studio-a")
		g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
		proof, err := types.NewWindowTargetHMAC(make([]byte, 32))
		require.NoError(t, err)
		remote := &WindowCatalog{Gateway: g, TargetProof: proof}
		finished := 0
		local := scopedLocalWindowCatalog{localCatalogStub{service.WindowDefinitionSummary{WindowID: "local", ResourceURI: "window://local/home"}}, func() error {
			finished++
			return finalErr
		}}
		rows, err := (&CompositeWindowCatalog{Local: local, Remote: remote}).List(context.Background(), nil)
		require.Equal(t, 1, finished, "the whole-list authority must finish exactly once")
		if finalErr == nil {
			require.NoError(t, err)
			require.Len(t, rows.Windows, 2)
		} else {
			require.ErrorIs(t, err, finalErr)
			require.Nil(t, rows, "a final authority failure cannot expose either provider's rows")
		}
	}
}
