package types

import (
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
	"testing"
)

func TestLegacyStoredVariantNormalizesConsumerHashes(t *testing.T) {
	// This synthetic stored shape predates logical datasource references.
	raw := json.RawMessage(`{"window":{"view":{"content":{"id":"root"}}},"dataSources":{},"dataSourceResources":{"rows":{"resource":{"uri":"datasource://example/rows","revision":"1"},"contentFingerprint":"legacy-private-hash","providerIdentity":"provider"}}}`)
	var stored struct {
		Window      *Window                    `json:"window"`
		DataSources map[string]json.RawMessage `json:"dataSources"`
		References  map[string]json.RawMessage `json:"dataSourceResources"`
	}
	if err := json.Unmarshal(raw, &stored); err != nil {
		t.Fatal(err)
	}
	canonical, err := json.Marshal(stored)
	if err != nil {
		t.Fatal(err)
	}
	original := identity.ContentFingerprint(canonical)
	variant, err := NormalizeWindowReferenceVariant(raw, original)
	if err != nil {
		t.Fatal(err)
	}
	if variant.DataSourceResources["rows"].ContentFingerprint != "" {
		t.Fatal("legacy consumer hash retained")
	}
	if _, err = NormalizeWindowReferenceVariant(raw, identity.ContentFingerprint([]byte("forged"))); err == nil {
		t.Fatal("stored content integrity bypassed")
	}
}
