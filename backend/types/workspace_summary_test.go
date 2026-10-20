package types

import (
	"encoding/json"
	"testing"
)

func TestWorkspaceSummaryMetadataRoundTrip(t *testing.T) {
	raw := []byte(`{"workspaceSummary":{"title":"Overview","sections":[{"id":"recent","dataSourceRef":"reports","labelField":"title","handler":"open","statuses":{"active":{"intent":"success"}}}]},"table":{"presentation":"catalog","fullWidth":true}}`)
	var container Container
	if err := json.Unmarshal(raw, &container); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var restored Container
	if err = json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.WorkspaceSummary.Sections[0].Handler != "open" || restored.Table.Presentation != "catalog" {
		t.Fatal(string(encoded))
	}
}
