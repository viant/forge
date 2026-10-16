package resource

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	dssvc "github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	reporting "github.com/viant/forge/backend/reporting/engine"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	mcp "github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type standaloneExecutingFixture struct {
	*dependencyMCPProvider
	signer   *types.WindowTargetHMAC
	fetched  int
	after    func()
	delay    time.Duration
	canceled bool
}

func (p *standaloneExecutingFixture) ListTools(ctx context.Context, cursor *string, opts ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	out, err := p.dependencyMCPProvider.ListTools(ctx, cursor, opts...)
	if err == nil {
		out.Tools = append(out.Tools, schema.Tool{Name: "datasources/fetch", Meta: out.Tools[0].Meta})
	}
	return out, err
}
func (p *standaloneExecutingFixture) CallTool(ctx context.Context, request *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if request.Name == "datasources/fetch" {
		var in struct {
			Resource       identity.ResolvedResource `json:"resource"`
			ExecutionProof *primitive.ExecutionProof `json:"executionProof"`
			DataSourceID   string                    `json:"dataSourceId"`
		}
		raw, _ := json.Marshal(request.Arguments)
		_ = json.Unmarshal(raw, &in)
		if !mcpclient.NewRequestOptions(opts).NoRetry || in.ExecutionProof == nil || in.DataSourceID != "canonical" || in.Resource.ValidUntil.After(in.ExecutionProof.Resource.ValidUntil) || p.signer.Verify(ctx, in.ExecutionProof.Resource, types.WindowTarget{}, in.ExecutionProof.Binding, in.ExecutionProof.Token) != nil {
			return dependencyToolError(identity.ErrResourceDenied), nil
		}
		p.fetched++
		if p.delay > 0 {
			select {
			case <-ctx.Done():
				p.canceled = true
				return nil, ctx.Err()
			case <-time.After(p.delay):
			}
		}
		if p.after != nil {
			p.after()
		}
		return &schema.CallToolResult{StructuredContent: map[string]any{"data": []map[string]any{{"id": 7}}}}, nil
	}
	out, err := p.dependencyMCPProvider.CallTool(ctx, request, opts...)
	if err != nil || out.IsError != nil && *out.IsError {
		return out, err
	}
	if request.Name == "namespaces/get" {
		caps := out.StructuredContent.(primitive.NamespaceCapabilities)
		for i := range caps.Kinds {
			if caps.Kinds[i].Kind == "datasource" {
				caps.Kinds[i].Operations = append(caps.Kinds[i].Operations, "fetch")
				caps.Kinds[i].Methods["fetch"] = "datasources/fetch"
			}
		}
		out.StructuredContent = caps
	}
	if request.Name == "datasources/get" {
		got := out.StructuredContent.(primitive.GetResult)
		binding := "fixture-datasource:" + got.ResolvedResource.ContentFingerprint
		token, err := p.signer.Sign(ctx, *got.ResolvedResource, types.WindowTarget{}, binding)
		if err != nil {
			return nil, err
		}
		got.ExecutionProof = &primitive.ExecutionProof{Resource: *got.ResolvedResource, Binding: binding, Token: token}
		out.StructuredContent = got
	}
	return out, nil
}

func standaloneStack(t *testing.T) (*Gateway, *standaloneExecutingFixture, identity.ResolvedResource, *primitive.ExecutionProof, *dsproto.DataSource) {
	t.Helper()
	ctx := context.Background()
	lease := time.Now().Add(time.Minute)
	descriptor := &dsproto.DataSource{ID: "canonical", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendDatly, Ownership: "provider", Method: "datasources/fetch", Component: &windowprotocol.ComponentBinding{ID: "producer", Kind: "linked", Revision: "artifact-1", ContentFingerprint: identity.ContentFingerprint([]byte("code")), SchemaFingerprint: identity.ContentFingerprint([]byte("schema"))}}}
	body, _ := json.Marshal(map[string]any{"schemaVersion": 1, "dataSource": descriptor})
	uri := "datasource://team/window/path/canonical"
	signer, err := types.NewWindowTargetHMAC(make([]byte, 32))
	require.NoError(t, err)
	provider := &standaloneExecutingFixture{dependencyMCPProvider: &dependencyMCPProvider{owner: "provider", items: map[string]*dependencyResource{uri: {raw: body, formatVersion: 1, revision: "working", authorityBinding: "verified", validUntil: lease}}}, signer: signer}
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(ctx, "provider", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "provider"}, func(context.Context) (mcpclient.Interface, error) { return provider, nil }))
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "issuer", TenantID: "team", AccountID: "account", IdentityRevision: "revision", ValidUntil: lease}
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	t.Cleanup(gateway.Close)
	connection, err := gateway.ConnectionForProvider(ctx, "provider")
	require.NoError(t, err)
	got, err := gateway.Get(ctx, connection, identity.ResourceRef{URI: uri}, nil)
	require.NoError(t, err)
	return gateway, provider, *got.ResolvedResource, got.ExecutionProof, descriptor
}

