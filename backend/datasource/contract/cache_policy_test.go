// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package datasource

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestCachePolicyEnabledDefaultsTrueAndRoundTripsFalse(t *testing.T) {
	if policy := CachePolicyOrDefault(nil); policy.Enabled == nil || !*policy.Enabled {
		t.Fatalf("nil cache policy must retain the documented enabled default: %#v", policy.Enabled)
	}
	for name, decode := range map[string]func([]byte, interface{}) error{
		"json": json.Unmarshal,
		"yaml": yaml.Unmarshal,
	} {
		t.Run(name, func(t *testing.T) {
			var source DataSource
			if err := decode([]byte(`{"id":"writer","cache":{"enabled":false},"backend":{"kind":"mcp_tool","service":"platform","method":"Patch"}}`), &source); err != nil {
				t.Fatal(err)
			}
			if source.Cache == nil || source.Cache.Enabled == nil || *source.Cache.Enabled {
				t.Fatalf("explicit disabled cache was lost: %#v", source.Cache)
			}
			resolved := CachePolicyOrDefault(source.Cache)
			if resolved.Enabled == nil || *resolved.Enabled {
				t.Fatalf("resolved policy re-enabled an explicit false: %#v", resolved.Enabled)
			}
		})
	}
}
