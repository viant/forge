package resource

import (
	"context"
	"encoding/json"
	"errors"
	reportcatalog "github.com/viant/forge/backend/reporting/catalog"

	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	reporting "github.com/viant/forge/backend/reporting/engine"
	identity "github.com/viant/forge/backend/resource"
	mcpcfg "github.com/viant/mcp/client/config"

	"github.com/viant/mcp"

	mcpclient "github.com/viant/mcp/client"
)

type gatewayReportCompiler func(context.Context, *reporting.CompileRequest) (*reporting.CompileResult, error)

func (f gatewayReportCompiler) Compile(ctx context.Context, request *reporting.CompileRequest) (*reporting.CompileResult, error) {
	return f(ctx, request)
}

type boundedReportFixturePolicy struct {
	actor identity.VerifiedActor
	until time.Time
}

func (p boundedReportFixturePolicy) SelectRevision(ctx context.Context, ref identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	decision, err := (localFixturePolicy{actor: p.actor}).SelectRevision(ctx, ref, candidates)
	if err != nil {
		return decision, err
	}
	if p.until.Before(decision.ValidUntil) {
		decision.ValidUntil = p.until
	}
	return decision, nil
}
func reportGatewayFixture(t *testing.T) (*ReportGatewayCatalog, *localFixtureSource, *identity.VerifiedActor, *atomic.Bool, *LocalProvider) {
	allowed := new(atomic.Bool)
	allowed.Store(true)
	until := time.Now().Add(time.Minute)
	source := &localFixtureSource{raw: json.RawMessage(`{"schemaVersion":1,"reportDocument":{"title":"Approved"},"reportSpec":{"kind":"reportSpec","title":"Approved","datasets":[],"blocks":[]}}`)}
	actor := &identity.VerifiedActor{Subject: "alice", Issuer: "https://synthetic.invalid", TenantID: "test", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Hour)}
	actorFn := func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }
	verify := func(_ context.Context, a identity.VerifiedActor) error {
		if !sameLocalActor(a, *actor) {
			return identity.ErrResourceDenied
		}
		return nil
	}
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "internal", Actor: actorFn, Verify: verify, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error {
		if !allowed.Load() {
			return identity.ErrResourceDenied
		}
		return nil
	}, Bindings: []LocalResourceBinding{{Changes: source, URI: "report://example/sales", Title: "Approved", FormatVersion: 1, Resolver: func(_ context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: "internal", Source: source, Policy: boundedReportFixturePolicy{actor: a, until: until}}, nil
	}}}, Validators: map[string]LocalResourceValidator{"report": ValidateReportEnvelope}})
	require.NoError(t, err)
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	require.NoError(t, mgr.RegisterLocal(context.Background(), "internal", &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "internal"}, func(context.Context) (mcpclient.Interface, error) { return NewLocalMCPClient(provider) }))
	gateway := NewGateway(mgr, actorFn, verify, "aggregate")
	t.Cleanup(gateway.Close)
	return &ReportGatewayCatalog{Gateway: gateway}, source, actor, allowed, provider
}

func TestReportListPreservesOperationAndCleanupErrors(t *testing.T) {
	service, _, _, _, _ := reportGatewayFixture(t)
	primary, cleanup := errors.New("capabilities unavailable"), errors.New("metadata scope close failed")
	service.Capabilities = func(context.Context, identity.VerifiedActor, reportcatalog.ReportCatalogCandidate, identity.ResolvedResource) (reportcatalog.ReportCapabilities, error) {
		return reportcatalog.ReportCapabilities{}, primary
	}
	service.BeginMetadataRead = func(ctx context.Context) (context.Context, func() error, error) {
		return ctx, func() error { return cleanup }, nil
	}
	page, err := service.List(context.Background(), reportcatalog.ReportCatalogQuery{})
	require.Nil(t, page)
	require.ErrorIs(t, err, primary)
	require.ErrorIs(t, err, cleanup)
}
func TestReportListPreservesCallerCancellation(t *testing.T) {
	service, _, _, _, _ := reportGatewayFixture(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.BeginMetadataRead = func(ctx context.Context) (context.Context, func() error, error) {
		return ctx, func() error { cancel(); return nil }, nil
	}
	page, err := service.List(ctx, reportcatalog.ReportCatalogQuery{})
	require.Nil(t, page)
	require.ErrorIs(t, err, context.Canceled)
	require.NotErrorIs(t, err, identity.ErrResourceDenied)
}

func TestRetiredReportPublisherDoesNotInitializeReplacementEndpoint(t *testing.T) {
	for _, declared := range []bool{true, false} {
		t.Run(map[bool]string{true: "configured", false: "discovered"}[declared], func(t *testing.T) {
			fixture, source, _, _, provider := reportGatewayFixture(t)
			config := &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}}
			if declared {
				config.PrimitiveProviderIdentity = "internal"
			}
			var opened, reads atomic.Int32
			source.onRead = func() { reads.Add(1) }
			mgr, err := manager.New(fixtureOptions{"fixture-endpoint": config}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) {
				opened.Add(1)
				return NewLocalMCPClient(provider)
			}))
			require.NoError(t, err)
			t.Cleanup(func() { mgr.CloseConversation("") })
			g := NewGateway(mgr, fixture.Gateway.Actor, fixture.Gateway.Verify, "host")
			t.Cleanup(g.Close)
			ref := identity.ResourceRef{URI: "report://example/sales"}
			reader := &gatewayReportReader{catalog: &ReportGatewayCatalog{Gateway: g}}
			_, err = reader.ReportReaderForProvider(t.Context(), ref, "retired")
			require.ErrorIs(t, err, identity.ErrResourceDenied)
			require.Zero(t, opened.Load(), "even replacement discovery must not run")
			if !declared {
				_, err = g.Discover(t.Context())
				require.NoError(t, err)
			}
			selected, err := reader.ReportReaderForProvider(t.Context(), ref, "internal")
			require.NoError(t, err)
			result, err := selected.(*gatewayReportReader).ReadDefinition(t.Context(), ref, nil)
			require.NoError(t, err)
			require.Equal(t, "internal", result.ResolvedResource.ProviderIdentity)
			require.EqualValues(t, 1, reads.Load(), "owner-qualified selection and delivery share one definition read")
		})
	}
}
