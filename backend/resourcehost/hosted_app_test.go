package resource

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	primitiveprovider "github.com/viant/forge/backend/provider"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"testing"
	"time"
)

func TestHostedAppInstallationBoundaries(t *testing.T) {
	b := HostedAppBinding{WindowURI: "window://authoring/DatlyStudio", ProviderIdentity: "owned-studio", ResourceURI: "ui://owned-studio/datly-studio", RendererURL: "http://127.0.0.1:29391/datly-studio/index.html", Sandbox: HostedAppSandbox}
	if err := ValidateHostedAppBindings([]HostedAppBinding{b}); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name  string
		alter func(*HostedAppBinding)
	}{
		{"remote-http", func(b *HostedAppBinding) { b.RendererURL = "http://untrusted.example/editor" }},
		{"userinfo", func(b *HostedAppBinding) { b.RendererURL = "https://alice@example.com/editor" }},
		{"query", func(b *HostedAppBinding) { b.RendererURL += "?token=caller" }},
		{"sandbox", func(b *HostedAppBinding) { b.Sandbox = "allow-scripts allow-top-navigation" }},
		{"network-resource", func(b *HostedAppBinding) { b.ResourceURI = "https://example.com/editor" }},
		{"nonwindow", func(b *HostedAppBinding) { b.WindowURI = "report://authoring/DatlyStudio" }},
		{"wrong-provider", func(b *HostedAppBinding) { b.ProviderIdentity = "other" }},
		{"missing-provider", func(b *HostedAppBinding) { b.ProviderIdentity = "" }},
	} {
		t.Run(test.name, func(t *testing.T) {
			bad := b
			test.alter(&bad)
			if ValidateHostedAppBindings([]HostedAppBinding{bad}) == nil {
				t.Fatal("unsafe installation accepted")
			}
		})
	}
	if ValidateHostedAppBindings([]HostedAppBinding{b, b}) == nil {
		t.Fatal("duplicate resource accepted")
	}
}

type hostedExternalOptions struct{ fixtureOptions }

func (p hostedExternalOptions) Names(context.Context) ([]string, error) {
	return []string{"owned"}, nil
}

type hostedWindowCatalog struct {
	window *types.Window
	after  func()
}

func (c *hostedWindowCatalog) List(context.Context, *primitiveprovider.WindowDefinitionListInput) (*primitiveprovider.WindowDefinitionListOutput, error) {
	return nil, nil
}
func (c *hostedWindowCatalog) Get(context.Context, *primitiveprovider.WindowDefinitionGetInput) (*primitiveprovider.WindowDefinitionGetOutput, error) {
	return &primitiveprovider.WindowDefinitionGetOutput{Definition: c.window}, nil
}
func (c *hostedWindowCatalog) RevalidateWindowResource(context.Context, string, identity.ResolvedResource, *types.WindowTarget) (*identity.ResolvedResource, error) {
	if c.after != nil {
		c.after()
	}
	p := *c.window.Resource
	return &p, nil
}

type hostedReadClient struct {
	*dependencyMCPProvider
	result             *schema.ReadResourceResult
	opened             primitive.MCPAppOpenResult
	signer             *types.WindowTargetHMAC
	proofUntil         *time.Time
	calls, opens       int
	managingReadDenied bool
	managingOpenDenied bool
	after              func()
}

func (c *hostedReadClient) CallTool(ctx context.Context, in *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if in.Name == "apps/open" {
		if c.managingOpenDenied {
			c.opens++
			return dependencyToolError(identity.ErrResourceDenied), nil
		}
		raw, _ := json.Marshal(in.Arguments)
		var request primitive.MCPAppOpenRequest
		if json.Unmarshal(raw, &request) != nil || request.ExecutionProof == nil || request.ResourceURI != c.opened.ResourceURI || c.signer.Verify(ctx, request.ExecutionProof.Resource, types.WindowTarget{}, request.ExecutionProof.Binding, request.ExecutionProof.Token) != nil {
			return dependencyToolError(identity.ErrResourceDenied), nil
		}
		c.opens++
		return &schema.CallToolResult{StructuredContent: c.opened}, nil
	}
	result, err := c.dependencyMCPProvider.CallTool(ctx, in, opts...)
	if err == nil && in.Name == "windows/get" {
		got := result.StructuredContent.(primitive.GetResult)
		binding := "compiled-ui:" + c.opened.AssetClosure.Fingerprint
		proofResource := *got.ResolvedResource
		if c.proofUntil != nil {
			proofResource.ValidUntil = *c.proofUntil
		}
		token, e := c.signer.Sign(ctx, proofResource, types.WindowTarget{}, binding)
		if e != nil {
			return nil, e
		}
		got.ExecutionProof = &primitive.ExecutionProof{Resource: proofResource, Binding: binding, Token: token}
		result.StructuredContent = got
	}
	return result, err
}
func (c *hostedReadClient) ReadResource(context.Context, *schema.ReadResourceRequestParams, ...mcpclient.RequestOption) (*schema.ReadResourceResult, error) {
	c.calls++
	if c.managingReadDenied {
		return nil, identity.ErrResourceDenied
	}
	if c.after != nil {
		c.after()
	}
	return c.result, nil
}

