package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const menuFixture = `{"schemaVersion":1,"applications":[{"id":"steward","title":"Workspace","icon":"applications","menus":[{"id":"advertisers","title":"Advertisers","icon":"office","action":{"type":"window","windowKey":"advertiserList","parameters":{"active":true}}},{"id":"campaigns","title":"Campaigns","icon":"timeline-events","action":{"type":"window","windowKey":"campaignList"}},{"id":"group","title":"Hidden","menus":[{"id":"secret","action":{"type":"window","windowKey":"secretWindow"}}]}]}]}`

func menuFixtureProvider(t *testing.T) (*LocalProvider, *localFixtureSource, *identity.VerifiedActor, *bool) {
	p, source, actor, revoked := localFixture(t)
	source.raw = json.RawMessage(menuFixture)
	b := localProviderBinding(p, "window://team/sales")
	b.URI = "navigation://team/navigation"
	b.Changes = source
	b.FormatVersion = 1
	b.Title = "Navigation"
	updateLocalProvider(t, p, func(config *LocalConfig) {
		config.Bindings = []LocalResourceBinding{b}
		config.Validators = map[string]LocalResourceValidator{"navigation": ValidateMenu}
		config.MenuActionVisibility = func(_ context.Context, _ identity.VerifiedActor, _ identity.ResourceURI, raw json.RawMessage) (bool, error) {
			return !strings.Contains(string(raw), "secretWindow"), nil
		}
	})
	return p, source, actor, revoked
}
func TestMenuProjectionNeverExposesSourceAndPreservesActions(t *testing.T) {
	p, source, _, _ := menuFixtureProvider(t)
	result, err := p.Get(context.Background(), "navigation", primitive.GetRequest{URI: "navigation://team/navigation"})
	require.NoError(t, err)
	require.Empty(t, result.Resource.Definition)
	require.Empty(t, result.Resource.DefinitionBytes)
	require.Equal(t, identity.ContentFingerprint(source.bytes()), result.ResolvedResource.ContentFingerprint)
	require.Equal(t, result.ResolvedResource.ContentFingerprint, result.Resource.ContentFingerprint)
	visible := string(result.MenuProjection.DefinitionBytes)
	require.NotContains(t, visible, "secretWindow")
	require.NotContains(t, visible, "Hidden")
	require.Contains(t, visible, `"windowKey":"advertiserList"`)
	require.Contains(t, visible, `"windowKey":"campaignList"`)
	require.Contains(t, visible, `"parameters":{"active":true}`)
	require.Equal(t, identity.ContentFingerprint(result.MenuProjection.DefinitionBytes), result.MenuProjection.ContentFingerprint)
	require.NotEqual(t, result.Resource.ContentFingerprint, result.MenuProjection.ContentFingerprint)
}
func TestMenuProducerDeniesRevocationDriftAndExpiry(t *testing.T) {
	for _, mode := range []string{"revocation", "drift", "expiry", "child-revocation", "late-drift"} {
		t.Run(mode, func(t *testing.T) {
			p, source, actor, revoked := menuFixtureProvider(t)
			calls := 0
			updateLocalProvider(t, p, func(config *LocalConfig) {
				config.MenuActionVisibility = func(_ context.Context, _ identity.VerifiedActor, _ identity.ResourceURI, raw json.RawMessage) (bool, error) {
					calls++
					switch mode {
					case "revocation":
						*revoked = true
					case "drift":
						source.raw = json.RawMessage(`{"schemaVersion":1,"applications":[]}`)
					case "expiry":
						actor.ValidUntil = time.Now().Add(-time.Second)
					case "late-drift":
						if calls > 3 {
							source.raw = json.RawMessage(`{"schemaVersion":1,"applications":[]}`)
						}
					case "child-revocation":
						if calls > 3 {
							return false, nil
						}
					}
					return !strings.Contains(string(raw), "secretWindow"), nil
				}
			})
			got, err := p.Get(context.Background(), "navigation", primitive.GetRequest{URI: "navigation://team/navigation"})
			require.Error(t, err)
			require.Nil(t, got)
		})
	}
}
func TestMenuGatewayOverOrdinaryProtectedMCP(t *testing.T) {
	p, source, actor, _ := menuFixtureProvider(t)
	var hideAll atomic.Bool
	visibility := localProviderConfig(p).MenuActionVisibility
	updateLocalProvider(t, p, func(config *LocalConfig) {
		config.MenuActionVisibility = func(ctx context.Context, actor identity.VerifiedActor, uri identity.ResourceURI, raw json.RawMessage) (bool, error) {
			if hideAll.Load() {
				return false, nil
			}
			return visibility(ctx, actor, uri, raw)
		}
	})
	handler, err := NewMCPHandler(p, func(next http.Handler) http.Handler { return next })
	require.NoError(t, err)
	server := httptest.NewServer(handler)
	defer server.Close()
	options := fixtureOptions{"producer": {ClientOptions: &mcp.ClientOptions{Name: "producer", Version: "1", ProtocolVersion: "2025-11-25", Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}}}
	mgr, err := manager.New(options)
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "consumer")
	defer gateway.Close()
	rows, err := gateway.List(context.Background(), "navigation", "team")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	got, err := gateway.GetMenu(context.Background(), rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil)
	require.NoError(t, err)
	wire, err := json.Marshal(got)
	require.NoError(t, err)
	require.NotContains(t, string(wire), "secretWindow")
	_, err = gateway.Get(context.Background(), rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	hideAll.Store(true)
	before := mgr.ResourceCatalogGeneration(context.Background(), "producer")
	source.Publish(context.Background())
	require.Eventually(t, func() bool { return mgr.ResourceCatalogGeneration(context.Background(), "producer") != before }, time.Second, time.Millisecond)
	fresh, err := gateway.GetMenu(context.Background(), rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, got.ResolvedResource)
	require.NoError(t, err)
	require.NotContains(t, string(fresh.MenuProjection.DefinitionBytes), "advertiserList")
}

