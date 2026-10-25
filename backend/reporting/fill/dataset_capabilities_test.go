package reportfill

import (
	"encoding/json"
	"testing"
)

func TestDatasourceCapabilitiesRetainRuntimeFieldCatalog(t *testing.T) {
	for _, scenario := range []struct {
		name  string
		value any
	}{
		{"enabled", true}, {"disabled", false}, {"omitted", nil},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			var fixture map[string]any
			if err := json.Unmarshal(datasourceFillFixture(t, map[string]any{"advertiserId": 19}), &fixture); err != nil {
				t.Fatal(err)
			}
			dataset := fixture["datasets"].([]any)[0].(map[string]any)
			capabilities := map[string]any{"export": true}
			if scenario.value != nil {
				capabilities["inheritRuntimeFieldCatalog"] = scenario.value
			}
			dataset["capabilities"] = capabilities
			raw, err := json.Marshal(fixture)
			if err != nil {
				t.Fatal(err)
			}
			decoded, err := DecodeDatasourceJSON(raw)
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := json.Marshal(decoded.Datasets[0])
			if err != nil {
				t.Fatal(err)
			}
			var roundtrip map[string]any
			if err = json.Unmarshal(encoded, &roundtrip); err != nil {
				t.Fatal(err)
			}
			actual := roundtrip["capabilities"].(map[string]any)
			if actual["inheritRuntimeFieldCatalog"] != scenario.value || actual["export"] != true {
				t.Fatalf("capabilities changed: %s", encoded)
			}
			if roundtrip["request"].(map[string]any)["advertiserId"] != float64(19) {
				t.Fatal("opaque producer request changed")
			}
		})
	}
}
