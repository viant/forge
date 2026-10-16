package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

type mutableNamespaceFixture struct {
	*fixtureProvider
	hidden, changed, unavailable bool
}

func (p *mutableNamespaceFixture) CallTool(ctx context.Context, input *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if input.Name == "namespaces/list" && p.hidden {
		return &schema.CallToolResult{StructuredContent: primitive.NamespaceListResult{ProviderIdentity: p.owner, Complete: true}}, nil
	}
	if input.Name == "namespaces/get" && p.unavailable {
		return nil, identity.ErrResourceDenied
	}
	if input.Name == "namespaces/get" && p.changed {
		return &schema.CallToolResult{StructuredContent: primitive.NamespaceCapabilities{ProviderIdentity: p.owner, Namespace: "example", Kinds: []primitive.KindSupport{{Kind: "window", FormatVersions: []int64{3}, Operations: []string{"get"}, Methods: primitive.Methods("window", []string{"get"})}}}}, nil
	}
	return p.fixtureProvider.CallTool(ctx, input, options...)
}

func readSequenceFixture(t *testing.T) (*Gateway, *mutableNamespaceFixture, *identity.VerifiedActor, fixtureOptions) {
	t.Helper()
	p := &mutableNamespaceFixture{fixtureProvider: provider("owned")}
	options := fixtureOptions{"remote": &cfg.MCPClient{PrimitiveProviderIdentity: "owned"}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return p, nil }))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor := &identity.VerifiedActor{Subject: "alice", Issuer: "issuer", TenantID: "tenant", AccountID: "21", IdentityRevision: "original", ValidUntil: time.Now().Add(time.Minute)}
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(_ context.Context, held identity.VerifiedActor) error {
		if held.Subject != actor.Subject || held.Issuer != actor.Issuer || held.AccountID != actor.AccountID || held.IdentityRevision != actor.IdentityRevision {
			return identity.ErrResourceDenied
		}
		return nil
	}, "gateway")
	t.Cleanup(g.Close)
	return g, p, actor, options
}

func TestReadSequenceReusesDefinitionAndContractAcrossPhases(t *testing.T) {
	g, p, _, _ := readSequenceFixture(t)
	ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	ref := identity.ResourceRef{URI: "window://example/sales"}
	for i := 0; i < 3; i++ {
		_, err := g.GetForProvider(ctx, "owned", ref, nil)
		require.NoError(t, err)
	}
	require.Equal(t, 3, p.calls["windows/get"], "unselected working reads remain fresh within a metadata sequence")
	require.Equal(t, 1, p.calls["namespaces/list"])
	require.Equal(t, 1, p.calls["namespaces/get"])
	endDispatch, err := requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, p.calls["namespaces/list"], "dispatch retains the same authenticated namespace contract")
	require.NoError(t, endDispatch())
	for i := 0; i < 2; i++ {
		_, err := g.GetForProvider(ctx, "owned", ref, nil)
		require.NoError(t, err)
	}
	require.Equal(t, 5, p.calls["windows/get"])
	require.Equal(t, 1, p.calls["namespaces/list"], "POST reuses namespace discovery while working definitions remain fresh")
	require.NoError(t, finish())
	require.Equal(t, 1, p.calls["namespaces/list"], "release fences transport without another namespace RPC")
	_, err = g.GetForProvider(ctx, "owned", ref, nil)
	require.Error(t, err, "an escaped completed operation cannot reuse either phase")
	newCtx, newFinish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	_, err = g.GetForProvider(newCtx, "owned", ref, nil)
	require.NoError(t, err)
	require.Equal(t, 1, p.calls["namespaces/list"], "another operation shares only the cached contract")
	require.NoError(t, newFinish())
}

