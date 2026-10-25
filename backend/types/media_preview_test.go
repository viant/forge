package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"reflect"
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
	if err = json.Unmarshal(raw, &actual); err != nil || !reflect.DeepEqual(actual, value) {
		t.Fatal("value contract changed")
	}
}

func TestFramePreviewSourceRoundtrip(t *testing.T) {
	value := MediaPreviewValue{Kind: "frame", URL: "https://example.test/render?id=42", Width: 350, Height: 280, Sources: []MediaPreviewSource{{Label: "HTTPS", URL: "https://example.test/render?id=42"}, {Label: "SOURCE", URL: "view-source:http://example.test/render?id=42"}}}
	raw, err := yaml.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var actual MediaPreviewValue
	if err := yaml.Unmarshal(raw, &actual); err != nil || !reflect.DeepEqual(actual, value) {
		t.Fatalf("frame source metadata lost: %s, %v", raw, err)
	}
}
