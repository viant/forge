package window

import (
	"context"
	"github.com/viant/forge/backend/types"
	"testing"
)

// This source is independently invented and contains only normalized metadata.
func TestCompileWindowRetainsFieldAttributes(t *testing.T) {
	manifest := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "attributes", URI: "window://example/attributes"}, Files: map[string]string{"extension/forge/windows/attributes/main.yaml": `windowKey: attributes
schemas:
  record:
    type: object
    properties:
      title:
        type: string
        validation:
          presenceOnly: true
          checks: [{name: required}, {name: le, parameters: ["64"]}]
      created:
        type: string
        timeFormat: {timeLayout: "2006-01-02", timeZone: UTC, nullable: true}
view:
  content: {id: root}
`}}
	raw, err := CompileWindowSource(context.Background(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := types.SelectWindowResource(raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	schema := selected.Window.Schemas["record"]
	if schema.Properties["title"].Validation == nil || !schema.Properties["title"].Validation.PresenceOnly || schema.Properties["title"].Validation.Checks[1].Parameters[0] != "64" {
		t.Fatal("field validation metadata lost")
	}
	if schema.Properties["created"].TimeFormat == nil || schema.Properties["created"].TimeFormat.TimeZone != "UTC" {
		t.Fatal("field format metadata lost")
	}
}
