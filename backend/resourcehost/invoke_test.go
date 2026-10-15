package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/viant/mcp"
	authtransport "github.com/viant/mcp/client/auth/transport"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

const customAuthoringMethod = "owned.metadata.persist-v2"

type invokeProvider struct {
	*dependencyMCPProvider
	mu                       sync.Mutex
	versions                 map[string]int
	lists                    map[string]int
	actions                  int
	args                     map[string]interface{}
	bearer, idToken          string
	deny                     error
	after                    func()
	blockList                bool
	listEntered, listRelease chan struct{}
}

func (p *invokeProvider) ListTools(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	result, err := p.dependencyMCPProvider.ListTools(ctx, cursor, options...)
	if err == nil {
		result.Tools = append(result.Tools, schema.Tool{Name: customAuthoringMethod, Meta: result.Tools[0].Meta})
	}
	return result, err
}
func (p *invokeProvider) CallTool(ctx context.Context, r *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	user := authctx.EffectiveUserID(ctx)
	p.mu.Lock()
	version := p.versions[user]
	if version == 0 {
		version = 1
	}
	if r.Name == customAuthoringMethod {
		p.actions++
		if !mcpclient.NewRequestOptions(options).NoRetry {
			p.mu.Unlock()
			return nil, errors.New("unexpected retry-enabled action")
		}
		encoded, _ := json.Marshal(r.Arguments)
		decoder := json.NewDecoder(bytes.NewReader(encoded))
		decoder.UseNumber()
		_ = decoder.Decode(&p.args)
		p.bearer, p.idToken = authctx.Bearer(ctx), authctx.IDToken(ctx)
		failure, after := p.deny, p.after
		if failure == nil {
			p.versions[user] = version + 1
		}
		// The transport owns its decoded argument graph, even for a custom client.
		if config, ok := r.Arguments["config"].(map[string]interface{}); ok {
			config["owner"] = "mutated-by-provider"
		}
		p.mu.Unlock()
		if failure != nil {
			return nil, failure
		}
		if after != nil {
			after()
		}
		return &schema.CallToolResult{StructuredContent: map[string]interface{}{"value": "saved"}}, nil
	}
	blocked := r.Name == "windows/list" && user == "alice" && p.blockList
	if r.Name == "windows/list" {
		p.lists[user]++
	}
	if blocked {
		p.blockList = false
	}
	entered, release := p.listEntered, p.listRelease
	p.mu.Unlock()
	if blocked {
		close(entered)
		<-release
	}
	result, err := p.dependencyMCPProvider.CallTool(ctx, r, options...)
	if err != nil {
		return result, err
	}
	switch r.Name {
	case "namespaces/get":
		caps := result.StructuredContent.(primitive.NamespaceCapabilities)
		for i := range caps.Kinds {
			if caps.Kinds[i].Kind == "window" {
				caps.Kinds[i].Operations = append(caps.Kinds[i].Operations, "publish")
				caps.Kinds[i].Methods["publish"] = customAuthoringMethod
			}
		}
		result.StructuredContent = caps
	case "windows/list":
		list := result.StructuredContent.(map[string]interface{})
		rows := list["windows"].([]primitive.ResourceState)
		for i := range rows {
			rows[i].Title = fmt.Sprintf("%s-%d", user, version)
			rows[i].ContentFingerprint = identity.ContentFingerprint(invokeDefinition(user, version))
		}
	case "windows/get":
		got := result.StructuredContent.(primitive.GetResult)
		got.Resource.Definition = invokeDefinition(user, version)
		got.Resource.DefinitionBytes = append([]byte(nil), got.Resource.Definition...)
		got.Resource.ContentFingerprint = identity.ContentFingerprint(got.Resource.Definition)
		got.ResolvedResource.ContentFingerprint = got.Resource.ContentFingerprint
		result.StructuredContent = got
	}
	return result, nil
}
func invokeDefinition(user string, version int) json.RawMessage {
	raw, _ := json.Marshal(map[string]string{"title": fmt.Sprintf("%s-%d", user, version)})
	return raw
}
func (p *invokeProvider) listCount(user string) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.lists[user]
}
func invokeFixture(t *testing.T) (*Gateway, *invokeProvider, context.Context, Connection, identity.ResourceURI) {
	t.Helper()
	item := func() *dependencyResource {
		return &dependencyResource{raw: json.RawMessage(`{"title":"initial"}`), formatVersion: 1, revision: identity.WorkingCandidate, authorityBinding: "original", validUntil: time.Now().Add(time.Minute)}
	}
	p := &invokeProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "managing-owner", items: map[string]*dependencyResource{"window://draft/first": item(), "window://draft/second": item()}}, versions: map[string]int{}, lists: map[string]int{}}
	mgr, err := manager.New(fixtureOptions{"owner": &cfg.MCPClient{PrimitiveProviderIdentity: "managing-owner"}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return p, nil }))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	gateway := NewGateway(mgr, func(ctx context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{Subject: authctx.EffectiveUserID(ctx), Issuer: "issuer", TenantID: "tenant", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, func(context.Context, identity.VerifiedActor) error { return nil }, "consumer")
	t.Cleanup(gateway.Close)
	alice := authctx.WithIDToken(authctx.WithBearer(authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "alice"}), "access-original"), "id-original")
	namespaces, err := gateway.Discover(alice)
	require.NoError(t, err)
	uri, err := identity.ParseResourceURI("window://draft/first")
	require.NoError(t, err)
	return gateway, p, alice, namespaces[0].Connection, uri
}

