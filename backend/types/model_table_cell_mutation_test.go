package types

import "testing"

func TestTableCellMutationValidatesResourcePayload(t *testing.T) {
	w := &Window{View: View{Content: &Container{ID: "list", Table: &Table{Columns: []Column{{ID: "remove", Type: "button", MutationCommand: &MutationCommand{DataSourceRef: "patch", Payload: &ResourcePayloadPreparation{ModelRef: "missing"}}}}}}}}
	if err := ValidateResourceModelStructure(w); err == nil {
		t.Fatal("unknown column payload model accepted")
	}
}
