package handlers

import (
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestTargetContextFromRequest_NormalizesRepeatedAndCommaCapabilities(t *testing.T) {
	request := httptest.NewRequest("GET", "/meta/order?platform=ios&formFactor=tablet&surface=app&capabilities=lookup,markdown&capabilities=voice&capabilities=%20chart%20,%20", nil)

	target := targetContextFromRequest(request)
	if target == nil {
		t.Fatalf("expected target context")
	}
	if target.Platform != "ios" || target.FormFactor != "tablet" || target.Surface != "app" {
		t.Fatalf("unexpected target context: %#v", target)
	}
	expectedCapabilities := []string{"lookup", "markdown", "voice", "chart"}
	if !reflect.DeepEqual(target.Capabilities, expectedCapabilities) {
		t.Fatalf("expected capabilities %v, got %v", expectedCapabilities, target.Capabilities)
	}
}
