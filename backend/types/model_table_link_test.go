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

func TestTableLinkRetainsHostedRegionReplacementPolicy(t *testing.T) {
	var actual Column
	if err := yaml.Unmarshal([]byte("id: report\ntype: link\nlink:\n  kind: window\n  windowKey: advancedReports\n  replaceHostedRegion: false\n"), &actual); err != nil {
		t.Fatal(err)
	}
	if actual.Link == nil || actual.Link.ReplaceHostedRegion == nil || *actual.Link.ReplaceHostedRegion {
		t.Fatalf("replaceHostedRegion=false was not retained: %#v", actual.Link)
	}
	payload, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"replaceHostedRegion":false`) {
		t.Fatalf("replaceHostedRegion missing from JSON: %s", payload)
	}
}
