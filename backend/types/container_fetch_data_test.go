package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"reflect"
	"testing"
)

func assertFetchPolicyJSON(t *testing.T, c Container, present, value bool) {
	t.Helper()
	data, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	var wire map[string]interface{}
	if err = json.Unmarshal(data, &wire); err != nil {
		t.Fatal(err)
	}
	actual, exists := wire["fetchData"]
	if exists != present || present && actual != value {
		t.Fatalf("fetchData presence/value = %v/%v, want %v/%v; %s", exists, actual, present, value, data)
	}
	var roundtrip Container
	if err = json.Unmarshal(data, &roundtrip); err != nil {
		t.Fatal(err)
	}
	again, err := json.Marshal(roundtrip)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != string(again) {
		t.Fatalf("JSON roundtrip changed policy: %s -> %s", data, again)
	}
}
func TestContainerFetchDataYAMLJSONPresenceRoundtrip(t *testing.T) {
	for _, test := range []struct {
		name, declaration string
		present, value    bool
	}{{"omitted", "", false, false}, {"false", "fetchData: false\n", true, false}, {"true", "fetchData: true\n", true, true}} {
		t.Run(test.name, func(t *testing.T) {
			var c Container
			if err := yaml.Unmarshal([]byte("id: row\ndataSourceRef: records\n"+test.declaration), &c); err != nil {
				t.Fatal(err)
			}
			assertFetchPolicyJSON(t, c, test.present, test.value)
			yamlBytes, err := yaml.Marshal(c)
			if err != nil {
				t.Fatal(err)
			}
			var yamlRoundtrip Container
			if err = yaml.Unmarshal(yamlBytes, &yamlRoundtrip); err != nil {
				t.Fatal(err)
			}
			assertFetchPolicyJSON(t, yamlRoundtrip, test.present, test.value)
		})
	}
	// Presence is reset when reusing a decode target, rather than leaking an old declaration.
	var c Container
	if err := json.Unmarshal([]byte(`{"id":"row","fetchData":false}`), &c); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(`{"id":"row"}`), &c); err != nil {
		t.Fatal(err)
	}
	assertFetchPolicyJSON(t, c, false, false)
	assertFetchPolicyJSON(t, Container{ID: "zero"}, false, false)
	eager := true
	assertFetchPolicyJSON(t, Container{ID: "eager", FetchData: &eager}, true, true)
	deferred := false
	c.FetchData = &deferred
	assertFetchPolicyJSON(t, c, true, false)
}
func TestContainerFetchDataPreservesNestedBindingsOverridesAndCompactDashboard(t *testing.T) {
	const source = `id: root
dataSourceRef: records
dataSourceRefSelector: mode
dataSourceRefs: {browse: records}
scope: form
dataField: caption
fetchData: false
targetOverrides:
  phone:
    fetchData: false
containers:
  - {id: passive, dataSourceRef: manual, fetchData: false}
  - {id: active, fetchData: true}
  - {id: omitted}
  - id: filters
    kind: dashboard.filters
    fetchData: false
    items:
      - id: period
        label: Period
        field: period
        options: [{label: Today, value: today, default: true}]
footer: {id: footer, fetchData: false}
`
	var c Container
	if err := yaml.Unmarshal([]byte(source), &c); err != nil {
		t.Fatal(err)
	}
	for _, format := range []string{"json", "yaml"} {
		t.Run(format, func(t *testing.T) {
			var raw []byte
			var err error
			var decoded Container
			if format == "json" {
				raw, err = json.Marshal(c)
				if err == nil {
					err = json.Unmarshal(raw, &decoded)
				}
			} else {
				raw, err = yaml.Marshal(c)
				if err == nil {
					err = yaml.Unmarshal(raw, &decoded)
				}
			}
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(decoded.Binding, c.Binding) {
				t.Fatalf("embedded Binding changed: %#v -> %#v", c.Binding, decoded.Binding)
			}
			assertFetchPolicyJSON(t, decoded, true, false)
			assertFetchPolicyJSON(t, decoded.Containers[0], true, false)
			assertFetchPolicyJSON(t, decoded.Containers[1], true, true)
			assertFetchPolicyJSON(t, decoded.Containers[2], false, false)
			assertFetchPolicyJSON(t, *decoded.Footer, true, false)
			if actual, ok := decoded.TargetOverrides["phone"]["fetchData"]; !ok || actual != false {
				t.Fatal("target override false was lost")
			}
			filters := decoded.Containers[3]
			if len(filters.Items) != 0 || filters.Dashboard == nil || filters.Dashboard.Filters == nil || len(filters.Dashboard.Filters.Items) != 1 || filters.Dashboard.Filters.Items[0].Field != "period" {
				t.Fatalf("compact dashboard normalization changed: %#v", filters)
			}
		})
	}
}