func TestHostedAppSelectedClosureAndActorFences(t *testing.T) {
	for _, scenario := range []string{"accepted", "managing-open-denied", "managing-html-denied", "zero-metadata", "zero-execution-expiry", "expired-authenticated-actor", "missing-open-context", "unknown-uri", "wrong-origin", "wrong-sandbox", "foreign-provider", "source-drift", "revoked-after-read", "expired-instance", "binary-html", "asset-drift", "cross-window", "closure-drift-after-read", "provider-options-drift-after-read", "actor-drift-after-read", "actor-lease-shortened-after-read", "partial-html", "expired-final-pin", "escaped-renderer-path"} {
		t.Run(scenario, func(t *testing.T) {
			lease := time.Now().Add(time.Minute)
			actor := identity.VerifiedActor{Subject: "alice", Issuer: "owned-issuer", TenantID: "tenant", AccountID: "21", IdentityRevision: "1", ValidUntil: lease}
			pin := identity.ResolvedResource{ProviderIdentity: "owned-studio", URI: "window://authoring/DatlyStudio", ResourceCandidate: identity.ResourceCandidate{Kind: "working", ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "verified-alice", ValidUntil: lease}
			if scenario == "zero-metadata" || scenario == "zero-execution-expiry" {
				pin.ValidUntil = time.Time{}
			}
			binding := HostedAppBinding{WindowURI: pin.URI, ProviderIdentity: pin.ProviderIdentity, ResourceURI: "ui://owned-studio/datly-studio", RendererOrigin: "http://127.0.0.1:29391", RendererPathPrefix: "/api/embedded", Sandbox: HostedAppSandbox}
			html := "<!doctype html><main>Actual captured entry</main>"
			digest := sha256.Sum256([]byte(html))
			closure := primitive.MCPAppClosure{Fingerprint: identity.ContentFingerprint([]byte("complete compiled closure")), EntryPath: "index.html", EntrySHA256: hex.EncodeToString(digest[:])}
			target := &types.WindowTarget{SelectionToken: "owned-selected-target"}
			window := &types.Window{Resource: &pin, ResourceTarget: target, View: types.View{Content: &types.Container{Kind: "mcpApp", MCPApp: &types.MCPAppSpec{ResourceURI: binding.ResourceURI, AssetClosure: &closure}}}}
			windows := &hostedWindowCatalog{window: window}
			signer, err := types.NewWindowTargetHMAC(make([]byte, 32))
			require.NoError(t, err)
			readURI := "ui://owned-studio/selected/owned_instance_1234567890"
			mime := "text/html;profile=mcp-app"
			client := &hostedReadClient{dependencyMCPProvider: &dependencyMCPProvider{owner: pin.ProviderIdentity, items: map[string]*dependencyResource{pin.URI: {raw: json.RawMessage(`{}`), formatVersion: 2, revision: "working", authorityBinding: pin.AuthorityBinding, validUntil: lease}}}, signer: signer, opened: primitive.MCPAppOpenResult{ProviderIdentity: pin.ProviderIdentity, Resource: pin, ResourceURI: binding.ResourceURI, ReadResourceURI: readURI, AssetClosure: closure, RendererURL: binding.RendererOrigin + binding.RendererPathPrefix + "/" + closure.Fingerprint + "/owned_instance_1234567890/index.html", Sandbox: HostedAppSandbox}, result: &schema.ReadResourceResult{ResultType: schema.ResultTypeComplete, CacheScope: schema.ReadResourceResultCacheScopePrivate, Contents: []schema.ReadResourceResultContentsElem{{Uri: readURI, MimeType: &mime, Text: html, Meta: map[string]any{"resource": "must never be forwarded", "providerIdentity": "must never be forwarded"}}}}}
			if scenario == "zero-metadata" || scenario == "zero-execution-expiry" {
				client.items[pin.URI].validUntil = time.Time{}
				client.opened.Resource.ValidUntil = lease // real owning app-instance TTL
				client.proofUntil = &lease
				if scenario == "zero-execution-expiry" {
					zero := time.Time{}
					client.proofUntil = &zero
				}
			}
			if scenario == "expired-authenticated-actor" {
				actor.ValidUntil = time.Now().Add(-time.Second)
			}
			options := &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: pin.ProviderIdentity}
			var mgr *manager.Manager
			if scenario == "provider-options-drift-after-read" {
				mgr, err = manager.New(hostedExternalOptions{fixtureOptions{"owned": options}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return client, nil }))
			} else {
				mgr, err = manager.New(nil)
				require.NoError(t, err)
				require.NoError(t, mgr.RegisterLocal(context.Background(), "owned", options, func(context.Context) (mcpclient.Interface, error) { return client, nil }))
			}
			require.NoError(t, err)
			t.Cleanup(func() { mgr.CloseConversation("") })
			revoked := false
			resolve := func(context.Context) (identity.VerifiedActor, error) { return actor, nil }
			verify := func(context.Context, identity.VerifiedActor) error {
				if revoked {
					return identity.ErrResourceDenied
				}
				return nil
			}
			gateway := NewGateway(mgr, resolve, verify, "hosted-test")
			defer gateway.Close()
			reader, err := NewHostedAppReader([]HostedAppBinding{binding}, gateway, mgr, windows, resolve, verify)
			require.NoError(t, err)
			ctx := requestctx.WithWindowTarget(requestctx.WithResolvedResource(context.Background(), pin), target)
			uri := binding.ResourceURI
			switch scenario {
			case "managing-open-denied":
				client.managingOpenDenied = true
			case "managing-html-denied":
				client.managingReadDenied = true
			case "missing-open-context":
				ctx = context.Background()
			case "unknown-uri":
				uri = "ui://owned-studio/unknown"
			case "wrong-origin":
				client.opened.RendererURL = "https://foreign.example/index.html"
			case "wrong-sandbox":
				client.opened.Sandbox = "allow-scripts allow-top-navigation"
			case "foreign-provider":
				client.opened.ProviderIdentity = "foreign"
			case "source-drift":
				windows.after = func() { window.Resource.ContentFingerprint = identity.ContentFingerprint([]byte("changed")) }
			case "revoked-after-read":
				client.after = func() { revoked = true }
			case "expired-instance":
				client.opened.Resource.ValidUntil = time.Now().Add(-time.Second)
			case "binary-html":
				client.result.Contents[0].Blob = "Ynl0ZXM="
			case "closure-drift-after-read":
				client.after = func() {
					window.View.Content.MCPApp.AssetClosure.Fingerprint = identity.ContentFingerprint([]byte("changed closure"))
				}
			case "provider-options-drift-after-read":
				client.after = func() {
					options, e := mgr.Options(context.Background(), "owned")
					require.NoError(t, e)
					options.PrimitiveProviderIdentity = "changed-owner"
				}
			case "actor-drift-after-read":
				client.after = func() { actor.IdentityRevision = "2" }
			case "actor-lease-shortened-after-read":
				client.after = func() { actor.ValidUntil = lease.Add(-time.Second) }
			case "partial-html":
				client.result.ResultType = "partial"
			case "expired-final-pin":
				windows.after = func() { window.Resource.ValidUntil = time.Now().Add(-time.Second) }
			case "escaped-renderer-path":
				client.opened.RendererURL = binding.RendererOrigin + binding.RendererPathPrefix + "/" + closure.Fingerprint + "/owned_instance_1234567890/%69ndex.html"
			case "asset-drift":
				client.result.Contents[0].Text = "latest mutated deployment"
			case "cross-window":
				other := pin
				other.URI = "window://authoring/Other"
				ctx = requestctx.WithResolvedResource(ctx, other)
			}
			got, err := reader.Read(ctx, uri)
			if scenario != "accepted" && scenario != "zero-metadata" {
				require.Error(t, err)
				require.Nil(t, got)
				if scenario == "managing-open-denied" {
					require.ErrorIs(t, err, identity.ErrResourceDenied)
					require.Equal(t, 1, client.opens)
					require.Zero(t, client.calls)
				}
				if scenario == "managing-html-denied" {
					require.ErrorIs(t, err, identity.ErrResourceDenied)
					require.Equal(t, 1, client.opens)
					require.Equal(t, 1, client.calls)
				}
				if scenario == "missing-open-context" || scenario == "unknown-uri" || scenario == "cross-window" || scenario == "zero-execution-expiry" || scenario == "expired-authenticated-actor" {
					require.Zero(t, client.opens)
					require.Zero(t, client.calls)
				}
				return
			}
			require.NoError(t, err)
			require.Equal(t, 1, client.opens)
			require.Equal(t, 1, client.calls)
			require.Equal(t, schema.ReadResourceResultCacheScopePrivate, got.CacheScope)
			require.Zero(t, got.TtlMs)
			require.NotContains(t, got.Contents[0].Meta, "resource")
			require.NotContains(t, got.Contents[0].Meta, "providerIdentity")
		})
	}
}
