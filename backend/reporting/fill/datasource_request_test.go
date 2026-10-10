package reportfill

import (
	"encoding/json"
	"strings"
	"testing"
)

func datasourceFillFixture(t *testing.T, request any) []byte {
	t.Helper()
	var fixture map[string]any
	if err := json.Unmarshal([]byte(validTestReportFillJSON()), &fixture); err != nil {
		t.Fatal(err)
	}
	fixture["datasets"].([]any)[0].(map[string]any)["request"] = request
	syncReportFillFixtureProvenance(fixture)
	body, err := json.Marshal(fixture)
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func TestDecodeDatasourceJSONPreservesOpaqueArgumentsAndFingerprint(t *testing.T) {
	request := map[string]any{"kind": 123, "limit": "producer-label", "term": "approved", "resume": map[string]any{"ordinal": json.Number("9223372036854775807"), "tag": "opaque"}}
	body := datasourceFillFixture(t, request)
	if _, err := DecodeJSON(body); err == nil {
		t.Fatal("legacy decoder accepted arbitrary producer arguments")
	}
	if err := ValidateDatasourceRequestProvenance(body); err != nil {
		t.Fatal(err)
	}
	fill, err := DecodeDatasourceJSON(body)
	if err != nil {
		t.Fatal(err)
	}
	// No alias to the caller's input buffer and no fixed query reinterpretation.
	for i := range body {
		body[i] = ' '
	}
	raw, err := json.Marshal(fill.Datasets[0])
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err = json.Unmarshal(raw, &fields); err != nil {
		t.Fatal(err)
	}
	expected, _ := json.Marshal(request)
	if string(fields["request"]) != string(expected) {
		t.Fatalf("changed raw producer request: %s", fields["request"])
	}
	if err = fill.Validate(); err != nil {
		t.Fatal(err)
	}
	limit := 10
	fill.Datasets[0].Request.Limit = &limit
	if err = fill.Validate(); err == nil || !strings.Contains(err.Error(), "changed after decoding") {
		t.Fatal("mutable typed query replaced opaque arguments", err)
	}
}

func TestDecodeDatasourceJSONRetainsAllOtherValidation(t *testing.T) {
	for _, request := range []any{nil, []any{}, "token", 42} {
		if _, err := DecodeDatasourceJSON(datasourceFillFixture(t, request)); err == nil {
			t.Fatalf("nonobject request accepted: %#v", request)
		}
	}
	for _, scenario := range []string{"hash", "row count", "column", "root field"} {
		t.Run(scenario, func(t *testing.T) {
			var fixture map[string]any
			json.Unmarshal(datasourceFillFixture(t, map[string]any{"term": "exact"}), &fixture)
			dataset := fixture["datasets"].([]any)[0].(map[string]any)
			switch scenario {
			case "hash":
				dataset["provenance"].(map[string]any)["requestHash"] = "wrong"
			case "row count":
				dataset["provenance"].(map[string]any)["rowCount"] = 99
			case "column":
				fixture["blocks"].([]any)[0].(map[string]any)["content"].(map[string]any)["columns"] = nil
			case "root field":
				fixture["unexpected"] = true
			}
			raw, _ := json.Marshal(fixture)
			if _, err := DecodeDatasourceJSON(raw); err == nil {
				t.Fatal("invalid report released")
			}
			if scenario == "hash" || scenario == "row count" {
				if err := ValidateDatasourceRequestProvenance(raw); err == nil {
					t.Fatal("invalid provenance accepted before rendering")
				}
			}
		})
	}
}
