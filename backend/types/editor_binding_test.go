package types

import (
	"encoding/json"
	"testing"
)

func TestEditorPreservesNestedBindingAndReadOnlyMetadata(t *testing.T) {
	source := []byte(`{"editor":{"language":"css","valueFormat":"yaml","errorField":"validationError","selector":{"source":"definition.css"},"readOnlyWhen":{"selector":"locked","equals":true}}}`)
	var container Container
	if err := json.Unmarshal(source, &container); err != nil {
		t.Fatal(err)
	}
	if container.Editor == nil || container.Editor.Language != "css" || container.Editor.EditorSelector.Source != "definition.css" || container.Editor.ReadOnlyWhen["equals"] != true {
		t.Fatalf("editor binding lost: %+v", container.Editor)
	}
	encoded, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var again Container
	if err = json.Unmarshal(encoded, &again); err != nil {
		t.Fatal(err)
	}
	if again.Editor.ValueFormat != "yaml" || again.Editor.ErrorField != "validationError" || again.Editor.Language != "css" || again.Editor.ReadOnlyWhen["selector"] != "locked" {
		t.Fatal("editor metadata lost during publication")
	}
}
