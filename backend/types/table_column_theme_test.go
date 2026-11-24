package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestColumnRetainsThemeExclusion(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte(`
id: records
table:
  columns:
    - id: details
      name: Details
      width: 80
      hiddenInThemes: [design-system-2]
`), &container); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(container.Table.Columns[0])
	if err != nil {
		t.Fatal(err)
	}
	var column Column
	if err := json.Unmarshal(data, &column); err != nil {
		t.Fatal(err)
	}
	if len(column.HiddenInThemes) != 1 || column.HiddenInThemes[0] != "design-system-2" || column.Visible != nil || column.Width != 80 {
		t.Fatalf("theme exclusion or existing column metadata changed: %#v", column)
	}
}
