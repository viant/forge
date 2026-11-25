// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestDataFallbackPresenceAndLegacyProjection(t *testing.T) {
	for _, primary := range []interface{}{nil, false, 0, []interface{}{}} {
		payload := map[string]interface{}{"primary": primary, "backup": []interface{}{map[string]interface{}{"value": "wrong"}}}
		if got := selectDataPath("primary", []string{"backup"}, payload); !reflect.DeepEqual(got, primary) {
			t.Fatal("present primary was replaced")
		}
	}
	rows := []map[string]interface{}{{"value": "legacy"}}
	for _, fallbacks := range [][]string{nil, {}} {
		got, _, _ := project(rows, &types.DataSource{Selectors: &types.Selectors{Data: "data", DataFallbacks: fallbacks}})
		if !reflect.DeepEqual(got, rows) {
			t.Fatal("legacy root-array projection changed")
		}
	}
}

func TestRootMetadataProjectionCopiesOnlySelectedFallbackPath(t *testing.T) {
	selectedRows := []interface{}{map[string]interface{}{"id": 7}}
	siblingRows := []interface{}{map[string]interface{}{"id": 8}}
	payload := map[string]interface{}{
		"pages": []interface{}{
			map[string]interface{}{"rows": selectedRows, "total": 1, "hasMore": false},
			map[string]interface{}{"rows": siblingRows, "total": 1},
		},
		"cursor": nil,
	}
	source := &types.DataSource{Selectors: &types.Selectors{
		Data: "missing.rows", DataFallbacks: []string{"pages[0].rows"}, DataInfo: ".",
	}}
	rows, metadata, _ := project(payload, source)
	wantRows := []map[string]interface{}{{"id": 7}}
	wantMetadata := map[string]interface{}{
		"pages": []interface{}{
			map[string]interface{}{"total": 1, "hasMore": false},
			map[string]interface{}{"rows": siblingRows, "total": 1},
		},
		"cursor": nil,
	}
	if !reflect.DeepEqual(rows, wantRows) || !reflect.DeepEqual(metadata, wantMetadata) {
		t.Fatalf("projected rows or metadata changed: rows=%#v metadata=%#v", rows, metadata)
	}
	sourcePage := payload["pages"].([]interface{})[0].(map[string]interface{})
	if !reflect.DeepEqual(sourcePage["rows"], selectedRows) {
		t.Fatal("projection removed the selected rows from the source payload")
	}
	metadata["pages"].([]interface{})[0].(map[string]interface{})["total"] = 9
	if sourcePage["total"] != 1 {
		t.Fatal("projection reused a map on the selected collection path")
	}

	source.Selectors.DataInfo = "pages[0]"
	_, metadata, _ = project(payload, source)
	if !reflect.DeepEqual(metadata, sourcePage) {
		t.Fatal("projection changed an explicitly selected metadata object")
	}
}

// The opt-in cross-runtime check executes Forge itself against the same JSON
// vectors as Core. Production builds do not depend on Node or checkout layout.
func TestCoreForgeDeclaredFallbackEquivalence(t *testing.T) {
	root := os.Getenv("FORGE_SELECTOR_EQUIVALENCE_ROOT")
	if root == "" {
		t.Skip("set FORGE_SELECTOR_EQUIVALENCE_ROOT to run cross-runtime integration")
	}
	raw, err := os.ReadFile(filepath.Join(root, "backend/types/testdata/data_selector_fallbacks.json"))
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name         string                   `json:"name"`
		Selectors    types.Selectors          `json:"selectors"`
		Payload      interface{}              `json:"payload"`
		ExpectedRows []map[string]interface{} `json:"expectedRows"`
	}
	if err = json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	script := `import {pathToFileURL} from 'node:url';
const {extractData}=await import(pathToFileURL(process.argv[1]));
let input=''; for await(const chunk of process.stdin) input+=chunk;
process.stdout.write(JSON.stringify(JSON.parse(input).map(c=>extractData(c.selectors,null,c.payload).records)));`
	command := exec.Command("node", "--input-type=module", "-e", script, filepath.Join(root, "src/components/dataSourceExtract.js"))
	command.Stdin = bytes.NewReader(raw)
	js, err := command.Output()
	if err != nil {
		t.Fatal("Forge extraction failed", err)
	}
	var forge [][]map[string]interface{}
	if err = json.Unmarshal(js, &forge); err != nil || len(forge) != len(cases) {
		t.Fatal("invalid Forge projection response", err)
	}
	for i, fixture := range cases {
		t.Run(fixture.Name, func(t *testing.T) {
			core, _, _ := project(fixture.Payload, &types.DataSource{Selectors: &fixture.Selectors})
			if len(core) == 0 {
				core = []map[string]interface{}{}
			}
			if !reflect.DeepEqual(core, fixture.ExpectedRows) || !reflect.DeepEqual(core, forge[i]) {
				t.Fatal("Core/Forge projection diverged from the declared selector contract")
			}
		})
	}
}
