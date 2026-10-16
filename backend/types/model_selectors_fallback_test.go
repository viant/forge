package types

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestSelectorsDataFallbacksJSONYAMLRoundtrip(t *testing.T) {
	var definition DataSource
	if err := yaml.Unmarshal([]byte("selectors:\n  data: data.0.iSpotBrandOptions\n  dataFallbacks: [data.0.isPotBrandOptions, backup]\n"), &definition); err != nil {
		t.Fatal(err)
	}
	want := &Selectors{Data: "data.0.iSpotBrandOptions", DataFallbacks: []string{"data.0.isPotBrandOptions", "backup"}}
	if !reflect.DeepEqual(definition.Selectors, want) {
		t.Fatal("YAML discarded ordered alternatives")
	}
	raw, err := json.Marshal(definition)
	if err != nil {
		t.Fatal(err)
	}
	var fromJSON DataSource
	if err = json.Unmarshal(raw, &fromJSON); err != nil || !reflect.DeepEqual(fromJSON.Selectors, want) {
		t.Fatal("JSON discarded ordered alternatives", err)
	}
	raw, err = yaml.Marshal(fromJSON)
	if err != nil {
		t.Fatal(err)
	}
	var fromYAML DataSource
	if err = yaml.Unmarshal(raw, &fromYAML); err != nil || !reflect.DeepEqual(fromYAML.Selectors, want) {
		t.Fatal("JSON to YAML metadata roundtrip changed alternatives", err)
	}
	for _, selectors := range []Selectors{{Data: "data"}, {Data: "data", DataFallbacks: []string{}}} {
		for _, encode := range []func(interface{}) ([]byte, error){json.Marshal, yaml.Marshal} {
			raw, err = encode(selectors)
			if err != nil || strings.Contains(string(raw), "dataFallbacks") {
				t.Fatal("legacy metadata must omit absent alternatives", err)
			}
		}
	}
}