func TestStandaloneProviderDatasourceAliasAndOriginalLease(t *testing.T) {
	gateway, provider, pin, proof, descriptor := standaloneStack(t)
	descriptor.ID = "parent-local-alias"
	body, err := gateway.FetchDatasource(context.Background(), pin, proof, descriptor, nil)
	require.NoError(t, err)
	require.JSONEq(t, `{"data":[{"id":7}]}`, string(body))
	require.Equal(t, 1, provider.fetched)
	// A fresh longer provider proof cannot renew the original consumer lease.
	pin.ValidUntil = time.Now().Add(30 * time.Millisecond)
	provider.after = func() { time.Sleep(40 * time.Millisecond) }
	body, err = gateway.FetchDatasource(context.Background(), pin, proof, descriptor, nil)
	require.Error(t, err)
	require.Nil(t, body)
}

func TestStandaloneDatasourceTimingSeparatesDispatchWithoutPayloads(t *testing.T) {
	gateway, provider, pin, proof, descriptor := standaloneStack(t)
	provider.delay = 10 * time.Millisecond
	var events []observe.Event
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) {
		events = append(events, event)
	}))
	_, err := gateway.FetchDatasource(ctx, pin, proof, descriptor, map[string]interface{}{"token": "sensitive-input"})
	require.NoError(t, err)
	phases := map[observe.Phase]observe.Event{}
	for _, event := range events {
		phases[event.Phase] = event
	}
	require.Contains(t, phases, observe.Phase("datasource.fetch"))
	require.Contains(t, phases, observe.Phase("datasource.mcp.call"))
	require.GreaterOrEqual(t, phases[observe.Phase("datasource.fetch")].Duration, phases[observe.Phase("datasource.mcp.call")].Duration)
	require.Equal(t, observe.OK, phases[observe.Phase("datasource.mcp.call")].Outcome)
	raw, err := json.Marshal(events)
	require.NoError(t, err)
	require.False(t, strings.Contains(string(raw), "sensitive-input"))
	require.False(t, strings.Contains(string(raw), pin.URI))
}
func TestStandaloneProviderDatasourceCancelsDispatchAtOriginalDeadline(t *testing.T) {
	gateway, provider, pin, proof, descriptor := standaloneStack(t)
	pin.ValidUntil = time.Now().Add(30 * time.Millisecond)
	provider.delay = time.Second
	started := time.Now()
	body, err := gateway.FetchDatasource(context.Background(), pin, proof, descriptor, nil)
	require.Error(t, err)
	require.Nil(t, body)
	require.True(t, provider.canceled, "owning MCP dispatch must receive original deadline cancellation")
	require.Less(t, time.Since(started), 500*time.Millisecond)
}

func TestStandaloneDatasourceServiceUsesOriginalDefinitionAndFreshChecks(t *testing.T) {
	gateway, provider, pin, proof, descriptor := standaloneStack(t)
	checks := 0
	service := dssvc.New(dssvc.Options{ResolveResource: func(ctx context.Context, original identity.ResolvedResource) (*identity.ResolvedResource, error) {
		connection, err := gateway.ConnectionForProvider(ctx, original.ProviderIdentity)
		if err != nil {
			return nil, err
		}
		got, err := gateway.Get(ctx, connection, identity.ResourceRef{URI: original.URI, Revision: original.Selector()}, &original)
		if err != nil {
			return nil, err
		}
		return got.ResolvedResource, nil
	}, ResolveDefinition: func(ctx context.Context, original identity.ResolvedResource, _ *types.WindowTarget, id string) (*dsproto.DataSource, error) {
		actual, _, err := gateway.ResolveDatasource(ctx, original)
		if err != nil {
			return nil, err
		}
		if actual.ID != id {
			return nil, identity.ErrResourceDenied
		}
		return actual, nil
	}, AuthorizeDefinition: func(ctx context.Context, ds *dsproto.DataSource, _ map[string]interface{}) error {
		checks++
		held, ok := requestctx.ResolvedResourceFromContext(ctx)
		if !ok {
			return identity.ErrResourceDenied
		}
		actual, _, err := gateway.ResolveDatasource(ctx, *held)
		if err != nil {
			return err
		}
		if !sameDatasourceDescriptor(ds, actual) {
			return identity.ErrResourceDenied
		}
		return nil
	}, ProviderExecute: func(ctx context.Context, ds *dsproto.DataSource, in map[string]interface{}) (json.RawMessage, error) {
		held, ok := requestctx.ResolvedResourceFromContext(ctx)
		if !ok {
			return nil, identity.ErrResourceDenied
		}
		p, ok := requestctx.ResourceExecutionProofFromContext(ctx)
		if !ok {
			return nil, identity.ErrResourceDenied
		}
		return gateway.FetchDatasource(ctx, *held, p, ds, in)
	}})
	for i := 0; i < 2; i++ {
		rows, err := service.Fetch(context.Background(), descriptor.ID, nil, dssvc.FetchOptions{Resource: &pin, ResourceProof: proof})
		require.NoError(t, err)
		require.Len(t, rows.Rows, 1)
	}
	require.Equal(t, 2, provider.fetched, "provider datasets must bypass generic row cache")
	require.Equal(t, 4, checks, "definition/input checks run before and after each fetch")
	_, err := service.Fetch(context.Background(), descriptor.ID, nil, dssvc.FetchOptions{})
	require.Error(t, err, "no ID memory-store fallback without standalone original pin")
	_, err = service.Fetch(context.Background(), descriptor.ID, nil, dssvc.FetchOptions{Resource: &pin})
	require.Error(t, err, "standalone proof context is required")
}

