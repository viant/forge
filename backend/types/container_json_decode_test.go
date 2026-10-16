package types

import (
	"encoding/json"
	"testing"
)

func TestOrdinaryContainerDecodeRetainsReportAliasAndNestedNumbers(t *testing.T) {
	const source = `{"id":"root","kind":"section","visibleWhen":{"source":"form","field":"shown","equals":true},"r\u0065port":{"enabled":true,"title":"Retained report"},"containers":[{"id":"child","fetchData":false,"items":[{"id":"number","type":"label","properties":{"exact":18446744073709551615}}]}]}`
	var value Container
	if err := json.Unmarshal([]byte(source), &value); err != nil {
		t.Fatal(err)
	}
	if value.Dashboard == nil || value.Dashboard.ReportOptions == nil || !value.Dashboard.ReportOptions.Enabled || value.Dashboard.ReportOptions.Title != "Retained report" {
		t.Fatalf("report alias lost: %#v", value.Dashboard)
	}
	if value.VisibleWhen["equals"] != true {
		t.Fatal("ordinary visibility condition lost")
	}
	child := value.Containers[0]
	if child.FetchData == nil || *child.FetchData {
		t.Fatal("explicit deferred child became eager")
	}
	if number, ok := child.Items[0].Properties["exact"].(json.Number); !ok || number.String() != "18446744073709551615" {
		t.Fatalf("numeric precision lost: %#v", child.Items[0].Properties)
	}
	var roundtrip Container
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(encoded, &roundtrip); err != nil {
		t.Fatal(err)
	}
	if roundtrip.Dashboard.ReportOptions.Title != "Retained report" {
		t.Fatal("report options lost on normalized roundtrip")
	}
}
