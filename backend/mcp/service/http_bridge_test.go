package service

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/viant/jsonrpc"
	"github.com/viant/jsonrpc/transport/server/base"
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
					"recordId": 123,
					"groupId":  778899,
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
	if got := prefill["recordId"]; got != float64(123) {
		t.Fatalf("expected recordId 123, got %#v", got)
	}
	if got := prefill["groupId"]; got != float64(778899) {
		t.Fatalf("expected groupId 778899, got %#v", got)
	}
}

func TestUIRPCHandler_UsesDefaultNamespaceWithoutExplicitBridgeToken(t *testing.T) {
	hub := NewHub(&Config{})
	bridge := &httpRPCBridge{hub: hub, sessions: map[string]*httpSessionInfo{}}
	handler := &uiRPCHandler{bridge: bridge}
	ctx := context.Background()

	_, jerr := handler.handle(ctx, "ui.hello", json.RawMessage(`{"clientId":"mobile-client"}`))
	if jerr != nil {
		t.Fatalf("ui.hello error: %v", jerr)
	}

	hub.enqueueCommand("default", "mobile-client", rpcRequest{
		ID:     "cmd-mobile",
		Method: "ui.window.open",
		Params: map[string]interface{}{
			"windowKey": "recordDetail",
		},
	})
	result, jerr := handler.handle(ctx, "ui.poll", json.RawMessage(`{"clientId":"mobile-client","timeoutMs":10}`))
	if jerr != nil {
		t.Fatalf("ui.poll error: %v", jerr)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(result, &decoded); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	params, ok := decoded["params"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected command params, got %#v", decoded["params"])
	}
	if got := params["id"]; got != "cmd-mobile" {
		t.Fatalf("expected command from default namespace, got %#v", got)
	}
}

func TestHTTPBridgeSessionCloseKeepsExplicitPollingClientSnapshot(t *testing.T) {
	hub := NewHub(&Config{})
	bridge := &httpRPCBridge{hub: hub, sessions: map[string]*httpSessionInfo{}}
	ctx := context.WithValue(context.Background(), jsonrpc.SessionKey, &base.Session{Id: "session-1"})
	handler := &uiRPCHandler{bridge: bridge}

	_, jerr := handler.handle(ctx, "ui.hello", json.RawMessage(`{"clientId":"mobile-client"}`))
	if jerr != nil {
		t.Fatalf("ui.hello error: %v", jerr)
	}
	_, jerr = handler.handle(
		context.Background(),
		"ui.snapshot",
		json.RawMessage(`{"clientId":"mobile-client","data":{"clientId":"mobile-client","windows":[]}}`),
	)
	if jerr != nil {
		t.Fatalf("ui.snapshot error: %v", jerr)
	}

	bridge.onSessionClose(&base.Session{Id: "session-1"})

	if got := hub.Snapshot("default", "mobile-client"); len(got) == 0 {
		t.Fatalf("expected explicit polling client snapshot to remain after request session close")
	}
}

func TestUIRPCHandlerSnapshotStatusDetectsMissingAndPublishedSnapshot(t *testing.T) {
	hub := NewHub(&Config{})
	bridge := &httpRPCBridge{hub: hub, sessions: map[string]*httpSessionInfo{}}
	handler := &uiRPCHandler{bridge: bridge}
	ctx := context.Background()

	if _, jerr := handler.handle(ctx, "ui.hello", json.RawMessage(`{"clientId":"status-client"}`)); jerr != nil {
		t.Fatalf("ui.hello error: %v", jerr)
	}
	assertStatus := func(expected bool) {
		t.Helper()
		result, jerr := handler.handle(ctx, "ui.snapshot.status", json.RawMessage(`{"clientId":"status-client"}`))
		if jerr != nil {
			t.Fatalf("ui.snapshot.status error: %v", jerr)
		}
		var decoded struct {
			Connected bool `json:"connected"`
		}
		if err := json.Unmarshal(result, &decoded); err != nil {
			t.Fatalf("decode snapshot status: %v", err)
		}
		if decoded.Connected != expected {
			t.Fatalf("expected connected=%v, got %v", expected, decoded.Connected)
		}
	}

	assertStatus(false)
	if _, jerr := handler.handle(ctx, "ui.snapshot", json.RawMessage(`{"clientId":"status-client","data":{"windows":[]}}`)); jerr != nil {
		t.Fatalf("ui.snapshot error: %v", jerr)
	}
	assertStatus(true)
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
						"recordId": 123,
						"groupId":  778899,
						"flags":    "alpha,beta",
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
	if got := prefill["recordId"]; got != 123 {
		t.Fatalf("expected recordId 123, got %#v", got)
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

func TestHubNextCommandIDIsUniqueForConcurrentCallsAtSameInstant(t *testing.T) {
	hub := NewHub(&Config{})
	now := time.Date(2026, time.July, 24, 2, 40, 3, 440000000, time.UTC)

	const count = 1000
	ids := make(chan string, count)
	var wg sync.WaitGroup
	wg.Add(count)
	for i := 0; i < count; i++ {
		go func() {
			defer wg.Done()
			ids <- hub.nextCommandID("default", "client-1", now)
		}()
	}
	wg.Wait()
	close(ids)

	seen := make(map[string]struct{}, count)
	for id := range ids {
		if _, ok := seen[id]; ok {
			t.Fatalf("duplicate command ID %q", id)
		}
		seen[id] = struct{}{}
	}
	if len(seen) != count {
		t.Fatalf("expected %d unique command IDs, got %d", count, len(seen))
	}
}
