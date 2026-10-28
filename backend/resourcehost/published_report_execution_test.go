package resource

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	reporting "github.com/viant/forge/backend/reporting/engine"
	csvexport "github.com/viant/forge/backend/reporting/export/csv"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/viant/forge/backend/reporting/registry"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	auth "github.com/viant/mcp/client/auth/link"
)

type publishedDataTransport func(context.Context, string, map[string]interface{}) (string, error)

func (f publishedDataTransport) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	return f(ctx, name, args)
}

func closedPublishedReport(t *testing.T, source *syntheticPublishedSource) {
	t.Helper()
	descriptor := json.RawMessage(`{"id":"rows","cardinality":"collection","selectors":{"data":"data"},"backend":{"kind":"mcp_tool","service":"data","method":"read"}}`)
	spec := json.RawMessage(`{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"example","stateKey":"example","dataSourceRef":"rows"},"title":"Example","parameters":{"viewMode":"table","groupBy":"","pageSize":25,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["details"]},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"rows","request":{"limit":25,"offset":0,"filters":{"scope":"approved"}}}],"blocks":[{"id":"details","kind":"tableBlock","title":"Details","datasetRef":"primary","columns":[{"key":"name","label":"Name"},{"key":"amount","label":"Amount"}]}]}`)
	child := json.RawMessage(`{"schemaVersion":1,"dataSource":` + string(descriptor) + `}`)
	envelope := registry.ReportEnvelope{SchemaVersion: 2, Format: registry.ResourceReportFormat, ReportSpec: spec, DataSources: map[string]json.RawMessage{"rows": descriptor}, DataSourceResources: map[string]primitive.DataSourceReference{"rows": {Resource: identity.ResourceRef{URI: "datasource://example/rows", Revision: identity.WorkingCandidate}, ProviderIdentity: "publisher", ContentFingerprint: identity.ContentFingerprint(child)}}}
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	state := source.states["report://example/sample"]
	state.Definition = nil
	state.DefinitionBytes = raw
	state.ContentFingerprint = identity.ContentFingerprint(raw)
	state.FormatVersion = 2
	source.states[state.URI] = state
}

func TestPublishedClosedReportCompilesRunsAndExportsThroughRealDatasourcePipeline(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	closedPublishedReport(t, source)
	service := reporting.New(reporting.Options{Compiler: reporting.NewReportSpecCompiler(nil), ReportCatalog: &ReportGatewayCatalog{Gateway: g}})
	service.SetResourceReaderFactory((&ReportGatewayCatalog{Gateway: g}).Reader)
	dependencyCalls := 0
	service.SetResourceDependencies(func(context.Context, identity.ResolvedResource, map[string]primitive.DataSourceReference, map[string]json.RawMessage, map[string]identity.ResolvedResource) (map[string]identity.ResolvedResource, error) {
		dependencyCalls++
		return nil, errors.New("closed dependencies must not be separate metadata reads")
	}, nil)
	dataCalls := 0
	rejectData := false
	during := func() {}
	service.SetResourceDatasetExecutor(reporting.NewResourceDatasetExecutor(publishedDataTransport(func(ctx context.Context, method string, args map[string]interface{}) (string, error) {
		dataCalls++
		require.Equal(t, "data:read", method)
		require.Equal(t, "reader", auth.EffectiveUserID(ctx))
		require.Equal(t, "approved", args["filters"].(map[string]interface{})["scope"])
		pin, ok := requestctx.ResolvedResourceFromContext(ctx)
		require.True(t, ok)
		require.Equal(t, identity.PublishedCandidate, pin.Kind)
		if rejectData {
			return "", errors.New("data admission denied")
		}
		during()
		return `{"data":[{"name":"Example","amount":7}]}`, nil
	}), service.AuthorizeResourceDataset))
	ctx := auth.InjectUser(context.Background(), "reader")
	ref := &identity.ResourceRef{URI: "report://example/sample"}
	compiled, err := service.Compile(ctx, &reporting.CompileRequest{Resource: ref})
	require.NoError(t, err)
	require.Empty(t, compiled.DependencyPins)
	require.Empty(t, compiled.DependencyToken)
	require.Zero(t, dependencyCalls)
	before := source.gets.Load()
	result, err := service.ExecuteResource(ctx, &reporting.ExecuteResourceRequest{Resource: ref})
	require.NoError(t, err)
	require.Len(t, result.Datasets["primary"].Rows, 1)
	require.NotEmpty(t, result.ReportPrint)
	require.Empty(t, result.DependencyPins)
	require.EqualValues(t, 1, source.gets.Load()-before, "run hydrates only the report root once")
	table := "details"
	exported, err := service.ExecuteResource(ctx, &reporting.ExecuteResourceRequest{ResolvedResource: result.Resource, TableBlockID: &table, DatasetFetchMode: reporting.DatasetFetchComplete})
	require.NoError(t, err)
	fill, err := reportfill.DecodeJSON(exported.ReportFill)
	require.NoError(t, err)
	csv, err := csvexport.Render(fill)
	require.NoError(t, err)
	require.Contains(t, string(csv), "Example,7")
	lookup, err := service.FetchResourceDatasource(ctx, *ref, "rows", map[string]interface{}{"filters": map[string]interface{}{"scope": "approved"}})
	require.NoError(t, err)
	require.Len(t, lookup.Rows, 1)
	// An ordinary data transport denial remains an operation failure.
	rejectData = true
	denied, err := service.ExecuteResource(ctx, &reporting.ExecuteResourceRequest{Resource: ref})
	require.Error(t, err)
	require.Nil(t, denied)
	rejectData = false
	// The root must remain admitted after the data call, before rows or export release.
	during = func() { source.denied = true }
	revoked, err := service.ExecuteResource(ctx, &reporting.ExecuteResourceRequest{Resource: ref})
	require.Error(t, err)
	require.Nil(t, revoked)
	require.Positive(t, dataCalls)
	require.Zero(t, dependencyCalls)
	require.Zero(t, trap.calls)
}

