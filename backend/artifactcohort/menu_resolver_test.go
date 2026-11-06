package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

type menuOriginCaller struct {
	*fakeCaller
	calls   int
	rows    string
	failure error
	seenRef RootRef
}

type menuResponseClient struct {
	result *schema.CallToolResult
	err    error
}

func (c menuResponseClient) CallTool(context.Context, *schema.CallToolRequestParams, ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	return c.result, c.err
}

func TestMenuOriginTransportPreservesFailureClassification(t *testing.T) {
	ref := RootRef{URI: "navigation://example/path/main", Kind: "navigation", Version: 7, Hash: Hash([]byte("source"))}
	failed, succeeded := true, false
	textResult := func(raw string) *schema.CallToolResult {
		return &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: raw}}}
	}
	unavailable := errors.New("synthetic connection unavailable")
	projection := json.RawMessage(`{"schemaVersion":1,"applications":[]}`)
	badHash, err := json.Marshal(&primitive.GetResult{Resource: &primitive.ResourceState{URI: ref.URI, Revision: "7", ContentFingerprint: ref.Hash}, MenuProjection: &primitive.MenuProjection{SchemaVersion: 1, DefinitionBytes: projection, ContentFingerprint: "different"}})
	require.NoError(t, err)
	for _, test := range []struct {
		name   string
		client menuResponseClient
		want   error
	}{
		{"producer denial", menuResponseClient{result: &schema.CallToolResult{IsError: &failed, Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: `{"code":"forbidden","status":403,"message":"synthetic secret"}`}}}}, ErrDenied},
		{"opaque producer failure", menuResponseClient{result: &schema.CallToolResult{IsError: &failed}}, ErrDenied},
		{"nil response", menuResponseClient{}, ErrInvalid},
		{"missing content", menuResponseClient{result: &schema.CallToolResult{IsError: &succeeded}}, ErrInvalid},
		{"malformed JSON", menuResponseClient{result: textResult(`{"forbidden":`)}, ErrInvalid},
		{"body is not a denial contract", menuResponseClient{result: textResult(`{"code":"forbidden","status":403}`)}, ErrInvalid},
		{"projection hash mismatch", menuResponseClient{result: textResult(string(badHash))}, ErrInvalid},
		{"network unavailable", menuResponseClient{err: unavailable}, unavailable},
	} {
		t.Run(test.name, func(t *testing.T) {
			result, err := (MCPCaller{Client: test.client}).ResolveMenu(context.Background(), ref, nil)
			require.Nil(t, result)
			require.ErrorIs(t, err, test.want)
			require.NotContains(t, err.Error(), "synthetic secret")
		})
	}
}

func (c *menuOriginCaller) ResolveMenu(ctx context.Context, ref RootRef, parameters map[string]any) (*primitive.GetResult, error) {
	c.calls++
	c.seenRef = ref
	if c.failure != nil {
		return nil, c.failure
	}
	actor, err := fixtureSession(ctx)
	if err != nil {
		return nil, err
	}
	raw, _ := json.Marshal(map[string]any{"schemaVersion": 1, "applications": []any{map[string]any{"id": fmt.Sprint(actor, "/", parameters["scope"], "/", c.rows), "disabled": true}}})
	return &primitive.GetResult{Resource: &primitive.ResourceState{URI: ref.URI, ContentFingerprint: ref.Hash}, MenuProjection: &primitive.MenuProjection{SchemaVersion: 1, DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)}}, nil
}

