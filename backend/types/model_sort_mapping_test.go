package types

import (
	"encoding/json"
	"reflect"
	"testing"

	"gopkg.in/yaml.v2"
)

func TestDataSourceSortMappingYAMLAndJSONRoundTrip(t *testing.T) {
	var dataSource DataSource
	if err := yaml.Unmarshal([]byte(`
sortMode: server
sortMapping:
  parameter: OrderBy
  template: '{{field}}:{{direction}}'
  fields:
    campaignId: campaign_id
    advertiserName: advertiser_name
`), &dataSource); err != nil {
		t.Fatal(err)
	}
	want := &SortMapping{
		Parameter: "OrderBy",
		Template:  "{{field}}:{{direction}}",
		Fields: map[string]string{
			"campaignId":     "campaign_id",
			"advertiserName": "advertiser_name",
		},
	}
	if !reflect.DeepEqual(dataSource.SortMapping, want) {
		t.Fatalf("unexpected YAML sort mapping: %#v", dataSource.SortMapping)
	}
	raw, err := json.Marshal(dataSource)
	if err != nil {
		t.Fatal(err)
	}
	var roundTrip DataSource
	if err := json.Unmarshal(raw, &roundTrip); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(roundTrip.SortMapping, want) {
		t.Fatalf("unexpected JSON sort mapping: %#v", roundTrip.SortMapping)
	}
}
