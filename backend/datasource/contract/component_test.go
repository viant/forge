// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package datasource

import (
	"encoding/json"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestBackendRoundTripPreservesTrustedProducerIdentity(t *testing.T) {
	input := Backend{Kind: BackendMCPTool, ProducerKind: "datly", Service: "fixture", Method: "query", ServerVersion: "observed-v1", Component: &windowprotocol.ComponentBinding{Kind: "linked", ID: "query", Revision: "exact-v1", ContentFingerprint: "content", SchemaFingerprint: "schema"}}
	for _, codec := range []struct {
		encode func(interface{}) ([]byte, error)
		decode func([]byte, interface{}) error
	}{{json.Marshal, json.Unmarshal}, {yaml.Marshal, yaml.Unmarshal}} {
		raw, err := codec.encode(input)
		if err != nil {
			t.Fatal(err)
		}
		var output Backend
		if err = codec.decode(raw, &output); err != nil || output.Component == nil || *output.Component != *input.Component || output.ServerVersion != input.ServerVersion || output.ProducerKind != "datly" {
			t.Fatalf("typed roundtrip erased binding: %+v %v", output, err)
		}
	}
}
