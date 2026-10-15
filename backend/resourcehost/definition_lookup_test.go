package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	mcpclient "github.com/viant/mcp/client"
	mcpcfg "github.com/viant/mcp/client/config"
	"testing"
	"time"
)

func TestResolveDefinitionCustomWrappedDecoderAndExactURI(t *testing.T) {
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "synthetic", TenantID: "team", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	source := &localFixtureSource{raw: json.RawMessage(`{"schemaVersion":1,"dataSource":{"id":"authored-inner","selectors":{"data":"rows"}}}`)}
	local, err := NewLocalProvider(LocalConfig{ProviderIdentity: "wrapped", Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: []LocalResourceBinding{{URI: "datasource://team/outer", FormatVersion: 1, Resolver: func(_ context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: "wrapped", Source: source, Policy: localFixturePolicy{actor: a}}, nil
	}}}, Validators: map[string]LocalResourceValidator{"datasource": func(_ int64, raw json.RawMessage) error { _, err := datasourceDefinition(raw); return err }}})
	require.NoError(t, err)
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	require.NoError(t, mgr.RegisterLocal(context.Background(), "wrapped", &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "wrapped"}, func(context.Context) (mcpclient.Interface, error) { return NewLocalMCPClient(local) }))
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "host")
	defer g.Close()
	got, err := ResolveDefinition[*dsproto.DataSource](context.Background(), g, "datasource", "authored-inner", func(d *dsproto.DataSource) string { return d.ID }, datasourceDefinition)
	require.NoError(t, err)
	require.Equal(t, "authored-inner", got.Definition.ID)
	require.Equal(t, "datasource://team/outer", got.Resource.URI)
	got, err = ResolveDefinition[*dsproto.DataSource](context.Background(), g, "datasource", "datasource://team/outer", func(*dsproto.DataSource) string { t.Fatal("exact URI must not consult authored alias"); return "wrong" }, datasourceDefinition)
	require.NoError(t, err)
	require.Equal(t, "authored-inner", got.Definition.ID)
}
