package materializer

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"
	"testing"

	reportcsv "github.com/viant/forge/backend/reporting/export/csv"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportspec "github.com/viant/forge/backend/reporting/spec"
)

func TestRowIdentityNativeMaterializationAndExports(t *testing.T) {
	columns := []map[string]any{{"key": "campaign", "label": "Campaign", "format": "id", "rowIdentity": true}, {"key": "label", "label": "Entity label", "rowIdentity": true}}
	for i := 0; i < 10; i++ {
		columns = append(columns, map[string]any{"key": fmt.Sprintf("value%d", i), "label": fmt.Sprintf("Value %d", i)})
	}
	source := map[string]any{"version": 1, "kind": "reportSpec", "source": map[string]any{"kind": "dashboard.reportBuilder", "containerId": "identity", "stateKey": "identity", "dataSourceRef": "rows"}, "title": "Composite identity", "parameters": map[string]any{"viewMode": "table", "pageSize": 100, "orderDir": "asc", "orderField": "", "groupBy": ""}, "layoutIntent": map[string]any{"kind": "stack", "resultPanePosition": "bottom", "blockOrder": []string{"evidence"}}, "refinements": []any{}, "calculatedFields": []any{}, "datasets": []any{map[string]any{"id": "primary", "dataSourceRef": "rows", "request": map[string]any{"limit": 100, "offset": 0}}}, "blocks": []any{map[string]any{"id": "evidence", "kind": "tableBlock", "datasetRef": "primary", "columns": columns}}}
	raw, err := json.Marshal(source)
	if err != nil {
		t.Fatal(err)
	}
	typed, err := reportspec.DecodeJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if !typed.Blocks[0].Columns[i].RowIdentity {
			t.Fatal("identity lost decoding spec")
		}
	}
	roundtrip, err := json.Marshal(typed)
	if err != nil {
		t.Fatal(err)
	}
	typed, err = reportspec.DecodeJSON(roundtrip)
	if err != nil || !typed.Blocks[0].Columns[1].RowIdentity {
		t.Fatalf("spec roundtrip: %v", err)
	}
	ids := []any{0, "000123", "9007199254740993"}
	rows := make([]map[string]any, len(ids))
	for i, id := range ids {
		rows[i] = map[string]any{"campaign": id, "label": fmt.Sprintf("Entity %d", i)}
		for j := 0; j < 10; j++ {
			rows[i][fmt.Sprintf("value%d", j)] = fmt.Sprintf("Complete payload %d for row %d", j, i)
		}
	}
	payload, _ := json.Marshal(map[string]any{"rows": rows})
	out, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
	if err != nil {
		t.Fatal(err)
	}
	fill, err := reportfill.DecodeJSON(out.ReportFill)
	if err != nil {
		t.Fatal(err)
	}
	if !fill.Blocks[0].Content.Columns[0].RowIdentity || !fill.Blocks[0].Content.Columns[1].RowIdentity {
		t.Fatal("identity lost in native fill")
	}
	encodedFill, err := json.Marshal(fill)
	if err != nil {
		t.Fatal(err)
	}
	copy, err := reportfill.DecodeJSON(encodedFill)
	if err != nil {
		t.Fatal(err)
	}
	var print struct {
		Pages []struct {
			Elements []struct{ ID, Kind, RowKey, ColumnKey, Text string }
		}
	}
	if err = json.Unmarshal(out.ReportPrint, &print); err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	anchorCounts := map[string]int{}
	for _, p := range print.Pages {
		for _, e := range p.Elements {
			if e.Kind != "tableCellText" {
				continue
			}
			counts[e.ColumnKey]++
			if e.ColumnKey == "campaign" {
				anchorCounts[e.Text]++
			}
		}
	}
	if counts["campaign"] <= len(rows) || counts["campaign"] != counts["label"] {
		t.Fatalf("composite identities not repeated: %v", counts)
	}
	for _, id := range []string{"0", "000123", "9007199254740993"} {
		if anchorCounts[id] != counts["campaign"]/len(rows) {
			t.Fatalf("changed exact ID %q: %v", id, anchorCounts)
		}
	}
	for i := 0; i < 10; i++ {
		if counts[fmt.Sprintf("value%d", i)] != len(rows) {
			t.Fatalf("payload cell lost/duplicated: %v", counts)
		}
	}
	for i := range copy.Blocks[0].Content.Columns {
		copy.Blocks[0].Content.Columns[i].RowIdentity = false
	}
	csvWith, err := reportcsv.Render(fill)
	if err != nil {
		t.Fatal(err)
	}
	csvWithout, err := reportcsv.Render(copy)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(csvWith, csvWithout) {
		t.Fatal("identity metadata changed CSV")
	}
	xWith, err := reportxlsx.Render(fill)
	if err != nil {
		t.Fatal(err)
	}
	xWithout, err := reportxlsx.Render(copy)
	if err != nil {
		t.Fatal(err)
	}
	sheetParts := func(data []byte) map[string][]byte {
		r, e := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if e != nil {
			t.Fatal(e)
		}
		parts := map[string][]byte{}
		for _, f := range r.File {
			if f.Name == "xl/worksheets/sheet1.xml" || f.Name == "xl/styles.xml" {
				reader, e := f.Open()
				if e != nil {
					t.Fatal(e)
				}
				parts[f.Name], e = io.ReadAll(reader)
				reader.Close()
				if e != nil {
					t.Fatal(e)
				}
			}
		}
		if len(parts) != 2 {
			t.Fatal("missing XLSX worksheet/styles")
		}
		return parts
	}
	if !reflect.DeepEqual(sheetParts(xWith), sheetParts(xWithout)) {
		t.Fatal("identity metadata changed XLSX cells or number formats")
	}
	// Row references are print-only; ordinary data exports retain original columns.
	source["blocks"].([]any)[0].(map[string]any)["runtime"] = map[string]any{"printRowReference": true}
	referenceSpec, _ := json.Marshal(source)
	referenceOut, err := Materialize(context.Background(), referenceSpec, map[string]json.RawMessage{"primary": payload})
	if err != nil {
		t.Fatal(err)
	}
	referenceFill, err := reportfill.DecodeJSON(referenceOut.ReportFill)
	if err != nil {
		t.Fatal(err)
	}
	if len(referenceFill.Blocks[0].Content.Columns) != len(columns) {
		t.Fatal("generated column leaked into fill")
	}
	for _, row := range referenceFill.Blocks[0].Content.ResolvedRows {
		if len(row.Cells) != len(columns) {
			t.Fatal("generated cells leaked into fill")
		}
	}
	var referencePrint struct {
		Pages []struct {
			Elements []struct{ ID, Kind, RowKey, ColumnKey, Text string }
		}
	}
	if err = json.Unmarshal(referenceOut.ReportPrint, &referencePrint); err != nil {
		t.Fatal(err)
	}
	bandReferences := map[string]map[int]bool{}
	byRow := map[string]int{}
	for _, page := range referencePrint.Pages {
		for _, cell := range page.Elements {
			if cell.Kind != "tableCellText" || !strings.HasPrefix(cell.ColumnKey, "__forge_print_row_reference") {
				continue
			}
			ordinal, parseErr := strconv.Atoi(cell.Text)
			if parseErr != nil || ordinal < 1 || ordinal > len(rows) {
				t.Fatalf("invalid print-only reference %q", cell.Text)
			}
			if cell.RowKey != fmt.Sprintf("row_%d", ordinal) {
				t.Fatal("reference does not follow final row order")
			}
			byRow[cell.RowKey] = ordinal
			band := strings.Split(cell.ID, "__row_")[0]
			if bandReferences[band] == nil {
				bandReferences[band] = map[int]bool{}
			}
			if bandReferences[band][ordinal] {
				t.Fatal("reference repeated within a band")
			}
			bandReferences[band][ordinal] = true
		}
	}
	if len(bandReferences) < 2 {
		t.Fatal("fixture must exercise horizontal bands")
	}
	for _, refs := range bandReferences {
		if len(refs) != len(rows) {
			t.Fatal("reference numbering reset or dropped a row")
		}
	}
	for _, page := range referencePrint.Pages {
		for _, cell := range page.Elements {
			if cell.Kind != "tableCellText" {
				continue
			}
			ordinal := byRow[cell.RowKey]
			if ordinal == 0 {
				t.Fatal("cell has no matching print reference")
			}
			if cell.ColumnKey == "campaign" && cell.Text != fmt.Sprint(ids[ordinal-1]) {
				t.Fatal("reference changed precise business ID")
			}
			if cell.ColumnKey == "label" && cell.Text != fmt.Sprintf("Entity %d", ordinal-1) {
				t.Fatal("reference changed source identity")
			}
		}
	}
	referenceCSV, err := reportcsv.Render(referenceFill)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(csvWith, referenceCSV) {
		t.Fatal("print reference changed CSV columns or data")
	}
	referenceXLSX, err := reportxlsx.Render(referenceFill)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(sheetParts(xWith), sheetParts(referenceXLSX)) {
		t.Fatal("print reference changed XLSX cells or formats")
	}

}
