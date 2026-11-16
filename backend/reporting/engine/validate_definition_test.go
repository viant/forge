package reporting

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	ds "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"os"
	"testing"
)

func TestValidateDefinitionReusesCompilerWithoutResourceOrDataReads(t *testing.T) {
	service := New(Options{Compiler: NewReportSpecCompiler(nil), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) {
		t.Fatal("candidate validation attempted source resolution")
		return nil, nil
	}})
	service.SetResourceDatasetExecutor(func(context.Context, identity.ResolvedResource, *ds.DataSource, map[string]interface{}) (*ds.FetchResult, error) {
		t.Fatal("candidate validation executed data")
		return nil, nil
	})
	authored, err := os.ReadFile("testdata/authored_report.json")
	require.NoError(t, err)
	before := append([]byte(nil), authored...)
	require.NoError(t, service.ValidateDefinition(context.Background(), "report://example/summary", authored))
	require.Equal(t, before, authored)
	spec, err := os.ReadFile("../materializer/testdata/presentation-report.json")
	require.NoError(t, err)
	native, err := json.Marshal(map[string]any{"schemaVersion": 1, "reportSpec": json.RawMessage(spec)})
	require.NoError(t, err)
	require.NoError(t, service.ValidateDefinition(context.Background(), "report://example/native", native))
	for _, raw := range []json.RawMessage{json.RawMessage(`{"unexpected":true}`), json.RawMessage(`{"schemaVersion":1,"reportSpec":{}}`), json.RawMessage(`{"schemaVersion":1,"format":"forge.authoredReport","reportDocument":{},"builderDefinition":{}}`)} {
		err = service.ValidateDefinition(context.Background(), "report://example/summary", raw)
		require.Error(t, err)
		var phase *CompileStageError
		require.ErrorAs(t, err, &phase)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.ErrorIs(t, service.ValidateDefinition(ctx, "report://example/summary", authored), context.Canceled)
}
