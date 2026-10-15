// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider_test

import (
	"context"
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type actorKey struct{}
type policy struct{ actor identity.VerifiedActor }

func (p policy) SelectRevision(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	if len(c) != 1 {
		return identity.ResourceDecision{}, identity.ErrResourceDenied
	}
	return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "standalone-host-authority", ValidUntil: p.actor.ValidUntil}, nil
}
func TestStandaloneProtectedHTTPMCPMenus(t *testing.T) {
	var revoked, expired atomic.Bool
	uri, _ := identity.ParseResourceURI("navigation://tenant/navigation")
	source := &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) {
		return json.RawMessage(`{"schemaVersion":1,"applications":[{"id":"workspace","title":"Workspace","menus":[{"id":"allowed","action":{"type":"window","windowKey":"advertiserList","parameters":{"page":1}}},{"id":"nested","menus":[{"id":"denied","action":{"type":"window","windowKey":"deniedTarget"}}]}]}]}`), nil
	}}
	p, err := producer.NewLocalProvider(producer.LocalConfig{ProviderIdentity: "standalone", Actor: func(ctx context.Context) (identity.VerifiedActor, error) {
		a, ok := ctx.Value(actorKey{}).(identity.VerifiedActor)
		if !ok {
			return a, identity.ErrResourceDenied
		}
		return a, nil
	}, Verify: func(context.Context, identity.VerifiedActor) error {
		if revoked.Load() {
			return identity.ErrResourceDenied
		}
		return nil
	}, Authorize: func(_ context.Context, _ identity.VerifiedActor, u identity.ResourceURI, _ string) error {
		if u.Namespace != "tenant" {
			return identity.ErrResourceDenied
		}
		return nil
	}, Bindings: []producer.LocalResourceBinding{{URI: uri.String(), Title: "Workspace", FormatVersion: 1, Resolver: func(_ context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: "standalone", Source: source, Policy: policy{actor: a}}, nil
	}}}, Validators: map[string]producer.LocalResourceValidator{"navigation": producer.ValidateMenu}, MenuActionVisibility: func(_ context.Context, _ identity.VerifiedActor, _ identity.ResourceURI, raw json.RawMessage) (bool, error) {
		return !strings.Contains(string(raw), "deniedTarget"), nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	h, err := producer.NewMCPHandler(p, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			expiry := time.Now().Add(time.Minute)
			if expired.Load() {
				expiry = time.Now().Add(-time.Second)
			}
			a := identity.VerifiedActor{Subject: "reader", Issuer: "standalone-idp", TenantID: "tenant", AccountID: "account", IdentityRevision: "r1", ValidUntil: expiry}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), actorKey{}, a)))
		})
	})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(h)
	defer server.Close()
	c, err := mcp.NewClient(nil, &mcp.ClientOptions{Name: "standalone-test", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}})
	if err != nil {
		t.Fatal(err)
	}
	initialized, err := c.Initialize(context.Background())
	if err != nil || initialized.Capabilities.Resources == nil {
		t.Fatalf("standard resources capability unavailable: %v", err)
	}
	listed, err := c.ListResources(context.Background(), nil)
	if err != nil || len(listed.Resources) != 1 || listed.Resources[0].Uri != uri.String() {
		t.Fatalf("standard resources/list failed: %+v %v", listed, err)
	}
	read, err := c.ReadResource(context.Background(), &schema.ReadResourceRequestParams{Uri: uri.String()})
	if err != nil || len(read.Contents) != 1 || !strings.Contains(read.Contents[0].Text, "advertiserList") || strings.Contains(read.Contents[0].Text, "deniedTarget") {
		t.Fatalf("standard resources/read leaked or failed: %+v %v", read, err)
	}
	tools, err := c.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	for _, tool := range tools.Tools {
		names[tool.Name] = true
	}
	for _, name := range []string{"navigations/list", "navigations/get", "namespaces/list", "namespaces/get"} {
		if !names[name] {
			t.Fatalf("missing ordinary tool %s", name)
		}
	}
	if names["windows/get"] {
		t.Fatal("unsupported window capability advertised")
	}
	call := func(name string, args map[string]interface{}) *schema.CallToolResult {
		t.Helper()
		r, e := c.CallTool(context.Background(), &schema.CallToolRequestParams{Name: name, Arguments: args}, mcpclient.WithNoRetry())
		if e != nil {
			t.Fatal(e)
		}
		return r
	}
	for _, item := range []struct {
		name string
		args map[string]interface{}
	}{{"namespaces/get", map[string]interface{}{"namespace": "tenant"}}, {"navigations/list", map[string]interface{}{"namespace": "tenant"}}, {"navigations/get", map[string]interface{}{"uri": uri.String()}}} {
		r := call(item.name, item.args)
		if r.IsError != nil && *r.IsError {
			t.Fatalf("unexpected denial %s", item.name)
		}
		wire, e := json.Marshal(r)
		if e != nil {
			t.Fatal(e)
		}
		if strings.Contains(string(wire), "deniedTarget") {
			t.Fatal("denied target leaked")
		}
	}
	r := call("navigations/get", map[string]interface{}{"uri": uri.String()})
	wire, _ := json.Marshal(r.StructuredContent)
	var result struct {
		Resource struct {
			Definition      json.RawMessage
			DefinitionBytes []byte
		}
		MenuProjection struct {
			DefinitionBytes    []byte
			ContentFingerprint string
		}
	}
	if err = json.Unmarshal(wire, &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Resource.Definition) > 0 || len(result.Resource.DefinitionBytes) > 0 {
		t.Fatal("source bytes exposed")
	}
	if !strings.Contains(string(result.MenuProjection.DefinitionBytes), "advertiserList") || strings.Contains(string(result.MenuProjection.DefinitionBytes), "deniedTarget") {
		t.Fatal("invalid visible projection")
	}
	if identity.ContentFingerprint(result.MenuProjection.DefinitionBytes) != result.MenuProjection.ContentFingerprint {
		t.Fatal("invalid projection hash")
	}
	revoked.Store(true)
	if _, err = c.ReadResource(context.Background(), &schema.ReadResourceRequestParams{Uri: uri.String()}, mcpclient.WithNoRetry()); err == nil {
		t.Fatal("revoked standard resource read succeeded")
	}
	r = call("navigations/get", map[string]interface{}{"uri": uri.String()})
	if r.IsError == nil || !*r.IsError {
		t.Fatal("revoked actor released menu")
	}
	revoked.Store(false)
	expired.Store(true)
	r = call("navigations/get", map[string]interface{}{"uri": uri.String()})
	if r.IsError == nil || !*r.IsError {
		t.Fatal("expired actor released menu")
	}
}

