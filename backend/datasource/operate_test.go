package datasource

import (
	"context"
	"encoding/json"
	"errors"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"strings"
	"testing"
)

type operationTestExecutor struct {
	names     []string
	arguments []map[string]interface{}
	failure   error
	payload   string
}

func (e *operationTestExecutor) Execute(_ context.Context, name string, inputs map[string]interface{}) (string, error) {
	e.names = append(e.names, name)
	e.arguments = append(e.arguments, inputs)
	if e.payload != "" {
		return e.payload, e.failure
	}
	return `{"receipt":{"id":"sample"},"ok":true}`, e.failure
}
func operationTestService() (*Service, *operationTestExecutor, *dsproto.DataSource) {
	executor := &operationTestExecutor{}
	definition := &dsproto.DataSource{ID: "sample", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "sample", Method: "read"}, Operations: map[string]*dsproto.Operation{"save": {Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "sample", Method: "write", Pinned: map[string]interface{}{"scope": "trusted"}}}}}
	store := NewMemoryStore()
	store.Put(definition)
	return New(Options{Store: store, Executor: executor}), executor, definition
}
func TestOperateRequiresDeclaredName(t *testing.T) {
	for _, name := range []string{"", "unknown", " save ", "read", "fetch", "execute"} {
		s, e, _ := operationTestService()
		if _, err := s.Operate(context.Background(), "sample", name, nil, FetchOptions{}); !errors.Is(err, identity.ErrResourceDenied) {
			t.Fatalf("name %q: %v", name, err)
		}
		if len(e.names) != 0 {
			t.Fatal("denied operation dispatched")
		}
	}
	s, e, d := operationTestService()
	d.Operations = nil
	if _, err := s.Operate(context.Background(), "sample", "save", nil, FetchOptions{}); !errors.Is(err, identity.ErrResourceDenied) {
		t.Fatal(err)
	}
	if len(e.names) != 0 {
		t.Fatal("missing declarations dispatched")
	}
}
func TestOperateBypassesReadCacheAndPreservesPayload(t *testing.T) {
	s, e, _ := operationTestService()
	ctx := context.Background()
	inputs := map[string]interface{}{"scope": "untrusted", "service": "other", "method": "other"}
	first, err := s.Fetch(ctx, "sample", inputs, FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if first.Cache == nil {
		t.Fatal("expected populated read cache")
	}
	for i := 0; i < 2; i++ {
		result, err := s.Operate(ctx, "sample", "save", inputs, FetchOptions{BypassCache: true})
		if err != nil {
			t.Fatal(err)
		}
		if result.Result.(map[string]interface{})["receipt"].(map[string]interface{})["id"] != "sample" {
			t.Fatal(result)
		}
		if e.names[len(e.names)-1] != "sample:write" || e.arguments[len(e.arguments)-1]["scope"] != "trusted" {
			t.Fatal("caller changed operation binding")
		}
	}
	last, err := s.Fetch(ctx, "sample", inputs, FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if last.Cache == nil || !last.Cache.Hit || len(e.names) != 3 {
		t.Fatalf("cache changed or operation cached: %+v %v", last.Cache, e.names)
	}
}
func TestOperateAdmissionAndWriterErrors(t *testing.T) {
	s, e, _ := operationTestService()
	denied := errors.New("admission denied")
	s.authorizeDefinition = func(context.Context, *dsproto.DataSource, map[string]interface{}) error { return denied }
	if _, err := s.Operate(context.Background(), "sample", "save", nil, FetchOptions{}); !errors.Is(err, denied) {
		t.Fatal(err)
	}
	if len(e.names) != 0 {
		t.Fatal("admission failure dispatched")
	}
	s, e, _ = operationTestService()
	e.failure = &dsproto.UpstreamAuthorizationError{Status: 403}
	if _, err := s.Operate(context.Background(), "sample", "save", nil, FetchOptions{}); err == nil {
		t.Fatal("writer denial became success")
	}
}

func TestOperateDoesNotAccessCacheAndRetainsReleaseAuthorization(t *testing.T) {
	s, e, _ := operationTestService()
	s.cache = nil
	result, err := s.Operate(context.Background(), "sample", "save", nil, FetchOptions{WriteThrough: true})
	if err != nil || result == nil || len(e.names) != 1 {
		t.Fatalf("cache-free action: %v", err)
	}
	checks := 0
	denied := errors.New("grant revoked")
	s.authorizeDefinition = func(context.Context, *dsproto.DataSource, map[string]interface{}) error {
		checks++
		if checks > 1 {
			return denied
		}
		return nil
	}
	result, err = s.Operate(context.Background(), "sample", "save", nil, FetchOptions{})
	if result != nil || !errors.Is(err, denied) || checks != 2 || len(e.names) != 2 {
		t.Fatalf("release check missing: %v checks=%d calls=%d", err, checks, len(e.names))
	}
}

func TestOperatePreservesVirtualExportJobResult(t *testing.T) {
	s, e, ds := operationTestService()
	ds.ID = "sample"
	ds.Operations = map[string]*dsproto.Operation{"export": {Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "sample", Method: "export"}}}
	e.payload = `{"jobId":"synthetic-job","status":"queued"}`
	s.cache = nil
	for i := 0; i < 2; i++ {
		out, err := s.Operate(context.Background(), "sample", "export", map[string]interface{}{"format": "pdf"}, FetchOptions{})
		if err != nil {
			t.Fatal(err)
		}
		payload := out.Result.(map[string]interface{})
		if payload["jobId"] != "synthetic-job" || payload["status"] != "queued" {
			t.Fatalf("job output changed: %+v", out)
		}
		raw, err := json.Marshal(out)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(raw), `"rows"`) || strings.Contains(string(raw), `"cache"`) {
			t.Fatalf("read envelope leaked: %s", raw)
		}
	}
	if len(e.names) != 2 || e.names[0] != "sample:export" {
		t.Fatal("export operation cached or redirected")
	}
}

func TestOperateMultipleNamesUseDistinctDeclaredHandlers(t *testing.T) {
	s, e, ds := operationTestService()
	ds.Operations = map[string]*dsproto.Operation{}
	for _, name := range []string{"create", "update", "delete"} {
		ds.Operations[name] = &dsproto.Operation{Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "sample", Method: "records_" + name, Pinned: map[string]interface{}{"scope": "trusted", "action": name}}}
	}
	ctx := context.Background()
	inputs := map[string]interface{}{"scope": "attacker", "action": "other", "service": "other", "method": "other"}
	read, err := s.Fetch(ctx, "sample", inputs, FetchOptions{})
	if err != nil || read.Cache == nil {
		t.Fatalf("prime read: %v", err)
	}
	for _, name := range []string{"create", "update", "delete"} {
		if _, err := s.Operate(ctx, "sample", name, inputs, FetchOptions{}); err != nil {
			t.Fatal(err)
		}
		last := len(e.names) - 1
		if e.names[last] != "sample:records_"+name || e.arguments[last]["scope"] != "trusted" || e.arguments[last]["action"] != name {
			t.Fatalf("wrong declared handler: %s %+v", e.names[last], e.arguments[last])
		}
	}
	read, err = s.Fetch(ctx, "sample", inputs, FetchOptions{})
	if err != nil || read.Cache == nil || !read.Cache.Hit || len(e.names) != 4 {
		t.Fatal("actions interfered with read cache")
	}
}
