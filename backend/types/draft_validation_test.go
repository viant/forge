package types

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestDraftSchemaValidationBindingRoundTrip(t *testing.T) {
	source := []byte(`validation: {schemaRef: draft}
validate: Fixture.crossField
lifecycle: {defaults: [{name: enabled, default: false}]}
`)
	var spec DraftFormSpec
	if err := yaml.Unmarshal(source, &spec); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	var restored DraftFormSpec
	if err = json.Unmarshal(raw, &restored); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(spec, restored) || restored.Validation.SchemaRef != "draft" {
		t.Fatal("binding lost in round trip")
	}
}
func TestDraftSchemaValidationReferencesFailClosed(t *testing.T) {
	for _, ref := range []string{"", "missing", "draft"} {
		draft := &DraftFormSpec{Validation: &DraftFormValidation{SchemaRef: ref}}
		window := &Window{Schemas: map[string]ResourceSchema{"draft": {Type: "object"}}, View: View{Content: &Container{ID: "editor", DraftForm: draft}}}
		err := ValidateResourceModelStructure(window)
		if ref == "draft" {
			if err != nil {
				t.Fatal(err)
			}
		} else if err == nil || !strings.Contains(err.Error(), "draft validation") {
			t.Fatalf("invalid binding %q accepted: %v", ref, err)
		}
	}
}

func TestEmbeddedParameterDraftSchemaValidation(t *testing.T) {
	window := &Window{View: View{Content: &Container{ID: "parameters", ParameterEditor: &ParameterEditorSpec{Draft: &DraftFormSpec{Validation: &DraftFormValidation{SchemaRef: "missing"}}}}}}
	if err := ValidateResourceModelStructure(window); err == nil || !strings.Contains(err.Error(), "unknown schema") {
		t.Fatalf("embedded missing schema accepted: %v", err)
	}
}
