package reportspec

import (
	"encoding/json"
	"testing"
)

func TestBlockMarshalPreservesKindSpecificColumns(t *testing.T) {
	cases := []struct {
		name  string
		block Block
	}{
		{"table", Block{ID: "table", Kind: "tableBlock", DatasetRef: "rows", Columns: []TableColumn{{Key: "id", Label: "ID"}}}},
		{"kanban", Block{ID: "kanban", Kind: "kanbanBlock", Title: "Board", ColumnsLayout: []KanbanColumn{{ID: "open", Title: "Open"}}}},
		{"collection", Block{ID: "cards", Kind: "collectionBlock", Title: "Cards", DatasetRef: "rows", ItemTitleField: "id", Layout: "grid", CollectionCols: 2, RowLimit: intPointer(5)}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			payload, err := json.Marshal(test.block)
			if err != nil {
				t.Fatal(err)
			}
			var raw map[string]json.RawMessage
			if err := json.Unmarshal(payload, &raw); err != nil {
				t.Fatal(err)
			}
			if len(raw["columns"]) == 0 || len(raw["columnsCount"]) != 0 {
				t.Fatalf("kind-specific columns lost: %s", payload)
			}
		})
	}
}

func intPointer(value int) *int { return &value }

func TestRequestPayloadMarshalPreservesDynamicHashAndStaticEmptyColumns(t *testing.T) {
	limit, offset, zero := 10, 0, 0
	dynamic := RequestPayload{Kind: "query", Limit: &limit, Offset: &offset}
	type plain RequestPayload
	got, err := json.Marshal(dynamic)
	if err != nil {
		t.Fatal(err)
	}
	want, err := json.Marshal(plain(dynamic))
	if err != nil || string(got) != string(want) {
		t.Fatalf("dynamic request hash bytes changed: got %s want %s: %v", got, want, err)
	}
	static := RequestPayload{Kind: "staticJson", Format: "json", RowCount: &zero, ColumnKeys: []string{}}
	got, err = json.Marshal(static)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(got, &fields); err != nil || string(fields["columnKeys"]) != "[]" {
		t.Fatalf("static empty columns were lost: %s: %v", got, err)
	}
	static.ColumnKeys = []string{"id"}
	got, err = json.Marshal(static)
	if err != nil {
		t.Fatal(err)
	}
	want, err = json.Marshal(plain(static))
	if err != nil || string(got) != string(want) {
		t.Fatalf("existing static request hash bytes changed: got %s want %s: %v", got, want, err)
	}
}
