package reporting

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	identity "github.com/viant/forge/backend/resource"
	authsvc "github.com/viant/mcp/client/auth/link"
)

func TestOwnedDatasourceUsesSelectedDefinitionAndExistingExecutor(t *testing.T) {
	uri, _ := identity.ParseResourceURI("report://example/summary")
	allowed := true
	expiry := time.Now().Add(time.Minute)
	raw := json.RawMessage(`{"schemaVersion":1,"dataSources":{"options":{"id":"options","backend":{"kind":"mcp_tool","service":"example","method":"options"}}}}`)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "selected-account", ValidUntil: expiry}, nil
	})}
	service := New(Options{ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	calls := 0
	revoke := false
	service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(ctx context.Context, name string, inputs map[string]interface{}) (string, error) {
		calls++
		if name != "example:options" || inputs["scope"] != float64(0) {
			t.Fatalf("wrong declared dispatch: %s", name)
		}
		if revoke {
			allowed = false
		}
		return `{"data":[{"value":0,"label":"Zero"}]}`, nil
	}), service.AuthorizeResourceDataset))
	ctx := authsvc.InjectUser(context.Background(), "example-user")
	owner := identity.ResourceRef{URI: uri.String()}
	result, err := service.FetchResourceDatasource(ctx, owner, "options", map[string]interface{}{"scope": float64(0)})
	if err != nil || result == nil || calls != 1 {
		t.Fatalf("fetch failed: %v calls=%d", err, calls)
	}
	for _, request := range []struct {
		owner identity.ResourceRef
		id    string
	}{{owner, "missing"}, {identity.ResourceRef{URI: owner.URI, Revision: "5"}, "options"}, {identity.ResourceRef{URI: "window://example/summary"}, "options"}} {
		if result, err := service.FetchResourceDatasource(ctx, request.owner, request.id, nil); err == nil || result != nil || calls != 1 {
			t.Fatal("invalid request dispatched")
		}
	}
	revoke = true
	if result, err := service.FetchResourceDatasource(ctx, owner, "options", map[string]interface{}{"scope": float64(0)}); err == nil || result != nil || calls != 2 {
		t.Fatalf("revoked result released: %v", err)
	}
}
