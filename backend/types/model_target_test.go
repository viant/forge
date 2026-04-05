package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTargetSpecUnmarshalJSON(t *testing.T) {
	cases := []struct {
		name      string
		payload   string
		platforms []string
	}{
		{name: "string", payload: `"android"`, platforms: []string{"android"}},
		{name: "array", payload: `["android","ios"]`, platforms: []string{"android", "ios"}},
		{name: "object", payload: `{"platforms":["web"],"capabilities":["markdown"]}`, platforms: []string{"web"}},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			var spec TargetSpec
			if err := json.Unmarshal([]byte(testCase.payload), &spec); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(spec.Platforms) != len(testCase.platforms) {
				t.Fatalf("expected %d platforms, got %d", len(testCase.platforms), len(spec.Platforms))
			}
			for index, expected := range testCase.platforms {
				if spec.Platforms[index] != expected {
					t.Fatalf("expected platform %q at index %d, got %q", expected, index, spec.Platforms[index])
				}
			}
		})
	}
}

func TestTargetSpecUnmarshalYAML(t *testing.T) {
	type yamlContainer struct {
		Target TargetSpec `yaml:"target"`
	}

	cases := []struct {
		name      string
		payload   string
		platforms []string
	}{
		{name: "string", payload: "target: android\n", platforms: []string{"android"}},
		{name: "array", payload: "target:\n  - android\n  - ios\n", platforms: []string{"android", "ios"}},
		{name: "object", payload: "target:\n  platforms: [web]\n  capabilities: [markdown]\n", platforms: []string{"web"}},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			var holder yamlContainer
			if err := yaml.Unmarshal([]byte(testCase.payload), &holder); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(holder.Target.Platforms) != len(testCase.platforms) {
				t.Fatalf("expected %d platforms, got %d", len(testCase.platforms), len(holder.Target.Platforms))
			}
			for index, expected := range testCase.platforms {
				if holder.Target.Platforms[index] != expected {
					t.Fatalf("expected platform %q at index %d, got %q", expected, index, holder.Target.Platforms[index])
				}
			}
		})
	}
}
