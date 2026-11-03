package reporting

import (
	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"testing"
)

func TestReportInvocationDelegatesProducerArgumentPolicy(t *testing.T) {
	for _, value := range []any{false, true, "summary", []any{"selected"}} {
		descriptor := &dsproto.DataSource{Backend: &dsproto.Backend{Pinned: map[string]any{"mode": false}}}
		args, err := reportDatasetArguments(nil, map[string]any{"mode": value}, descriptor, nil, nil)
		require.NoError(t, err)
		require.Equal(t, value, args["mode"])
		require.Equal(t, false, descriptor.Backend.Pinned["mode"], "producer-owned pins remain unchanged")
	}
	for _, name := range []string{"_private", "backend", "service", "method", "source", "filters", "options"} {
		t.Run(name, func(t *testing.T) {
			_, err := reportDatasetArguments(nil, map[string]any{name: false}, &dsproto.DataSource{Backend: &dsproto.Backend{Pinned: map[string]any{name: false}}}, nil, nil)
			require.Error(t, err, "producer delegation must not bypass reserved transport guards")
		})
	}
}
