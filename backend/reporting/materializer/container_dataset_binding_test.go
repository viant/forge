package materializer

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

func TestContainerVisibilityUsesBoundDatasetInFillAndPrint(t *testing.T) {
	for _, count := range []int{0, 1, 2} {
		t.Run(fmt.Sprintf("count%d", count), func(t *testing.T) {
			raw, err := os.ReadFile("testdata/presentation-report.json")
			if err != nil {
				t.Fatal(err)
			}
			var spec map[string]any
			if err = json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			runtime := map[string]any{"visibleWhen": map[string]any{"source": "metrics", "field": "studyCount", "equals": 1}}
			spec["blocks"] = []any{
				map[string]any{"id": "section", "kind": "sectionBlock", "title": "Bound question section", "navigationLabel": "Question", "datasetRef": "studyScope", "runtime": runtime, "blockIds": []string{"group"}},
				map[string]any{"id": "group", "kind": "compositeBlock", "title": "Bound question panel", "datasetRef": "studyScope", "runtime": runtime, "childBlockIds": []string{"metric"}},
				map[string]any{"id": "metric", "kind": "kpiBlock", "title": "Impressions", "datasetRef": "primary", "valueField": "impressions", "valueLabel": "Impressions"},
			}
			spec["layoutIntent"] = map[string]any{"kind": "stack", "blockOrder": []string{"section", "group", "metric"}}
			spec["datasets"] = []any{
				map[string]any{"id": "primary", "dataSourceRef": "approved", "request": map[string]any{}},
				map[string]any{"id": "studyScope", "dataSourceRef": "approved", "request": map[string]any{}},
			}
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{
				"primary":    json.RawMessage(`{"rows":[{"impressions":1900,"studyCount":99}]}`),
				"studyScope": json.RawMessage(fmt.Sprintf(`{"rows":[{"studyCount":%d}]}`, count)),
			})
			if err != nil {
				t.Fatal(err)
			}
			var fill struct {
				Blocks []struct {
					ID         string `json:"id"`
					DatasetRef string `json:"datasetRef"`
				} `json:"blocks"`
			}
			if err = json.Unmarshal(artifacts.ReportFill, &fill); err != nil {
				t.Fatal(err)
			}
			for _, block := range fill.Blocks {
				if (block.ID == "section" || block.ID == "group") && block.DatasetRef != "studyScope" {
					t.Fatalf("lost %s dataset: %s", block.ID, artifacts.ReportFill)
				}
			}
			var print struct {
				Pages []struct {
					Elements []struct {
						ID string `json:"id"`
					} `json:"elements"`
				} `json:"pages"`
			}
			if err = json.Unmarshal(artifacts.ReportPrint, &print); err != nil {
				t.Fatal(err)
			}
			ids := map[string]bool{}
			for _, page := range print.Pages {
				for _, element := range page.Elements {
					ids[element.ID] = true
				}
			}
			for _, id := range []string{"section__title_0", "metric__card"} {
				if ids[id] != (count == 1) {
					t.Fatalf("wrong count%d visibility for %s: %s", count, id, artifacts.ReportPrint)
				}
			}
		})
	}
}
