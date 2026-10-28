package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"

	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	reportcatalog "github.com/viant/forge/backend/reporting/catalog"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	client "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type publishedTrapProvider struct{ calls int }

func (p *publishedTrapProvider) Options(context.Context, string) (*cfg.MCPClient, error) {
	p.calls++
	return nil, errors.New("unexpected remote metadata options")
}
func (p *publishedTrapProvider) Names(context.Context) ([]string, error) {
	return []string{"catalog"}, nil
}
func (p *publishedTrapProvider) CatalogNames(context.Context) ([]string, error) {
	return []string{"catalog"}, nil
}

type syntheticPublishedSource struct {
	states                      map[string]primitive.ResourceState
	denied                      bool
	namespace, owner, admission string
	gets, hashes                atomic.Int64
}

func (s *syntheticPublishedSource) AdmissionKey(context.Context) (string, error) {
	if s.denied {
		return "", identity.ErrResourceDenied
	}
	if s.admission != "" {
		return s.admission, nil
	}
	return "session-1", nil
}
func (s *syntheticPublishedSource) Namespaces(context.Context) ([]primitive.NamespaceCapabilities, error) {
	if s.denied {
		return nil, identity.ErrResourceDenied
	}
	kinds := []primitive.KindSupport{}
	for _, kind := range []string{"window", "navigation", "report", "mcp", "skill", "prompt", "agent", "eval", "playbook", "toolfeed"} {
		kinds = append(kinds, primitive.KindSupport{Kind: kind, FormatVersions: []int64{1}, Operations: []string{"list", "get"}})
	}
	owner, namespace := s.owner, s.namespace
	if owner == "" {
		owner = "publisher"
	}
	if namespace == "" {
		namespace = "example"
	}
	return []primitive.NamespaceCapabilities{{ProviderIdentity: owner, Namespace: namespace, Kinds: kinds}}, nil
}
func (s *syntheticPublishedSource) List(_ context.Context, kind, namespace string) ([]primitive.ResourceState, error) {
	if s.denied {
		return nil, identity.ErrResourceDenied
	}
	out := []primitive.ResourceState{}
	for _, state := range s.states {
		if state.Kind == kind && (namespace == "" || namespace == state.Namespace) {
			out = append(out, state)
		}
	}
	return out, nil
}
func (s *syntheticPublishedSource) Get(_ context.Context, uri string) (*primitive.ResourceState, error) {
	s.gets.Add(1)
	if s.denied {
		return nil, identity.ErrResourceDenied
	}
	state, ok := s.states[uri]
	if !ok {
		return nil, identity.ErrResourceDenied
	}
	state.Definition = bytes.Clone(state.Definition)
	state.DefinitionBytes = bytes.Clone(state.DefinitionBytes)
	return &state, nil
}
func (s *syntheticPublishedSource) CurrentHash(_ context.Context, uri string) (string, error) {
	s.hashes.Add(1)
	if s.denied {
		return "", identity.ErrResourceDenied
	}
	state, ok := s.states[uri]
	if !ok {
		return "", identity.ErrResourceDenied
	}
	return state.ContentFingerprint, nil
}
func publishedFixture(t *testing.T) (*Gateway, *syntheticPublishedSource, *publishedTrapProvider, *identity.VerifiedActor) {
	t.Helper()
	trap := &publishedTrapProvider{}
	mgr, err := manager.New(trap, manager.WithClientFactory(func(context.Context, string, string) (client.Interface, error) {
		trap.calls++
		return nil, errors.New("unexpected metadata transport")
	}))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor := &identity.VerifiedActor{Issuer: "https://example.invalid", Subject: "reader", TenantID: "tenant", AccountID: "account", IdentityRevision: "identity-1", ValidUntil: time.Now().Add(time.Hour)}
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "host")
	t.Cleanup(gateway.Close)
	source := &syntheticPublishedSource{states: map[string]primitive.ResourceState{}}
	for kind, raw := range map[string]string{"navigation": `{"schemaVersion":1,"applications":[]}`, "report": `{"schemaVersion":1,"reportDocument":{"title":"Example"},"reportSpec":{"kind":"reportSpec","title":"Example","datasets":[],"blocks":[]}}`, "mcp": `{"name":"data","transport":{"type":"streamable","url":"https://example.invalid/mcp"}}`, "skill": `{"name":"Example"}`, "prompt": `{"name":"Example"}`, "agent": `{"name":"Example"}`, "eval": `{"name":"Example"}`, "playbook": `{"name":"Example"}`, "toolfeed": `{"name":"Example"}`} {
		uri := kind + "://example/sample"
		source.states[uri] = primitive.ResourceState{URI: uri, Kind: kind, Namespace: "example", Name: "sample", Title: "Example", FormatVersion: 1, DefinitionBytes: []byte(raw), ContentFingerprint: identity.ContentFingerprint([]byte(raw))}
	}
	require.NoError(t, gateway.RegisterPublishedMetadataSource(Connection{Name: "catalog", ProviderIdentity: "publisher"}, []string{"example"}, source))
	return gateway, source, trap, actor
}
func TestPublishedMetadataRoutesAllKindsWithoutRemoteMetadata(t *testing.T) {
	g, _, trap, _ := publishedFixture(t)
	ctx := context.Background()
	namespaces, err := g.Discover(ctx)
	require.NoError(t, err)
	require.Len(t, namespaces, 1)
	for _, kind := range []string{"navigation", "report", "mcp", "skill", "prompt", "agent", "eval", "playbook", "toolfeed"} {
		t.Run(kind, func(t *testing.T) {
			uri := kind + "://example/sample"
			connection, err := g.ConnectionForResource(ctx, identity.ResourceURI{Kind: kind, Namespace: "example", Name: "sample"}, "publisher")
			require.NoError(t, err)
			rows, err := ListPageFrom[json.RawMessage](ctx, g, []Connection{connection}, kind, CatalogQuery{Namespace: "example"}, true)
			require.NoError(t, err)
			require.Len(t, rows.Items, 1)
			got, err := GetFrom[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri}, decodeDefinition[json.RawMessage])
			require.NoError(t, err)
			require.Equal(t, identity.PublishedCandidate, got.ResolvedResource.Kind)
			require.Empty(t, got.ResolvedResource.Selector())
			require.Equal(t, "publisher", got.ResolvedResource.ProviderIdentity)
			reread, err := g.Get(ctx, connection, identity.ResourceRef{URI: uri}, got.ResolvedResource)
			require.NoError(t, err)
			require.Equal(t, *got.ResolvedResource, *reread.ResolvedResource)
		})
	}
	require.Zero(t, trap.calls)
}
func TestPublishedReportReadSequenceHasLocalTerminalValidation(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	catalog := &ReportGatewayCatalog{Gateway: g}
	listed, err := catalog.List(ctx, reportcatalog.ReportCatalogQuery{})
	require.NoError(t, err)
	require.Len(t, listed.Reports, 1)
	reader, err := catalog.Reader(ctx, "report.execute")
	require.NoError(t, err)
	pin, err := reader.Resolve(ctx, identity.ResourceRef{URI: "report://example/sample"})
	require.NoError(t, err)
	_, _, err = reader.ReadResolved(ctx, *pin)
	require.NoError(t, err)
	source.denied = true
	require.Error(t, finish())
	require.Zero(t, trap.calls)
}
func TestPublishedMetadataMissingDriftAndRegistrationAreTerminal(t *testing.T) {
	g, source, trap, actor := publishedFixture(t)
	ctx := context.Background()
	connection := Connection{Name: "catalog", ProviderIdentity: "publisher"}
	_, err := g.Get(ctx, connection, identity.ResourceRef{URI: "report://example/missing"}, nil)
	require.Error(t, err)
	got, err := g.Get(ctx, connection, identity.ResourceRef{URI: "report://example/sample"}, nil)
	require.NoError(t, err)
	actor.Subject = "other"
	_, err = g.Get(ctx, connection, identity.ResourceRef{URI: "report://example/sample"}, got.ResolvedResource)
	require.Error(t, err)
	require.ErrorIs(t, g.RegisterPublishedMetadataSource(connection, []string{"different"}, source), ErrCollision)
	require.ErrorIs(t, g.RegisterPublishedMetadataSource(Connection{Name: "other", ProviderIdentity: "other"}, []string{"example"}, source), ErrCollision)
	source.denied = true
	_, err = g.ConnectionForResource(ctx, identity.ResourceURI{Kind: "report", Namespace: "example", Name: "sample"}, "publisher")
	require.Error(t, err)
	require.Zero(t, trap.calls)
}

