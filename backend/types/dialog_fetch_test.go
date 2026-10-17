package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestDialogFetchOnOpenSurvivesYamlAndJson(t *testing.T) {
	var dialog Dialog
	if err := yaml.Unmarshal([]byte("id: detail\ntitle: Detail\nfetchOnOpen: true\ncontent:\n  id: body\n  fetchData: false\n"), &dialog); err != nil {
		t.Fatal(err)
	}
	if dialog.FetchOnOpen == nil || !*dialog.FetchOnOpen || dialog.Content == nil || dialog.Content.FetchData == nil || *dialog.Content.FetchData {
		t.Fatalf("dialog must retain explicit fetch ownership: %+v", dialog)
	}
	data, err := json.Marshal(dialog)
	if err != nil {
		t.Fatal(err)
	}
	var restored Dialog
	if err = json.Unmarshal(data, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.FetchOnOpen == nil || !*restored.FetchOnOpen || restored.Content == nil || restored.Content.FetchData == nil || *restored.Content.FetchData {
		t.Fatalf("fetch ownership lost in published metadata: %s", data)
	}
}
