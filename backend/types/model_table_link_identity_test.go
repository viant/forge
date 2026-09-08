package types

import (
	"testing"

	"gopkg.in/yaml.v2"
)

func TestTableLinkPreservesIdentityParameters(t *testing.T) {
	var column Column
	err := yaml.Unmarshal([]byte(`
id: name
name: Order
type: link
link:
  kind: window
  windowKey: order
  identityParameters: [AdOrderId]
`), &column)
	if err != nil {
		t.Fatal(err)
	}
	if column.Link == nil || len(column.Link.IdentityParameters) != 1 || column.Link.IdentityParameters[0] != "AdOrderId" {
		t.Fatalf("identity parameters were not preserved: %#v", column.Link)
	}
}