func TestPublishedMCPDefinitionReaderNeverUsesCoveredTransport(t *testing.T) {
	g, _, trap, _ := publishedFixture(t)
	raw := []byte(`{"name":"catalog","primitiveProviderIdentity":"publisher","primitiveNamespaces":["ns://example"],"transport":{"type":"streamable","url":"https://example.invalid/catalog"}}`)
	local := &syntheticPublishedSource{owner: "configuration", namespace: "workspace", states: map[string]primitive.ResourceState{"mcp://workspace/catalog": {URI: "mcp://workspace/catalog", Kind: "mcp", Namespace: "workspace", Name: "catalog", FormatVersion: 1, DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)}}}
	require.NoError(t, g.RegisterPublishedMetadataSource(Connection{Name: "configuration", ProviderIdentity: "configuration"}, []string{"workspace"}, local))
	reader, err := NewMCPReferenceReader(g, MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}, []identity.ResourceRef{{URI: "mcp://workspace/catalog"}})
	require.NoError(t, err)
	for i := 0; i < 2; i++ {
		definition, err := reader.Load(context.Background(), "mcp://example/sample")
		require.NoError(t, err)
		require.Equal(t, "publisher", definition.ResolvedIdentity.ProviderIdentity)
		require.Equal(t, "mcp://example/sample", definition.ResolvedIdentity.ResourceURI)
	}
	names, err := reader.List(context.Background())
	require.NoError(t, err)
	require.Contains(t, names, "mcp://example/sample")
	require.Zero(t, trap.calls)
}

