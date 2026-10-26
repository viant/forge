package materializer

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "testing"

    reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
    reportfill "github.com/viant/forge/backend/reporting/fill"
    "github.com/xuri/excelize/v2"
)

// Exercise the embedded official adapter and lowerer with the actual transport
// shape (one tabular frame), rather than substituting already-flat mock rows.
func TestWindowBuilderPrimaryTabularContractReachesXLSX(t *testing.T) {
    ctx := context.Background()
    prepared, err := PrepareWindowBuilder(ctx, WindowBuilderPreparation{
        Container: json.RawMessage(`{"id":"builder","dataSourceRef":"approved"}`),
        Config: json.RawMessage(`{"dataSourceRef":"approved","dimensions":[{"id":"region","key":"region","paramPath":"dimensions.region"}],"measures":[{"id":"count","key":"count","paramPath":"measures.count","default":true}],"dataSources":[{"id":"primary","dataSourceRef":"approved","resultContract":{"shape":"tabular","rowPath":"rows.0"}}],"result":{"defaultMode":"table"}}`),
        Selection: json.RawMessage(`{"version":1,"containerId":"builder","state":{"selectedDimensions":["region"],"selectedMeasures":["count"],"viewMode":"table","pageSize":50,"reportDocumentBlocks":[{"id":"evidence","kind":"tableBlock","datasetRef":"primary","columns":[{"key":"region"},{"key":"count"}]}]}}`),
        AttachedDataSourceIDs: []string{"approved"},
    })
    if err != nil { t.Fatal(err) }
    var spec struct { Datasets []struct { ID string `json:"id"`; ResultContract json.RawMessage `json:"resultContract"` } `json:"datasets"` }
    if err = json.Unmarshal(prepared.ReportSpec, &spec); err != nil { t.Fatal(err) }
    if len(spec.Datasets) != 1 || len(spec.Datasets[0].ResultContract) == 0 { t.Fatal("primary tabular contract lost before materialization") }
    rows := make([][]any, 32)
    for i := range rows { rows[i] = []any{fmt.Sprintf("local-%02d", i), i} }
    frame := map[string]any{"columns": []map[string]string{{"name":"region"},{"name":"count"}}, "rows":rows, "hasMore":false}
    payload, err := json.Marshal(map[string]any{"rows": []any{frame}, "dataInfo": frame})
    if err != nil { t.Fatal(err) }
    result, err := Materialize(ctx, prepared.ReportSpec, map[string]json.RawMessage{"primary":payload})
    if err != nil { t.Fatal(err) }
    fill, err := reportfill.DecodeJSON(result.ReportFill)
    if err != nil { t.Fatal(err) }
    if len(fill.Datasets) != 1 || len(fill.Datasets[0].Rows) != 32 { t.Fatal("native fill lost tabular rows") }
    // Select the authored evidence table, as the export host does.
    selected := *fill
    selected.Blocks = nil
    for _, block := range fill.Blocks { if block.ID == "evidence" { selected.Blocks = append(selected.Blocks, block) } }
    if len(selected.Blocks) != 1 || len(selected.Blocks[0].Content.ResolvedRows) != 32 { t.Fatal("native evidence table lost rows") }
    data, err := reportxlsx.Render(&selected)
    if err != nil { t.Fatal(err) }
    book, err := excelize.OpenReader(bytes.NewReader(data))
    if err != nil { t.Fatal(err) }
    defer book.Close()
    sheetRows, err := book.GetRows("Report")
    if err != nil { t.Fatal(err) }
    if len(sheetRows) != 33 || len(sheetRows[0]) != 2 { t.Fatalf("XLSX has %d rows, want header + 32",len(sheetRows)) }
    if sheetRows[1][0] != "local-00" || sheetRows[32][0] != "local-31" { t.Fatal("XLSX omitted first or last producer row") }
}
