package types

import (
	"testing"

	"gopkg.in/yaml.v2"
)

func TestExecuteYAMLAcceptsStructuredArguments(t *testing.T) {
	var actual Execute
	if err := yaml.Unmarshal([]byte(`
event: onClick
handler: window.openDialog
args:
  - advertiserPermissionDraft
  - awaitResult: false
`), &actual); err != nil {
		t.Fatalf("unmarshal execute: %v", err)
	}
	if len(actual.Arguments) != 2 || actual.Arguments[0] != "advertiserPermissionDraft" {
		t.Fatalf("unexpected arguments: %#v", actual.Arguments)
	}
	options, ok := actual.Arguments[1].(map[interface{}]interface{})
	if !ok || options["awaitResult"] != false {
		t.Fatalf("expected structured dialog options, got %#v", actual.Arguments[1])
	}
}
