package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var ErrReportReferenceInvalid = errors.New("report specification contains undeclared references")

// ReferenceValidationError contains only bounded, public authoring diagnostics.
// It never includes request values, dataset rows or operational causes.
type ReferenceValidationError struct{ diagnostics []Diagnostic }

func (e *ReferenceValidationError) Error() string { return ErrReportReferenceInvalid.Error() }
func (e *ReferenceValidationError) Unwrap() error { return ErrReportReferenceInvalid }
func (e *ReferenceValidationError) ReportReferenceDiagnostics() []Diagnostic {
	return append([]Diagnostic(nil), e.diagnostics...)
}

var referenceDiagnosticID = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.-]{0,127}$`)

const maxReferenceDiagnostics = 64

func diagnosticReferenceID(value string) string {
	if referenceDiagnosticID.MatchString(value) {
		return strconv.Quote(value)
	}
	return "<invalid identifier>"
}
func diagnosticAvailableIDs(ids []string) string {
	values := make([]string, 0, 16)
	seen := map[string]bool{}
	size := 0
	for _, id := range ids {
		if !referenceDiagnosticID.MatchString(id) || seen[id] {
			continue
		}
		seen[id] = true
		next := strconv.Quote(id)
		if len(values) >= 16 || size+len(next) > 512 {
			values = append(values, "...")
			break
		}
		values = append(values, next)
		size += len(next) + 2
	}
	if len(values) == 0 {
		return "none"
	}
	return strings.Join(values, ", ")
}

// ValidateReportReferences checks only explicit links in a canonical spec.
// scope.params declares parameter IDs; values may be absent until invocation.
// Thin legacy declarations remain valid, and unified filter bars without
// explicit paramIds require no invented parameters. Diagnostics are capped at64.
func ValidateReportReferences(ctx context.Context, document json.RawMessage) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	var spec struct {
		Datasets []struct {
			ID string `json:"id"`
		} `json:"datasets"`
		Scope *struct {
			Params []struct {
				ID string `json:"id"`
			} `json:"params"`
		} `json:"scope"`
		Blocks []struct {
			ID         string   `json:"id"`
			Kind       string   `json:"kind"`
			DatasetRef string   `json:"datasetRef"`
			ParamIDs   []string `json:"paramIds"`
		} `json:"blocks"`
	}
	if err := json.Unmarshal(document, &spec); err != nil {
		return err
	}
	datasetIDs, paramIDs := []string{}, []string{}
	datasets, params := map[string]bool{}, map[string]bool{}
	for _, dataset := range spec.Datasets {
		if dataset.ID == "" {
			continue
		}
		datasets[dataset.ID] = true
		datasetIDs = append(datasetIDs, dataset.ID)
	}
	if spec.Scope != nil {
		for _, param := range spec.Scope.Params {
			if param.ID == "" {
				continue
			}
			params[param.ID] = true
			paramIDs = append(paramIDs, param.ID)
		}
	}
	diagnostics := []Diagnostic{}
	add := func(d Diagnostic) {
		if len(diagnostics) < maxReferenceDiagnostics {
			diagnostics = append(diagnostics, d)
		}
	}
	for i, block := range spec.Blocks {
		if err := ctx.Err(); err != nil {
			return err
		}
		if block.DatasetRef != "" && !datasets[block.DatasetRef] {
			add(Diagnostic{Code: "missing_report_dataset", Severity: "error", Path: fmt.Sprintf("reportSpec.blocks[%d].datasetRef", i), Message: fmt.Sprintf("Block %s references undeclared dataset %s. Available dataset IDs: %s.", diagnosticReferenceID(block.ID), diagnosticReferenceID(block.DatasetRef), diagnosticAvailableIDs(datasetIDs)), SuggestedFix: "Use the intended declared dataset ID for datasetRef; a datasource ID is not a dataset ID."})
		}
		if block.Kind == "filterBarBlock" {
			for j, id := range block.ParamIDs {
				if !params[id] {
					add(Diagnostic{Code: "missing_report_parameter", Severity: "error", Path: fmt.Sprintf("reportSpec.blocks[%d].paramIds[%d]", i, j), Message: fmt.Sprintf("Filter block %s references undeclared scope parameter %s. Available scope parameter IDs: %s.", diagnosticReferenceID(block.ID), diagnosticReferenceID(id), diagnosticAvailableIDs(paramIDs)), SuggestedFix: "Declare the intended parameter through the authored builder or use an existing scope.params ID. Invocation values do not declare parameters."})
				}
			}
		}
		if len(diagnostics) >= maxReferenceDiagnostics {
			break
		}
	}
	if len(diagnostics) > 0 {
		return &ReferenceValidationError{diagnostics: diagnostics}
	}
	return nil
}
