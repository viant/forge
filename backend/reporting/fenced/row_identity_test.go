package fenced

import (
	"encoding/json"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"testing"
)

func TestRowIdentitySurvivesAuthoredFencedGrammar(t *testing.T) {
	content := "```forge-report\n" + `{"version":1,"scope":"message","id":"identity","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Identity","blocks":[{"id":"evidence","kind":"tableBlock","datasetRef":"rows","columns":[{"key":"id","label":"ID","format":"id","rowIdentity":true},{"key":"label","label":"Entity label","rowIdentity":true},{"key":"value","label":"Value"}]}]}` + "\n```\n```forge-data\n" + `{"version":2,"scope":"message","id":"rows","reportRef":"identity","sequence":2,"format":"json","mode":"replace","data":[{"id":"0001","label":"Entity A","value":5}]}` + "\n```\n```forge-report\n" + `{"version":1,"scope":"message","id":"identity","sequence":3,"mode":"commit"}` + "\n```"
	out, err := Compile(&CompileRequest{Content: content, ReportID: "identity"})
	if err != nil {
		t.Fatal(err)
	}
	spec, err := reportspec.DecodeJSON(out.ReportSpec)
	if err != nil {
		t.Fatal(err)
	}
	fill, err := reportfill.DecodeJSON(out.ReportFill)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if !spec.Blocks[0].Columns[i].RowIdentity || !fill.Blocks[0].Content.Columns[i].RowIdentity {
			t.Fatal("authored grammar discarded composite identity")
		}
	}
	for _, v := range []any{spec, fill} {
		raw, err := json.Marshal(v)
		if err != nil {
			t.Fatal(err)
		}
		var data map[string]any
		if err = json.Unmarshal(raw, &data); err != nil {
			t.Fatal(err)
		}
	}
}
