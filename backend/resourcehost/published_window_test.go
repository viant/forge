package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	datasource "github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	forgeprovider "github.com/viant/forge/backend/provider"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func closedPublishedWindow(t *testing.T, source *syntheticPublishedSource) string {
	t.Helper()
	uri := "window://example/closed"
	raw, err := types.CanonicalWindowDescriptor(json.RawMessage(`{"id":"rows","cardinality":"collection","selectors":{"data":"data"},"backend":{"kind":"mcp_tool","service":"data","method":"read"}}`))
	require.NoError(t, err)
	fingerprint, err := types.WindowDescriptorFingerprint(raw)
	require.NoError(t, err)
	variant := types.WindowResourceVariant{Window: &types.Window{View: types.View{Content: &types.Container{ID: "root"}}, DataSource: map[string]types.DataSource{"rows": {}}, ResourceDependencies: map[string]string{"rows": fingerprint}}, DataSources: map[string]json.RawMessage{"rows": raw}, DataSourceResources: map[string]primitive.DataSourceReference{"rows": {Resource: identity.ResourceRef{URI: "datasource://example/rows", Revision: identity.WorkingCandidate}, ProviderIdentity: "publisher", ContentFingerprint: identity.ContentFingerprint([]byte(`{"schemaVersion":1,"dataSource":` + string(raw) + `}`))}}}
	hash, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	envelope := types.WindowResourceEnvelope{SchemaVersion: 3, Format: types.WindowReferencesFormat, Targets: []types.WindowTargetBinding{{Variant: hash}}, Variants: map[string]types.WindowResourceVariant{hash: variant}}
	require.NoError(t, envelope.Validate(), "synthetic producer validates before publication")
	payload, err := json.Marshal(envelope)
	require.NoError(t, err)
	source.states[uri] = primitive.ResourceState{URI: uri, Kind: "window", Namespace: "example", Name: "closed", Title: "Closed window", FormatVersion: 3, DefinitionBytes: payload, ContentFingerprint: identity.ContentFingerprint(payload)}
	return uri
}
func TestPublishedWindowBackendConsumerUsesClosedDescriptorsWithoutChildRoots(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	uri := closedPublishedWindow(t, source)
	proof, err := types.NewWindowTargetHMAC(make([]byte, 32))
	require.NoError(t, err)
	catalog := &WindowCatalog{Gateway: g, TargetProof: proof}
	opened, err := catalog.Get(context.Background(), &forgeprovider.WindowDefinitionGetInput{WindowID: uri})
	require.NoError(t, err)
	require.Equal(t, identity.PublishedCandidate, opened.Definition.Resource.Kind)
	require.Empty(t, opened.Definition.ResourceTarget.DependencyPins)
	bodyReads := source.gets.Load()
	require.EqualValues(t, 1, bodyReads)
	opened.Definition.View.Content.ID = "caller-mutation"
	again, err := catalog.Get(context.Background(), &forgeprovider.WindowDefinitionGetInput{WindowID: uri})
	require.NoError(t, err)
	require.Equal(t, "root", again.Definition.View.Content.ID)
	require.Equal(t, bodyReads, source.gets.Load(), "immutable representation cache never reopens the body")
	ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	pin, target := again.Definition.Resource, again.Definition.ResourceTarget
	descriptor, err := catalog.ResolveDatasource(ctx, *pin, target, "rows")
	require.NoError(t, err)
	require.Equal(t, "data", descriptor.Backend.Service)
	require.Empty(t, target.DependencyPins)
	calls, admissions := 0, 0
	denyData := false
	during := func() {}
	service := datasource.New(datasource.Options{DisableCache: true, ResolveDefinition: catalog.ResolveDatasource, AuthorizeDefinition: func(context.Context, *dsproto.DataSource, map[string]interface{}) error {
		admissions++
		if denyData {
			return errors.New("data admission denied")
		}
		return nil
	}, Executor: publishedDataTransport(func(_ context.Context, name string, _ map[string]interface{}) (string, error) {
		calls++
		during()
		require.Equal(t, "data:read", name)
		return `{"data":[{"name":"Example"}]}`, nil
	})})
	fetchCtx := requestctx.WithWindowTarget(requestctx.WithResolvedResource(ctx, *pin), target)
	result, err := service.Fetch(fetchCtx, "rows", nil, datasource.FetchOptions{BypassCache: true})
	require.NoError(t, err)
	require.Len(t, result.Rows, 1)
	require.Positive(t, admissions)
	require.Equal(t, 1, calls)
	require.NoError(t, finish())
	require.Equal(t, bodyReads, source.gets.Load())
	require.Zero(t, trap.calls)
	denyData = true
	result, err = service.Fetch(requestctx.WithWindowTarget(requestctx.WithResolvedResource(context.Background(), *pin), target), "rows", nil, datasource.FetchOptions{BypassCache: true})
	require.Error(t, err)
	require.Nil(t, result)
	require.Equal(t, 1, calls)
	denyData = false
	during = func() { source.denied = true }
	result, err = service.Fetch(requestctx.WithWindowTarget(requestctx.WithResolvedResource(context.Background(), *pin), target), "rows", nil, datasource.FetchOptions{BypassCache: true})
	require.Error(t, err)
	require.Nil(t, result)
	require.Equal(t, 2, calls)
	source.denied = true
	_, err = catalog.Get(context.Background(), &forgeprovider.WindowDefinitionGetInput{WindowID: uri})
	require.Error(t, err)
	_, err = catalog.ResolveDatasource(context.Background(), *pin, target, "rows")
	require.Error(t, err)
	require.Zero(t, trap.calls)
}
func TestPublishedWindowOriginalPinAndTargetCannotSurviveSelectionChanges(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	uri := closedPublishedWindow(t, source)
	proof, err := types.NewWindowTargetHMAC(make([]byte, 32))
	require.NoError(t, err)
	catalog := &WindowCatalog{Gateway: g, TargetProof: proof}
	opened, err := catalog.Get(context.Background(), &forgeprovider.WindowDefinitionGetInput{WindowID: uri})
	require.NoError(t, err)
	pin, target := opened.Definition.Resource, opened.Definition.ResourceTarget
	forged := *target
	forged.DependencyPins = map[string]identity.ResolvedResource{"rows": {}}
	_, err = catalog.ResolveDatasource(context.Background(), *pin, &forged, "rows")
	require.Error(t, err)
	source.admission = "new-session"
	_, err = catalog.ResolveDatasource(context.Background(), *pin, target, "rows")
	require.Error(t, err)
	require.Error(t, catalog.CheckWindowContent(context.Background(), uri, *pin, target))
	require.Zero(t, trap.calls)
}

