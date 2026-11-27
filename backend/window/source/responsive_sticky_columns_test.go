package window

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestNativeCompiledWindowPreservesResponsiveStickyColumnPresence(t *testing.T) {
	manifest := WindowSourceManifest{
		Version: 1,
		Binding: ResourceBinding{WindowKey: "sample", URI: "window://example/sample"},
		Files: map[string]string{
			"extension/forge/windows/sample/main.yaml": `
windowKey: sample
view:
  content:
    id: results
    responsiveDataGrid:
      breakpoints:
        desktop: {columns: [id, name]}
        narrow: {stickyColumns: [id]}
        phone:
          stickyColumns: []
          columnOverrides:
            name: {width: 160, sticky: false}
    table:
      columns:
        - {id: id, name: ID, sticky: left}
        - {id: name, name: Name, sticky: left}
`,
		},
	}
	compiled, err := CompileWindowSource(context.Background(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	for _, platform := range []string{"web", "ios", "android"} {
		t.Run(platform, func(t *testing.T) {
			target := &types.WindowTarget{Platform: platform, FormFactor: "phone"}
			selected, err := types.SelectWindowResource(compiled, target)
			if err != nil {
				t.Fatal(err)
			}
			states := selected.Window.View.Content.ResponsiveDataGrid.Breakpoints
			if states["desktop"].StickyColumns != nil {
				t.Fatal("omission must inherit authored column stickiness")
			}
			if got := states["phone"].StickyColumns; got == nil || len(got) != 0 {
				t.Fatalf("explicit empty sticky columns were lost: %#v", got)
			}
			if got := states["narrow"].StickyColumns; len(got) != 1 || got[0] != "id" {
				t.Fatalf("explicit sticky column was lost: %#v", got)
			}
			if got := states["phone"].ColumnOverrides["name"]["sticky"]; got != false {
				t.Fatalf("explicit per-column override was lost: %#v", got)
			}
			wire, err := json.Marshal(states)
			if err != nil {
				t.Fatal(err)
			}
			var delivered map[string]map[string]json.RawMessage
			if err := json.Unmarshal(wire, &delivered); err != nil {
				t.Fatal(err)
			}
			if got := delivered["desktop"]["stickyColumns"]; got != nil {
				t.Fatalf("omitted override became %s", got)
			}
			if got := string(delivered["phone"]["stickyColumns"]); got != "[]" {
				t.Fatalf("consumer received %q for an empty override", got)
			}
			if got := string(delivered["narrow"]["stickyColumns"]); got != `["id"]` {
				t.Fatalf("consumer received %q for the explicit sticky column", got)
			}
		})
	}
}
