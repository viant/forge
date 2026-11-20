package types

import (
 "encoding/json"
 "testing"
 "gopkg.in/yaml.v3"
)
func TestTableThemeOverridesRoundTrip(t *testing.T) {
 source:=[]byte("presentation: list-page\ncolumns:\n- id: name\n  type: link\ntargetOverrides:\n  theme:design-system-2:\n    columns:\n    - id: name\n      type: editableText\n      cellProperties: {required: true}\n")
 var table Table
 if err:=yaml.Unmarshal(source,&table);err!=nil {t.Fatal(err)}
 payload,err:=json.Marshal(table);if err!=nil {t.Fatal(err)}
 var restored Table;if err=json.Unmarshal(payload,&restored);err!=nil {t.Fatal(err)}
 if restored.Columns[0].Type!="link" {t.Fatal("base column changed")}
 columns,ok:=restored.TargetOverrides["theme:design-system-2"]["columns"].([]interface{});if !ok||len(columns)!=1 {t.Fatal("theme columns lost")}
 if columns[0].(map[string]interface{})["type"]!="editableText" {t.Fatal("theme column override lost")}
}