func TestInvokeUsesAdvertisedCustomActionWithoutChangingInputsOrCredentials(t *testing.T) {
	gateway, p, alice, connection, uri := invokeFixture(t)
	input := map[string]interface{}{"uri": uri.String(), "etag": json.Number("9007199254740993"), "config": map[string]interface{}{"owner": "authored"}}
	original, _ := json.Marshal(input)
	result, err := Invoke[struct {
		Value string `json:"value"`
	}](alice, gateway, connection, uri, "publish", input)
	require.NoError(t, err)
	require.Equal(t, "saved", result.Value)
	after, _ := json.Marshal(input)
	require.Equal(t, original, after, "client-side mutation of owned RPC arguments must not alter the input")
	require.Equal(t, "access-original", p.bearer)
	require.Equal(t, "id-original", p.idToken)
	require.Equal(t, json.Number("9007199254740993"), p.args["etag"])
	require.Equal(t, "authored", p.args["config"].(map[string]interface{})["owner"])
	require.Len(t, p.args, 3, "routing must not inject business authorization arguments")
	require.Equal(t, 1, p.actions)
}

func TestInvokeRejectsUnsupportedOwnerGenerationAndServerDenialWithoutReplay(t *testing.T) {
	for _, kind := range []string{"unsupported", "owner", "generation", "server-denied"} {
		t.Run(kind, func(t *testing.T) {
			gateway, p, alice, connection, uri := invokeFixture(t)
			operation := "publish"
			var expected error
			switch kind {
			case "unsupported":
				operation = "not-advertised"
				expected = ErrUnavailable
			case "owner":
				connection.ProviderIdentity = "unrelated-owner"
				expected = ErrCollision
			case "generation":
				gateway.Invalidate(connection.Name)
				expected = identity.ErrResourceDenied
			case "server-denied":
				p.deny = identity.ErrResourceDenied
				expected = p.deny
			}
			_, err := Invoke[map[string]interface{}](alice, gateway, connection, uri, operation, map[string]interface{}{"uri": uri.String()})
			require.ErrorIs(t, err, expected)
			if kind == "server-denied" {
				require.Equal(t, 1, p.actions, "managing denial must not retry or use another transport")
			}
			if kind != "server-denied" {
				require.Zero(t, p.actions, "invalid owner/capability must fail before dispatch")
			}
		})
	}
}

