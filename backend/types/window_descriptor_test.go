package types

import (
	"bytes"
	"encoding/json"
	"strings"
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

func TestCanonicalWindowDescriptorMatchesNumericJSONEncoding(t *testing.T) {
	for _, source := range []string{
		`{}`, `{"values":[null,true,false,{},[],"<safe>&\u2028",-0.0,1e-300,18446744073709551615]}`,
		`{"nested":{"unicode":"\u0061","decimal":1.2300,"array":[{"z":2,"a":1}]}}`,
	} {
		decoder := json.NewDecoder(strings.NewReader(source))
		decoder.UseNumber()
		var reference map[string]interface{}
		if err := decoder.Decode(&reference); err != nil {
			t.Fatal(err)
		}
		expected, err := json.Marshal(reference)
		if err != nil {
			t.Fatal(err)
		}
		actual, err := CanonicalWindowDescriptor([]byte(source))
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(actual, expected) {
			t.Fatalf("canonical encoding changed: %s != %s", actual, expected)
		}
	}
	for _, source := range []string{`null`, `[]`, `true`, `{"a":null,"\u0061":1}`, `{"a":[1,]}`, `{"a":1}true`, strings.Repeat(`{"a":`, 130) + `0` + strings.Repeat(`}`, 130)} {
		if _, err := CanonicalWindowDescriptor([]byte(source)); err == nil {
			t.Fatalf("invalid descriptor accepted: %.100s", source)
		}
	}
}