type stampedMenuSource struct{ raw json.RawMessage }

func (s *stampedMenuSource) Candidates(context.Context, identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	return []identity.ResourceCandidate{{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(s.raw)}, {Kind: identity.StampedCandidate, Revision: "release-7", ContentFingerprint: identity.ContentFingerprint(s.raw)}}, nil
}
func (s *stampedMenuSource) ReadCandidate(context.Context, identity.ResourceURI, identity.ResourceCandidate) (json.RawMessage, error) {
	return append(json.RawMessage(nil), s.raw...), nil
}

type stampMenuPolicy struct{ until time.Time }

func (p stampMenuPolicy) SelectRevision(_ context.Context, ref identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	for _, c := range candidates {
		if c.Kind == identity.StampedCandidate && (ref.Revision == "" || ref.Revision == "release-7") {
			return identity.ResourceDecision{Candidate: c, AuthorityBinding: "source-menu-authority", ValidUntil: p.until}, nil
		}
	}
	return identity.ResourceDecision{}, identity.ErrResourceDenied
}
func TestMenuGenericAuthoredSourceSelectsExactStamp(t *testing.T) {
	p, _, actor, _ := menuFixtureProvider(t)
	b := localProviderBinding(p, "navigation://team/navigation")
	source := &stampedMenuSource{raw: json.RawMessage(menuFixture)}
	b.Resolver = func(context.Context, identity.VerifiedActor, string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: p.ProviderIdentity(), Source: source, Policy: stampMenuPolicy{until: actor.ValidUntil}}, nil
	}
	updateLocalProvider(t, p, func(config *LocalConfig) { setLocalConfigBinding(config, b) })
	for _, revision := range []string{"", "release-7"} {
		got, err := p.Get(context.Background(), "navigation", primitive.GetRequest{URI: b.URI, Revision: revision})
		require.NoError(t, err)
		require.Equal(t, "release-7", got.Resource.Revision)
		require.Equal(t, identity.StampedCandidate, got.Resource.Lifecycle)
		require.Equal(t, "release-7", got.ResolvedResource.Revision)
	}
	_, err := p.Get(context.Background(), "navigation", primitive.GetRequest{URI: b.URI, Revision: "release-8"})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
}
