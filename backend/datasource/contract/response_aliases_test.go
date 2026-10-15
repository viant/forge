// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package datasource

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"reflect"
	"testing"
)

func TestResponseAliasesJSONYAMLRoundTrip(t *testing.T) {
	source := DataSource{ID: "demo", ResponseAliases: map[string]string{"metric-3": "Metric_3", "literal.dot": "Literal.Dot"}}
	for _, codec := range []struct {
		name      string
		marshal   func(interface{}) ([]byte, error)
		unmarshal func([]byte, interface{}) error
	}{{"json", json.Marshal, json.Unmarshal}, {"yaml", yaml.Marshal, yaml.Unmarshal}} {
		t.Run(codec.name, func(t *testing.T) {
			encoded, err := codec.marshal(source)
			if err != nil {
				t.Fatal(err)
			}
			var actual DataSource
			if err = codec.unmarshal(encoded, &actual); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(actual.ResponseAliases, source.ResponseAliases) {
				t.Fatalf("aliases changed: %#v", actual.ResponseAliases)
			}
		})
	}
}