func TestReportExecutorDispatchesVerifiedOriginalDatasourceDependency(t *testing.T) {
	gateway, provider, child, _, descriptor := standaloneStack(t)
	parent := identity.ResolvedResource{ProviderIdentity: "report-owner", URI: "report://team/orders", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("report"))}, AuthorityBinding: "report-authority", ValidUntil: child.ValidUntil}
	checks := 0
	execute := reporting.NewResourceDatasetExecutorWithProvider(nil, func(ctx context.Context, ds *dsproto.DataSource, _ map[string]interface{}) error {
		checks++
		held, ok := requestctx.ResolvedResourceFromContext(ctx)
		if !ok || *held != parent || !sameDatasourceDescriptor(ds, descriptor) {
			return identity.ErrResourceDenied
		}
		return nil
	}, func(ctx context.Context, ds *dsproto.DataSource, in map[string]interface{}) (json.RawMessage, error) {
		pin, ok := requestctx.ResourceDependencyFromContext(ctx, ds.ID)
		if !ok {
			return nil, identity.ErrResourceDenied
		}
		_, proof, err := gateway.ResolveDatasource(ctx, *pin)
		if err != nil {
			return nil, err
		}
		return gateway.FetchDatasource(ctx, *pin, proof, ds, in)
	})
	ctx := requestctx.WithResourceDependencies(requestctx.WithResolvedResource(context.Background(), parent), parent, map[string]identity.ResolvedResource{descriptor.ID: child})
	rows, err := execute(ctx, parent, descriptor, nil)
	require.NoError(t, err)
	require.Len(t, rows.Rows, 1)
	require.Equal(t, 2, checks)
	require.Equal(t, 1, provider.fetched)
	rows, err = execute(context.Background(), parent, descriptor, nil)
	require.Error(t, err)
	require.Nil(t, rows, "report execution cannot invent an omitted child selection")
}

func TestStandaloneProviderDatasourceRejectsSubstitutionAndPostDispatchDrift(t *testing.T) {
	for _, change := range []string{"provider", "proof", "descriptor", "component", "method", "expired", "source-after", "component-after", "authority-after", "lease-after"} {
		t.Run(change, func(t *testing.T) {
			gateway, provider, pin, proof, descriptor := standaloneStack(t)
			item := provider.items[pin.URI]
			switch change {
			case "provider":
				pin.ProviderIdentity = "other"
			case "proof":
				proof.Token = "invalid"
			case "descriptor":
				descriptor.Selectors = &types.Selectors{Data: "other"}
			case "component":
				descriptor.Backend.Component.Revision = "other"
			case "method":
				descriptor.Backend.Method = "unknown"
			case "expired":
				pin.ValidUntil = time.Now().Add(-time.Second)
			case "source-after":
				provider.after = func() { item.raw = append(item.raw, byte(' ')); provider.resourceChanged() }
			case "component-after":
				provider.after = func() {
					var e map[string]any
					json.Unmarshal(item.raw, &e)
					e["dataSource"].(map[string]any)["backend"].(map[string]any)["component"].(map[string]any)["revision"] = "other"
					item.raw, _ = json.Marshal(e)
					provider.resourceChanged()
				}
			case "authority-after":
				provider.after = func() { item.authorityBinding = "revoked"; provider.resourceChanged() }
			case "lease-after":
				provider.after = func() { item.validUntil = time.Now().Add(5 * time.Millisecond); provider.resourceChanged() }
			}
			body, err := gateway.FetchDatasource(context.Background(), pin, proof, descriptor, nil)
			require.Error(t, err)
			require.Nil(t, body)
		})
	}
}
