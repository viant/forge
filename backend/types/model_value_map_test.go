package types

import (
	"testing"

	"gopkg.in/yaml.v3"
)

func TestValueMapsSurviveWindowMetadataDecode(t *testing.T) {
	var window Window
	if err := yaml.Unmarshal([]byte(`
view:
  content:
    id: root
    items:
      - id: status
        type: label
        valueMap: {'0': Inactive, '1': Active}
    table:
      columns:
        - id: media
          name: Media
          valueMap: {BANNER: Banner, AUDIO: Audio}
        - id: campaignIds
          name: Associated Campaigns
          format: relationCount
          singularLabel: Campaign
          pluralLabel: Campaigns
`), &window); err != nil {
		t.Fatal(err)
	}
	if got := window.View.Content.Items[0].ValueMap["1"]; got != "Active" {
		t.Fatalf("item valueMap lost: %#v", window.View.Content.Items[0].ValueMap)
	}
	if got := window.View.Content.Table.Columns[0].ValueMap["BANNER"]; got != "Banner" {
		t.Fatalf("column valueMap lost: %#v", window.View.Content.Table.Columns[0].ValueMap)
	}
	if got := window.View.Content.Table.Columns[1].SingularLabel; got != "Campaign" {
		t.Fatalf("column singularLabel lost: %q", got)
	}
	if got := window.View.Content.Table.Columns[1].PluralLabel; got != "Campaigns" {
		t.Fatalf("column pluralLabel lost: %q", got)
	}
}
