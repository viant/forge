package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTableLinkRetainsDialogID(t *testing.T) {
	var actual Column
	if err := yaml.Unmarshal([]byte("id: name\ntype: link\nlink:\n  kind: dialog\n  dialogId: campaignDetail\n"), &actual); err != nil {
		t.Fatal(err)
	}
	if actual.Link == nil || actual.Link.DialogId != "campaignDetail" {
		t.Fatalf("dialogId was not retained: %#v", actual.Link)
	}
	payload, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"dialogId":"campaignDetail"`) {
		t.Fatalf("dialogId missing from JSON: %s", payload)
	}
}
