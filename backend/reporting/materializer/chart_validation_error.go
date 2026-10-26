package materializer

import (
	"encoding/json"
	"errors"
	"regexp"

	"github.com/dop251/goja"
)

// ChartValidationDiagnostic describes source locations only. It carries no
// authored message, data row, request value, stack trace or operational cause.
type ChartValidationDiagnostic struct {
	BlockID        string `json:"blockId"`
	DatasetRef     string `json:"datasetRef"`
	Field          string `json:"field"`
	FieldRef       string `json:"fieldRef"`
	ValidationCode string `json:"validationCode"`
}

// AuthoredChartValidationError is emitted only from the trusted lowerer's
// structured validation failure, never inferred from an arbitrary error string.
type AuthoredChartValidationError struct {
	cause       error
	diagnostics []ChartValidationDiagnostic
}

func (*AuthoredChartValidationError) Error() string {
	return "authored report contains invalid chart fields"
}
func (e *AuthoredChartValidationError) Unwrap() error { return e.cause }
func (e *AuthoredChartValidationError) AuthoredChartValidationDiagnostics() []ChartValidationDiagnostic {
	return append([]ChartValidationDiagnostic(nil), e.diagnostics...)
}

var chartValidationID = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.-]{0,127}$`)
var chartValidationField = regexp.MustCompile(`^(chartSpec|type|xField|yFields(\.[0-9]{1,8})?|seriesField|seriesOptions(\.[A-Za-z_][A-Za-z0-9_-]{0,63})(\.(type|axis|stackId|dataLabels|pointColorMode))?)$`)

// ValidChartValidationDiagnostic admits only locations and categories produced
// by the code-owned chart validator. Consumers may reuse it at their boundary.
func ValidChartValidationDiagnostic(d ChartValidationDiagnostic) bool {
	if !chartValidationID.MatchString(d.BlockID) || !chartValidationID.MatchString(d.DatasetRef) || !chartValidationField.MatchString(d.Field) || len(d.Field) > 128 || (d.FieldRef != "" && !chartValidationID.MatchString(d.FieldRef)) {
		return false
	}
	switch d.ValidationCode {
	case "missing", "unsupportedType", "missingField", "wrongKind", "empty", "duplicateField", "notAllowed", "tooManyMeasures", "unknownMeasure", "invalidType", "invalidAxis", "invalidStackId", "invalidDataLabels", "invalidPointColorMode", "axisConflict":
		return true
	}
	return false
}

func authoredChartValidationError(err error) error {
	var exception *goja.Exception
	if !errors.As(err, &exception) {
		return nil
	}
	object, ok := exception.Value().(*goja.Object)
	if !ok {
		return nil
	}
	name := object.Get("name")
	if name == nil || goja.IsUndefined(name) || name.String() != "AuthoredReportChartValidationError" {
		return nil
	}
	value := object.Get("authoredChartValidation")
	if value == nil || goja.IsNull(value) || goja.IsUndefined(value) {
		return nil
	}
	entries, ok := value.Export().([]interface{})
	if !ok || len(entries) == 0 || len(entries) > 64 {
		return nil
	}
	raw, marshalErr := json.Marshal(entries)
	if marshalErr != nil || len(raw) > 64<<10 {
		return nil
	}
	var candidates []ChartValidationDiagnostic
	if json.Unmarshal(raw, &candidates) != nil {
		return nil
	}
	diagnostics := make([]ChartValidationDiagnostic, 0, len(candidates))
	for _, candidate := range candidates {
		if ValidChartValidationDiagnostic(candidate) {
			diagnostics = append(diagnostics, candidate)
		}
	}
	if len(diagnostics) == 0 {
		return nil
	}
	return &AuthoredChartValidationError{cause: err, diagnostics: diagnostics}
}
