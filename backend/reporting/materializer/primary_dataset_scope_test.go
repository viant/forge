package materializer

import (
	"encoding/json"
	"testing"

	identity "github.com/viant/forge/backend/resource"
)

func TestPrimaryDatasetExclusionsThroughNativeBundle(t *testing.T) {
	// Independently authored synthetic selectors share one producer destination.
	for _, excluded := range [][]string{{"overviewTag", "detailTag"}, {"detailTag"}, {"overviewTag"}} {
		envelope := fingerprintEnvelope()
		builder := map[string]any{"id": "builder", "reportBuilder": map[string]any{
			"dataSourceRef": "rows", "measures": []any{map[string]any{"id": "input", "key": "input", "label": "Input", "default": true}},
			"predicates": []any{
				map[string]any{"id": "overviewTag", "kind": "value", "pinned": true, "multiple": true, "paramPath": "filters.tag", "default": []string{"alpha"}},
				map[string]any{"id": "detailTag", "kind": "value", "pinned": true, "multiple": true, "paramPath": "filters.tag", "default": []string{"beta"}},
			}, "scope": map[string]any{"mode": "exclude", "exclude": excluded},
			"request": map[string]any{"baseParameters": map[string]any{"filters": map[string]any{"account": 17}}},
		}}
		envelope.BuilderDefinition, _ = json.Marshal(builder)
		envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","id":"records","title":"Records","blocks":[{"id":"recordsTable","kind":"tableBlock","datasetRef":"primary","columns":[{"key":"input","label":"Input"}]}]}`)
		envelope.State = json.RawMessage(`{"selectedMeasures":["input"]}`)
		for i := range envelope.Dependencies {
			dep := &envelope.Dependencies[i]
			switch dep.Kind {
			case "builder":
				dep.ContentFingerprint = identity.ContentFingerprint(envelope.BuilderDefinition)
			case "report":
				dep.ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
			}
		}
		encoded, err := json.Marshal(envelope)
		if err != nil {
			t.Fatal(err)
		}
		spec, err := Lower(t.Context(), encoded)
		if err != nil {
			t.Fatal(err)
		}
		var decoded struct {
			Datasets []struct {
				ID      string
				Request struct{ Filters map[string]any }
			}
			Scope struct {
				Params []struct {
					ID    string
					Value any
				}
			}
		}
		if err = json.Unmarshal(spec, &decoded); err != nil {
			t.Fatal(err)
		}
		if len(decoded.Datasets) != 1 || decoded.Datasets[0].ID != "primary" {
			t.Fatalf("unexpected datasets: %s", spec)
		}
		filters := decoded.Datasets[0].Request.Filters
		if filters["account"] != float64(17) {
			t.Fatalf("fixed scope changed: %v", filters)
		}
		if len(excluded) == 2 {
			if _, present := filters["tag"]; present {
				t.Fatalf("excluded selector survived: %v", filters)
			}
		} else {
			want := "alpha"
			if excluded[0] == "overviewTag" {
				want = "beta"
			}
			selected, ok := filters["tag"].([]any)
			if !ok || len(selected) != 1 || selected[0] != want {
				t.Fatalf("wrong independent selector: %v", filters)
			}
		}
		if len(decoded.Scope.Params) != 2 {
			t.Fatalf("shared controls were removed: %s", spec)
		}
	}
}

func TestCapturedPrimaryDefaultsDoNotRestoreClearedAliases(t *testing.T) {
	for _, cleared := range []string{"[]", "null"} {
		envelope := fingerprintEnvelope()
		envelope.BuilderDefinition = json.RawMessage(`{"id":"builder","reportBuilder":{"dataSourceRef":"rows","measures":[{"id":"input","key":"input","label":"Input","default":true}],"predicates":[{"id":"overviewTag","kind":"value","pinned":true,"multiple":true,"paramPath":"filters.tag","default":["alpha"]},{"id":"detailTag","kind":"value","pinned":true,"multiple":true,"paramPath":"filters.tag","default":["beta"]}],"scope":{"mode":"exclude","exclude":["overviewTag","detailTag"]},"request":{"baseParameters":{"resultSet":"summary"}},"dataSources":[{"id":"overview","dataSourceRef":"rows","request":{"measures":{"input":true}},"columnOptions":[{"key":"input","label":"Input","kind":"measure"}],"scope":{"mode":"exclude","exclude":["detailTag"]},"scopeParamOptions":[{"id":"overviewTag","paramPath":"filters.tag"},{"id":"detailTag","paramPath":"filters.tag"}]},{"id":"detail","dataSourceRef":"rows","request":{"measures":{"input":true}},"columnOptions":[{"key":"input","label":"Input","kind":"measure"}],"scope":{"mode":"exclude","exclude":["overviewTag"]},"scopeParamOptions":[{"id":"overviewTag","paramPath":"filters.tag"},{"id":"detailTag","paramPath":"filters.tag"}]}]}}`)
		envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","id":"records","title":"Records","datasets":[{"id":"primary","dataSourceRef":"rows","request":{"measures":{"input":true},"filters":{"tag":["beta"]}}}],"blocks":[{"id":"primaryTable","kind":"tableBlock","datasetRef":"primary","columns":[{"key":"input","label":"Input"}]},{"id":"overviewTable","kind":"tableBlock","datasetRef":"overview","columns":[{"key":"input","label":"Input"}]},{"id":"detailTable","kind":"tableBlock","datasetRef":"detail","columns":[{"key":"input","label":"Input"}]}]}`)
		var authoredBuilder, authoredDocument map[string]any
		if err := json.Unmarshal(envelope.BuilderDefinition, &authoredBuilder); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(envelope.ReportDocument, &authoredDocument); err != nil {
			t.Fatal(err)
		}
		// The document dataset catalog is authoritative once explicitly present.
		authoredDocument["datasets"] = append(authoredDocument["datasets"].([]any), authoredBuilder["reportBuilder"].(map[string]any)["dataSources"].([]any)...)
		envelope.ReportDocument, _ = json.Marshal(authoredDocument)
		envelope.State = json.RawMessage(`{"selectedMeasures":["input"],"scopeParams":{"overviewTag":` + cleared + `,"detailTag":["gamma"]}}`)
		for i := range envelope.Dependencies {
			dep := &envelope.Dependencies[i]
			switch dep.Kind {
			case "builder":
				dep.ContentFingerprint = identity.ContentFingerprint(envelope.BuilderDefinition)
			case "report":
				dep.ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
			}
		}
		encoded, err := json.Marshal(envelope)
		if err != nil {
			t.Fatal(err)
		}
		spec, err := Lower(t.Context(), encoded)
		if err != nil {
			t.Fatal(err)
		}
		var decoded struct {
			Datasets []struct {
				ID      string
				Request struct{ Filters map[string]any }
			}
		}
		if err = json.Unmarshal(spec, &decoded); err != nil {
			t.Fatal(err)
		}
		if len(decoded.Datasets) != 3 {
			t.Fatalf("unexpected dataset count: %s", spec)
		}
		for _, dataset := range decoded.Datasets {
			if dataset.ID == "detail" {
				tag, ok := dataset.Request.Filters["tag"].([]any)
				if !ok || len(tag) != 1 || tag[0] != "gamma" {
					t.Fatalf("independent selection changed: %s", spec)
				}
			} else if _, present := dataset.Request.Filters["tag"]; present {
				t.Fatalf("stale or sibling selector restored for %s: %s", dataset.ID, spec)
			}
		}
	}
}