func TestNamespaceDescriptionsAreExplicitOptionalConfiguration(t *testing.T) {
	actor := identity.VerifiedActor{Subject: "reader", Issuer: "issuer", TenantID: "tenant", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	config := producer.LocalConfig{ProviderIdentity: "local", Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: []producer.LocalResourceBinding{{URI: "intent://tenant/review", FormatVersion: 1, Resolver: func(context.Context, identity.VerifiedActor, string) (*identity.ResourceResolver, error) {
		t.Fatal("namespace filtering must not resolve definitions")
		return nil, nil
	}}}, Validators: map[string]producer.LocalResourceValidator{"intent": func(int64, json.RawMessage) error { return nil }}}
	plain, err := producer.NewLocalProvider(config)
	if err != nil {
		t.Fatal(err)
	}
	old, err := plain.NamespaceList(context.Background(), primitive.NamespaceListRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if old.Namespaces[0].Description != "" || len(old.Namespaces[0].UseCases) != 0 {
		t.Fatal("namespace descriptions invented")
	}
	config.NamespaceMetadata = map[string]primitive.NamespaceMetadata{"tenant": {Description: "Published review intents", UseCases: []string{"Review selected records"}}}
	described, err := producer.NewLocalProvider(config)
	if err != nil {
		t.Fatal(err)
	}
	result, err := described.NamespaceList(context.Background(), primitive.NamespaceListRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if result.Namespaces[0].Description != "Published review intents" || len(result.Namespaces[0].UseCases) != 1 {
		t.Fatal(result)
	}
	if len(result.Namespaces[0].SupportedKinds) != 1 || len(result.Namespaces[0].SupportedKinds[0].Operations) != 2 {
		t.Fatal("explicit namespace overview did not preserve declared operations")
	}
	if len(result.Namespaces[0].Kinds) != 1 || result.Namespaces[0].Kinds[0] != "intent" {
		t.Fatal("configured descriptions altered capabilities")
	}
}
