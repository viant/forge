package types

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/agently-core/protocol/primitive"
	"gopkg.in/yaml.v3"
)

func TestMCPAppContainerRetainsAuthoredClosure(t *testing.T) {
	input := Container{Kind: "mcpApp", MCPApp: &MCPAppSpec{ResourceURI: "ui://arbitrary-producer/editor", AssetClosure: &primitive.MCPAppClosure{Fingerprint: "complete-immutable-closure", EntryPath: "index.html", EntrySHA256: "immutable-entry"}}}
	for _, codec := range []struct {
		name      string
		marshal   func(any) ([]byte, error)
		unmarshal func([]byte, any) error
	}{
		{"json", json.Marshal, json.Unmarshal},
		{"yaml", yaml.Marshal, yaml.Unmarshal},
	} {
		t.Run(codec.name, func(t *testing.T) {
			raw, err := codec.marshal(input)
			require.NoError(t, err)
			var output Container
			require.NoError(t, codec.unmarshal(raw, &output))
			require.Equal(t, input.Kind, output.Kind)
			require.Equal(t, input.MCPApp, output.MCPApp)
			require.NotContains(t, string(raw), "_meta")
			raw, err = codec.marshal(Container{Kind: "native"})
			require.NoError(t, err)
			require.NotContains(t, string(raw), "mcpApp")
		})
	}
}