func TestReadSequenceRejectsCatalogCredentialActorGenerationAndDeadlineDrift(t *testing.T) {
	for _, change := range []string{"visibility", "methods", "unavailable", "credential", "identity", "generation", "session", "options", "association", "account", "tenant", "subject", "expiry", "cancel"} {
		t.Run(change, func(t *testing.T) {
			g, p, actor, options := readSequenceFixture(t)
			base, cancel := context.WithCancel(context.Background())
			defer cancel()
			ctx, finish, err := g.BeginReadSequence(base, nil)
			require.NoError(t, err)
			ref := identity.ResourceRef{URI: "window://example/sales"}
			_, err = g.GetForProvider(ctx, "owned", ref, nil)
			require.NoError(t, err)
			switch change {
			case "visibility":
				p.hidden = true
				p.resourceChanged()
			case "methods":
				p.changed = true
				p.resourceChanged()
			case "unavailable":
				p.unavailable = true
				p.resourceChanged()
			case "credential":
				ctx = authctx.WithIDToken(ctx, "different-session-credential")
			case "identity":
				actor.IdentityRevision = "changed"
			case "generation":
				g.Invalidate("remote")
			case "session":
				replacement := &mutableNamespaceFixture{fixtureProvider: provider("owned")}
				newManager, managerErr := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return replacement, nil }))
				require.NoError(t, managerErr)
				t.Cleanup(func() { newManager.CloseConversation("") })
				g.Manager = newManager
			case "options":
				options["remote"].PrimitiveNamespaces = []string{"changed"}
			case "association":
				ctx, err = requestctx.WithResourceReadAssociation(ctx, &identity.ResolvedResource{URI: "window://example/another"}, nil)
				require.NoError(t, err)
			case "account":
				actor.AccountID = "22"
			case "tenant":
				actor.TenantID = "other"
			case "subject":
				actor.Subject = "other"
			case "expiry":
				now := time.Now().Add(2 * time.Minute)
				g.Now = func() time.Time { return now }
			case "cancel":
				cancel()
			}
			if change == "visibility" || change == "methods" || change == "unavailable" {
				// A resource event refreshes the advertised contract on the next read;
				// it does not turn a transport barrier into namespace-policy polling.
				_, err = g.GetForProvider(ctx, "owned", ref, nil)
				require.Error(t, err, "the notified owner contract cannot be adopted by the original operation")
			}
			_, err = requestctx.BeginResourceReadDispatch(ctx)
			require.Error(t, err, "changed facts must stop actual dispatch")
			require.Error(t, finish())
			_, err = g.GetForProvider(ctx, "owned", ref, nil)
			require.Error(t, err, "failed phases must close and cannot silently refresh their authority")
		})
	}
}

func TestReadSequencePostPhaseCannotAdoptChangedMethodContract(t *testing.T) {
	g, p, _, _ := readSequenceFixture(t)
	ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	ref := identity.ResourceRef{URI: "window://example/sales"}
	_, err = g.GetForProvider(ctx, "owned", ref, nil)
	require.NoError(t, err)
	endDispatch, err := requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	p.changed = true
	p.resourceChanged()
	require.NoError(t, endDispatch())
	_, err = g.GetForProvider(ctx, "owned", ref, nil)
	require.Error(t, err, "a fresh POST phase must compare the original method contract rather than silently adopting drift")
	require.Error(t, finish())
}

func TestReadSequenceProviderFetchBarrierClosesPreBeforeActualRPC(t *testing.T) {
	for _, revoke := range []bool{false, true} {
		t.Run(map[bool]string{false: "stable", true: "revoked-during-dispatch"}[revoke], func(t *testing.T) {
			g, provider, pin, proof, descriptor := standaloneStack(t)
			ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
			require.NoError(t, err)
			provider.after = func() {
				sequence := sequenceFromContext(ctx)
				sequence.mu.Lock()
				active, depth, facts := sequence.active, sequence.dispatchDepth, sequence.factContext
				sequence.mu.Unlock()
				require.False(t, active, "metadata PRE memo must end at the actual provider RPC")
				require.Nil(t, facts, "PRE opaque facts cannot remain active through dispatch")
				require.Equal(t, 1, depth)
				if revoke {
					provider.items[pin.URI].denied = true
					provider.resourceChanged()
				}
			}
			body, err := g.FetchDatasource(ctx, pin, proof, descriptor, nil)
			if revoke {
				require.Error(t, err)
				require.Nil(t, body, "fresh POST resource authorization must discard revoked data")
			} else {
				require.NoError(t, err)
				require.NotEmpty(t, body)
			}
			_ = finish()
			_, _, err = g.ResolveDatasource(ctx, pin)
			require.Error(t, err, "completed or failed dispatch contexts cannot reuse catalog facts")
		})
	}
}

