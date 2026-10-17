package materializer

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestTabularResultContractPreservesValuesAndPaging(t *testing.T) {
	spec := json.RawMessage(`{"datasets":[{"id":"primary","resultContract":{"shape":"tabular","rowPath":"rows.0","hasMorePath":"rows.0.hasMore"}}]}`)
	raw := json.RawMessage(`{"rows":[{"columns":[{"name":"id"},{"name":"spend"}],"rows":[[9007199254740993,1.25],[2]],"hasMore":true}],"metrics":{"count":2}}`)
	got, err := normalizeDatasetResults(spec, map[string]json.RawMessage{"primary": raw})
	if err != nil {
		t.Fatal(err)
	}
	text := string(got["primary"])
	for _, want := range []string{`"id":9007199254740993`, `"spend":1.25`, `"spend":null`, `"hasMore":true`, `"metrics":{"count":2}`} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %s in %s", want, text)
		}
	}
	if string(raw) != `{"rows":[{"columns":[{"name":"id"},{"name":"spend"}],"rows":[[9007199254740993,1.25],[2]],"hasMore":true}],"metrics":{"count":2}}` {
		t.Fatal("input mutated")
	}
	_, err = normalizeDatasetResults(spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"columns":[{"name":"id"},{"name":"id"}],"rows":[[1,2]]}]}`)})
	if err == nil {
		t.Fatal("duplicate columns accepted")
	}
}
func TestResultContractsLeaveOrdinaryRowsUnchanged(t *testing.T) {
	raw := json.RawMessage(`{"rows":[{"value":3}]}`)
	result, err := normalizeDatasetResults(json.RawMessage(`{"datasets":[{"id":"generic"}]}`), map[string]json.RawMessage{"generic": raw})
	if err != nil || string(result["generic"]) != string(raw) {
		t.Fatalf("generic rows changed: %s %v", result["generic"], err)
	}
}