func TestPublishedBrowserWindowSourceSharesTypedLoaderAndOwnsMutableVariants(t *testing.T) {
	gateway, source, trap, _ := publishedFixture(t)
	uri := closedPublishedWindow(t, source)
	decodes := 0
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) {
		if event.Phase == "artifact.load.decode" {
			decodes++
		}
	}))
	first, hash, err := gateway.OpenPublishedWindowVariantForProvider(ctx, "publisher", uri, nil)
	require.NoError(t, err)
	require.Equal(t, source.states[uri].ContentFingerprint, hash)
	descriptor := bytes.Clone(first.DataSources["rows"])
	first.Window.View.Content.ID = "caller-mutation"
	first.DataSources["rows"][0] = '!'
	delete(first.DataSourceResources, "rows")
	second, secondHash, err := gateway.OpenPublishedWindowVariantForProvider(ctx, "publisher", uri, nil)
	require.NoError(t, err)
	require.Equal(t, hash, secondHash)
	require.Equal(t, "root", second.Window.View.Content.ID)
	require.Equal(t, descriptor, []byte(second.DataSources["rows"]))
	require.Contains(t, second.DataSourceResources, "rows")
	require.NotSame(t, first.Window, second.Window)
	require.EqualValues(t, 1, source.gets.Load())
	require.Equal(t, 1, decodes)
	require.Zero(t, trap.calls)
	source.denied = true
	denied, _, err := gateway.OpenPublishedWindowVariantForProvider(ctx, "publisher", uri, nil)
	require.Error(t, err)
	require.Nil(t, denied)
	require.EqualValues(t, 1, source.gets.Load())
	require.Equal(t, 1, decodes)
}
func TestPublishedBrowserWindowSourceRejectsWrongBindingOwnerBeforeBodyRead(t *testing.T) {
	gateway, source, trap, _ := publishedFixture(t)
	uri := closedPublishedWindow(t, source)
	denied, _, err := gateway.OpenPublishedWindowVariantForProvider(context.Background(), "other-publisher", uri, nil)
	require.Error(t, err)
	require.Nil(t, denied)
	require.Zero(t, source.gets.Load())
	denied, _, err = gateway.OpenPublishedWindowVariantForProvider(context.Background(), "publisher", "window://unclaimed/closed", nil)
	require.Error(t, err)
	require.Nil(t, denied)
	require.Zero(t, source.gets.Load())
	require.Zero(t, trap.calls)
}
