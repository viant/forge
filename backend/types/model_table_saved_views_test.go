package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTableSavedViewsRoundTrip(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte("id: grid\ntable:\n  savedViews:\n    key: shared-personal-grid\n"), &container); err != nil {
		t.Fatal(err)
	}
	if container.Table.SavedViews == nil || container.Table.SavedViews.Key != "shared-personal-grid" {
		t.Fatalf("saved view collection lost: %#v", container.Table)
	}
	payload, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var roundTrip Container
	if err := json.Unmarshal(payload, &roundTrip); err != nil {
		t.Fatal(err)
	}
	if roundTrip.Table.SavedViews == nil || roundTrip.Table.SavedViews.Key != "shared-personal-grid" {
		t.Fatalf("saved view JSON collection lost: %s", payload)
	}
}
