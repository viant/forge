package types

import (
	"encoding/json"
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

func TestConfigurableLinkFields(t *testing.T) {
	var link TableLink
	if err := yaml.Unmarshal([]byte("kind: external\nkindSelector: CreativeLinkMode\nkindSource: windowForm\nbaseUrl: https://dsp.viantinc.com\nbaseUrlSelector: DspBaseUrl\nbaseUrlSource: windowForm\n"), &link); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(link)
	if err != nil {
		t.Fatal(err)
	}
	var result TableLink
	if err = json.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}
	if result.Kind != "external" || result.KindSelector != "CreativeLinkMode" || result.KindSource != "windowForm" || result.BaseURL != "https://dsp.viantinc.com" || result.BaseURLSelector != "DspBaseUrl" || result.BaseURLSource != "windowForm" {
		t.Fatalf("lost configurable link fields: %s", data)
	}
}

func TestLinkTemplateSourceSurvivesYAMLAndJSON(t *testing.T) {
	var link TableLink
	if err := yaml.Unmarshal([]byte("kind: external\nhrefTemplate: campaigns/{{id}}\nhrefTemplateSource: metrics\n"), &link); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(link)
	if err != nil {
		t.Fatal(err)
	}
	var roundTrip TableLink
	if err = json.Unmarshal(raw, &roundTrip); err != nil {
		t.Fatal(err)
	}
	if roundTrip.HrefTemplateSource != "metrics" || roundTrip.HrefTemplate != "campaigns/{{id}}" {
		t.Fatalf("lost scoped link template: %s", raw)
	}
}
