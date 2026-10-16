package window

import (
	"context"
	"encoding/json"
	"github.com/viant/forge/backend/types"
	"testing"
)

func TestNativeCompiledWindowPreservesExplicitFetchDataFalse(t *testing.T) {
	manifest := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "sample", URI: "window://example/sample"}, Files: map[string]string{
		"extension/forge/windows/sample/main.yaml":    "windowKey: sample\nresources: {dataSources: [records]}\nview:\n  content:\n    id: root\n    dataSourceRef: records\n    containers:\n      - $import(passive.yaml)\n      - {id: active, fetchData: true}\n      - {id: omitted}\n",
		"extension/forge/windows/sample/passive.yaml": "id: passive\ndataSourceRef: records\nfetchData: false\ntargetOverrides:\n  phone: {fetchData: false}\ncontainers:\n  - {id: nested, fetchData: false}\n",
		"extension/forge/datasources/records.yaml":    "id: records\nbackend: {kind: inline, rows: [{id: 1}]}\n",
	}}
	original, _ := json.Marshal(manifest)
	published, err := CompileWindowSource(context.Background(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := types.SelectWindowResource(published, &types.WindowTarget{Platform: "web", FormFactor: "desktop"})
	if err != nil {
		t.Fatal(err)
	}
	// Exercise the same typed re-serialization used when delivering a selected component.
	delivered, err := json.Marshal(selected.Window)
	if err != nil {
		t.Fatal(err)
	}
	var wire map[string]interface{}
	if err = json.Unmarshal(delivered, &wire); err != nil {
		t.Fatal(err)
	}
	content := wire["view"].(map[string]interface{})["content"].(map[string]interface{})
	children := content["containers"].([]interface{})
	passive := children[0].(map[string]interface{})
	if value, ok := passive["fetchData"]; !ok || value != false {
		t.Fatalf("published literal false lost: %s", delivered)
	}
	nested := passive["containers"].([]interface{})[0].(map[string]interface{})
	if value, ok := nested["fetchData"]; !ok || value != false {
		t.Fatal("nested literal false lost")
	}
	phone := passive["targetOverrides"].(map[string]interface{})["phone"].(map[string]interface{})
	if value, ok := phone["fetchData"]; !ok || value != false {
		t.Fatal("target override literal false lost")
	}
	if children[1].(map[string]interface{})["fetchData"] != true {
		t.Fatal("explicit true lost")
	}
	if _, ok := children[2].(map[string]interface{})["fetchData"]; ok {
		t.Fatal("omitted policy invented")
	}
	after, _ := json.Marshal(manifest)
	if string(after) != string(original) {
		t.Fatal("native compilation changed retained authored YAML")
	}
}
