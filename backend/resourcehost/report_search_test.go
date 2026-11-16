package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	catalog "github.com/viant/forge/backend/reporting/catalog"
	identity "github.com/viant/forge/backend/resource"
)

// Synthetic published metadata proves title search without application captures.
func TestPublishedReportSearchUsesPreparedIndexAndScopedCursor(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	for uri := range source.states {
		delete(source.states, uri)
	}
	for name, title := range map[string]string{"001": "Delivery Overview", "002": "Delivery Detail", "003": "Inventory Summary"} {
		raw := []byte(`{"schemaVersion":1,"reportDocument":{"title":"` + title + `"},"reportSpec":{"kind":"reportSpec","title":"` + title + `","datasets":[],"blocks":[]}}`)
		uri := "report://example/" + name
		source.states[uri] = primitive.ResourceState{URI: uri, Kind: "report", Namespace: "example", Name: name, Title: title, FormatVersion: 1, DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)}
	}
	c := &ReportGatewayCatalog{Gateway: g}
	ctx := context.Background()
	q := catalog.ReportCatalogQuery{Namespace: "example", Search: "Delivery", Limit: 1}
	first, err := c.List(ctx, q)
	require.NoError(t, err)
	require.Len(t, first.Reports, 1)
	require.NotEmpty(t, first.NextCursor)
	reads := source.gets.Load()
	for i := 0; i < 3; i++ {
		page, e := c.List(ctx, q)
		require.NoError(t, e)
		require.Equal(t, first.Reports[0].URI, page.Reports[0].URI)
	}
	require.Equal(t, reads, source.gets.Load(), "warm search must not reload definitions")
	q.Cursor = first.NextCursor
	next, err := c.List(ctx, q)
	require.NoError(t, err)
	require.Len(t, next.Reports, 1)
	require.NotEqual(t, first.Reports[0].URI, next.Reports[0].URI)
	require.Empty(t, next.NextCursor)
	q.Search = "Inventory"
	_, err = c.List(ctx, q)
	require.ErrorIs(t, err, primitive.ErrCatalogCursor)
	q.Cursor = ""
	page, err := c.List(ctx, q)
	require.NoError(t, err)
	require.Len(t, page.Reports, 1)
	require.Equal(t, "report://example/003", page.Reports[0].URI)
	q.Namespace = "missing"
	page, err = c.List(ctx, q)
	require.NoError(t, err)
	require.Empty(t, page.Reports)
	require.Zero(t, trap.calls, "published search must not invoke remote discovery")
	source.denied = true
	q.Namespace = "example"
	page, err = c.List(ctx, q)
	if err == nil {
		require.Empty(t, page.Reports, "cached search cannot bypass revoked admission")
	}
}

func TestSavedReportPublisherSelectsOneDefinitionWithoutProbingPeers(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	reader := &gatewayReportReader{catalog: &ReportGatewayCatalog{Gateway: g}}
	ref := identity.ResourceRef{URI: "report://example/sample"}
	ctx := t.Context()
	for _, publisher := range []string{"retired", "publisher"} {
		selected, err := reader.ReportReaderForProvider(ctx, ref, publisher)
		if publisher == "retired" {
			require.ErrorIs(t, err, identity.ErrResourceDenied)
			require.Nil(t, selected)
			require.Zero(t, source.gets.Load())
		} else {
			require.NoError(t, err)
			result, err := selected.(*gatewayReportReader).ReadDefinition(ctx, ref, nil)
			require.NoError(t, err)
			require.Equal(t, publisher, result.ResolvedResource.ProviderIdentity)
			require.EqualValues(t, 1, source.gets.Load())
		}
		require.Zero(t, trap.calls)
	}
}

type unavailablePeerSettings struct{ publishedTrapProvider }

func (*unavailablePeerSettings) Names(context.Context) ([]string, error) {
	return []string{"unavailable-peer"}, nil
}
func (p *unavailablePeerSettings) CatalogNames(ctx context.Context) ([]string, error) {
	return p.Names(ctx)
}

