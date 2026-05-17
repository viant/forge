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

func TestUIRPCHandler_PollWrapsSetFormDataCommandEnvelope(t *testing.T) {
	hub := NewHub(&Config{})
	bridge := &httpRPCBridge{hub: hub, sessions: map[string]*httpSessionInfo{}}
	handler := &uiRPCHandler{bridge: bridge}

	hub.enqueueCommand("default", "client-1", rpcRequest{
		ID:     "cmd-2",
		Method: "ui.window.setFormData",
		Params: map[string]interface{}{
			"windowId": "metricReportBuilder__conv-1",
			"values": map[string]interface{}{
				"prefill": map[string]interface{}{
					"advertiserId": 123,
					"dealId":       "deal-xyz",
				},
			},
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
	params, ok := decoded["params"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected params object, got %#v", decoded["params"])
	}
	if got := params["method"]; got != "ui.window.setFormData" {
		t.Fatalf("expected command method ui.window.setFormData, got %#v", got)
	}
	commandParams, ok := params["params"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected command params object, got %#v", params["params"])
	}
	values, ok := commandParams["values"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected values object, got %#v", commandParams["values"])
	}
	prefill, ok := values["prefill"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected prefill object, got %#v", values["prefill"])
	}
	if got := prefill["advertiserId"]; got != float64(123) {
		t.Fatalf("expected advertiserId 123, got %#v", got)
	}
	if got := prefill["dealId"]; got != "deal-xyz" {
		t.Fatalf("expected dealId deal-xyz, got %#v", got)
	}
}

func TestServiceUICommand_QueueRoundTripForSetFormData(t *testing.T) {
	svc := NewService(&Config{})

	resultCh := make(chan *UICommandOutput, 1)
	errCh := make(chan error, 1)
	go func() {
		out, err := svc.UICommand(context.Background(), &UICommandInput{
			ClientID: "client-1",
			Method:   "ui.window.setFormData",
			Params: map[string]interface{}{
				"windowId": "metricReportBuilder__conv-1",
				"values": map[string]interface{}{
					"prefill": map[string]interface{}{
						"advertiserId":  123,
						"dealId":        "deal-xyz",
						"targetingIncl": "iris:1466062,123",
					},
				},
			},
			TimeoutMs: 1000,
		})
		if err != nil {
			errCh <- err
			return
		}
		resultCh <- out
	}()

	req, err := svc.hub.dequeueCommand(context.Background(), "default", "client-1")
	if err != nil {
		t.Fatalf("dequeueCommand error: %v", err)
	}
	if req == nil {
		t.Fatalf("expected queued command")
	}
	if req.Method != "ui.window.setFormData" {
		t.Fatalf("expected ui.window.setFormData, got %q", req.Method)
	}
	params, ok := req.Params.(map[string]interface{})
	if !ok {
		t.Fatalf("expected params map, got %#v", req.Params)
	}
	values, ok := params["values"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected values map, got %#v", params["values"])
	}
	prefill, ok := values["prefill"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected prefill map, got %#v", values["prefill"])
	}
	if got := prefill["advertiserId"]; got != 123 {
		t.Fatalf("expected advertiserId 123, got %#v", got)
	}

	svc.hub.deliverResponse(&rpcResponse{
		ID:     req.ID,
		OK:     true,
		Result: mustJSON(map[string]interface{}{"ok": true}),
	})

	select {
	case err := <-errCh:
		t.Fatalf("UICommand error: %v", err)
	case out := <-resultCh:
		if !out.OK {
			t.Fatalf("expected OK output, got %#v", out)
		}
	}
}
