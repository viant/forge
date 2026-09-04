package types

import (
	"testing"

	"gopkg.in/yaml.v3"
)

func TestColumnRetainsConditionalBadge(t *testing.T) {
	source := []byte(`
id: root
table:
  columns:
    - id: name
      name: Name
      sticky: left
      badge:
        label: Priority
        icon: endorsed
        field: planType
        equals: 2
        tone: accent
        visibleWhen: {source: authorization, field: principal.features, contains: FEATURE_PRIORITY}
`)
	container := &Container{}
	if err := yaml.Unmarshal(source, container); err != nil {
		t.Fatal(err)
	}
	badge := container.Table.Columns[0].Badge
	if container.Table.Columns[0].Sticky != "left" {
		t.Fatalf("sticky column position was not retained: %#v", container.Table.Columns[0])
	}
	if badge == nil || badge.Label != "Priority" || badge.Field != "planType" || badge.Equals != 2 || badge.Tone != "accent" {
		t.Fatalf("conditional badge was not retained: %#v", badge)
	}
	if badge.VisibleWhen["source"] != "authorization" {
		t.Fatalf("badge visibility rule was not retained: %#v", badge.VisibleWhen)
	}
}
