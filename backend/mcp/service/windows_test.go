package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestWindowListAndGetAreBoundToOneClientSnapshot(t *testing.T) {
	svc := NewService(&Config{})
	svc.Hub().registerHTTPClient("default", "client-a")
	svc.Hub().registerHTTPClient("default", "client-b")
	svc.Hub().setSnapshot("default", "client-a", json.RawMessage(`{"selected":{"windowId":"w2"},"windows":[{"windowId":"w1","windowKey":"forecast","windowTitle":"Forecast","inTab":true,"parameters":{"private":"only-in-get"}},{"windowId":"w2","windowKey":"report","windowTitle":"Report","isModal":true,"dataSources":{"rows":{"collection":[{"id":42}]}}}]}`))
	svc.Hub().setSnapshot("default", "client-b", json.RawMessage(`{"windows":[{"windowId":"b1","windowKey":"other"}]}`))
	ctx := context.Background()

	listed, err := svc.WindowList(ctx, &WindowListInput{ClientID: "client-a"})
	if err != nil || !listed.Connected || len(listed.Windows) != 2 || listed.Windows[0].WindowID != "w1" || listed.Windows[1].WindowID != "w2" || !listed.Windows[1].Selected {
		t.Fatalf("window list=%+v err=%v", listed, err)
	}
	encoded, err := json.Marshal(listed)
	if err != nil || strings.Contains(string(encoded), "only-in-get") || strings.Contains(string(encoded), "collection") {
		t.Fatalf("window list leaked data: %s err=%v", encoded, err)
	}
	window, err := svc.WindowGet(ctx, &WindowGetInput{ClientID: "client-a", WindowID: "w1"})
	if err != nil || window.ClientID != "client-a" || !strings.Contains(string(window.Window), "only-in-get") {
		t.Fatalf("window get=%+v err=%v", window, err)
	}
	if _, err := svc.WindowGet(ctx, &WindowGetInput{ClientID: "client-a", WindowID: "b1"}); err == nil {
		t.Fatal("window get crossed the selected client")
	}
	if _, err := svc.WindowGet(ctx, &WindowGetInput{ClientID: "client-a", WindowID: " w1"}); err == nil {
		t.Fatal("window get accepted noncanonical ID")
	}
}

func TestWindowListRejectsAmbiguousIDsAndDisconnectedClient(t *testing.T) {
	svc := NewService(&Config{})
	ctx := context.Background()
	listed, err := svc.WindowList(ctx, &WindowListInput{ClientID: "missing"})
	if err != nil || listed.Connected || len(listed.Windows) != 0 {
		t.Fatalf("disconnected list=%+v err=%v", listed, err)
	}
	if _, err := svc.WindowGet(ctx, &WindowGetInput{ClientID: "missing", WindowID: "w1"}); err == nil {
		t.Fatal("disconnected client returned a window")
	}
	svc.Hub().setSnapshot("default", "stale", json.RawMessage(`{"windows":[{"windowId":"stale-window"}]}`))
	listed, err = svc.WindowList(ctx, &WindowListInput{ClientID: "stale"})
	if err != nil || listed.Connected || len(listed.Windows) != 0 {
		t.Fatalf("stale snapshot was treated as a live client: %+v err=%v", listed, err)
	}
	if _, err := svc.WindowGet(ctx, &WindowGetInput{ClientID: "stale", WindowID: "stale-window"}); err == nil {
		t.Fatal("stale snapshot was retrievable")
	}
	svc.Hub().setSnapshot("default", "client-a", json.RawMessage(`{"windows":[{"windowId":"w1"},{"windowId":"w1"}]}`))
	svc.Hub().registerHTTPClient("default", "client-a")
	if _, err := svc.WindowList(ctx, &WindowListInput{ClientID: "client-a"}); err == nil {
		t.Fatal("duplicate window IDs were accepted")
	}
	if _, err := svc.WindowGet(ctx, &WindowGetInput{ClientID: "client-a", WindowID: "w1"}); err == nil {
		t.Fatal("ambiguous window lookup was accepted")
	}
}
