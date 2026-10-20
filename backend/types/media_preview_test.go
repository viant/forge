package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestMediaPreviewColumnAndValueRoundtrip(t *testing.T) {
	var c Column
	if err := yaml.Unmarshal([]byte("id: content\ntype: mediaPreview\npreview: {label: Preview, ariaLabel: Content preview, className: app-card, popoverClassName: app-popover}\n"), &c); err != nil {
		t.Fatal(err)
	}
	if c.Preview == nil || c.Preview.AriaLabel != "Content preview" {
		t.Fatalf("preview options lost: %+v", c)
	}
	raw, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	var decoded Column
	if err = json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Preview.PopoverClassName != "app-popover" || decoded.Type != "mediaPreview" {
		t.Fatal("column roundtrip changed preview")
	}
	value := MediaPreviewValue{Kind: "imageCard", URL: "https://example.test/image.png", Title: "Heading", Description: "Body", Caption: "Sponsor", Href: "https://example.test/landing", Identity: "42"}
	raw, err = json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var actual MediaPreviewValue
	if err = json.Unmarshal(raw, &actual); err != nil || actual != value {
		t.Fatal("value contract changed")
	}
}
