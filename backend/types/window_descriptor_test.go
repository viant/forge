package types

import (
	"encoding/json"
	"testing"
)

func TestCanonicalWindowDescriptorRejectsRecursiveDuplicateKeys(t *testing.T) {
	for _, raw := range []string{`{"id":"x","id":"other"}`, `{"id":"x","backend":{"kind":"inline","kind":"systemexec"}}`, `{"id":"x","backend":{"rows":[{"scope":"own","scope":"foreign"}]}}`, `{"id":"x"} {"id":"next"}`} {
		if _, err := CanonicalWindowDescriptor(json.RawMessage(raw)); err == nil {
			t.Fatal("ambiguous descriptor accepted")
		}
	}
	a, err := CanonicalWindowDescriptor(json.RawMessage(`{"id":"x","backend":{"rows":[{"count":18446744073709551615,"value":"safe"}],"kind":"inline"}}`))
	if err != nil {
		t.Fatal(err)
	}
	b, err := CanonicalWindowDescriptor(json.RawMessage(`{"backend":{"kind":"inline","rows":[{"value":"safe","count":18446744073709551615}]},"id":"x"}`))
	if err != nil || string(a) != string(b) {
		t.Fatal("map ordering or precision changed canonical descriptor")
	}
}
