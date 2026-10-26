package reporting

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/viant/forge/backend/reporting/materializer"
	identity "github.com/viant/forge/backend/resource"
)

type chartValidationFixture struct {
	cause     error
	locations []materializer.ChartValidationDiagnostic
}

func (*chartValidationFixture) Error() string   { return "private-token https://private/source" }
func (e *chartValidationFixture) Unwrap() error { return e.cause }
func (e *chartValidationFixture) AuthoredChartValidationDiagnostics() []materializer.ChartValidationDiagnostic {
	return e.locations
}

func TestChartValidationCompileStageTypedDiagnostics(t *testing.T) {
	cause := errors.New("private-token")
	location := materializer.ChartValidationDiagnostic{BlockID: "chart", DatasetRef: "detail", Field: "yFields.0", FieldRef: "observations", ValidationCode: "missingField"}
	err := compileStageError(CompileStageLower, &chartValidationFixture{cause: cause, locations: []materializer.ChartValidationDiagnostic{location}})
	var stage *CompileStageError
	var invalid *ChartValidationError
	if !errors.As(err, &stage) || stage.Stage != CompileStageLower || !errors.As(err, &invalid) || !errors.Is(err, cause) {
		t.Fatalf("typed cause chain lost: %v", err)
	}
	diagnostics := invalid.ReportChartDiagnostics()
	if len(diagnostics) != 1 || diagnostics[0].Path != "reportDocument.blocks.chart.chartSpec.yFields[0]" {
		t.Fatalf("diagnostics: %+v", diagnostics)
	}
	if !strings.Contains(diagnostics[0].Message, "detail") || !strings.Contains(diagnostics[0].SuggestedFix, "columnOptions") || diagnostics[0].Cause != "" {
		t.Fatal("missing or unsafe source guidance")
	}
	if strings.Contains(invalid.Error()+diagnostics[0].Message+diagnostics[0].SuggestedFix, "private-token") {
		t.Fatal("operational cause was exposed")
	}
	diagnostics[0].Message = "changed"
	if invalid.ReportChartDiagnostics()[0].Message == "changed" {
		t.Fatal("diagnostic copy mutated")
	}
	for _, cause := range []error{context.Canceled, context.DeadlineExceeded, identity.ErrResourceDenied} {
		original := &chartValidationFixture{cause: cause, locations: []materializer.ChartValidationDiagnostic{location}}
		if compileStageError(CompileStageLower, original) != original {
			t.Fatal("cancellation/denial was reclassified")
		}
	}
	var untyped *ChartValidationError
	if errors.As(compileStageError(CompileStageLower, errors.New("AuthoredReportChartValidationError missingField")), &untyped) {
		t.Fatal("arbitrary error text was classified")
	}
}
