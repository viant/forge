package resource

import (
	"context"
	"encoding/json"

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
	}, Bindings: []LocalResourceBinding{{Changes: source, URI: "report://steward/sales", Title: "Approved", FormatVersion: 1, Resolver: func(_ context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
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