func TestInvokeInvalidatesOnlySameOwnerKindMetadataAndHydratedCatalogs(t *testing.T) {
	gateway, p, alice, connection, uri := invokeFixture(t)
	bob := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "bob"})
	query := CatalogQuery{Limit: 1}
	aliceMetadata, err := ListPage[map[string]string](alice, gateway, "window", query)
	require.NoError(t, err)
	aliceHydrated, err := ListPage[map[string]string](alice, gateway, "window", query, true)
	require.NoError(t, err)
	require.Equal(t, "alice-1", aliceHydrated.Items[0].Definition["title"])
	bobMetadata, err := ListPage[map[string]string](bob, gateway, "window", query)
	require.NoError(t, err)
	bobHydrated, err := ListPage[map[string]string](bob, gateway, "window", query, true)
	require.NoError(t, err)
	// A prior credential/session variant belongs to the same stable owner.
	variant := requestctx.WithConversationID(authctx.WithBearer(alice, "previous-session-token"), "previous-session")
	variantPage, err := ListPage[map[string]string](variant, gateway, "window", query)
	require.NoError(t, err)
	beforeBob := p.listCount("bob")
	_, err = Invoke[map[string]interface{}](alice, gateway, connection, uri, "publish", map[string]interface{}{"uri": uri.String()})
	require.NoError(t, err)
	for _, check := range []struct {
		ctx      context.Context
		cursor   string
		hydrated bool
	}{{alice, aliceMetadata.NextCursor, false}, {alice, aliceHydrated.NextCursor, true}, {variant, variantPage.NextCursor, false}} {
		_, err = ListPage[map[string]string](check.ctx, gateway, "window", CatalogQuery{Limit: 1, Cursor: check.cursor}, check.hydrated)
		require.ErrorIs(t, err, primitive.ErrCatalogCursor, "all retained variants of the writer's affected list must be invalidated")
	}
	fresh, err := ListPage[map[string]string](alice, gateway, "window", query, true)
	require.NoError(t, err)
	require.Equal(t, "alice-2", fresh.Items[0].Definition["title"])
	for _, check := range []struct {
		cursor   string
		hydrated bool
	}{{bobMetadata.NextCursor, false}, {bobHydrated.NextCursor, true}} {
		page, err := ListPage[map[string]string](bob, gateway, "window", CatalogQuery{Limit: 1, Cursor: check.cursor}, check.hydrated)
		require.NoError(t, err, "another owner's retained cursor must remain usable")
		if check.hydrated {
			require.Equal(t, "bob-1", page.Items[0].Definition["title"])
		}
	}
	require.Equal(t, beforeBob, p.listCount("bob"), "writer invalidation must not rediscover another user's lists")
}

func TestInvokeFailedActionKeepsCurrentCatalogButPostWriteDriftInvalidates(t *testing.T) {
	gateway, p, alice, connection, uri := invokeFixture(t)
	page, err := ListPage[map[string]string](alice, gateway, "window", CatalogQuery{Limit: 1})
	require.NoError(t, err)
	p.deny = identity.ErrResourceDenied
	_, err = Invoke[map[string]interface{}](alice, gateway, connection, uri, "publish", map[string]interface{}{"uri": uri.String()})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	_, err = ListPage[map[string]string](alice, gateway, "window", CatalogQuery{Limit: 1, Cursor: page.NextCursor})
	require.NoError(t, err, "denied writes must not invalidate unaffected metadata")
	p.deny = nil
	p.after = func() { gateway.Invalidate(connection.Name) }
	_, err = Invoke[map[string]interface{}](alice, gateway, connection, uri, "publish", map[string]interface{}{"uri": uri.String()})
	require.ErrorIs(t, err, identity.ErrResourceDenied, "connection generation drift must fence response delivery")
	_, err = ListPage[map[string]string](alice, gateway, "window", CatalogQuery{Limit: 1, Cursor: page.NextCursor})
	require.ErrorIs(t, err, primitive.ErrCatalogCursor, "an applied action must invalidate the original owner even if delivery fails")
}

func TestInvokeFencesInflightSameOwnerListAndPreservesOtherOwnerCursor(t *testing.T) {
	gateway, p, alice, connection, uri := invokeFixture(t)
	bob := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "bob"})
	bobPage, err := ListPage[map[string]string](bob, gateway, "window", CatalogQuery{Limit: 1})
	require.NoError(t, err)
	beforeBob := p.listCount("bob")
	entered, release := make(chan struct{}), make(chan struct{})
	p.mu.Lock()
	p.blockList = true
	p.listEntered, p.listRelease = entered, release
	p.mu.Unlock()
	done := make(chan error, 1)
	go func() {
		_, err := ListPage[map[string]string](alice, gateway, "window", CatalogQuery{Limit: 1})
		done <- err
	}()
	<-entered
	_, err = Invoke[map[string]interface{}](alice, gateway, connection, uri, "publish", map[string]interface{}{"uri": uri.String()})
	require.NoError(t, err)
	close(release)
	require.ErrorIs(t, <-done, primitive.ErrCatalogCursor, "pre-write list population must not be published after the mutation")
	fresh, err := ListPage[map[string]string](alice, gateway, "window", CatalogQuery{Limit: 1}, true)
	require.NoError(t, err)
	require.Equal(t, "alice-2", fresh.Items[0].Definition["title"])
	_, err = ListPage[map[string]string](bob, gateway, "window", CatalogQuery{Limit: 1, Cursor: bobPage.NextCursor})
	require.NoError(t, err)
	require.Equal(t, beforeBob, p.listCount("bob"))
}

