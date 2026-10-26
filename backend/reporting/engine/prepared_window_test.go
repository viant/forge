package reporting

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestPreparedWindowBuilderUsesHeldSourceWithoutCatalog(t *testing.T) {
	raw := json.RawMessage(`{"kind":"producer-validated-window"}`)
	pin := identity.ResolvedResource{URI: "window://example/report"}
	pin.ContentFingerprint = identity.ContentFingerprint(raw)
	prepared, err := PrepareWindowBuilderRuntime(context.Background(), pin, raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	original := string(raw)
	raw[0] = '!'
	fixture, err := os.ReadFile("testdata/authored_report.json")
	if err != nil {
		t.Fatal(err)
	}
	var envelope registry.ReportEnvelope
	if err = json.Unmarshal(fixture, &envelope); err != nil {
		t.Fatal(err)
	}
	for i := range envelope.Dependencies {
		if envelope.Dependencies[i].Kind == "report" {
			envelope.Dependencies[i].Kind = "window"
			envelope.Dependencies[i].ID = pin.URI
			envelope.Dependencies[i].ContentFingerprint = pin.ContentFingerprint
		}
	}
	// There is deliberately no ResourceResolver, policy provider or reader.
	service := New(Options{})
	calls := 0
	service.SetResourceDatasetExecutor(func(_ context.Context, current identity.ResolvedResource, _ *dsproto.DataSource, _ map[string]interface{}) (*dsproto.FetchResult, error) {
		calls++
		if current.URI != pin.URI {
			t.Fatal("lost source window")
		}
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"category": "Sample", "day": "2026-10-07", "amount": 10, "count": 5}}}, nil
	})
	derive := func(_ context.Context, current identity.ResolvedResource, source json.RawMessage) (registry.ReportEnvelope, error) {
		if current.URI != pin.URI || string(source) != original {
			t.Fatal("prepared window changed")
		}
		return envelope, nil
	}
	result, err := service.ExecutePreparedWindowBuilder(context.Background(), prepared, &ExecuteResourceRequest{FillOnly: true}, derive)
	if err != nil || result == nil || len(result.ReportFill) == 0 || calls == 0 {
		t.Fatalf("prepared window execution failed: %v", err)
	}
	if string(prepared.raw) != original {
		t.Fatal("prepared source mutated")
	}
}
