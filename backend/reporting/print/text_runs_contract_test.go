package reportprint

import (
	"encoding/json"
	"testing"
)

func TestTextRunsRejectNullStyle(t *testing.T) {
	var element Element
	if err := json.Unmarshal([]byte(`{"id":"text","kind":"text","box":{"x":0,"y":0,"width":100,"height":20},"text":"Hello","textRuns":[{"text":"Hello","fontWeight":null}]}`), &element); err == nil {
		t.Fatal("null run fontWeight accepted; JavaScript string contract rejects it")
	}
}

func TestTextRunsRejectSplitCRLF(t *testing.T) {
	var element Element
	if err := json.Unmarshal([]byte(`{"id":"text","kind":"text","box":{"x":0,"y":0,"width":100,"height":40},"text":"A\r\nB","textRuns":[{"text":"A\r"},{"text":"\nB"}]}`), &element); err == nil {
		t.Fatal("split CRLF must reject; canonical runs require normalized LF")
	}
}
