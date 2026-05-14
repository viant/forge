package service

import (
	"context"
	"encoding/json"
	"testing"
)

func TestUIRPCHandler_PollWrapsCommandEnvelope(t *testing.T) {
	hub := NewHub(&Config{})
	bridge := &httpRPCBridge{hub: hub, sessions: map[string]*httpSessionInfo{}}
	handler := &uiRPCHandler{bridge: bridge}

	hub.enqueueCommand("default", "client-1", rpcRequest{
		ID:     "cmd-1",
		Method: "ui.window.open",
		Params: map[string]interface{}{
			"windowKey": "orderPerformance",
		},
	})

	rawParams := json.RawMessage(`{"clientId":"client-1","timeoutMs":10}`)
	result, jerr := handler.handle(context.Background(), "ui.poll", rawParams)
	if jerr != nil {
		t.Fatalf("ui.poll error: %v", jerr)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(result, &decoded); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}

	if got := decoded["method"]; got != "ui.command" {
		t.Fatalf("expected wrapped ui.command envelope, got %#v", got)
	}
	params, ok := decoded["params"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected params object, got %#v", decoded["params"])
	}
	if got := params["id"]; got != "cmd-1" {
		t.Fatalf("expected command id cmd-1, got %#v", got)
	}
	if got := params["method"]; got != "ui.window.open" {
		t.Fatalf("expected command method ui.window.open, got %#v", got)
	}
}