// All resources and actors are independently authored synthetic fixtures.
func TestSourceBackedMenuAlwaysResolvesAtOriginWithoutCachingRows(t *testing.T) {
	ctx := actorContext("alice", "operator")
	publisher := NewPublisher()
	raw := json.RawMessage(`{"schemaVersion":1,"name":"Origin navigation","source":{"dataSourceRef":{"resource":{"uri":"datasource://example/path/rows"},"providerIdentity":"original"},"contextBindings":{"scope":"scope"},"resultPath":"data.navigation"},"applications":[]}`)
	artifact, _, err := publisher.Publish(ctx, RootRef{URI: "navigation://example/path/main", Kind: "navigation", Version: 7}, raw, allowPublished)
	require.NoError(t, err)
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{artifact.Root}
	_, err = publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
	require.NoError(t, err)
	caller := &menuOriginCaller{fakeCaller: &fakeCaller{publisher: publisher, fetches: map[string]int{}}, rows: "first"}
	replica, err := NewReplica(Config{Enabled: true, Source: "original", Tenant: "tenant", Account: "account", Caller: caller, Facts: &countedFacts{}, SessionKey: fixtureSession})
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	source, err := NewMetadataSource(replica, []string{"example"})
	require.NoError(t, err)
	rows, err := source.List(ctx, "navigation", "example")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	namespaces, err := source.Namespaces(ctx)
	require.NoError(t, err)
	require.Len(t, namespaces[0].Kinds, 1)
	require.Zero(t, caller.calls, "discovery must not query local or origin data")
	for _, input := range []struct{ actor, scope string }{{"alice", "one"}, {"bob", "two"}, {"alice", "two"}} {
		result, err := source.GetMenuWithParameters(actorContext(input.actor, "operator"), artifact.Root.URI, map[string]any{"scope": input.scope})
		require.NoError(t, err)
		require.Contains(t, string(result.MenuProjection.DefinitionBytes), input.actor+"/"+input.scope+"/first")
		require.Equal(t, artifact.Root.Hash, result.Resource.ContentFingerprint)
		require.Equal(t, artifact.Root, caller.seenRef)
		require.Empty(t, result.Resource.DefinitionBytes)
	}
	caller.rows = "refreshed"
	result, err := source.GetMenuWithParameters(ctx, artifact.Root.URI, map[string]any{"scope": "one"})
	require.NoError(t, err)
	require.Contains(t, string(result.MenuProjection.DefinitionBytes), "refreshed")
	require.Equal(t, 4, caller.calls)
	caller.failure = errors.New("origin unavailable")
	_, err = source.GetMenu(ctx, artifact.Root.URI)
	require.ErrorIs(t, err, caller.failure, "origin errors cannot fall back to retained definitions or old rows")
	replica.cfg.Caller = caller.fakeCaller
	_, err = source.GetMenu(ctx, artifact.Root.URI)
	require.ErrorIs(t, err, ErrUnsupported, "an origin without projection support must fail explicitly")
	retained, err := publisher.Get(artifact.Root)
	require.NoError(t, err)
	require.JSONEq(t, string(raw), string(retained.Payload))
}

func TestMenuOriginTransportUsesExactRootAndRejectsMismatchedIdentity(t *testing.T) {
	ref := RootRef{URI: "navigation://example/path/main", Kind: "navigation", Version: 7, Hash: Hash([]byte("source"))}
	raw := []byte(`{"schemaVersion":1,"applications":[]}`)
	value := &primitive.GetResult{Resource: &primitive.ResourceState{URI: ref.URI, Revision: "7", ContentFingerprint: ref.Hash}, MenuProjection: &primitive.MenuProjection{SchemaVersion: 1, DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)}}
	tool := &textToolClient{}
	setResponse := func() {
		wire, err := json.Marshal(value)
		require.NoError(t, err)
		tool.result = &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: string(wire)}}}
	}
	setResponse()
	caller := NamespaceCaller{Client: tool, Namespace: "example"}
	_, err := caller.ResolveMenu(context.Background(), ref, map[string]any{"scope": "actor-context"})
	require.NoError(t, err)
	require.Equal(t, "resources/get", tool.name)
	require.Equal(t, ref.URI, tool.args["uri"])
	require.Equal(t, "7", tool.args["revision"])
	require.Equal(t, map[string]any{"scope": "actor-context"}, tool.args["parameters"])
	require.NotContains(t, tool.args, "source")
	for _, change := range []func(){func() { value.Resource.URI = "navigation://other/path/main" }, func() { value.Resource.URI = ref.URI; value.Resource.ContentFingerprint = "different" }, func() { value.Resource.ContentFingerprint = ref.Hash; value.Resource.Revision = "8" }} {
		change()
		setResponse()
		_, err = caller.ResolveMenu(context.Background(), ref, nil)
		require.ErrorIs(t, err, ErrConflict)
	}
	_, err = (NamespaceCaller{Client: tool, Namespace: "other"}).ResolveMenu(context.Background(), ref, nil)
	require.ErrorIs(t, err, ErrInvalid)
}
