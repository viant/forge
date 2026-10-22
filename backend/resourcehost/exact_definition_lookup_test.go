package resource

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type exactLookupProvider struct {
	*dependencyMCPProvider
	mu    sync.Mutex
	reads map[string]int
	lists int
}

func (p *exactLookupProvider) CallTool(ctx context.Context, req *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	p.mu.Lock()
	if req.Name == "datasources/get" {
		uri, _ := req.Arguments["uri"].(string)
		p.reads[uri]++
	}
	if req.Name == "datasources/list" {
		p.lists++
	}
	p.mu.Unlock()
	return p.dependencyMCPProvider.CallTool(ctx, req, opts...)
}
func exactLookupGateway(t *testing.T, duplicate bool) (*Gateway, map[string]*exactLookupProvider) {
	t.Helper()
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "fixture", TenantID: "team", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	providers := map[string]*exactLookupProvider{}
	options := fixtureOptions{}
	for _, name := range []string{"parent", "child"} {
		ns := name
		if duplicate {
			ns = "child"
		}
		items := map[string]*dependencyResource{}
		for _, id := range []string{"selected", "unrelated"} {
			items["datasource://"+ns+"/"+id] = &dependencyResource{raw: json.RawMessage(`{"schemaVersion":1,"dataSource":{"id":"` + id + `","selectors":{"data":"rows"}}}`), formatVersion: 1, revision: identity.WorkingCandidate, authorityBinding: name + "-authority", validUntil: actor.ValidUntil}
		}
		providers[name] = &exactLookupProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: name, items: items}, reads: map[string]int{}}
		options[name] = &cfg.MCPClient{PrimitiveProviderIdentity: name}
	}
	pool, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) { return providers[name], nil }))
	require.NoError(t, err)
	t.Cleanup(func() { pool.CloseConversation("") })
	gateway := NewGateway(pool, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "consumer")
	t.Cleanup(gateway.Close)
	return gateway, providers
}
func TestExactDefinitionLookupReadsOnlySelectedCrossProviderDefinition(t *testing.T) {
	g, providers := exactLookupGateway(t, false)
	providers["child"].items["datasource://child/selected"].revision = "5"
	got, err := ResolveDefinitionIn[*dsproto.DataSource](context.Background(), g, "datasource", "datasource://child/selected", DefinitionScope{Namespace: "parent", ProviderIdentity: "parent"}, func(*dsproto.DataSource) string { t.Fatal("exact URI must not inspect aliases"); return "" }, datasourceDefinition)
	require.NoError(t, err)
	require.Equal(t, "child", got.ResolvedResource.ProviderIdentity)
	require.Equal(t, "selected", got.Definition.ID)
	selected := providers["child"].items["datasource://child/selected"]
	require.Equal(t, identity.StampedCandidate, got.ResolvedResource.Kind)
	require.Equal(t, "5", got.ResolvedResource.Revision)
	require.Equal(t, identity.ContentFingerprint(selected.raw), got.ResolvedResource.ContentFingerprint)
	require.Equal(t, selected.authorityBinding, got.ResolvedResource.AuthorityBinding)
	require.Equal(t, map[string]int{"datasource://child/selected": 1}, providers["child"].reads)
	require.Empty(t, providers["parent"].reads)
	require.Zero(t, providers["parent"].lists)
	require.Zero(t, providers["child"].lists)
}

func TestRelativeDefinitionLookupRetainsAliasCollisionChecks(t *testing.T) {
	g, _ := exactLookupGateway(t, false)
	_, err := ResolveDefinition[*dsproto.DataSource](context.Background(), g, "datasource", "selected", func(d *dsproto.DataSource) string { return d.ID }, datasourceDefinition)
	require.ErrorIs(t, err, ErrCollision)
}
func TestExactDefinitionLookupUnknownAndAmbiguousNamespace(t *testing.T) {
	for _, duplicate := range []bool{false, true} {
		t.Run(map[bool]string{false: "unknown", true: "ambiguous"}[duplicate], func(t *testing.T) {
			g, providers := exactLookupGateway(t, duplicate)
			uri := "datasource://missing/selected"
			expected := identity.ErrResourceDenied
			if duplicate {
				uri = "datasource://child/selected"
				expected = ErrCollision
			}
			_, err := ResolveDefinition[*dsproto.DataSource](context.Background(), g, "datasource", uri, nil, datasourceDefinition)
			require.ErrorIs(t, err, expected)
			for _, p := range providers {
				require.Empty(t, p.reads)
				require.Zero(t, p.lists)
			}
		})
	}
}
func TestRelativeDefinitionLookupRetainsParentScope(t *testing.T) {
	g, providers := exactLookupGateway(t, false)
	got, err := ResolveDefinitionIn[*dsproto.DataSource](context.Background(), g, "datasource", "selected", DefinitionScope{Namespace: "parent", ProviderIdentity: "parent"}, func(d *dsproto.DataSource) string { return d.ID }, datasourceDefinition)
	require.NoError(t, err)
	require.Equal(t, "parent", got.ResolvedResource.ProviderIdentity)
	require.Empty(t, providers["child"].reads)
	require.Zero(t, providers["child"].lists)
}
