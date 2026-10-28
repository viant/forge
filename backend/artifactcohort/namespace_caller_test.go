package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	"sync"
	"testing"
)

func namespaceToolResult(t *testing.T, value any) *schema.CallToolResult {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: string(raw)}}}
}
func TestNamespaceCallerUsesConditionalIndexWithoutLegacyFallback(t *testing.T) {
	p := fixturePublisher(t, `{"window":"sample"}`)
	manifest, err := p.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	// This synthetic publisher spans two namespaces; one namespace endpoint must
	// reject it instead of importing foreign metadata.
	raw, _ := json.Marshal(manifest)
	tool := &textToolClient{result: namespaceToolResult(t, map[string]any{"sync": primitive.NamespaceSyncResult{Catalog: raw, FetchMethod: MethodFetch}})}
	caller := NamespaceCaller{Client: tool, Namespace: "sales"}
	if _, err = caller.Discover(context.Background()); !errors.Is(err, ErrInvalid) {
		t.Fatalf("foreign namespace accepted: %v", err)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{{URI: "window://sales/main", Kind: "window"}}
	manifest, err = p.ReplaceCatalog(context.Background(), policies, cohorts, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	raw, _ = json.Marshal(manifest)
	tool.result = namespaceToolResult(t, map[string]any{"sync": primitive.NamespaceSyncResult{Catalog: raw, FetchMethod: MethodFetch}})
	got, err := caller.Discover(context.Background())
	if err != nil || got.Hash != manifest.Hash || tool.name != "namespaces/get" {
		t.Fatalf("namespace discovery: %v", err)
	}
	compact, _ := json.Marshal(map[string]any{"unchanged": true, "hash": manifest.Hash})
	tool.result = namespaceToolResult(t, map[string]any{"sync": primitive.NamespaceSyncResult{Catalog: compact, FetchMethod: MethodFetch}})
	got, err = caller.DiscoverKnown(context.Background(), manifest.Hash)
	if err != nil || !got.Unchanged {
		t.Fatalf("conditional index: %v", err)
	}
	request, ok := tool.args["sync"].(primitive.NamespaceSyncRequest)
	if !ok || request.KnownHash != manifest.Hash {
		t.Fatal("known hash not sent")
	}
	tool.result = namespaceToolResult(t, map[string]any{"namespace": "sales"})
	if _, err = caller.Discover(context.Background()); !errors.Is(err, ErrUnsupported) || tool.name != "namespaces/get" {
		t.Fatalf("missing sync must not use legacy discovery: %v", err)
	}
}
func TestCohortSupportsPublishedMCPDefinitions(t *testing.T) {
	p := NewPublisher()
	a, _, err := p.Publish(context.Background(), RootRef{URI: "mcp://example/rows", Kind: "mcp", Version: 1}, json.RawMessage(`{"name":"rows","transport":{"type":"streamable","url":"https://data.example/mcp"}}`), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	partition, err := RootPartition(a.Root)
	if err != nil || partition != "example|mcp" {
		t.Fatalf("MCP partition: %q %v", partition, err)
	}
}

type namespaceReplicaTool struct {
	publisher *Publisher
	mu        sync.Mutex
	calls     map[string]int
}

func (c *namespaceReplicaTool) CallTool(ctx context.Context, in *schema.CallToolRequestParams, _ ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	c.mu.Lock()
	c.calls[in.Name]++
	c.mu.Unlock()
	var value any
	switch in.Name {
	case "namespaces/get":
		manifest, err := c.publisher.Snapshot()
		if err != nil {
			return nil, err
		}
		wire, _ := json.Marshal(in.Arguments["sync"])
		var request primitive.NamespaceSyncRequest
		if json.Unmarshal(wire, &request) != nil {
			return nil, ErrInvalid
		}
		var catalog any = manifest
		if request.KnownHash == manifest.Hash {
			catalog = map[string]any{"unchanged": true, "hash": manifest.Hash}
		}
		raw, _ := json.Marshal(catalog)
		value = map[string]any{"sync": primitive.NamespaceSyncResult{Catalog: raw, FetchMethod: MethodFetch}}
	case MethodFetch:
		raw, _ := json.Marshal(in.Arguments)
		var request FetchInput
		if json.Unmarshal(raw, &request) != nil {
			return nil, ErrInvalid
		}
		artifact, err := c.publisher.Get(request.Root)
		if err != nil {
			return nil, err
		}
		value = artifact
	default:
		return nil, ErrUnsupported
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: string(raw)}}}, nil
}
func (c *namespaceReplicaTool) counts() (int, int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.calls["namespaces/get"], c.calls[MethodFetch]
}

type namespaceMemoryArtifacts struct {
	mu    sync.Mutex
	items map[string]*Artifact
}

func (s *namespaceMemoryArtifacts) Has(_ context.Context, ref RootRef) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	a := s.items[RootKey(ref)]
	return a != nil && a.Root == ref, nil
}
func (s *namespaceMemoryArtifacts) Get(_ context.Context, ref RootRef) (*Artifact, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return CloneArtifact(s.items[RootKey(ref)]), nil
}
func (s *namespaceMemoryArtifacts) Put(_ context.Context, a *Artifact) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[RootKey(a.Root)] = CloneArtifact(a)
	return nil
}
func TestNamespaceStartupMenuReportMCPAndRestartAreLocal(t *testing.T) {
	ctx := actorContext("alice", "operator")
	p := NewPublisher()
	roots := []RootRef{}
	for _, kind := range []string{"navigation", "report", "mcp"} {
		uri := kind + "://example/main"
		a, _, err := p.Publish(ctx, RootRef{URI: uri, Kind: kind, Version: 1}, json.RawMessage(`{"synthetic":true}`), allowPublished)
		if err != nil {
			t.Fatal(err)
		}
		roots = append(roots, a.Root)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = roots
	if _, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	tool := &namespaceReplicaTool{publisher: p, calls: map[string]int{}}
	store := &namespaceMemoryArtifacts{items: map[string]*Artifact{}}
	manifests := &countedManifestStore{}
	facts := &countedFacts{}
	config := Config{Enabled: true, Source: "producer", Tenant: "tenant", Account: "account", Caller: NamespaceCaller{Client: tool, Namespace: "example"}, Facts: facts, SessionKey: fixtureSession, Store: store, ManifestStore: manifests}
	for restart := 0; restart < 2; restart++ {
		replica, err := NewReplica(config)
		if err != nil {
			t.Fatal(err)
		}
		if err = replica.Sync(ctx); err != nil {
			t.Fatal(err)
		}
		discovers, fetches := tool.counts()
		if discovers != restart+1 || fetches != 3 {
			t.Fatalf("restart %d unexpected downloads: %d %d", restart, discovers, fetches)
		}
		if err = replica.EnsureAdmitted(ctx); err != nil {
			t.Fatal(err)
		}
		policyCalls := facts.calls.Load()
		for i := 0; i < 20; i++ {
			for _, ref := range roots {
				if err = replica.EnsureAdmitted(ctx); err != nil {
					t.Fatal(err)
				}
				view, err := replica.Open(ctx, ref.URI)
				if err != nil || view.Ref() != ref {
					t.Fatalf("local open: %v", err)
				}
			}
		}
		if d, f := tool.counts(); d != discovers || f != fetches || facts.calls.Load() != policyCalls {
			t.Fatal("interactive metadata or repeated policy evaluation")
		}
	}
}
