package resource

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func TestReportFreshSelectionRenewsCacheButNeverHeldOperation(t *testing.T) {
	const uri = "report://example/sample"
	var sourceLease atomic.Value
	oldDeadline := time.Now().Add(30 * time.Second)
	sourceLease.Store(oldDeadline)
	var reads atomic.Int32
	source := &localFixtureSource{raw: json.RawMessage(`{"schemaVersion":1,"reportDocument":{"title":"Sample"}}`), onRead: func() { reads.Add(1) }}
	actor := identity.VerifiedActor{Subject: "sample", Issuer: "https://example.invalid", TenantID: "sample", AccountID: "sample", IdentityRevision: "one", ValidUntil: oldDeadline}
	allowed := atomic.Bool{}
	allowed.Store(true)
	actorFn := func(context.Context) (identity.VerifiedActor, error) { return actor, nil }
	verify := func(context.Context, identity.VerifiedActor) error {
		if !allowed.Load() {
			return identity.ErrResourceDenied
		}
		return nil
	}
	producer, err := NewLocalProvider(LocalConfig{ProviderIdentity: "sample-owner", Actor: actorFn, Verify: verify, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error {
		return verify(context.Background(), actor)
	}, Bindings: []LocalResourceBinding{{URI: uri, FormatVersion: 1, Resolver: func(context.Context, identity.VerifiedActor, string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: "sample-owner", Source: source, Policy: boundedReportFixturePolicy{actor: actor, until: sourceLease.Load().(time.Time)}}, nil
	}}}, Validators: map[string]LocalResourceValidator{"report": ValidateReportEnvelope}})
	require.NoError(t, err)
	manager, err := manager.New(nil)
	require.NoError(t, err)
	defer manager.CloseConversation("")
	require.NoError(t, manager.RegisterLocal(context.Background(), "sample", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "sample-owner", ResourceCacheScopes: map[string]string{"example/report": cfg.ResourceCacheUser}}, func(context.Context) (mcpclient.Interface, error) { return NewLocalMCPClient(producer) }))
	gateway := NewGateway(manager, actorFn, verify, "sample-gateway")
	defer gateway.Close()
	catalog := &ReportGatewayCatalog{Gateway: gateway}
	ctx := cacheUser("sample", "sample-token", "sample-conversation")
	reader, err := catalog.Reader(ctx, "report.retrieve")
	require.NoError(t, err)
	concrete := reader.(*gatewayReportReader)
	ref := identity.ResourceRef{URI: uri, Revision: identity.WorkingCandidate}
	initial, err := concrete.ReadDefinition(ctx, ref, nil)
	require.NoError(t, err)
	held := *initial.ResolvedResource
	require.True(t, held.ValidUntil.Equal(oldDeadline))
	require.Equal(t, int32(1), reads.Load())
	heldContext, finishHeld, err := gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	_, err = concrete.ReadDefinition(heldContext, ref, &held)
	require.NoError(t, err)
	require.True(t, sequenceFromContext(heldContext).lease.Equal(oldDeadline))
	newDeadline := time.Now().Add(5 * time.Minute)
	actor.ValidUntil = time.Now().Add(time.Hour)
	sourceLease.Store(newDeadline)
	warm, err := concrete.ReadDefinition(ctx, ref, nil)
	require.NoError(t, err)
	require.True(t, warm.ResolvedResource.ValidUntil.Equal(oldDeadline))
	require.Equal(t, int32(1), reads.Load(), "ordinary metadata remains warm until explicit refresh")
	refreshed, err := concrete.ReadDefinitionFresh(ctx, ref, &held)
	require.NoError(t, err)
	require.True(t, refreshed.ResolvedResource.ValidUntil.Equal(newDeadline))
	require.Equal(t, int32(2), reads.Load())
	warm, err = concrete.ReadDefinition(ctx, ref, nil)
	require.NoError(t, err)
	require.True(t, warm.ResolvedResource.ValidUntil.Equal(newDeadline))
	require.Equal(t, int32(2), reads.Load(), "renewed metadata must replace the warm entry")
	nextAction, finishNext, err := gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	_, err = concrete.ReadDefinition(nextAction, ref, refreshed.ResolvedResource)
	require.NoError(t, err)
	require.True(t, sequenceFromContext(nextAction).lease.Equal(newDeadline), "new action must not inherit the older namespace lease")
	require.True(t, sequenceFromContext(heldContext).lease.Equal(oldDeadline), "refresh must not renew concurrent original operation")
	require.NoError(t, finishNext())
	require.NoError(t, finishHeld())
	_, checked, err := concrete.ReadResolved(ctx, held)
	require.NoError(t, err)
	require.True(t, checked.ValidUntil.Equal(oldDeadline))
	require.True(t, held.ValidUntil.Equal(oldDeadline), "concurrent original action cannot inherit refreshed lease")
	expired := held
	expired.ValidUntil = time.Now().Add(-time.Second)
	_, _, err = concrete.ReadResolved(ctx, expired)
	require.Error(t, err)
	_, err = concrete.ReadDefinitionFresh(ctx, ref, &expired)
	require.NoError(t, err, "expired bookmark may select a NEW metadata grant")
	active, finish, err := gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	_, err = concrete.ReadDefinition(active, ref, refreshed.ResolvedResource)
	require.NoError(t, err)
	_, err = concrete.ReadDefinitionFresh(active, ref, &held)
	require.Error(t, err, "active report operation cannot renew its original grant")
	require.NoError(t, finish())
	dispatch, finish, err := gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	end, err := requestctx.BeginResourceReadDispatch(dispatch)
	require.NoError(t, err)
	_, err = concrete.ReadDefinitionFresh(dispatch, ref, &held)
	require.Error(t, err)
	require.NoError(t, end())
	require.NoError(t, finish())
	before := reads.Load()
	allowed.Store(false)
	_, err = concrete.ReadDefinitionFresh(ctx, ref, &held)
	require.Error(t, err)
	require.Equal(t, before, reads.Load(), "current actor denial cannot be bypassed by refresh")
}