func TestKnownPublishedReportDoesNotReadUnrelatedConnectionSettings(t *testing.T) {
	old, source, _, _ := publishedFixture(t)
	peer := &unavailablePeerSettings{}
	mgr, err := manager.New(peer)
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	g := NewGateway(mgr, old.Actor, old.Verify, "host")
	t.Cleanup(g.Close)
	require.NoError(t, g.RegisterPublishedMetadataSource(Connection{Name: "replica", ProviderIdentity: "publisher"}, []string{"example"}, source, "replica-alias"))
	ref := identity.ResourceRef{URI: "report://example/sample"}
	reader := &gatewayReportReader{catalog: &ReportGatewayCatalog{Gateway: g}}
	for _, ctx := range []context.Context{t.Context(), context.WithValue(t.Context(), catalogRootsKey{}, []Connection{{Name: "replica-alias", ProviderIdentity: "publisher"}})} {
		selected, err := reader.ReportReaderForProvider(ctx, ref, "publisher")
		require.NoError(t, err)
		got, err := selected.(*gatewayReportReader).ReadDefinition(ctx, ref, nil)
		require.NoError(t, err)
		require.Equal(t, "publisher", got.ResolvedResource.ProviderIdentity)
	}
	require.Zero(t, peer.calls)
}

func TestDeclaredReportScopeNarrowsPagesAndBindsCursor(t *testing.T) {
	g, source, _, _ := publishedFixture(t)
	for uri := range source.states {
		delete(source.states, uri)
	}
	for _, item := range []struct{ name, value string }{{"a", "42"}, {"b", "[0,false,9007199254740993]"}} {
		raw := []byte(`{"schemaVersion":1,"reportDocument":{"title":"Sample","unrelated":{"team":false}},"reportSpec":{"kind":"reportSpec","title":"Sample","scope":{"params":[{"id":"team","value":` + item.value + `}]}}}`)
		uri := "report://example/" + item.name
		source.states[uri] = primitive.ResourceState{URI: uri, Kind: "report", Namespace: "example", Name: item.name, Title: "Sample", FormatVersion: 1, DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)}
	}
	c := &ReportGatewayCatalog{Gateway: g}
	q := catalog.ReportCatalogQuery{Namespace: "example", Limit: 1, Scope: &catalog.ScopeFilter{Key: "team", Value: json.RawMessage("false")}}
	first, err := c.List(t.Context(), q)
	require.NoError(t, err)
	require.Empty(t, first.Reports)
	require.NotEmpty(t, first.NextCursor)
	q.Cursor = first.NextCursor
	next, err := c.List(t.Context(), q)
	require.NoError(t, err)
	require.Len(t, next.Reports, 1)
	require.Equal(t, "b", next.Reports[0].Name)
	require.Empty(t, next.NextCursor)
	q.Scope.Value = json.RawMessage("0")
	_, err = c.List(t.Context(), q)
	require.Error(t, err)
	q.Namespace = "different"
	q.Scope.Value = json.RawMessage("false")
	_, err = c.List(t.Context(), q)
	require.Error(t, err)
	q.Namespace = "example"
	q.Cursor = ""
	q.Limit = 10
	for _, tc := range []struct {
		value   string
		matches int
	}{{"0", 1}, {"0e7", 1}, {"9007199254740993", 1}, {"9007199254740992", 0}, {`"false"`, 0}, {`["missing",false]`, 1}} {
		q.Scope.Value = json.RawMessage(tc.value)
		found, err := c.List(t.Context(), q)
		require.NoError(t, err)
		require.Len(t, found.Reports, tc.matches, tc.value)
	}
	q.Scope.Key = "undeclared"
	empty, err := c.List(t.Context(), q)
	require.NoError(t, err)
	require.Empty(t, empty.Reports)
}
