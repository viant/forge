// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package datasource

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"reflect"
	"testing"
)

func TestRequestMetadataAuthoringRoundTrip(t *testing.T) {
	expected := []string{"semanticSelection", "literal.dot", "*", "", "semanticSelection"}
	source := Backend{Kind: BackendMCPTool, RequestMetadata: expected}
	for _, codec := range []struct {
		name      string
		marshal   func(interface{}) ([]byte, error)
		unmarshal func([]byte, interface{}) error
	}{
		{"json", json.Marshal, json.Unmarshal}, {"yaml", yaml.Marshal, yaml.Unmarshal},
	} {
		t.Run(codec.name, func(t *testing.T) {
			encoded, err := codec.marshal(source)
			if err != nil {
				t.Fatal(err)
			}
			var actual Backend
			if err = codec.unmarshal(encoded, &actual); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(actual.RequestMetadata, expected) {
				t.Fatalf("literal keys altered: %#v", actual.RequestMetadata)
			}
		})
	}
}
