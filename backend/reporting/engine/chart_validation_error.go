package reporting

import (
	"errors"
	"fmt"
	"strings"

	"github.com/viant/forge/backend/reporting/materializer"
)

// ChartValidationError projects the trusted lowerer's source locations into the
// existing compile diagnostic contract, retaining the typed cause for hosts.
type ChartValidationError struct {
	cause       error
	diagnostics []Diagnostic
}

func (*ChartValidationError) Error() string   { return "report chart source validation failed" }
func (e *ChartValidationError) Unwrap() error { return e.cause }
func (e *ChartValidationError) ReportChartDiagnostics() []Diagnostic {
	return append([]Diagnostic(nil), e.diagnostics...)
}

// ChartSourceDiagnostic uses code-owned messages and repair guidance. Only
// already bounded authoring identifiers are included, never exception text.
func ChartSourceDiagnostic(d materializer.ChartValidationDiagnostic) (Diagnostic, bool) {
	if !materializer.ValidChartValidationDiagnostic(d) {
		return Diagnostic{}, false
	}
	field := d.Field
	if strings.HasPrefix(field, "yFields.") {
		field = "yFields[" + strings.TrimPrefix(field, "yFields.") + "]"
	}
	path := "reportDocument.blocks." + d.BlockID + ".chartSpec"
	if field != "chartSpec" {
		path += "." + field
	}
	message := fmt.Sprintf("Chart %q on dataset %q has invalid %s", d.BlockID, d.DatasetRef, d.Field)
	if d.FieldRef != "" {
		message += fmt.Sprintf(" field %q", d.FieldRef)
	}
	message += "."
	repair := "Correct the authored chart specification using fields and chart types supported by its dataset."
	if d.ValidationCode == "missingField" || d.ValidationCode == "unknownMeasure" {
		repair = "Declare the chart fields in this dataset's columnOptions, or explicitly enable capabilities.inheritRuntimeFieldCatalog when this dataset intentionally shares the parent field catalog. Otherwise select fields declared by this dataset."
	} else if d.ValidationCode == "wrongKind" {
		repair = "Use a declared dimension for the chart breakdown and declared measures for chart values in this dataset's field catalog."
	}
	return Diagnostic{Code: "invalid_report_chart", Severity: "error", Path: path, Message: message, SuggestedFix: repair}, true
}

func chartValidationCompileError(err error) error {
	var source interface {
		error
		AuthoredChartValidationDiagnostics() []materializer.ChartValidationDiagnostic
	}
	if !errors.As(err, &source) {
		return err
	}
	diagnostics := make([]Diagnostic, 0)
	for _, location := range source.AuthoredChartValidationDiagnostics() {
		if len(diagnostics) >= 64 {
			break
		}
		if diagnostic, ok := ChartSourceDiagnostic(location); ok {
			diagnostics = append(diagnostics, diagnostic)
		}
	}
	if len(diagnostics) == 0 {
		return err
	}
	return &ChartValidationError{cause: err, diagnostics: diagnostics}
}
