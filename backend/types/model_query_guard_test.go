package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"strings"
	"testing"
)

func TestTableRetainsQueryDisabledWhen(t *testing.T) {
	var table Table
	if err := yaml.Unmarshal([]byte("queryDisabledWhen: {source: formStatus, field: dirty, equals: true}\ncolumns: []\n"), &table); err != nil {
		t.Fatal(err)
	}
	if table.QueryDisabledWhen["source"] != "formStatus" || table.QueryDisabledWhen["equals"] != true {
		t.Fatal("query condition lost")
	}
	encoded, err := json.Marshal(table)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(encoded), `"queryDisabledWhen":{"equals":true,"field":"dirty","source":"formStatus"}`) {
		t.Fatalf("condition not emitted: %s", encoded)
	}
}
