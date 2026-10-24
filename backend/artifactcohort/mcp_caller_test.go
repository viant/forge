package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

type textToolClient struct {
	result *schema.CallToolResult
	name   string
	args   map[string]any
}

func (c *textToolClient) CallTool(_ context.Context, in *schema.CallToolRequestParams, _ ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	c.name, c.args = in.Name, in.Arguments
	return c.result, nil
}

func TestMCPCallerPreservesExactPublishedPayload(t *testing.T) {
	p := NewPublisher()
	a, generation, err := p.Publish(context.Background(), RootRef{URI: "window://studio/precision", Kind: "window", Version: 1}, json.RawMessage(` { "html":"<tag>", "id":9007199254740993 } `), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{{URI: a.Root.URI, Kind: a.Root.Kind}}
	manifest, err := p.ReplaceCatalog(context.Background(), policies, cohorts, generation)
	if err != nil {
		t.Fatal(err)
	}
	manifestWire, _ := json.Marshal(manifest)
	tool := &textToolClient{result: &schema.CallToolResult{Content: []schema.CallToolResultContentElem{map[string]any{"type": "text", "text": string(manifestWire)}}}}
	caller := MCPCaller{Client: tool}
	gotManifest, err := caller.Discover(context.Background())
	if err != nil || gotManifest.Hash != manifest.Hash || tool.name != MethodDiscover {
		t.Fatalf("discover: %v %s", err, tool.name)
	}
	artifactWire, _ := json.Marshal(a)
	tool.result = &schema.CallToolResult{StructuredContent: map[string]any{"payload": map[string]any{"id": float64(9007199254740992)}}, Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: string(artifactWire)}}}
	got, err := caller.Fetch(context.Background(), FetchInput{Tenant: "tenant", Root: a.Root})
	if err != nil || got.Root.Hash != a.Root.Hash || string(got.Payload) != string(a.Payload) || tool.name != MethodFetch {
		t.Fatalf("fetch: %v %+v", err, got)
	}
	if tool.args["tenant"] != "tenant" {
		t.Fatalf("missing tenant: %+v", tool.args)
	}
}

func TestMCPCallerRejectsAmbiguousOrMapOnlyResults(t *testing.T) {
	tool := &textToolClient{}
	caller := MCPCaller{Client: tool}
	for _, content := range [][]schema.CallToolResultContentElem{
		nil,
		{map[string]any{"type": "text", "text": "{}"}, map[string]any{"type": "text", "text": "{}"}},
		{map[string]any{"type": "image", "text": "{}"}},
	} {
		tool.result = &schema.CallToolResult{Content: content, StructuredContent: map[string]any{"payload": "untrusted"}}
		if _, err := caller.Fetch(context.Background(), FetchInput{Tenant: "tenant", Root: RootRef{URI: "window://studio/x"}}); !errors.Is(err, ErrInvalid) {
			t.Fatalf("accepted ambiguous result: %v", err)
		}
	}
}

func TestMCPCallerConditionalDiscoverRequiresMatchingHash(t *testing.T) {
	tool := &textToolClient{result: &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: `{"unchanged":true,"hash":"current"}`}}}}
	caller := MCPCaller{Client: tool}
	got, err := caller.DiscoverKnown(context.Background(), "current")
	if err != nil || !got.Unchanged || tool.args["knownHash"] != "current" {
		t.Fatalf("compact discovery: %+v %v %+v", got, err, tool.args)
	}
	if _, err = caller.DiscoverKnown(context.Background(), "stale"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("mismatched compact response accepted: %v", err)
	}
	if _, err = caller.Discover(context.Background()); !errors.Is(err, ErrInvalid) {
		t.Fatalf("unconditional compact response accepted: %v", err)
	}
}
