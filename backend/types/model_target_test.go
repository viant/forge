package types

import (
	"encoding/json"
	"reflect"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTargetSpecUnmarshalJSON(t *testing.T) {
	cases := []struct {
		name             string
		payload          string
		platforms        []string
		excludePlatforms []string
		formFactors      []string
		capabilities     []string
	}{
		{name: "string", payload: `"android"`, platforms: []string{"android"}},
		{name: "array", payload: `["android","ios"]`, platforms: []string{"android", "ios"}},
		{name: "object", payload: `{"platforms":["web"],"capabilities":["markdown"]}`, platforms: []string{"web"}, capabilities: []string{"markdown"}},
		{
			name:             "trims and compacts",
			payload:          `{"platforms":[" android ",""],"excludePlatforms":[" web "],"formFactors":[" phone "],"capabilities":[" lookup "," "]}`,
			platforms:        []string{"android"},
			excludePlatforms: []string{"web"},
			formFactors:      []string{"phone"},
			capabilities:     []string{"lookup"},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			var spec TargetSpec
			if err := json.Unmarshal([]byte(testCase.payload), &spec); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			assertStringSlice(t, "platforms", spec.Platforms, testCase.platforms)
			assertStringSlice(t, "excludePlatforms", spec.ExcludePlatforms, testCase.excludePlatforms)
			assertStringSlice(t, "formFactors", spec.FormFactors, testCase.formFactors)
			assertStringSlice(t, "capabilities", spec.Capabilities, testCase.capabilities)
		})
	}
}

func TestTargetSpecUnmarshalYAML(t *testing.T) {
	type yamlContainer struct {
		Target TargetSpec `yaml:"target"`
	}

	cases := []struct {
		name             string
		payload          string
		platforms        []string
		excludePlatforms []string
		formFactors      []string
		capabilities     []string
	}{
		{name: "string", payload: "target: android\n", platforms: []string{"android"}},
		{name: "array", payload: "target:\n  - android\n  - ios\n", platforms: []string{"android", "ios"}},
		{name: "object", payload: "target:\n  platforms: [web]\n  capabilities: [markdown]\n", platforms: []string{"web"}, capabilities: []string{"markdown"}},
		{
			name: "trims and compacts",
			payload: `target:
  platforms: [" android ", ""]
  excludePlatforms: [" web "]
  formFactors: [" phone "]
  capabilities: [" lookup ", " "]
`,
			platforms:        []string{"android"},
			excludePlatforms: []string{"web"},
			formFactors:      []string{"phone"},
			capabilities:     []string{"lookup"},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			var holder yamlContainer
			if err := yaml.Unmarshal([]byte(testCase.payload), &holder); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			assertStringSlice(t, "platforms", holder.Target.Platforms, testCase.platforms)
			assertStringSlice(t, "excludePlatforms", holder.Target.ExcludePlatforms, testCase.excludePlatforms)
			assertStringSlice(t, "formFactors", holder.Target.FormFactors, testCase.formFactors)
			assertStringSlice(t, "capabilities", holder.Target.Capabilities, testCase.capabilities)
		})
	}
}

func assertStringSlice(t *testing.T, label string, actual, expected []string) {
	t.Helper()
	if len(expected) == 0 {
		expected = nil
	}
	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("expected %s %#v, got %#v", label, expected, actual)
	}
}
