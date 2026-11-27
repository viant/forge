// SPDX-License-Identifier: Apache-2.0
package datasource

import (
	"testing"

	dsproto "github.com/viant/forge/backend/datasource/contract"
)

func TestProjectResultLookupsPreservesUnadornedRows(t *testing.T) {
	input := []map[string]any{{"key": "known"}, {"key": "unknown"}}
	label := "Label"
	lookups := map[string]dsproto.ResultLookup{"label": {Field: "key", Values: map[string]*string{"known": &label}}}
	output := projectResultLookups(input, lookups)
	if output[0]["label"] != label || len(input[0]) != 1 || len(input[1]) != 1 {
		t.Fatalf("unexpected projection or source mutation: input=%#v output=%#v", input, output)
	}
	output[0]["key"] = "changed"
	if input[0]["key"] != "known" {
		t.Fatalf("changed output shared the source row: %#v", input[0])
	}
}
