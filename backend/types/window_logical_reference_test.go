package types

import (
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"testing"
)

func TestMaterializeLogicalDatasourceWithoutConsumerFingerprint(t *testing.T) {
	manifest := WindowResourceVariant{Window: &Window{View: View{Content: &Container{ID: "root"}}, DataSource: map[string]DataSource{"rows": {}}}, DataSourceResources: map[string]primitive.DataSourceReference{"rows": {Resource: identity.ResourceRef{URI: "datasource://example/rows"}, ProviderIdentity: "provider"}}}
	raw := json.RawMessage(`{"schemaVersion":1,"dataSource":{"id":"source","backend":{"kind":"inline","rows":[]}}}`)
	result, err := MaterializeWindowReferences(manifest, map[string]json.RawMessage{"rows": raw})
	if err != nil {
		t.Fatal(err)
	}
	if !json.Valid(result.DataSources["rows"]) {
		t.Fatal("missing resolved descriptor")
	}
}
