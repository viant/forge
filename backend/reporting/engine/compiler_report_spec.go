package reporting

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// ReportSpecCompiler is the first backend compile implementation. It accepts
// already-canonical ReportSpec payloads and validates the top-level contract
// before returning them to the runtime. It does not lower raw authoring
// artifacts yet.
type ReportSpecCompiler struct {
	now func() time.Time
}

// NewReportSpecCompiler constructs a compiler for canonical ReportSpec inputs.
func NewReportSpecCompiler(now func() time.Time) *ReportSpecCompiler {
	if now == nil {
		now = time.Now
	}
	return &ReportSpecCompiler{now: now}
}

// Compile validates and returns a canonical ReportSpec payload.
func (c *ReportSpecCompiler) Compile(_ context.Context, request *CompileRequest) (*CompileResult, error) {
	if request == nil {
		return nil, fmt.Errorf("invalid reporting compile request: request is required")
	}
	sourceKind := strings.TrimSpace(request.SourceKind)
	if sourceKind != "" && sourceKind != SourceKindReportSpec {
		return nil, fmt.Errorf("invalid reporting compile source kind %q: only %s is supported", sourceKind, SourceKindReportSpec)
	}
	if len(request.Document) == 0 {
		return nil, fmt.Errorf("invalid reporting compile request: document is required")
	}

	var root map[string]json.RawMessage
	if err := json.Unmarshal(request.Document, &root); err != nil {
		return nil, fmt.Errorf("invalid reporting compile document: %w", err)
	}
	if err := validateReportSpecRoot(root); err != nil {
		return nil, err
	}
	expandedDocument, err := expandReportSpecTimeSemantics(request.Document, c.now())
	if err != nil {
		return nil, fmt.Errorf("expand reportSpec time semantics: %w", err)
	}
	return &CompileResult{
		ArtifactRef: strings.TrimSpace(request.ArtifactRef),
		ReportSpec:  cloneJSON(expandedDocument),
		CompiledAt:  c.now().UTC(),
	}, nil
}

func validateReportSpecRoot(root map[string]json.RawMessage) error {
	if err := requireCanonicalFields(root, "reportSpec", []string{
		"version",
		"kind",
		"source",
		"title",
		"parameters",
		"layoutIntent",
		"refinements",
		"calculatedFields",
		"datasets",
		"blocks",
	}); err != nil {
		return err
	}
	var kind string
	if err := requireJSONStringForKind(root["kind"], "reportSpec", "kind", false, &kind); err != nil {
		return err
	}
	if strings.TrimSpace(kind) != "reportSpec" {
		return fmt.Errorf("invalid reportSpec: kind must be reportSpec")
	}
	if _, err := requireIntegerAtLeast(root["version"], "reportSpec", "version", 1); err != nil {
		return err
	}
	if err := validateCanonicalSource(root["source"], "reportSpec"); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["title"], "reportSpec", "title", false, new(string)); err != nil {
		return err
	}
	if err := validateCanonicalParameters(root["parameters"], "reportSpec"); err != nil {
		return err
	}
	if err := validateCanonicalLayoutIntent(root["layoutIntent"], "reportSpec"); err != nil {
		return err
	}
	if err := requireJSONArrayForKind(root["refinements"], "reportSpec", "refinements", true); err != nil {
		return err
	}
	if err := requireJSONArrayForKind(root["calculatedFields"], "reportSpec", "calculatedFields", true); err != nil {
		return err
	}
	var datasets []json.RawMessage
	if err := requireJSONArrayForKind(root["datasets"], "reportSpec", "datasets", false, &datasets); err != nil {
		return err
	}
	var blocks []json.RawMessage
	if err := requireJSONArrayForKind(root["blocks"], "reportSpec", "blocks", false, &blocks); err != nil {
		return err
	}
	return nil
}