type testReadFactsKey struct{}
type testReadFactsState struct {
	base       context.Context
	credential [32]byte
	closed     bool
}
type testReadFactsScope struct{ begins, finishes int }

func (p *testReadFactsScope) BeginDecision(ctx context.Context) (context.Context, func() error, error) {
	p.begins++
	state := &testReadFactsState{base: ctx, credential: credentialDigest(ctx)}
	return context.WithValue(ctx, testReadFactsKey{}, state), func() error { state.closed = true; p.finishes++; return ctx.Err() }, nil
}
func (p *testReadFactsScope) WithoutDecision(ctx context.Context) context.Context {
	return context.WithValue(ctx, testReadFactsKey{}, (*testReadFactsState)(nil))
}
func (p *testReadFactsScope) CopyDecision(ctx, scoped context.Context) (context.Context, error) {
	state, _ := scoped.Value(testReadFactsKey{}).(*testReadFactsState)
	if state == nil || state.closed || state.base.Err() != nil || state.credential != credentialDigest(ctx) {
		return nil, identity.ErrResourceDenied
	}
	return context.WithValue(ctx, testReadFactsKey{}, state), nil
}

func TestReadSequenceFactsCloseAtDispatchAndFreshPostRetainsCallerValues(t *testing.T) {
	g, _, _, _ := readSequenceFixture(t)
	facts := &testReadFactsScope{}
	type callerValue struct{}
	base := context.WithValue(authctx.WithIDToken(context.Background(), "original-credential"), callerValue{}, "held-parent-context")
	ctx, finish, err := g.BeginReadSequence(base, facts)
	require.NoError(t, err)
	pre, err := ReadContext(ctx)
	require.NoError(t, err)
	preState := pre.Value(testReadFactsKey{}).(*testReadFactsState)
	require.Equal(t, "held-parent-context", pre.Value(callerValue{}))
	endDispatch, err := requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	require.True(t, preState.closed, "PRE source snapshot closes before actual dispatch")
	actual, err := ReadContext(pre)
	require.NoError(t, err)
	require.Nil(t, actual.Value(testReadFactsKey{}), "dispatch cannot carry the PRE snapshot")
	require.NoError(t, endDispatch())
	post, err := ReadContext(pre)
	require.NoError(t, err)
	postState := post.Value(testReadFactsKey{}).(*testReadFactsState)
	require.NotSame(t, preState, postState)
	require.Equal(t, "held-parent-context", post.Value(callerValue{}))
	require.NoError(t, finish())
	require.True(t, postState.closed)
	require.Equal(t, 2, facts.begins)
	require.Equal(t, 2, facts.finishes)
	_, err = ReadContext(post)
	require.Error(t, err)
}

func TestReadSequenceCopyFailureClosesFactsAndCannotRecoverWithOriginalCredential(t *testing.T) {
	g, _, _, _ := readSequenceFixture(t)
	facts := &testReadFactsScope{}
	ctx, finish, err := g.BeginReadSequence(authctx.WithIDToken(context.Background(), "initial"), facts)
	require.NoError(t, err)
	_, err = ReadContext(authctx.WithIDToken(ctx, "foreign"))
	require.Error(t, err)
	_, err = ReadContext(ctx)
	require.Error(t, err, "a poisoned scope cannot silently recover")
	require.Error(t, finish())
	require.Equal(t, 1, facts.finishes, "failure still closes the provider-owned snapshot")
}

func TestReadSequenceFreshPostCannotRenewOriginalLease(t *testing.T) {
	g, _, actor, _ := readSequenceFixture(t)
	originalExpiry := actor.ValidUntil
	ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	endDispatch, err := requestctx.BeginResourceReadDispatch(ctx)
	require.NoError(t, err)
	actor.ValidUntil = originalExpiry.Add(time.Hour)
	require.NoError(t, endDispatch())
	g.Now = func() time.Time { return originalExpiry.Add(time.Second) }
	_, err = ReadContext(ctx)
	require.Error(t, err, "POST lease renewal cannot extend this operation's original lease")
	require.Error(t, finish())
}
