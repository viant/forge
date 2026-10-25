package materializer

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestMaterializePresentedAppliesTableChoicesThroughEmbeddedBundle(t *testing.T) {
	spec := json.RawMessage(`{"version":1,"kind":"reportSpec","title":"Evidence","source":{"kind":"report","containerId":"evidence","stateKey":"evidence","dataSourceRef":"source"},"parameters":{"viewMode":"table","pageSize":25},"layoutIntent":{"kind":"stack","blockOrder":["evidence"]},"datasets":[{"id":"primary","dataSourceRef":"source","request":{}}],"blocks":[{"id":"evidence","kind":"tableBlock","datasetRef":"primary","columns":[{"key":"id","label":"ID"},{"key":"name","label":"Name"}]}]}`)
	datasets := map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"id":"9007199254740993","name":"Cedar"},{"id":"1","name":"Birch"},{"id":"9007199254740992","name":"Cedar"}],"hasMore":false}`)}
	choices := TablePresentations{"evidence": {Filter: "Cedar", Sort: &TableSort{Key: "id", Direction: "asc"}}}
	for _, fillOnly := range []bool{true, false} {
		t.Run(map[bool]string{true: "fill", false: "print"}[fillOnly], func(t *testing.T) {
			output, err := MaterializePresented(context.Background(), spec, datasets, choices, fillOnly)
			if err != nil {
				t.Fatal(err)
			}
			var fill struct {
				Blocks []struct {
					Content struct {
						Rows []struct {
							Cells []struct {
								Key   string `json:"key"`
								Value any    `json:"value"`
							} `json:"cells"`
						} `json:"resolvedRows"`
					} `json:"content"`
				} `json:"blocks"`
			}
			if err := json.Unmarshal(output.ReportFill, &fill); err != nil {
				t.Fatal(err)
			}
			if len(fill.Blocks) != 1 || len(fill.Blocks[0].Content.Rows) != 2 {
				t.Fatalf("table choices not applied: %s", output.ReportFill)
			}
			for i, want := range []string{"9007199254740992", "9007199254740993"} {
				if got := fill.Blocks[0].Content.Rows[i].Cells[0].Value; got != want {
					t.Fatalf("row %d ID=%v want %s", i, got, want)
				}
			}
			if !fillOnly && !json.Valid(output.ReportPrint) {
				t.Fatal("missing print model")
			}
		})
	}
}

func TestTablePresentationsValidateAgainstTrustedSpec(t *testing.T) {
	spec := json.RawMessage(`{"blocks":[{"id":"evidence","kind":"tableBlock","columns":[{"key":"id"}]},{"id":"chart","kind":"chartBlock"}]}`)
	for _, tc := range []struct {
		name  string
		state TablePresentations
		valid bool
	}{
		{"none", nil, true},
		{"sort", TablePresentations{"evidence": {Sort: &TableSort{Key: "id", Direction: "desc"}}}, true},
		{"filter", TablePresentations{"evidence": {Filter: "Cedar"}}, true},
		{"unknown table", TablePresentations{"foreign": {}}, false},
		{"chart", TablePresentations{"chart": {}}, false},
		{"unknown column", TablePresentations{"evidence": {Sort: &TableSort{Key: "secret", Direction: "asc"}}}, false},
		{"direction", TablePresentations{"evidence": {Sort: &TableSort{Key: "id", Direction: "invalid"}}}, false},
		{"oversized filter", TablePresentations{"evidence": {Filter: strings.Repeat("x", 4097)}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateTablePresentations(spec, tc.state)
			if (err == nil) != tc.valid {
				t.Fatalf("valid=%v error=%v", tc.valid, err)
			}
		})
	}
}