func TestPublishedPublicGatewayPinsAndCursorsUseActualAdmission(t *testing.T) {
	g, source, trap, actor := publishedFixture(t)
	*actor = identity.VerifiedActor{PublicRead: true}
	ctx := context.Background()
	connection := Connection{Name: "catalog", ProviderIdentity: "publisher"}
	got, err := g.Get(ctx, connection, identity.ResourceRef{URI: "report://example/sample"}, nil)
	require.NoError(t, err)
	require.True(t, got.ResolvedResource.ValidUntil.IsZero())
	// The public gateway actor stays identical while the real source session changes.
	source.admission = "session-2"
	_, err = g.Get(ctx, connection, identity.ResourceRef{URI: "report://example/sample"}, got.ResolvedResource)
	require.Error(t, err)
	fresh, err := g.Get(ctx, connection, identity.ResourceRef{URI: "report://example/sample"}, nil)
	require.NoError(t, err)
	require.NotEqual(t, got.ResolvedResource.AuthorityBinding, fresh.ResolvedResource.AuthorityBinding)
	require.Zero(t, trap.calls)
}

func TestPublishedMetadataRejectsWrongLocatorBeforeRemoteLookup(t *testing.T) {
	g, _, trap, _ := publishedFixture(t)
	ctx := context.Background()
	ref := identity.ResourceRef{URI: "report://example/sample"}
	_, err := GetFrom[json.RawMessage](ctx, g, Connection{Name: "unrelated", ProviderIdentity: "other"}, ref, decodeDefinition[json.RawMessage])
	require.Error(t, err)
	_, err = g.GetForProvider(ctx, "other", ref, nil)
	require.Error(t, err)
	_, err = g.Get(ctx, Connection{Name: "unrelated", ProviderIdentity: "other"}, ref, nil)
	require.Error(t, err)
	require.Zero(t, trap.calls)
}
func TestPublishedReportReadSequenceCanCompleteWithoutMetadataTransport(t *testing.T) {
	g, _, trap, _ := publishedFixture(t)
	ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	reader, err := (&ReportGatewayCatalog{Gateway: g}).Reader(ctx, "report.export")
	require.NoError(t, err)
	pin, err := reader.Resolve(ctx, identity.ResourceRef{URI: "report://example/sample"})
	require.NoError(t, err)
	_, fresh, err := reader.ReadResolved(ctx, *pin)
	require.NoError(t, err)
	require.Equal(t, *pin, *fresh)
	require.NoError(t, finish())
	require.Zero(t, trap.calls)
}
func TestPublishedCatalogCursorCannotCrossPublicSourceAdmissions(t *testing.T) {
	g, source, trap, actor := publishedFixture(t)
	*actor = identity.VerifiedActor{PublicRead: true}
	sample := source.states["report://example/sample"]
	sample.URI = "report://example/second"
	sample.Name = "second"
	source.states[sample.URI] = sample
	ctx := context.Background()
	page, err := ListPage[json.RawMessage](ctx, g, "report", CatalogQuery{Namespace: "example", Limit: 1}, true)
	require.NoError(t, err)
	require.NotEmpty(t, page.NextCursor)
	_, err = ListPage[json.RawMessage](ctx, g, "report", CatalogQuery{Namespace: "example", Limit: 1, Cursor: page.NextCursor}, true)
	require.NoError(t, err)
	source.admission = "other-session"
	_, err = ListPage[json.RawMessage](ctx, g, "report", CatalogQuery{Namespace: "example", Limit: 1, Cursor: page.NextCursor}, true)
	require.ErrorIs(t, err, primitive.ErrCatalogCursor)
	require.Zero(t, trap.calls)
}

