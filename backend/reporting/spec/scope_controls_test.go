package reportspec

import (
	"encoding/json"
	"testing"
)

func TestScopeControlBindings(t *testing.T) {
	report := &ReportSpec{Datasets: []Dataset{{ID: "first"}, {ID: "second"}}, Scope: &Scope{Params: []ScopeParam{{ID: "period", FilterBindings: []ScopeParamFilterBinding{{DatasetRef: "first", Path: "from", ValuePath: "start"}, {DatasetRef: "first", Path: "to", ValuePath: "end"}, {DatasetRef: "second", Path: "range"}}}}}}
	if err := validateScopeControlBindings(report); err != nil {
		t.Fatal(err)
	}
	for _, invalid := range []ScopeParamFilterBinding{{DatasetRef: "missing", Path: "mode"}, {DatasetRef: "first", Path: "__proto__.x"}, {DatasetRef: "first", Path: "range", ValuePath: "constructor.x"}, {DatasetRef: "first", Path: "from.child"}} {
		report.Scope.Params = append(report.Scope.Params, ScopeParam{ID: "invalid", FilterBindings: []ScopeParamFilterBinding{invalid}})
		if err := validateScopeControlBindings(report); err == nil {
			t.Fatalf("accepted invalid binding %+v", invalid)
		}
		report.Scope.Params = report.Scope.Params[:1]
	}
}

func TestScopeControlDefaultsRejectMissingAndUnsafeNumericValues(t *testing.T) {
	for _, value := range []any{nil, "", []any{}} {
		if err := ValidateScopeParamValue(ScopeParam{ID: "required", Required: true, Value: value}); err == nil {
			t.Fatalf("accepted missing required default %#v", value)
		}
	}
	for _, value := range []any{json.Number("9007199254740992"), json.Number("9007199254740993"), json.Number("-9007199254740992")} {
		if err := ValidateScopeParamValue(ScopeParam{ID: "large", Value: value}); err == nil {
			t.Fatalf("accepted unsafe numeric default %v", value)
		}
		if err := ValidateScopeParamValue(ScopeParam{ID: "large", Options: []ScopeParamOption{{Label: "Large", Value: value}}}); err == nil {
			t.Fatalf("accepted unsafe numeric option %v", value)
		}
	}
	for _, value := range []any{json.Number("9007199254740991"), json.Number("3.0"), "9007199254740993", nil} {
		if err := ValidateScopeParamValue(ScopeParam{ID: "supported", Value: value}); err != nil {
			t.Fatal(err)
		}
	}
}
