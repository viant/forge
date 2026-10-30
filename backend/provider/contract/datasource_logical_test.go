package primitive

import (
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
	"strings"
	"testing"
)

func TestLogicalDatasourceReference(t *testing.T) {
	ref := DataSourceReference{Resource: identity.ResourceRef{URI: "datasource://example/rows"}, ProviderIdentity: "provider"}
	if err := ref.Validate(false); err != nil {
		t.Fatalf("logical reference must resolve under server policy: %v", err)
	}
	ref.ContentFingerprint = "legacy-client-fingerprint"
	raw, err := json.Marshal(ref)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "Fingerprint") || strings.Contains(string(raw), "fingerprint") {
		t.Fatalf("consumer reference leaks private hash: %s", raw)
	}
}

func TestLogicalReferenceRetainsSourceIdentity(t *testing.T) {
	ref := DataSourceReference{Resource: identity.ResourceRef{URI: "datasource://example/rows"}, ProviderIdentity: "provider"}
	pin := identity.ResolvedResource{URI: ref.Resource.URI, ProviderIdentity: ref.ProviderIdentity}
	if !ref.MatchesResolved(pin) {
		t.Fatal("logical source did not match")
	}
	pin.ProviderIdentity = "other"
	if ref.MatchesResolved(pin) {
		t.Fatal("foreign provider accepted")
	}
	pin.ProviderIdentity = ref.ProviderIdentity
	pin.URI = "datasource://example/other"
	if ref.MatchesResolved(pin) {
		t.Fatal("foreign source accepted")
	}
}

func TestLegacyDatasourceReferenceReadIgnoresConsumerHash(t *testing.T) {
	var ref DataSourceReference
	decoder := json.NewDecoder(strings.NewReader(`{"resource":{"uri":"datasource://example/rows","revision":"working"},"providerIdentity":"provider","contentFingerprint":"obsolete"}`))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&ref); err != nil {
		t.Fatal(err)
	}
	if ref.ContentFingerprint != "" {
		t.Fatal("consumer hash retained")
	}
	if err := ref.Validate(false); err != nil {
		t.Fatal(err)
	}
}
