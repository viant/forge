// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import (
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
	"testing"
)

func TestToolfeedIdentityAndDefinition(t *testing.T) {
	uri := "toolfeed://user-alice/tools/nested/terminal"
	parsed, err := identity.ParseResourceURI(uri)
	if err != nil || parsed.String() != uri || parsed.Name != "tools/nested/terminal" {
		t.Fatalf("identity: %+v %v", parsed, err)
	}
	for _, invalid := range []string{"toolfeed://alice/../terminal", "toolfeed://alice//terminal", "toolfeed://alice/terminal?x=1", "toolfeed://alice/a%2fb", "toolfeed://alice/a b"} {
		if _, err := identity.ParseResourceURI(invalid); err == nil {
			t.Errorf("accepted %q", invalid)
		}
	}
	if Plural(ToolfeedKind) != "toolfeeds" || Kind("toolfeeds") != ToolfeedKind || Methods(ToolfeedKind, []string{"get"})["get"] != "toolfeeds/get" {
		t.Fatal("method mapping")
	}
	listed, err := DecodeList([]byte(`{"toolfeeds":[{"uri":"`+uri+`"}],"complete":true}`), ToolfeedKind)
	if err != nil || len(listed.Resources) != 1 || listed.Resources[0].Kind != ToolfeedKind {
		t.Fatalf("list: %+v %v", listed, err)
	}
	def, err := DecodeToolfeedDefinition(1, json.RawMessage(`{"id":"legacy/terminal","match":{"service":"system/exec","method":"execute"},"ui":{"type":"custom"},"dataSource":{"output":{"source":"output"}}}`))
	if err != nil || def.ID != "legacy/terminal" {
		t.Fatalf("definition: %+v %v", def, err)
	}
	for _, raw := range []string{`{"id":"x","feedId":"x"}`, `{"id":"x","match":{"unknown":true}}`, `{"id":"x","dataSource":{"output":42}}`, `{"id":"x","ui":[]}`, `{"id":"x"} {}`, `null`, `{"id":" x "}`} {
		if _, err := DecodeToolfeedDefinition(1, json.RawMessage(raw)); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	if _, err := DecodeToolfeedDefinition(2, json.RawMessage(`{"id":"x"}`)); err == nil {
		t.Fatal("unknown format accepted")
	}
}