func TestInvokeHTTPBindsCurrentCredentialAndPropagatesManagingDenialOnce(t *testing.T) {
	base, p, alice, _, uri := invokeFixture(t)
	var mu sync.Mutex
	expected := "Bearer id-original"
	denied := false
	var actionHeaders []string
	endpoint := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var request struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params struct {
				Name      string                 `json:"name"`
				Arguments map[string]interface{} `json:"arguments"`
			} `json:"params"`
		}
		decoder := json.NewDecoder(r.Body)
		decoder.UseNumber()
		if err := decoder.Decode(&request); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		mu.Lock()
		accepted := r.Header.Get("Authorization") == expected
		action := request.Method == "tools/call" && request.Params.Name == customAuthoringMethod
		blocked := action && denied
		if action {
			actionHeaders = append(actionHeaders, r.Header.Get("Authorization"))
		}
		mu.Unlock()
		if !accepted {
			http.Error(w, "current credential required", 401)
			return
		}
		if blocked {
			http.Error(w, "managing server denied action", 403)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Mcp-Session-Id", "invoke-test-session")
		var result any
		switch request.Method {
		case "initialize":
			result = map[string]interface{}{"protocolVersion": "2025-11-25", "capabilities": map[string]interface{}{"tools": map[string]interface{}{}}, "serverInfo": map[string]interface{}{"name": "authoring", "version": "1"}}
		case "tools/list":
			tools, err := p.ListTools(r.Context(), nil)
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			result = tools
		case "tools/call":
			ctx := authctx.WithUserInfo(r.Context(), &authctx.UserInfo{Subject: "alice"})
			called, err := p.CallTool(ctx, &schema.CallToolRequestParams{Name: request.Params.Name, Arguments: request.Params.Arguments}, mcpclient.WithNoRetry())
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			result = called
		default:
			w.WriteHeader(202)
			return
		}
		if err := json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": request.ID, "result": result}); err != nil {
			t.Error(err)
		}
	}))
	defer endpoint.Close()
	roundTripper, err := authtransport.New(authtransport.WithTransport(http.DefaultTransport))
	require.NoError(t, err)
	bff := true
	options := fixtureOptions{"http-owner": &cfg.MCPClient{PrimitiveProviderIdentity: "managing-owner", ClientOptions: &mcp.ClientOptions{ProtocolVersion: "2025-11-25", Auth: &mcp.ClientAuth{UseIdToken: true, BackendForFrontend: &bff}, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: endpoint.URL}}}}}
	mgr, err := manager.New(options, manager.WithAuthRoundTripper(roundTripper))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	gateway := NewGateway(mgr, base.Actor, base.Verify, "consumer")
	defer gateway.Close()
	namespaces, err := gateway.Discover(alice)
	require.NoError(t, err)
	input := map[string]interface{}{"uri": uri.String(), "config": map[string]interface{}{"owner": "authored"}}
	original, _ := json.Marshal(input)
	_, err = Invoke[map[string]interface{}](alice, gateway, namespaces[0].Connection, uri, "publish", input)
	require.NoError(t, err)
	mu.Lock()
	expected = "Bearer id-current"
	mu.Unlock()
	current := authctx.WithIDToken(alice, "id-current")
	_, err = Invoke[map[string]interface{}](current, gateway, namespaces[0].Connection, uri, "publish", input)
	require.NoError(t, err, "a retained connection must bind the current request credential")
	mu.Lock()
	denied = true
	mu.Unlock()
	_, err = Invoke[map[string]interface{}](current, gateway, namespaces[0].Connection, uri, "publish", input)
	require.Error(t, err)
	after, _ := json.Marshal(input)
	require.Equal(t, original, after)
	require.Equal(t, "authored", p.args["config"].(map[string]interface{})["owner"])
	mu.Lock()
	defer mu.Unlock()
	require.Equal(t, []string{"Bearer id-original", "Bearer id-current", "Bearer id-current"}, actionHeaders, "HTTP managing denial must not replay or fall back")
}