func TestPublishedPreparedReportFencesLocallyWithoutBodyReads(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	closedPublishedReport(t, source)
	catalog := &ReportGatewayCatalog{Gateway: g}
	service := reporting.New(reporting.Options{Compiler: reporting.NewReportSpecCompiler(nil), ReportCatalog: catalog})
	service.SetResourceReaderFactory(catalog.Reader)
	calls := 0
	during := func() {}
	service.SetResourceDatasetExecutor(reporting.NewResourceDatasetExecutor(publishedDataTransport(func(context.Context, string, map[string]interface{}) (string, error) {
		calls++
		during()
		return `{"data":[{"name":"Example","amount":7}]}`, nil
	}), service.AuthorizeResourceDataset))
	ctx := context.Background()
	plan, err := service.PrepareReport(ctx, &reporting.CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/sample"}})
	require.NoError(t, err)
	before := source.gets.Load()
	table := "details"
	result, err := service.ExecutePreparedReport(ctx, plan, &reporting.ExecuteResourceRequest{TableBlockID: &table})
	require.NoError(t, err)
	require.NotEmpty(t, result.ReportFill)
	require.Equal(t, before, source.gets.Load())
	during = func() { source.denied = true }
	result, err = service.ExecutePreparedReport(ctx, plan, &reporting.ExecuteResourceRequest{})
	require.Error(t, err)
	require.Nil(t, result)
	require.Equal(t, before, source.gets.Load())
	oldCalls := calls
	result, err = service.ExecutePreparedReport(ctx, plan, &reporting.ExecuteResourceRequest{})
	require.Error(t, err)
	require.Nil(t, result)
	require.Equal(t, oldCalls, calls)
	require.Zero(t, trap.calls)
}

func TestPublishedPreparedWindowBuilderFencesOriginalWindow(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	closedPublishedReport(t, source)
	raw := json.RawMessage(`{"kind":"producer-validated-window"}`)
	windowURI := "window://example/builder"
	source.states[windowURI] = primitive.ResourceState{URI: windowURI, Kind: "window", Namespace: "example", Name: "builder", DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)}
	selected, err := g.Get(context.Background(), Connection{Name: "catalog", ProviderIdentity: "publisher"}, identity.ResourceRef{URI: windowURI}, nil)
	require.NoError(t, err)
	prepared, err := reporting.PrepareWindowBuilderRuntime(context.Background(), *selected.ResolvedResource, selected.Resource.DefinitionBytes, nil)
	require.NoError(t, err)
	catalog := &ReportGatewayCatalog{Gateway: g}
	service := reporting.New(reporting.Options{ReportCatalog: catalog})
	service.SetResourceReaderFactory(catalog.Reader)
	calls := 0
	during := func() {}
	service.SetResourceDatasetExecutor(reporting.NewResourceDatasetExecutor(publishedDataTransport(func(context.Context, string, map[string]interface{}) (string, error) {
		calls++
		during()
		return `{"data":[{"name":"Example","amount":7}]}`, nil
	}), service.AuthorizeResourceDataset))
	derive := func(_ context.Context, pin identity.ResolvedResource, raw json.RawMessage) (registry.ReportEnvelope, error) {
		require.Equal(t, windowURI, pin.URI)
		var envelope registry.ReportEnvelope
		err := json.Unmarshal(source.states["report://example/sample"].DefinitionBytes, &envelope)
		return envelope, err
	}
	reader, err := catalog.Reader(context.Background(), "report.execute")
	require.NoError(t, err)
	require.NoError(t, reader.(reporting.PublishedResourceVerifier).VerifyPublishedResource(context.Background(), *selected.ResolvedResource))
	before := source.gets.Load()
	result, err := service.ExecutePreparedWindowBuilder(context.Background(), prepared, &reporting.ExecuteResourceRequest{}, derive)
	require.NoError(t, err, "data calls: %d", calls)
	require.NotEmpty(t, result.ReportFill)
	require.Equal(t, before, source.gets.Load())
	during = func() { source.denied = true }
	result, err = service.ExecutePreparedWindowBuilder(context.Background(), prepared, &reporting.ExecuteResourceRequest{}, derive)
	require.Error(t, err)
	require.Nil(t, result)
	previous := calls
	result, err = service.ExecutePreparedWindowBuilder(context.Background(), prepared, &reporting.ExecuteResourceRequest{}, derive)
	require.Error(t, err)
	require.Nil(t, result)
	require.Equal(t, previous, calls)
	require.Zero(t, trap.calls)
}
