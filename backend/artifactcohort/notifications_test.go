package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/jsonrpc"
)

func TestNotificationHandlerMarksExactPartitionAndSyncsOffReader(t *testing.T) {
	p, caller, replica, actor := replicaFixture(t)
	if replica.KnownHash() == "" {
		t.Fatal("fixture did not activate a complete catalog hash")
	}
	uri := "intent://sales/main"
	if _, _, err := p.Publish(actor, RootRef{URI: uri, Kind: "intent", Version: 2}, json.RawMessage(`{"intent":"changed"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	caller.mu.Lock()
	caller.blockURI = uri
	caller.entered = make(chan struct{}, 1)
	caller.release = make(chan struct{})
	entered, release := caller.entered, caller.release
	caller.mu.Unlock()
	var eventsMu sync.Mutex
	var notificationEvents []observe.Event
	ctx, cancel := context.WithCancel(observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) {
		if event.Phase == phaseNotificationReceived || event.Phase == phaseNotificationSync {
			eventsMu.Lock()
			notificationEvents = append(notificationEvents, event)
			eventsMu.Unlock()
		}
	})))
	defer cancel()
	handler := NewNotificationHandler(ctx, nil)
	defer handler.Close()
	if err := handler.AttachReplica(replica); err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		handler.OnNotification(actor, &jsonrpc.Notification{Jsonrpc: jsonrpc.Version, Method: NotificationUpdated, Params: json.RawMessage(`{"uri":"intent://sales/main"}`)})
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("notification callback blocked on MCP fetch")
	}
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("async sync did not fetch changed root")
	}
	if _, err := replica.Open(actor, uri); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("changed partition served before activation: %v", err)
	}
	for _, other := range []string{"window://sales/main", "intent://ops/main"} {
		if _, err := replica.Open(actor, other); err != nil {
			t.Fatalf("unrelated %s blocked: %v", other, err)
		}
	}
	close(release)
	deadline := time.Now().Add(time.Second)
	for {
		view, err := replica.Open(actor, uri)
		if err == nil && view.Ref().Version == 2 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("changed root was not activated: %v", err)
		}
		time.Sleep(time.Millisecond)
	}
	if caller.count("window://sales/main") != 1 || caller.count("intent://ops/main") != 1 {
		t.Fatal("notification refetched unrelated roots")
	}
	eventsMu.Lock()
	gotEvents := append([]observe.Event(nil), notificationEvents...)
	eventsMu.Unlock()
	if len(gotEvents) != 2 || gotEvents[0].Phase != phaseNotificationReceived || gotEvents[1].Phase != phaseNotificationSync || gotEvents[0].Outcome != observe.OK || gotEvents[1].Outcome != observe.OK {
		t.Fatalf("missing numeric push receive/sync events: %+v", gotEvents)
	}
	activatedHash := replica.KnownHash()
	handler.Close()
	if replica.KnownHash() != activatedHash {
		t.Fatal("disconnect erased conditional transport hash")
	}
	if _, err := replica.Open(actor, "window://sales/main"); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("disconnected transport served cached root: %v", err)
	}
}

func TestNotificationReconnectHintFencesOldCatalogBeforeAsyncSync(t *testing.T) {
	p, caller, replica, actor := replicaFixture(t)
	uri := "intent://sales/main"
	if _, _, err := p.Publish(actor, RootRef{URI: uri, Kind: "intent", Version: 2}, json.RawMessage(`{"intent":"changed"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	caller.mu.Lock()
	caller.blockURI = uri
	caller.entered = make(chan struct{}, 1)
	caller.release = make(chan struct{})
	entered, release := caller.entered, caller.release
	caller.mu.Unlock()
	handler := NewNotificationHandler(context.Background(), nil)
	defer handler.Close()
	if err := handler.AttachReplica(replica); err != nil {
		t.Fatal(err)
	}
	knownHash := replica.KnownHash()
	handler.ReconcileHint()
	if replica.KnownHash() != knownHash {
		t.Fatal("reconnect hint changed the validated conditional hash")
	}
	if _, err := replica.Open(actor, "window://sales/main"); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("old catalog remained readable before re-sync: %v", err)
	}
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("reconnect hint did not start authoritative sync")
	}
	close(release)
	deadline := time.Now().Add(time.Second)
	for {
		view, err := replica.Open(actor, uri)
		if err == nil && view.Ref().Version == 2 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("new catalog did not activate: %v", err)
		}
		time.Sleep(time.Millisecond)
	}
}
