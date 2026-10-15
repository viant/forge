package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"testing"
	"time"
)

func TestDelegatedWindowCatalogUsesExactProviderAndTarget(t *testing.T) {
	p := provider("studio-a")
	p.definition = localWindowBytes(t)
	g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
	proof, e := types.NewWindowTargetHMAC(bytes.Repeat([]byte{1}, 32))
	require.NoError(t, e)
	catalog := &WindowCatalog{Gateway: g, TargetProof: proof}
	listed, e := catalog.List(context.Background(), nil)
	require.NoError(t, e)
	require.Len(t, listed.Windows, 1)
	input := &service.WindowDefinitionGetInput{WindowID: listed.Windows[0].WindowID}
	opened, e := catalog.Get(context.Background(), input)
	require.NoError(t, e)
	require.Equal(t, "studio-a", opened.Definition.Resource.ProviderIdentity)
	require.NotEmpty(t, opened.Definition.ResourceTarget.SelectionToken)
	input.ResolvedResource = opened.Definition.Resource
	input.Target = opened.Definition.ResourceTarget
	_, e = catalog.Get(context.Background(), input)
	require.NoError(t, e)
	forged := *input.ResolvedResource
	forged.ProviderIdentity = "studio-b"
	input.ResolvedResource = &forged
	_, e = catalog.Get(context.Background(), input)
	require.ErrorIs(t, e, identity.ErrResourceDenied)
	input.ResolvedResource = opened.Definition.Resource
	phone := *opened.Definition.ResourceTarget
	phone.FormFactor = "phone"
	input.Target = &phone
	_, e = catalog.Get(context.Background(), input)
	require.Error(t, e)
	input.Target = opened.Definition.ResourceTarget
	p.definition = json.RawMessage(`{"view":{"content":{"id":"changed"}}}`)
	p.resourceChanged() // Owning MCP announces source invalidation.
	_, e = catalog.Get(context.Background(), input)
	require.Error(t, e)
}
func TestDelegatedWindowCatalogDiscardsOwningServerDenial(t *testing.T) {
	p := provider("studio-a")
	p.definition = localWindowBytes(t)
	upstream := &denyingWindowProvider{fixtureProvider: p}
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "fixture", TenantID: "example", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	mgr, err := manager.New(fixtureOptions{"remote": &cfg.MCPClient{}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return upstream, nil }))
	require.NoError(t, err)
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "host")
	defer gateway.Close()
	proof, err := types.NewWindowTargetHMAC(bytes.Repeat([]byte{1}, 32))
	require.NoError(t, err)
	catalog := &WindowCatalog{Gateway: gateway, TargetProof: proof}
	rows, err := catalog.List(context.Background(), nil)
	require.NoError(t, err)
	result, err := catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: rows.Windows[0].WindowID})
	require.NoError(t, err)
	require.NotNil(t, result.Definition, "one request retains its admitted provider frame")
	require.Equal(t, 1, upstream.gets)
	p.resourceChanged()
	result, err = catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: rows.Windows[0].WindowID})
	require.Error(t, err)
	require.Nil(t, result, "after notification the next request must receive managing-provider denial")
	require.Equal(t, 2, upstream.gets)
}

type denyingWindowProvider struct {
	*fixtureProvider
	gets int
}

func (p *denyingWindowProvider) CallTool(ctx context.Context, r *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if r.Name == "windows/get" {
		p.gets++
		if p.gets == 2 {
			return nil, identity.ErrResourceDenied
		}
	}
	return p.fixtureProvider.CallTool(ctx, r, options...)
}

type localCatalogStub struct {
	summary service.WindowDefinitionSummary
}

func (localCatalogStub) AuthzReady() bool { return true }
func (s localCatalogStub) List(context.Context, *service.WindowDefinitionListInput) (*service.WindowDefinitionListOutput, error) {
	return &service.WindowDefinitionListOutput{Windows: []service.WindowDefinitionSummary{s.summary}}, nil
}
func (localCatalogStub) Get(context.Context, *service.WindowDefinitionGetInput) (*service.WindowDefinitionGetOutput, error) {
	return &service.WindowDefinitionGetOutput{WindowID: "local"}, nil
}
func TestCompositeWindowCatalogPreservesLocalAndRejectsConflictingURI(t *testing.T) {
	p := provider("studio-a")
	p.definition = localWindowBytes(t)
	g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
	proof, e := types.NewWindowTargetHMAC(bytes.Repeat([]byte{1}, 32))
	require.NoError(t, e)
	remote := &WindowCatalog{Gateway: g, TargetProof: proof}
	local := localCatalogStub{service.WindowDefinitionSummary{WindowID: "local", ResourceURI: "window://local/home"}}
	composite := &CompositeWindowCatalog{Local: local, Remote: remote}
	rows, e := composite.List(context.Background(), nil)
	require.NoError(t, e)
	require.Len(t, rows.Windows, 2)
	result, e := composite.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: "local"})
	require.NoError(t, e)
	require.Equal(t, "local", result.WindowID)
	local.summary.ResourceURI = "window://example/sales"
	composite.Local = local
	_, e = composite.List(context.Background(), nil)
	require.ErrorIs(t, e, ErrCollision)
}
