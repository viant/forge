package reporting

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	reportcsv "github.com/viant/forge/backend/reporting/export/csv"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	identity "github.com/viant/forge/backend/resource"
)

func TestSummaryRowExecutionReusesDeclaredDataset(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/report-table-summary.json")
	require.NoError(t, err)
	var fixture struct {
		Spec map[string]any `json:"spec"`
	}
	require.NoError(t, json.Unmarshal(raw, &fixture))
	// Two tables and a KPI share one existing summary dataset. The executor below
	// is the actual datasource consumer boundary, not a helper invocation count.
	blocks := fixture.Spec["blocks"].([]any)
	fixture.Spec["blocks"] = append(blocks, map[string]any{"id": "totalMetric", "kind": "kpiBlock", "title": "Total", "datasetRef": "summary", "valueField": "count", "valueLabel": "Count"})
	envelope := map[string]any{"schemaVersion": 1, "reportDocument": map[string]any{"title": "Observations"}, "reportSpec": fixture.Spec, "dataSources": map[string]any{"source": map[string]any{"id": "source", "cardinality": "collection", "backend": map[string]any{"kind": "mcp_tool", "service": "synthetic", "method": "read"}}}}
	encoded, err := json.Marshal(envelope)
	require.NoError(t, err)
	uri, err := identity.ParseResourceURI("report://example/observations")
	require.NoError(t, err)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return encoded, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "synthetic", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	var mutex sync.Mutex
	calls := 0
	service.SetResourceDatasetExecutor(func(_ context.Context, _ identity.ResolvedResource, _ *dsproto.DataSource, _ map[string]interface{}) (*dsproto.FetchResult, error) {
		mutex.Lock()
		calls++
		mutex.Unlock()
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"count": float64(40), "rate": float64(0), "optional": nil}}, DataInfo: map[string]interface{}{"hasMore": false}}, nil
	})
	// The later selected execution is a fresh operation, not a data-cache hit.
	for _, selected := range []bool{false, true} {
		calls = 0
		request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true, DatasetFetchMode: DatasetFetchPage}
		if selected {
			id := "details"
			request.TableBlockID = &id
		}
		result, err := service.ExecuteResource(t.Context(), request)
		require.NoError(t, err)
		require.Equal(t, 2, calls, "detail and summary fetched once each, irrespective of consumer count")
		fill, err := reportfill.DecodeDatasourceJSON(result.ReportFill)
		require.NoError(t, err)
		count := 0
		for _, block := range fill.Blocks {
			if block.Kind == "tableBlock" {
				count++
				require.NotNil(t, block.Content.SummaryRow)
				require.EqualValues(t, 40, block.Content.SummaryRow.Cells[1].Value)
			}
		}
		// Rendering the trusted fill itself performs no new producer reads.
		reads := calls
		fill.Blocks = fill.Blocks[:1]
		_, err = reportcsv.Render(fill)
		require.NoError(t, err)
		require.Equal(t, reads, calls)
		if selected {
			require.Equal(t, 1, count)
		} else {
			require.Equal(t, 2, count)
		}
	}
}
