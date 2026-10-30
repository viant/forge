package reporting

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/materializer"
	identity "github.com/viant/forge/backend/resource"
	"sort"
	"strings"
	"testing"
	"time"
)

func TestReportPageSortUsesAdmittedColumns(t *testing.T) {
	spec := json.RawMessage(`{"blocks":[{"id":"items","kind":"tableBlock","datasetRef":"records","columns":[{"key":"quantity","sourceKey":"count"}]}]}`)
	choices := materializer.TablePresentations{"items": {Sort: &materializer.TableSort{Key: "quantity", Direction: "desc"}}}
	sorts, err := reportDatasetSorts(spec, choices)
	require.NoError(t, err)
	require.Equal(t, map[string]string{"records": "count desc"}, sorts)
	args := map[string]any{"orderBy": []string{"name asc"}, "filters": map[string]any{"region": "east"}, "offset": 25, "limit": 25}
	descriptor := &dsproto.DataSource{Backend: &dsproto.Backend{}}
	require.NoError(t, applyReportDatasetSort(descriptor, args, sorts["records"]))
	require.Equal(t, []string{"count desc", "name asc"}, args["orderBy"])
	require.Equal(t, map[string]any{"region": "east"}, args["filters"])
	require.Equal(t, 25, args["limit"])
	descriptor.Backend.Pinned = map[string]any{"orderBy": []string{"name asc"}}
	require.Error(t, applyReportDatasetSort(descriptor, args, "count asc"))
	choices["items"] = materializer.TablePresentation{Sort: &materializer.TableSort{Key: "injected desc", Direction: "asc"}}
	_, err = reportDatasetSorts(spec, choices)
	require.Error(t, err)
	require.Error(t, applyReportDatasetSort(&dsproto.DataSource{Backend: &dsproto.Backend{}}, map[string]any{}, "count asc"))
}

// Independent six-row inventory fixture: both extrema are outside the initial
// two-row page. The ordinary admitted executor, rather than the renderer, sorts.
func TestResourcePageSortFetchesGlobalOrder(t *testing.T) {
	raw := json.RawMessage(`{"schemaVersion":1,"reportDocument":{"title":"Inventory"},"reportSpec":{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"inventory","stateKey":"inventory","dataSourceRef":"reader"},"title":"Inventory","parameters":{"viewMode":"table","groupBy":"","pageSize":2,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["items"]},"refinements":[],"calculatedFields":[],"datasets":[{"id":"records","dataSourceRef":"reader","request":{"offset":0,"limit":2,"orderBy":["id asc"],"filters":{"region":"east"}},"resultContract":{"shape":"rows","rowPath":"rows","hasMorePath":"dataInfo.hasMore"}}],"blocks":[{"id":"items","kind":"tableBlock","datasetRef":"records","columns":[{"key":"count","label":"Count"}]}]},"dataSources":{"reader":{"id":"reader","cardinality":"collection","paging":{"enabled":true,"mode":"offset","parameters":{"page":"offset","size":"limit"},"dataInfoSelectors":{"hasMore":"hasMore"}},"backend":{"kind":"mcp_tool","service":"inventory","method":"read"}}}}`)
	uri, _ := identity.ParseResourceURI("report://example/inventory")
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "synthetic", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})

	calls := 0
	lexical := false
	service.SetResourceDatasetExecutor(func(_ context.Context, _ identity.ResolvedResource, _ *dsproto.DataSource, args map[string]any) (*dsproto.FetchResult, error) {
		calls++
		require.Equal(t, map[string]any{"region": "east"}, args["filters"])
		offset, err := reportPagingInteger(args["offset"])
		require.NoError(t, err)
		limit, err := reportPagingInteger(args["limit"])
		require.NoError(t, err)
		require.Equal(t, int64(2), limit)
		if lexical {
			values := []string{"10", "2", "20", "3"}
			rows := []map[string]any{}
			for _, value := range values[offset : offset+limit] {
				rows = append(rows, map[string]any{"id": value, "count": value})
			}
			return &dsproto.FetchResult{Rows: rows, DataInfo: map[string]any{"hasMore": offset+limit < 4}}, nil
		}
		orders := args["orderBy"].([]string)
		require.Equal(t, []string{orders[0], "id asc"}, orders)
		population := []struct{ id, count int }{{4, 2}, {3, 2}, {2, 1}, {6, 3}, {1, 1}, {5, 3}}
		sort.SliceStable(population, func(i, j int) bool {
			if population[i].count == population[j].count {
				return population[i].id < population[j].id
			}
			if strings.HasSuffix(orders[0], "desc") {
				return population[i].count > population[j].count
			}
			return population[i].count < population[j].count
		})
		rows := []map[string]any{}
		for _, row := range population[offset : offset+limit] {
			rows = append(rows, map[string]any{"id": row.id, "count": row.count})
		}
		return &dsproto.FetchResult{Rows: rows, DataInfo: map[string]any{"hasMore": offset+limit < int64(len(population))}}, nil
	})
	for _, tc := range []struct {
		direction string
		want      []int64
	}{{"asc", []int64{1, 2, 3, 4, 5, 6}}, {"desc", []int64{5, 6, 3, 4, 1, 2}}} {
		ids := []int64{}
		for offset := 0; offset < 6; offset += 2 {
			result, err := service.ExecuteResource(t.Context(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true, DatasetFetchMode: DatasetFetchPage, DatasetIDs: []string{"records"}, DatasetPageOffsets: map[string]int{"records": offset}, TablePresentations: materializer.TablePresentations{"items": {Sort: &materializer.TableSort{Key: "count", Direction: tc.direction}}}})
			require.NoError(t, err)
			for _, row := range result.Datasets["records"].Rows {
				id, err := reportPagingInteger(row["id"])
				require.NoError(t, err)
				ids = append(ids, id)
			}
			var effective struct {
				Datasets []struct {
					Request struct {
						OrderBy []string `json:"orderBy"`
					}
				}
			}
			require.NoError(t, json.Unmarshal(result.ReportSpec, &effective))
			require.Equal(t, []string{"count " + tc.direction, "id asc"}, effective.Datasets[0].Request.OrderBy)
		}
		require.Equal(t, tc.want, ids, "ties retain the admitted secondary order across all pages, with no duplicates or omissions")
	}
	require.Equal(t, 6, calls)
	lexical = true
	seen := []string{}
	for offset := 0; offset < 4; offset += 2 {
		result, err := service.ExecuteResource(t.Context(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true, DatasetFetchMode: DatasetFetchPage, DatasetIDs: []string{"records"}, DatasetPageOffsets: map[string]int{"records": offset}, TablePresentations: materializer.TablePresentations{"items": {Sort: &materializer.TableSort{Key: "count", Direction: "asc"}}}})
		require.NoError(t, err)
		var fill struct {
			Blocks []struct {
				Content struct {
					ResolvedRows []map[string]any `json:"resolvedRows"`
				} `json:"content"`
			}
		}
		require.NoError(t, json.Unmarshal(result.ReportFill, &fill))
		require.Len(t, fill.Blocks[0].Content.ResolvedRows, 2)
		for _, row := range fill.Blocks[0].Content.ResolvedRows {
			seen = append(seen, row["cells"].([]any)[0].(map[string]any)["value"].(string))
		}
	}
	require.Equal(t, []string{"10", "2", "20", "3"}, seen, "materialized bounded pages must retain the producer's lexical order")
	complete, err := service.ExecuteResource(t.Context(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true, DatasetFetchMode: DatasetFetchComplete, TablePresentations: materializer.TablePresentations{"items": {Sort: &materializer.TableSort{Key: "count", Direction: "asc"}}}})
	require.NoError(t, err)
	var full struct {
		Blocks []struct {
			Content struct {
				ResolvedRows []map[string]any `json:"resolvedRows"`
			} `json:"content"`
		}
	}
	require.NoError(t, json.Unmarshal(complete.ReportFill, &full))
	fullOrder := []string{}
	for _, row := range full.Blocks[0].Content.ResolvedRows {
		fullOrder = append(fullOrder, row["cells"].([]any)[0].(map[string]any)["value"].(string))
	}
	require.Equal(t, []string{"2", "3", "10", "20"}, fullOrder, "complete output retains global local display sorting")

}

