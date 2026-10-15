// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package catalog

import (
	"context"
	"encoding/json"
	"github.com/viant/forge/backend/reporting/registry"
	"os"
	"path/filepath"
	"strings"
	"testing"

	identity "github.com/viant/forge/backend/resource"
)

func TestAuthoredReportsMaterializeOneWorkingCandidateWithDependencyDrift(t *testing.T) {
	root := t.TempDir()
	writeAsset(t, root, "extension/forge/reporting/builder.yaml", "kind: forge.reporting.builder\nid: metrics\nreportBuilder:\n  document: {title: Default, subtitle: Preserved}\n")
	writeAsset(t, root, "extension/forge/reporting/report.yaml", "kind: forge.reporting.report\nid: delivery\nnamespace: analytics\nname: delivery\nresourceUri: report://analytics/delivery\nbuilderRef: metrics\nlabel: Delivery\ndocumentPatch: {title: Delivery, blocks: [{id: intro, kind: markdownBlock, markdown: Hello}]}\nstatePatch: {selectedMeasures: [spend]}\n")
	backend := json.RawMessage(`{"backend":{"kind":"mcp_tool","service":"metrics","method":"QueryV1"}}`)
	source, err := NewReportResourceSource(ReportResourceOptions{Options: registry.Options{WorkspaceRoot: root}, DataSources: func(context.Context, *registry.Asset) (map[string]json.RawMessage, error) {
		return map[string]json.RawMessage{"rows": backend}, nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	inventory, err := source.List(context.Background())
	if err != nil || len(inventory) != 1 || inventory[0].URI != "report://analytics/delivery" {
		t.Fatalf("inventory=%+v %v", inventory, err)
	}
	uri, _ := identity.ParseResourceURI(inventory[0].URI)
	candidates, err := source.Candidates(context.Background(), uri)
	if err != nil || len(candidates) != 1 || candidates[0].Kind != identity.WorkingCandidate || candidates[0].Revision != "" {
		t.Fatalf("invented YAML history=%+v %v", candidates, err)
	}
	raw, err := source.Materialize(context.Background(), uri.String())
	if err != nil {
		t.Fatal(err)
	}
	var envelope registry.ReportEnvelope
	if json.Unmarshal(raw, &envelope) != nil || envelope.Format != registry.AuthoredReportFormat || len(envelope.Dependencies) != 3 || !strings.Contains(string(envelope.ReportDocument), "Preserved") {
		t.Fatalf("complete materialization=%s", raw)
	}
	backend = json.RawMessage(`{"backend":{"kind":"mcp_tool","service":"metrics","method":"QueryV2"}}`)
	changed, err := source.Candidates(context.Background(), uri)
	if err != nil || changed[0].ContentFingerprint == candidates[0].ContentFingerprint {
		t.Fatal("backend descriptor drift did not change content identity", err)
	}
}
func TestCanonicalReportNamespaceAllowsSameNameAndRejectsSameURI(t *testing.T) {
	root := t.TempDir()
	writeAsset(t, root, "extension/forge/reporting/builder.yaml", "kind: forge.reporting.builder\nid: metrics\nreportBuilder: {}\n")
	for _, namespace := range []string{"alpha", "beta"} {
		writeAsset(t, root, "extension/forge/reporting/"+namespace+".yaml", "kind: forge.reporting.report\nid: delivery\nnamespace: "+namespace+"\nname: delivery\nbuilderRef: metrics\nlabel: Delivery\ndocument: {title: Delivery}\n")
	}
	source, err := NewReportResourceSource(ReportResourceOptions{Options: registry.Options{WorkspaceRoot: root}})
	if err != nil {
		t.Fatal(err)
	}
	items, err := source.List(context.Background())
	if err != nil || len(items) != 2 {
		t.Fatalf("namespace identities collided=%+v %v", items, err)
	}
	writeAsset(t, root, "extension/forge/reporting/duplicate.yaml", "kind: forge.reporting.report\nid: different\nnamespace: alpha\nname: delivery\nbuilderRef: metrics\nlabel: Duplicate\ndocument: {title: Duplicate}\n")
	if _, err := source.List(context.Background()); err == nil {
		t.Fatal("duplicate canonical report identity accepted")
	}
}

func writeAsset(t *testing.T, root, name, body string) {
	t.Helper()
	path := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
}
