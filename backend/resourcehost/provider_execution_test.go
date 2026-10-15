package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	dssvc "github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	bridge "github.com/viant/forge/backend/provider"
	primitive "github.com/viant/forge/backend/provider/contract"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

type executingProvider struct {
	*fixtureProvider
	signer     *types.WindowTargetHMAC
	calls      int
	afterFetch func()
	inputs     map[string]interface{}
	bearer     string
	idToken    string
}

func (p *executingProvider) ListTools(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	out, err := p.fixtureProvider.ListTools(ctx, cursor, options...)
	if err == nil {
		out.Tools = append(out.Tools, schema.Tool{Name: "windows/datasource", Meta: out.Tools[0].Meta})
	}
	return out, err
}
func (p *executingProvider) CallTool(ctx context.Context, r *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if r.Name == "windows/datasource" {
		p.calls++
		p.bearer, p.idToken = authctx.Bearer(ctx), authctx.IDToken(ctx)
		var in struct {
			Resource       identity.ResolvedResource `json:"resource"`
			ExecutionProof *primitive.ExecutionProof `json:"executionProof"`
			DataSourceID   string                    `json:"dataSourceId"`
			Inputs         map[string]interface{}    `json:"inputs"`
		}
		raw, _ := json.Marshal(r.Arguments)
		_ = json.Unmarshal(raw, &in)
		p.inputs = in.Inputs
		if !mcpclient.NewRequestOptions(options).NoRetry || in.ExecutionProof == nil || in.DataSourceID != "rows" || in.Resource.ValidUntil.After(in.ExecutionProof.Resource.ValidUntil) || p.signer.Verify(ctx, in.ExecutionProof.Resource, types.WindowTarget{}, in.ExecutionProof.Binding, in.ExecutionProof.Token) != nil {
			return dependencyToolError(identity.ErrResourceDenied), nil
		}
		if p.afterFetch != nil {
			p.afterFetch()
		}
		return &schema.CallToolResult{StructuredContent: map[string]interface{}{"data": []map[string]interface{}{{"id": 7}}}}, nil
	}
	out, err := p.fixtureProvider.CallTool(ctx, r, options...)
	if err != nil {
		return out, err
	}
	if r.Name == "namespaces/get" {
		caps := out.StructuredContent.(primitive.NamespaceCapabilities)
		caps.Kinds[0].Operations = append(caps.Kinds[0].Operations, "fetch")
		caps.Kinds[0].Methods["fetch"] = "windows/datasource"
		out.StructuredContent = caps
	}
	if r.Name == "windows/get" {
		get := out.StructuredContent.(primitive.GetResult)
		variant, e := types.SelectWindowResource(get.Resource.Definition, nil)
		if e != nil {
			return nil, e
		}
		token, e := p.signer.Sign(ctx, *get.ResolvedResource, types.WindowTarget{}, variant.Fingerprint)
		if e != nil {
			return nil, e
		}
		get.ExecutionProof = &primitive.ExecutionProof{Resource: *get.ResolvedResource, Binding: variant.Fingerprint, Token: token}
		out.StructuredContent = get
	}
	return out, nil
}

