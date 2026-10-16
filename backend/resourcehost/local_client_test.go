package resource

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	mcpcfg "github.com/viant/mcp/client/config"
)

type localActorKey struct{}

func TestLocalSDKClientExactNamesAndRequestAuthority(t *testing.T) {
	source := &localFixtureSource{raw: json.RawMessage(`{"native":"template"}`)}
	var revoked atomic.Bool
	actor := func(ctx context.Context) (identity.VerifiedActor, error) {
		a, ok := ctx.Value(localActorKey{}).(identity.VerifiedActor)
		if !ok {
			return a, identity.ErrResourceDenied
		}
		return a, nil
	}
	binding := func(namespace string) LocalResourceBinding {
		return LocalResourceBinding{URI: "template://" + namespace + "/nested/doc", FormatVersion: 1, Resolver: func(_ context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
			return &identity.ResourceResolver{ProviderIdentity: "internal", Source: source, Policy: localFixturePolicy{actor: a}}, nil
		}}
	}
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "internal", Actor: actor, Verify: func(_ context.Context, a identity.VerifiedActor) error {
		if revoked.Load() {
			return identity.ErrResourceDenied
		}
		return nil
	}, Authorize: func(_ context.Context, a identity.VerifiedActor, uri identity.ResourceURI, _ string) error {
		if uri.Namespace != a.Subject {
			return identity.ErrResourceDenied
		}
		return nil
	}, Bindings: []LocalResourceBinding{binding("alice"), binding("bob")}, Validators: map[string]LocalResourceValidator{"template": func(int64, json.RawMessage) error { return nil }}})
	require.NoError(t, err)
	client, err := NewLocalMCPClient(provider)
	require.NoError(t, err)
	listed, err := client.ListTools(context.Background(), nil)
	require.NoError(t, err)
	names := []string{}
	for _, tool := range listed.Tools {
		names = append(names, tool.Name)
		meta, ok := tool.Meta[primitive.AuthoringExtension].(map[string]interface{})
		require.True(t, ok)
		require.Equal(t, "internal", meta["providerIdentity"])
	}
	require.Contains(t, names, "templates/list")
	require.Contains(t, names, "templates/get")
	require.Contains(t, names, "namespaces/list")
	require.Contains(t, names, "namespaces/get")
	makeContext := func(subject string, expiry time.Time) context.Context {
		return context.WithValue(context.Background(), localActorKey{}, identity.VerifiedActor{Subject: subject, Issuer: "https://idp.example", TenantID: "team", AccountID: subject, IdentityRevision: "r1", ValidUntil: expiry})
	}
	var wg sync.WaitGroup
	for _, subject := range []string{"alice", "bob"} {
		wg.Add(1)
		go func(subject string) {
			defer wg.Done()
			ctx := makeContext(subject, time.Now().Add(time.Minute))
			for i := 0; i < 5; i++ {
				result, err := client.CallTool(ctx, &schema.CallToolRequestParams{Name: "templates/get", Arguments: map[string]interface{}{"uri": "template://" + subject + "/nested/doc"}})
				if err != nil || result == nil || result.IsError != nil && *result.IsError {
					t.Errorf("own authority failed: %s %v", subject, err)
					return
				}
				other := "alice"
				if subject == "alice" {
					other = "bob"
				}
				denied, err := client.CallTool(ctx, &schema.CallToolRequestParams{Name: "templates/get", Arguments: map[string]interface{}{"uri": "template://" + other + "/nested/doc"}})
				if err != nil || denied == nil || denied.IsError == nil || !*denied.IsError {
					t.Errorf("foreign authority allowed: %s %v", subject, err)
					return
				}
			}
		}(subject)
	}
	wg.Wait()
	expired, err := client.CallTool(makeContext("alice", time.Now().Add(-time.Second)), &schema.CallToolRequestParams{Name: "templates/get", Arguments: map[string]interface{}{"uri": "template://alice/nested/doc"}})
	require.NoError(t, err)
	require.NotNil(t, expired.IsError)
	require.True(t, *expired.IsError)
	revoked.Store(true)
	denied, err := client.CallTool(makeContext("alice", time.Now().Add(time.Minute)), &schema.CallToolRequestParams{Name: "templates/get", Arguments: map[string]interface{}{"uri": "template://alice/nested/doc"}})
	require.NoError(t, err)
	require.NotNil(t, denied.IsError)
	require.True(t, *denied.IsError)
}

