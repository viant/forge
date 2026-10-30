package types

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestDraftLifecycleRoundTrip(t *testing.T) {
	// Independently authored neutral metadata, with two different opening contexts.
	source := `{"dataSourceRef":"draft","lifecycle":{"openWhen":{"source":"windowForm","field":"open","equals":true},"key":[{"name":"parentId","in":"windowForm","location":"parentId"}],"defaults":[{"name":"enabled","default":false},{"name":"count","default":0},{"name":"nullable","default":null},{"name":"name","default":""},{"name":"omitted"}],"source":{"dataSourceRef":"settings","parameters":[{"name":"id","in":"windowForm","location":"parentId"}],"defaults":[{"name":"currency","in":"form","location":"settings.currency","default":"USD"}]},"load":"Host.prepareDefaults"},"validate":"Host.validate","submit":{"dataSourceRef":"writer","prepare":"Host.prepare"}}`
	var input DraftFormSpec
	if err := json.Unmarshal([]byte(source), &input); err != nil {
		t.Fatal(err)
	}
	yamlBytes, err := yaml.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	var restored DraftFormSpec
	if err := yaml.Unmarshal(yamlBytes, &restored); err != nil {
		t.Fatal(err)
	}
	jsonBytes, err := json.Marshal(restored)
	if err != nil {
		t.Fatal(err)
	}
	var expected, actual interface{}
	if err := json.Unmarshal([]byte(source), &expected); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(jsonBytes, &actual); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(expected, actual) {
		t.Fatalf("metadata lost through YAML/JSON round trip:\n%s", jsonBytes)
	}
}

func TestDraftLifecycleValidation(t *testing.T) {
	for _, tc := range []struct {
		source string
		want   string
	}{
		{`{"source":{}}`, "requires dataSourceRef"},
		{`{"source":{"dataSourceRef":"draft"}}`, "must differ"},
		{`{"source":{"dataSourceRef":"missing"}}`, "unknown datasource"},
		{`{"defaults":[{"default":0}]}`, "requires name"},
		{`{"key":[{"name":"id","direction":"out"}]}`, "must be inbound"},
	} {
		var lifecycle DraftLifecycleSpec
		if err := json.Unmarshal([]byte(tc.source), &lifecycle); err != nil {
			t.Fatal(err)
		}
		err := validateDraftLifecycle(&Window{}, &DraftFormSpec{Lifecycle: &lifecycle}, "draft", true)
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Fatalf("%s: got %v, want %s", tc.source, err, tc.want)
		}
	}
}