func TestPublishedReadUsesOneBodyAndLocalSelectionFence(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	ctx := context.Background()
	connection := Connection{Name: "catalog", ProviderIdentity: "publisher"}
	ref := identity.ResourceRef{URI: "report://example/sample"}
	original := bytes.Clone(source.states[ref.URI].DefinitionBytes)
	got, err := Get[json.RawMessage](ctx, g, connection, ref, nil, func(raw json.RawMessage) (json.RawMessage, error) { raw[0] = ' '; return raw, nil })
	require.NoError(t, err)
	require.Equal(t, original, []byte(got.Resource.Definition))
	require.EqualValues(t, 1, source.gets.Load())
	require.EqualValues(t, 1, source.hashes.Load())
	require.Zero(t, trap.calls)
}
func TestPublishedReadFencesSelectionAndAdmissionChangesDuringDecode(t *testing.T) {
	for _, change := range []string{"selection", "admission", "revocation"} {
		t.Run(change, func(t *testing.T) {
			g, source, trap, _ := publishedFixture(t)
			ref := identity.ResourceRef{URI: "report://example/sample"}
			_, err := Get[json.RawMessage](context.Background(), g, Connection{Name: "catalog", ProviderIdentity: "publisher"}, ref, nil, func(raw json.RawMessage) (json.RawMessage, error) {
				switch change {
				case "selection":
					state := source.states[ref.URI]
					state.ContentFingerprint = identity.ContentFingerprint([]byte(`{"new":true}`))
					source.states[ref.URI] = state
				case "admission":
					source.admission = "changed"
				case "revocation":
					source.denied = true
				}
				return raw, nil
			})
			require.Error(t, err)
			require.EqualValues(t, 1, source.gets.Load())
			require.EqualValues(t, 1, source.hashes.Load())
			require.Zero(t, trap.calls)
		})
	}
}

type ordinaryPublishedClaim struct{ *fixtureProvider }

func (p ordinaryPublishedClaim) CallTool(ctx context.Context, request *schema.CallToolRequestParams, options ...client.RequestOption) (*schema.CallToolResult, error) {
	result, err := p.fixtureProvider.CallTool(ctx, request, options...)
	if err != nil {
		return nil, err
	}
	if request.Name == "windows/get" {
		value := result.StructuredContent.(primitive.GetResult)
		value.ResolvedResource.Kind = identity.PublishedCandidate
		result.StructuredContent = value
	}
	return result, nil
}
func TestOrdinaryTransportCannotClaimLocalPublishedAuthority(t *testing.T) {
	provider := provider("remote-owner")
	manager, err := manager.New(fixtureOptions{"remote": {ClientOptions: &mcp.ClientOptions{}}}, manager.WithClientFactory(func(context.Context, string, string) (client.Interface, error) {
		return ordinaryPublishedClaim{provider}, nil
	}))
	require.NoError(t, err)
	t.Cleanup(func() { manager.CloseConversation("") })
	actor, verify := PublicReadActors()
	gateway := NewGateway(manager, actor, verify, "host")
	t.Cleanup(gateway.Close)
	_, err = gateway.Get(context.Background(), Connection{Name: "remote", ProviderIdentity: "remote-owner"}, identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
}
