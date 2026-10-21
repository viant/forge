package service

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPBridgeNegotiatesLosslessSnapshotEncoding(t *testing.T) {
	service := NewService(&Config{Token: "local-test-token", RequireToken: true})
	server := httptest.NewServer(http.HandlerFunc(service.Hub().ServeHTTPRPC))
	defer server.Close()
	send := func(method, session, client string, data json.RawMessage, encoded bool) (map[string]any, string) {
		params := map[string]any{"clientId": client}
		if method == "ui.hello" {
			params["token"] = "local-test-token"
		}
		if data != nil {
			params["data"] = data
		}
		body, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
		var wire []byte = body
		if encoded {
			var buffer bytes.Buffer
			writer := gzip.NewWriter(&buffer)
			_, _ = writer.Write(body)
			_ = writer.Close()
			wire = buffer.Bytes()
		}
		request, _ := http.NewRequest("POST", server.URL, bytes.NewReader(wire))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Accept", "application/json, text/event-stream")
		if session != "" {
			request.Header.Set("Mcp-Session-Id", session)
		}
		if encoded {
			request.Header.Set("Content-Encoding", "gzip")
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		raw, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != 200 {
			t.Fatalf("transport status %d", response.StatusCode)
		}
		if strings.HasPrefix(string(raw), "event:") || strings.HasPrefix(string(raw), "data:") {
			for _, line := range strings.Split(string(raw), "\n") {
				if strings.HasPrefix(line, "data: ") {
					raw = []byte(strings.TrimPrefix(line, "data: "))
					break
				}
			}
		}
		var out map[string]any
		if err = json.Unmarshal(raw, &out); err != nil {
			t.Fatal("invalid RPC response", err)
		}
		return out, response.Header.Get("Mcp-Session-Id")
	}
	hello, session := send("ui.hello", "", "owner-client", nil, false)
	result, ok := hello["result"].(map[string]any)
	if !ok || session == "" {
		t.Fatal("hello unavailable")
	}
	capabilities, ok := result["capabilities"].(map[string]any)
	if !ok || capabilities["snapshotRequestEncodings"].([]any)[0] != "gzip" {
		t.Fatal("gzip not advertised")
	}
	snapshot := json.RawMessage(`{"conversationId":"owned-chat","selected":{"windowId":"editor"},"windows":[{"windowId":"editor","viewState":{"tabs":{"main":"properties"}},"dataSources":{"record":{"form":{"name":"日本語 café 👋"},"formStatus":{"dirty":true},"selection":{"selected":{"id":7}},"collection":[{"id":7}],"input":{"filter":{"status":"active"},"page":2}}}}]}`)
	for _, encoded := range []bool{false, true} {
		out, _ := send("ui.snapshot", session, "owner-client", snapshot, encoded)
		if out["error"] != nil {
			t.Fatal("owned snapshot rejected")
		}
		var want, got any
		_ = json.Unmarshal(snapshot, &want)
		_ = json.Unmarshal(service.Hub().Snapshot(namespaceFromTokenString("local-test-token", "default"), "owner-client"), &got)
		a, _ := json.Marshal(want)
		b, _ := json.Marshal(got)
		if !bytes.Equal(a, b) {
			t.Fatal("stored snapshot changed through transport")
		}
	}
	anonymous, _ := send("ui.snapshot", "", "unregistered-client", json.RawMessage(`{"windows":[]}`), true)
	if anonymous["error"] == nil {
		t.Fatal("compressed request bypassed negotiated session")
	}
	before := append([]byte(nil), service.Hub().Snapshot(namespaceFromTokenString("local-test-token", "default"), "owner-client")...)
	out, _ := send("ui.snapshot", session, "foreign-client", json.RawMessage(`{"windows":[]}`), true)
	if out["error"] == nil || !bytes.Equal(before, service.Hub().Snapshot(namespaceFromTokenString("local-test-token", "default"), "owner-client")) {
		t.Fatal("compressed request bypassed client owner fence")
	}
}
