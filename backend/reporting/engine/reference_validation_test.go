package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
)

const referenceSpec = `{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"demo","stateKey":"demo","dataSourceRef":"rows"},"title":"Demo","parameters":{"viewMode":"table","groupBy":"","pageSize":10,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":[]},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"rows","request":{}}],"scope":{"params":[{"id":"advertiser","required":true},{"id":"legacy","value":0}]},"blocks":[]}`

func referenceDocument(t *testing.T, blocks []any) json.RawMessage {
	t.Helper()
	var doc map[string]any
	if err := json.Unmarshal([]byte(referenceSpec), &doc); err != nil {
		t.Fatal(err)
	}
	doc["blocks"] = blocks
	raw, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
func TestReportReferencesCollectEveryExplicitReference(t *testing.T) {
	blocks := []any{}
	for i := 0; i < 11; i++ {
		blocks = append(blocks, map[string]any{"id": fmt.Sprintf("block%d", i), "kind": "tableBlock", "datasetRef": "undeclared"})
	}
	blocks = append(blocks, map[string]any{"id": "filters", "kind": "filterBarBlock", "paramIds": []string{"advertiser", "missing", "alsoMissing"}})
	_, err := NewReportSpecCompiler(nil).Compile(context.Background(), &CompileRequest{Document: referenceDocument(t, blocks)})
	if !errors.Is(err, ErrReportReferenceInvalid) {
		t.Fatalf("expected typed reference error, got %v", err)
	}
	var refs *ReferenceValidationError
	if !errors.As(err, &refs) {
		t.Fatal("typed diagnostics unavailable")
	}
	diagnostics := refs.ReportReferenceDiagnostics()
	if len(diagnostics) != 13 {
		t.Fatalf("got %d diagnostics, want all13", len(diagnostics))
	}
	if diagnostics[10].Path != "reportSpec.blocks[10].datasetRef" || !strings.Contains(diagnostics[10].Message, `"block10"`) {
		t.Fatal(diagnostics[10])
	}
	if diagnostics[11].Path != "reportSpec.blocks[11].paramIds[1]" || !strings.Contains(diagnostics[11].Message, `"advertiser"`) {
		t.Fatal(diagnostics[11])
	}
	diagnostics[0].Code = "mutated"
	if refs.ReportReferenceDiagnostics()[0].Code == "mutated" {
		t.Fatal("diagnostics were aliased")
	}
}
func TestReportReferencesAllowDeclaredParametersWithoutInvocationValues(t *testing.T) {
	for _, blocks := range [][]any{
		{map[string]any{"id": "table", "kind": "tableBlock", "datasetRef": "primary"}},
		{map[string]any{"id": "filters", "kind": "filterBarBlock", "paramIds": []string{"advertiser", "legacy"}}},
		{map[string]any{"id": "unified", "kind": "filterBarBlock", "visibleGroups": []string{"scope"}}},
	} {
		_, err := NewReportSpecCompiler(nil).Compile(context.Background(), &CompileRequest{Document: referenceDocument(t, blocks)})
		if err != nil {
			t.Fatalf("valid legacy/required/unified declarations rejected: %v", err)
		}
	}
}
func TestReportReferencesBoundAndRedactDiagnostics(t *testing.T) {
	blocks := []any{}
	for i := 0; i < 100; i++ {
		blocks = append(blocks, map[string]any{"id": "https://private/token", "kind": "tableBlock", "datasetRef": "/private/customer?secret=token"})
	}
	err := ValidateReportReferences(context.Background(), referenceDocument(t, blocks))
	var refs *ReferenceValidationError
	if !errors.As(err, &refs) {
		t.Fatal(err)
	}
	if len(refs.ReportReferenceDiagnostics()) != 64 {
		t.Fatal("diagnostic bound not applied")
	}
	raw, _ := json.Marshal(refs.ReportReferenceDiagnostics())
	if strings.Contains(string(raw), "private") || strings.Contains(string(raw), "secret") {
		t.Fatalf("private authored identifiers leaked: %s", raw)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := ValidateReportReferences(ctx, referenceDocument(t, nil)); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation lost: %v", err)
	}
}
