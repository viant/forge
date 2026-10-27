package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTableSavedViewsRoundTrip(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte("id: grid\ntable:\n  savedViews:\n    key: shared-personal-grid\n    actions:\n      list: views.list\n      save: views.save\n      remove: views.remove\n"), &container); err != nil {
		t.Fatal(err)
	}
	if container.Table.SavedViews == nil || container.Table.SavedViews.Key != "shared-personal-grid" {
		t.Fatalf("saved view collection lost: %#v", container.Table)
	}
	if container.Table.SavedViews.Actions == nil || container.Table.SavedViews.Actions.List != "views.list" {
		t.Fatal("authored list action lost")
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
	if roundTrip.Table.SavedViews.Actions == nil || roundTrip.Table.SavedViews.Actions.Save != "views.save" || roundTrip.Table.SavedViews.Actions.Remove != "views.remove" {
		t.Fatal("authored mutation actions lost")
	}
}
