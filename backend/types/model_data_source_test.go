package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestDataSourceYAMLRetainsClientModes(t *testing.T) {
	var actual DataSource
	if err := yaml.Unmarshal([]byte(`
sortMode: client
filterMode: client
paginationMode: client
replayPendingFetchOnRestore: false
filterSet:
  - name: quick
    default: true
    template:
      - {id: Search, field: siteName, dataField: legacySiteName, label: Site, operator: contains, type: string}
`), &actual); err != nil {
		t.Fatalf("unmarshal datasource: %v", err)
	}
	if actual.SortMode != "client" || actual.FilterMode != "client" || actual.PaginationMode != "client" {
		t.Fatalf("client modes were not retained: %#v", actual)
	}
	if actual.ReplayPendingFetchOnRestore == nil || *actual.ReplayPendingFetchOnRestore {
		t.Fatalf("pending fetch replay policy was not retained: %#v", actual.ReplayPendingFetchOnRestore)
	}
	template := actual.FilterSet[0].Template[0]
	if template.Field != "siteName" || template.DataField != "legacySiteName" {
		t.Fatalf("client filter row selectors were not retained: %#v", template)
	}
	payload, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
	}
	for _, fragment := range []string{`"sortMode":"client"`, `"filterMode":"client"`, `"paginationMode":"client"`, `"replayPendingFetchOnRestore":false`, `"field":"siteName"`, `"dataField":"legacySiteName"`} {
		if !strings.Contains(string(payload), fragment) {
			t.Fatalf("missing %s in datasource JSON: %s", fragment, payload)
		}
	}
}
