package resource

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	mcpclient "github.com/viant/mcp/client"
	authcfg "github.com/viant/mcp/client/auth/config"
)

func TestGatewayCatalogCategorySkipsOnlyTypedUnlinkedConnector(t *testing.T) {
	for _, tc := range []struct {
		name    string
		failure error
		skip    bool
	}{
		{"unlinked", &authcfg.OAuthLinkRequiredError{ServerName: "optional", ProviderRef: "optional-oauth", Resource: "https://optional.example/mcp"}, true},
		{"offline", errors.New("offline fixture"), false},
		{"denied", identity.ErrResourceDenied, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			available := provider("available-owner")
			options := fixtureOptions{"optional": {PrimitiveProviderIdentity: "optional-owner"}, "available": {PrimitiveProviderIdentity: "available-owner"}}
			mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
				if name == "optional" {
					return nil, tc.failure
				}
				return available, nil
			}))
			require.NoError(t, err)
			defer mgr.CloseConversation("")
			actor := identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
			g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "aggregate")
			defer g.Close()
			page, err := ListPage[json.RawMessage](context.Background(), g, "window", CatalogQuery{Namespace: "example", Limit: 10})
			if !tc.skip {
				require.ErrorIs(t, err, tc.failure)
				return
			}
			require.NoError(t, err)
			require.Len(t, page.Items, 1)
			require.Equal(t, "available-owner", page.Items[0].Connection.ProviderIdentity)
			// A warm cached category remains usable; selecting the unavailable owner
			// independently still returns the original link-required outcome.
			page, err = ListPage[json.RawMessage](context.Background(), g, "window", CatalogQuery{Namespace: "example", Limit: 10})
			require.NoError(t, err)
			require.Len(t, page.Items, 1)
			_, err = g.Get(context.Background(), Connection{Name: "optional", ProviderIdentity: "optional-owner"}, identity.ResourceRef{URI: "window://example/sales"}, nil)
			_, required := manager.LinkRequired(err)
			require.True(t, required)
		})
	}
}

func TestGatewayCategoryNewlyLinkedConnectorChangesSnapshotAndCursor(t *testing.T) {
	item := func() *dependencyResource {
		return &dependencyResource{raw: json.RawMessage(`{"view":{"content":{"id":"original"}}}`), formatVersion: 2, revision: identity.WorkingCandidate, authorityBinding: "owner", validUntil: time.Now().Add(time.Minute)}
	}
	available := &dependencyMCPProvider{owner: "available-owner", items: map[string]*dependencyResource{"window://example/alpha": item(), "window://example/beta": item()}}
	optional := &dependencyMCPProvider{owner: "optional-owner", items: map[string]*dependencyResource{"window://example/later": item()}}
	linked := false
	options := fixtureOptions{"available": {PrimitiveProviderIdentity: "available-owner"}, "optional": {PrimitiveProviderIdentity: "optional-owner"}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
		if name == "optional" {
			if !linked {
				return nil, &authcfg.OAuthLinkRequiredError{ServerName: name, ProviderRef: "optional-oauth", Resource: "https://optional.example/mcp"}
			}
			return optional, nil
		}
		return available, nil
	}))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	actor := identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "aggregate")
	defer g.Close()
	first, err := ListPage[json.RawMessage](context.Background(), g, "window", CatalogQuery{Namespace: "example", Limit: 1})
	require.NoError(t, err)
	require.Equal(t, 2, first.Total)
	require.NotEmpty(t, first.NextCursor)
	linked = true
	current, err := ListPage[json.RawMessage](context.Background(), g, "window", CatalogQuery{Namespace: "example", Limit: 10})
	require.NoError(t, err)
	require.Equal(t, 3, current.Total)
	found := false
	for _, entry := range current.Items {
		if entry.Connection.ProviderIdentity == "optional-owner" {
			found = true
		}
	}
	require.True(t, found, "newly linked resource was not permanently excluded by cached category")
	_, err = ListPage[json.RawMessage](context.Background(), g, "window", CatalogQuery{Namespace: "example", Limit: 1, Cursor: first.NextCursor})
	require.ErrorIs(t, err, primitive.ErrCatalogCursor)
}
