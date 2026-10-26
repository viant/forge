package reporting

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var ErrReportParameterBinding = errors.New("report parameter is not declared by the approved source")

// ReportParameterBindingError describes an undeclared invocation input only.
// Reserved inputs, authorization failures and selection widening retain their
// original errors. Values and private parameter destination paths are omitted.
type ReportParameterBindingError struct{ diagnostic Diagnostic }

func (e *ReportParameterBindingError) Error() string { return ErrReportParameterBinding.Error() }
func (e *ReportParameterBindingError) Unwrap() error { return ErrReportParameterBinding }
func (e *ReportParameterBindingError) ReportParameterBindingDiagnostic() Diagnostic {
	return e.diagnostic
}

var bindingDiagnosticID = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.-]{0,127}$`)

func reservedReportParameter(key string) bool {
	return strings.HasPrefix(key, "_") || key == "backend" || key == "source" || key == "service" || key == "method" || key == "filters" || key == "options"
}
func newReportParameterBindingError(parameter string, allowed map[string]bool, declarations map[string]reportParameterDeclaration) error {
	keys := map[string]bool{}
	for key, admitted := range allowed {
		if admitted {
			keys[key] = true
		}
	}
	for key := range declarations {
		keys[key] = true
	}
	names := make([]string, 0, len(keys))
	for key := range keys {
		if !reservedReportParameter(key) && bindingDiagnosticID.MatchString(key) {
			names = append(names, key)
		}
	}
	sort.Strings(names)
	public := make([]string, 0, 16)
	size := 0
	for _, name := range names {
		next := strconv.Quote(name)
		if len(public) >= 16 || size+len(next) > 512 {
			public = append(public, "...")
			break
		}
		public = append(public, next)
		size += len(next) + 2
	}
	available := "none"
	if len(public) > 0 {
		available = strings.Join(public, ", ")
	}
	name, path := "<invalid identifier>", "parameters"
	if !reservedReportParameter(parameter) && bindingDiagnosticID.MatchString(parameter) {
		name = strconv.Quote(parameter)
		path += "[" + name + "]"
	}
	return &ReportParameterBindingError{diagnostic: Diagnostic{
		Code: "undeclared_report_parameter", Severity: "error", Path: path,
		Message:      fmt.Sprintf("Invocation parameter %s is not declared by the approved report datasource. Declared input names: %s.", name, available),
		SuggestedFix: "Remove this invocation input or author the intended datasource parameter or builder predicate, then re-import and validate the report source.",
	}}
}
