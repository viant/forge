package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestDataStateBoundaryIdleConditionSurvivesNativeMetadata(t *testing.T) {
	var spec DataStateBoundarySpec
	if err := yaml.Unmarshal([]byte("dataSourceRefs: [records, optional_details]\nignoreIdleWhen: {source: windowForm, field: aggregateReady, equals: true}\nrenderEmptyContent: true\n"), &spec); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	var output map[string]interface{}
	if err = json.Unmarshal(encoded, &output); err != nil {
		t.Fatal(err)
	}
	condition, ok := output["ignoreIdleWhen"].(map[string]interface{})
	if !ok || condition["source"] != "windowForm" || condition["field"] != "aggregateReady" || condition["equals"] != true {
		t.Fatalf("native metadata lost idle dependency condition: %s", encoded)
	}
}