func TestReportPageSortRejectsPresentationAndCalculatedColumns(t *testing.T) {
	for _, column := range []string{
		`{"key":"owner","sourceKey":"ownerId","displayKey":"owner.name"}`,
		`{"key":"owner","dataType":"object"}`,
		`{"key":"owner.name"}`,
		`{"key":"count","displayValueMap":{"1":"One"}}`,
		`{"key":"doubled"}`,
	} {
		spec := json.RawMessage(`{"calculatedFields":[{"id":"doubled","datasetRef":"records","expr":"count * 2"}],"blocks":[{"id":"items","kind":"tableBlock","datasetRef":"records","columns":[` + column + `]}]}`)
		var field struct{ Key string }
		require.NoError(t, json.Unmarshal([]byte(column), &field))
		_, err := reportDatasetSorts(spec, materializer.TablePresentations{"items": {Sort: &materializer.TableSort{Key: field.Key, Direction: "asc"}}})
		require.Error(t, err, column)
	}
}

func TestPagePresentationsRemoveOnlyConsumedSort(t *testing.T) {
	spec := json.RawMessage(`{"blocks":[{"id":"items","datasetRef":"records"},{"id":"other","datasetRef":"other"}]}`)
	choices := materializer.TablePresentations{"items": {Filter: "keep", ExpandedKeys: []string{"node"}, Sort: &materializer.TableSort{Key: "count", Direction: "asc"}}, "other": {Sort: &materializer.TableSort{Key: "id", Direction: "desc"}}}
	page := reportPageTablePresentations(spec, choices, map[string]string{"records": "count asc"})
	require.Nil(t, page["items"].Sort)
	require.Equal(t, "keep", page["items"].Filter)
	require.Equal(t, []string{"node"}, page["items"].ExpandedKeys)
	require.NotNil(t, choices["items"].Sort)
	require.Equal(t, choices["other"], page["other"])
	require.Equal(t, choices, reportPageTablePresentations(spec, choices, nil), "complete output retains global presentation sorting")
}