type metadataRefreshCountedProvider struct {
	*dependencyMCPProvider
	namespaceGets atomic.Int32
}

func (p *metadataRefreshCountedProvider) CallTool(ctx context.Context, request *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if request.Name == "namespaces/get" {
		p.namespaceGets.Add(1)
	}
	return p.dependencyMCPProvider.CallTool(ctx, request, options...)
}

func TestReportFreshSelectionRefreshesDeclaredChildrenOncePerOwner(t *testing.T) {
	const reportURI = "report://example/sample"
	old := time.Now().Add(30 * time.Second)
	renewed := time.Now().Add(5 * time.Minute)
	actor := identity.VerifiedActor{Subject: "sample", Issuer: "https://example.invalid", TenantID: "sample", AccountID: "sample", IdentityRevision: "one", ValidUntil: old}
	items := map[string]*dependencyResource{}
	descriptors := map[string]json.RawMessage{}
	refs := map[string]primitive.DataSourceReference{}
	for _, id := range []string{"first", "second"} {
		descriptor, _ := json.Marshal(dsproto.DataSource{ID: id, DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendInline, Rows: []map[string]interface{}{{"value": 1}}}})
		raw, _ := json.Marshal(map[string]interface{}{"schemaVersion": 1, "dataSource": json.RawMessage(descriptor)})
		uri := "datasource://example/" + id
		items[uri] = &dependencyResource{raw: raw, formatVersion: 1, revision: identity.WorkingCandidate, authorityBinding: "sample-binding", validUntil: old}
		descriptors[id] = descriptor
		refs[id] = primitive.DataSourceReference{Resource: identity.ResourceRef{URI: uri, Revision: identity.WorkingCandidate}, ProviderIdentity: "sample-owner", ContentFingerprint: identity.ContentFingerprint(raw)}
	}
	// Two local aliases of one source must share its one fresh metadata read.
	var alias map[string]interface{}
	require.NoError(t, json.Unmarshal(descriptors["first"], &alias))
	alias["id"] = "third"
	descriptors["third"], _ = json.Marshal(alias)
	refs["third"] = refs["first"]
	raw, _ := json.Marshal(map[string]interface{}{"schemaVersion": 1, "reportDocument": map[string]interface{}{"title": "Sample"}, "dataSources": descriptors, "dataSourceResources": refs})
	items[reportURI] = &dependencyResource{raw: raw, formatVersion: 1, revision: identity.WorkingCandidate, authorityBinding: "sample-binding", validUntil: old}
	source := &metadataRefreshCountedProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "sample-owner", items: items}}
	manager, err := manager.New(fixtureOptions{"sample": {PrimitiveProviderIdentity: "sample-owner", ResourceCacheScopes: map[string]string{"example": cfg.ResourceCacheUser}}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer manager.CloseConversation("")
	gateway := NewGateway(manager, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "sample-gateway")
	defer gateway.Close()
	catalog := &ReportGatewayCatalog{Gateway: gateway}
	ctx := cacheUser("sample", "sample-token", "sample-conversation")
	reader := &gatewayReportReader{catalog: catalog}
	ref := identity.ResourceRef{URI: reportURI, Revision: identity.WorkingCandidate}
	initial, err := reader.ReadDefinition(ctx, ref, nil)
	require.NoError(t, err)
	held, finish, err := gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	_, err = reader.ReadDefinition(held, ref, initial.ResolvedResource)
	require.NoError(t, err)
	connection, found, err := gateway.configuredOwnerConnection(held, "sample-owner")
	require.NoError(t, err)
	require.True(t, found)
	children, err := gateway.ResolveDependencyPins(held, connection, *initial.ResolvedResource, refs, descriptors, nil)
	require.NoError(t, err)
	require.Equal(t, int64(2), source.datasourceReads.Load())
	namespaceBefore := source.namespaceGets.Load()
	for _, item := range items {
		item.validUntil = renewed
	}
	actor.ValidUntil = time.Now().Add(time.Hour)
	newAction, finishNew, err := gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	refreshed, err := reader.ReadDefinitionFresh(newAction, ref, initial.ResolvedResource)
	require.NoError(t, err)
	require.NoError(t, finishNew())
	require.True(t, refreshed.ResolvedResource.ValidUntil.Equal(renewed))
	require.Equal(t, int64(4), source.datasourceReads.Load(), "declared children must get current managing-producer grants")
	require.Equal(t, namespaceBefore+1, source.namespaceGets.Load(), "one owner namespace refresh serves the entire metadata action")
	require.True(t, sequenceFromContext(held).lease.Equal(old), "concurrent operation retains its original child deadline")
	for id, reference := range refs {
		warm, err := Get[json.RawMessage](ctx, gateway, connection, reference.Resource, nil)
		require.NoError(t, err)
		require.True(t, warm.ResolvedResource.ValidUntil.Equal(renewed))
		original := children[id]
		checked, err := Get[json.RawMessage](ctx, gateway, connection, reference.Resource, &original)
		require.NoError(t, err)
		require.True(t, checked.ResolvedResource.ValidUntil.Equal(old))
	}
	require.Equal(t, int64(4), source.datasourceReads.Load(), "warm reads must use replacement child entries")
	require.NoError(t, finish())
	items[refs["first"].Resource.URI].denied = true
	_, err = reader.ReadDefinitionFresh(ctx, ref, initial.ResolvedResource)
	require.Error(t, err, "child revocation must block the new metadata action")
}
