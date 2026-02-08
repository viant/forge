package service

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestPredicateMatch(t *testing.T) {
	p := &UIPredicate{
		All: []UICondition{
			{Path: "selected.windowId", Exists: boolPtr(true)},
			{Path: "selected.windowId", Equals: mustJSON(`"W1"`)},
		},
		Any: []UICondition{
			{Path: "windows.#.windowKey", Contains: "files"},
		},
	}
	cp, err := compilePredicate(p)
	if err != nil {
		t.Fatalf("compile: %v", err)
	}
	raw := json.RawMessage(`{"selected":{"windowId":"W1"},"windows":[{"windowKey":"files"}]}`)
	ok, _ := cp.match(raw)
	if !ok {
		t.Fatalf("expected match")
	}
}

func TestUIWaitChange(t *testing.T) {
	svc := NewService(&Config{RequireToken: false, LocalOnly: false})
	ns := "default"
	clientID := "c1"

	svc.hub.setSnapshot(ns, clientID, json.RawMessage(`{"ts":1}`))

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	done := make(chan *UIWaitOutput, 1)
	go func() {
		out, _ := svc.UIWait(ctx, &UIWaitInput{ClientID: clientID, TimeoutMs: 1500, WaitForChange: true, IncludeSnapshot: true})
		done <- out
	}()

	time.Sleep(50 * time.Millisecond)
	svc.hub.setSnapshot(ns, clientID, json.RawMessage(`{"ts":2}`))

	out := <-done
	if out == nil || !out.Matched || !out.Changed {
		t.Fatalf("expected changed match, got %#v", out)
	}
}

func boolPtr(v bool) *bool { return &v }

func mustJSON(s string) json.RawMessage {
	return json.RawMessage([]byte(s))
}