func TestProviderOwnedDatasourcePipelineRetainsBothProofsAndBuffersFinalDenial(t *testing.T) {
	ctx := authctx.WithIDToken(authctx.WithBearer(context.Background(), "window-access"), "window-id")
	base := provider("studio-a")
	signer, e := types.NewWindowTargetHMAC(bytes.Repeat([]byte{1}, 32))
	require.NoError(t, e)
	p := &executingProvider{fixtureProvider: base, signer: signer}
	component := windowprotocol.ComponentBinding{ID: "native", Kind: "linked", Revision: "1", ContentFingerprint: identity.ContentFingerprint([]byte("code")), SchemaFingerprint: identity.ContentFingerprint([]byte("schema"))}
	descriptor := dsproto.DataSource{ID: "rows", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendDatly, Ownership: "provider", Method: "windows/datasource", Component: &component}}
	raw, e := json.Marshal(descriptor)
	require.NoError(t, e)
	fingerprint, e := types.WindowDescriptorFingerprint(raw)
	require.NoError(t, e)
	var w types.Window
	require.NoError(t, json.Unmarshal([]byte(`{"view":{"content":{"id":"root"}}}`), &w))
	w.DataSource = map[string]types.DataSource{"rows": descriptor.DataSource}
	w.ResourceDependencies = map[string]string{"rows": fingerprint}
	variant := types.WindowResourceVariant{Window: &w, DataSources: map[string]json.RawMessage{"rows": raw}}
	variantID, e := types.WindowVariantFingerprint(variant)
	require.NoError(t, e)
	base.definition, e = json.Marshal(types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: []types.WindowTargetBinding{{Variant: variantID}}, Variants: map[string]types.WindowResourceVariant{variantID: variant}})
	require.NoError(t, e)
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "fixture", TenantID: "example", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	revoked := false
	mgr, e := manager.New(fixtureOptions{"remote": &cfg.MCPClient{}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return p, nil }))
	require.NoError(t, e)
	defer mgr.CloseConversation("")
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error {
		if revoked {
			return identity.ErrResourceDenied
		}
		return nil
	}, "host")
	defer g.Close()
	hostSigner, e := types.NewWindowTargetHMAC(bytes.Repeat([]byte{2}, 32))
	require.NoError(t, e)
	catalog := &WindowCatalog{Gateway: g, TargetProof: hostSigner}
	opened, e := catalog.Get(ctx, &bridge.WindowDefinitionGetInput{WindowID: "window://example/sales"})
	require.NoError(t, e)
	parent := *opened.Definition.Resource
	target := opened.Definition.ResourceTarget
	originalProof := *target.ExecutionProof
	getInput := &bridge.WindowDefinitionGetInput{WindowID: parent.URI, ResolvedResource: &parent, Target: target}
	rechecked, e := catalog.Get(ctx, getInput)
	require.NoError(t, e)
	require.Equal(t, originalProof, *rechecked.Definition.ResourceTarget.ExecutionProof)
	svc := dssvc.New(dssvc.Options{ResolveResource: func(ctx context.Context, pin identity.ResolvedResource) (*identity.ResolvedResource, error) {
		connection, e := g.ConnectionForProvider(ctx, pin.ProviderIdentity)
		if e != nil {
			return nil, e
		}
		got, e := g.Get(ctx, connection, identity.ResourceRef{URI: pin.URI}, &pin)
		if e != nil {
			return nil, e
		}
		return got.ResolvedResource, nil
	}, ResolveDefinition: catalog.ResolveDatasource, AuthorizeDefinition: func(context.Context, *dsproto.DataSource, map[string]interface{}) error {
		if revoked {
			return identity.ErrResourceDenied
		}
		return nil
	}, ProviderExecute: func(ctx context.Context, ds *dsproto.DataSource, args map[string]interface{}) (json.RawMessage, error) {
		pin, _ := requestctx.ResolvedResourceFromContext(ctx)
		target, _ := requestctx.WindowTargetFromContext(ctx)
		return catalog.FetchProviderDatasource(ctx, *pin, target, ds, args)
	}})
	inputs := map[string]interface{}{"filter": "authored", "ids": []interface{}{float64(7), "literal"}}
	result, e := svc.Fetch(ctx, "rows", inputs, dssvc.FetchOptions{Resource: &parent, Target: target})
	require.NoError(t, e)
	require.Len(t, result.Rows, 1)
	require.EqualValues(t, 1, p.calls)
	require.Equal(t, inputs, p.inputs, "consumer must preserve ordinary datasource inputs")
	require.Equal(t, "window-access", p.bearer)
	require.Equal(t, "window-id", p.idToken)
	_, e = svc.Fetch(ctx, "rows", nil, dssvc.FetchOptions{Resource: &parent, Target: target})
	require.NoError(t, e)
	require.EqualValues(t, 2, p.calls, "provider execution cannot be hidden by a generic datasource cache")
	altered := *target
	proofCopy := *target.ExecutionProof
	proofCopy.Resource.ValidUntil = proofCopy.Resource.ValidUntil.Add(time.Minute)
	altered.ExecutionProof = &proofCopy
	result, e = svc.Fetch(ctx, "rows", nil, dssvc.FetchOptions{Resource: &parent, Target: &altered})
	require.Error(t, e)
	require.Nil(t, result)
	require.EqualValues(t, 2, p.calls, "tampered host proof must deny before provider execution")
	// A successful fresh verifier is insufficient if it consumes the original
	// lease. Advance the test clock in the terminal verifier, after the final
	// source read; no sleeps or deadline renewal are involved.
	armFinal := false
	originalVerify := g.Verify
	g.Verify = func(ctx context.Context, actor identity.VerifiedActor) error {
		if armFinal {
			g.Now = func() time.Time { return parent.ValidUntil.Add(time.Nanosecond) }
		}
		return originalVerify(ctx, actor)
	}
	p.afterFetch = func() { armFinal = true }
	body, e := catalog.FetchProviderDatasource(ctx, parent, target, &descriptor, nil)
	require.ErrorIs(t, e, identity.ErrResourceDenied)
	require.Nil(t, body, "terminal fresh authorization cannot release rows after the original lease")
	g.Now, g.Verify = nil, originalVerify
	p.afterFetch = func() { revoked = true }
	result, e = svc.Fetch(ctx, "rows", nil, dssvc.FetchOptions{Resource: &parent, Target: target})
	require.Error(t, e)
	require.Nil(t, result, "rows must be buffered until final fresh authorization")
}