func TestInProcessProviderGatewayPreservesProvenanceAndDeniesLogicalCollision(t *testing.T) {
	original, source, actor, _ := localFixture(t)
	makeProvider := func(owner string) *LocalProvider {
		binding := localProviderBinding(original, "window://team/sales")
		binding.Resolver = func(_ context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
			return &identity.ResourceResolver{ProviderIdentity: owner, Source: source, Policy: localFixturePolicy{actor: a}}, nil
		}
		provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: owner, Actor: localProviderConfig(original).Actor, Verify: localProviderConfig(original).Verify, Authorize: localProviderConfig(original).Authorize, Bindings: []LocalResourceBinding{binding}, Validators: localProviderConfig(original).Validators})
		require.NoError(t, err)
		return provider
	}
	ctx := context.Background()
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	local := makeProvider("internal")
	require.NoError(t, mgr.RegisterLocal(ctx, "internal", &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "internal"}, func(context.Context) (mcpclient.Interface, error) { return NewLocalMCPClient(local) }))
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, localProviderConfig(original).Verify, "aggregate-gateway")
	defer gateway.Close()
	resources, err := gateway.List(ctx, "window", "team")
	require.NoError(t, err)
	require.Len(t, resources, 1)
	require.Equal(t, "internal", resources[0].Connection.ProviderIdentity)
	got, err := gateway.Get(ctx, resources[0].Connection, identity.ResourceRef{URI: resources[0].Resource.URI}, nil)
	require.NoError(t, err)
	require.Equal(t, "internal", got.ResolvedResource.ProviderIdentity)
	peer := makeProvider("external-authority")
	require.NoError(t, mgr.RegisterLocal(ctx, "external", &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "external-authority"}, func(context.Context) (mcpclient.Interface, error) { return NewLocalMCPClient(peer) }))
	resources, err = gateway.List(ctx, "window", "team")
	require.NoError(t, err)
	require.Len(t, resources, 2)
	_, err = ResolveLocator(resources, "window://team/sales", "")
	require.ErrorIs(t, err, ErrCollision)
	selected, err := ResolveLocator(resources, "window://team/sales", "internal")
	require.NoError(t, err)
	require.Equal(t, "internal", selected.ProviderIdentity)
}

func TestLocalSDKCompactCarrierRetainsExactBytesAndHTTPKeepsProjection(t *testing.T) {
	provider, source, actor, _ := localFixture(t)
	original := source.bytes()
	require.Contains(t, string(original), "schemaVersion")
	client, err := NewLocalMCPClient(provider)
	require.NoError(t, err)
	reply, err := client.CallTool(context.Background(), &schema.CallToolRequestParams{Name: "windows/get", Arguments: map[string]interface{}{"uri": "window://team/sales"}})
	require.NoError(t, err)
	require.False(t, reply.IsError != nil && *reply.IsError)
	encoded, err := json.Marshal(reply.StructuredContent)
	require.NoError(t, err)
	var decoded primitive.GetResult
	require.NoError(t, json.Unmarshal(encoded, &decoded))
	require.Empty(t, decoded.Resource.Definition)
	require.Equal(t, []byte(original), decoded.Resource.DefinitionBytes)
	require.Equal(t, identity.ContentFingerprint(original), decoded.ResolvedResource.ContentFingerprint)
	text, ok := reply.Content[0].(schema.TextContent)
	if !ok {
		if object, ok := reply.Content[0].(map[string]interface{}); ok {
			text.Text, _ = object["text"].(string)
		}
	}
	require.Less(t, len(text.Text), 100)
	// The HTTP/shared handler uses the original compatible rich projection.
	server, err := newLocalMCPServer(provider)
	require.NoError(t, err)
	httpEquivalent := server.AsClient(context.Background())
	full, err := httpEquivalent.CallTool(context.Background(), &schema.CallToolRequestParams{Name: "windows/get", Arguments: map[string]interface{}{"uri": "window://team/sales"}})
	require.NoError(t, err)
	encoded, err = json.Marshal(full.StructuredContent)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(encoded, &decoded))
	require.NotEmpty(t, decoded.Resource.Definition)
	require.Equal(t, []byte(original), decoded.Resource.DefinitionBytes)
	require.True(t, actor.Valid(time.Now()))
}
