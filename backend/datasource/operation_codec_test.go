package datasource_test

import (
	"encoding/json"
	resourcehost "github.com/viant/forge/backend/resourcehost"
	"github.com/viant/forge/backend/types"
	"testing"
)

func TestOperationSurvivesAdmittedDatasourceCodec(t *testing.T) {
	// Independently authored synthetic declaration; no application capture.
	raw := json.RawMessage(`{"schemaVersion":1,"dataSource":{"id":"sample","backend":{"kind":"mcp_tool","service":"sample","method":"read"},"operations":{"save":{"backend":{"kind":"mcp_tool","service":"sample","method":"save","pinned":{"scope":"trusted"}}}}}}`)
	ds, err := resourcehost.DecodeDatasourceDefinition(raw)
	if err != nil {
		t.Fatal(err)
	}
	if ds.Operations["save"] == nil || ds.Operations["save"].Backend.Method != "save" {
		t.Fatal("operation declaration lost in admission")
	}
	before, err := json.Marshal(ds)
	if err != nil {
		t.Fatal(err)
	}
	original, err := types.WindowDescriptorFingerprint(before)
	if err != nil {
		t.Fatal(err)
	}
	ds.Operations["save"].Backend.Method = "different"
	after, err := json.Marshal(ds)
	if err != nil {
		t.Fatal(err)
	}
	changed, err := types.WindowDescriptorFingerprint(after)
	if err != nil {
		t.Fatal(err)
	}
	if original == changed {
		t.Fatal("operation change missing from descriptor identity")
	}
}
