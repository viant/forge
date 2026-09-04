package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestToolbarItemRetainsDirtyValue(t *testing.T) {
	var actual Item
	if err := yaml.Unmarshal([]byte(`
id: mutationStatus
type: status
dataField: mutationMessage
dirtyValue: Unsaved changes
`), &actual); err != nil {
		t.Fatalf("unmarshal toolbar item: %v", err)
	}
	if actual.DirtyValue != "Unsaved changes" {
		t.Fatalf("dirtyValue was not retained: %#v", actual.DirtyValue)
	}
	payload, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"dirtyValue":"Unsaved changes"`) {
		t.Fatalf("dirtyValue missing from JSON: %s", payload)
	}
}
