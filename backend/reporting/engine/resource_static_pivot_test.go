package reporting

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/viant/forge/backend/reporting/materializer"
	identity "github.com/viant/forge/backend/resource"
)

func TestResourceStaticPivotCompletesObservedDomainAcrossPages(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/library-static-pivot.json")
	require.NoError(t, err)
	var fixture struct {
		Block map[string]any   `json:"block"`
		Rows  []map[string]any `json:"rows"`
	}
	require.NoError(t, json.Unmarshal(raw, &fixture))
	raw, err = os.ReadFile("../materializer/testdata/presentation-report.json")
	require.NoError(t, err)
	var spec map[string]any
	require.NoError(t, json.Unmarshal(raw, &spec))
	spec["title"] = "Library visits"
	spec["blocks"] = []any{fixture.Block}
	spec["layoutIntent"] = map[string]any{"kind": "single", "resultPanePosition": "bottom", "blockOrder": []string{"visits"}}
	spec["datasets"] = []any{map[string]any{"id": "primary", "dataSourceRef": "reader", "request": map[string]any{"offset": 0, "limit": 2}, "resultContract": map[string]any{"shape": "rows", "rowPath": "rows", "hasMorePath": "dataInfo.hasMore"}}}
	raw, err = json.Marshal(map[string]any{
		"schemaVersion":  1,
		"reportDocument": map[string]any{"title": "Library visits"},
		"reportSpec":     spec,
		"dataSources": map[string]any{"reader": map[string]any{
			"id": "reader", "cardinality": "collection",
			"paging":  map[string]any{"enabled": true, "mode": "offset", "parameters": map[string]any{"page": "offset", "size": "limit"}, "dataInfoSelectors": map[string]any{"hasMore": "hasMore"}},
			"backend": map[string]any{"kind": "mcp_tool", "service": "library", "method": "read"},
		}},
	})
	require.NoError(t, err)
	uri, err := identity.ParseResourceURI("report://example/library-visits")
	require.NoError(t, err)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "synthetic", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	rows := append([]map[string]any{fixture.Rows[0], fixture.Rows[2], fixture.Rows[1]}, fixture.Rows[3:]...)
	calls := 0
	service.SetResourceDatasetExecutor(func(_ context.Context, _ identity.ResolvedResource, _ *dsproto.DataSource, args map[string]any) (*dsproto.FetchResult, error) {
		calls++
		offset, err := reportPagingInteger(args["offset"])
		require.NoError(t, err)
		limit, err := reportPagingInteger(args["limit"])
		require.NoError(t, err)
		require.Equal(t, int64(2), limit)
		end := min(int(offset+limit), len(rows))
		return &dsproto.FetchResult{Rows: rows[int(offset):end], DataInfo: map[string]any{"hasMore": end < len(rows)}}, nil
	})
	request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true, DatasetFetchMode: DatasetFetchComplete, TablePresentations: materializer.TablePresentations{"visits": {Sort: &materializer.TableSort{Key: "registeredMembers", Direction: "asc"}}}}
	result, err := service.ExecuteResource(t.Context(), request)
	require.NoError(t, err)
	require.Equal(t, 4, calls)
	require.Len(t, result.Datasets["primary"].Rows, 7)
	fill, err := reportfill.DecodeJSON(result.ReportFill)
	require.NoError(t, err)
	table := fill.Blocks[0]
	require.Len(t, table.Content.Columns, 7)
	require.Equal(t, "February", table.Content.ColumnGroups[3].Label)
	require.Equal(t, "South", table.Content.ResolvedRows[0].Cells[1].Value)
	require.EqualValues(t, 0, table.Content.ResolvedRows[0].Cells[2].Value)
	require.EqualValues(t, 120, table.Content.ResolvedRows[1].Cells[2].Value)
	rows[2]["registeredMembers"] = 121
	calls = 0
	_, err = service.ExecuteResource(t.Context(), request)
	require.Equal(t, 4, calls)
	require.ErrorContains(t, err, "static field registeredMembers has inconsistent values")
}
