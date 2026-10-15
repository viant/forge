package types

import (
	"encoding/json"
	"testing"
)

func TestCanonicalWindowDescriptorRejectsDuplicateKeysAtEveryDepth(t *testing.T) {
	for name, raw := range map[string]string{
		"identity": `{"id":"first","id":"second"}`,
		"nested":   `{"id":"items","service":{"method":"read","method":"write"}}`,
		"array":    `{"id":"items","args":[{"account":1,"account":2}]}`,
		"escaped":  `{"id":"items","args":{"name":1,"na\u006de":2}}`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := CanonicalWindowDescriptor(json.RawMessage(raw)); err == nil {
				t.Fatal("ambiguous duplicate-key descriptor accepted")
			}
		})
	}
}
