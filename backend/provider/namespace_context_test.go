// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"github.com/gorilla/websocket"
	"github.com/viant/forge/backend/requestctx"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type cachedNamespaceFacts struct{}

func TestNamespaceReceiverDropsDecisionScopesAndClosesLifecycle(t *testing.T) {
	svc := NewService(&Config{})
	svc.ConfigureNamespaceResolver(func(context.Context) (NamespaceIdentity, error) {
		return NamespaceIdentity{Namespace: "owned", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, cachedNamespaceFacts{}, false)
	})
	marked, finish := requestctx.WithWindowReadDecision(context.WithValue(context.Background(), cachedNamespaceFacts{}, true))
	defer finish()
	receiver := svc.Hub().registerHTTPClient("owned", "client", marked)
	if receiver == nil || requestctx.WindowReadDecisionActive(receiver.ctx) || receiver.ctx.Value(cachedNamespaceFacts{}) != false {
		t.Fatal("receiver retained decision snapshot")
	}
	svc.Hub().closeReceiver(receiver)
	if receiver.ctx.Err() == nil || len(svc.Hub().ListClients("owned")) != 0 {
		t.Fatal("receiver lifecycle retained context or registration")
	}
}
func TestNamespaceResolverFailureNeverFallsBack(t *testing.T) {
	svc := NewService(&Config{NamespaceResolver: func(context.Context) (NamespaceIdentity, error) { return NamespaceIdentity{}, nil }})
	if ns, err := svc.ns.Namespace(context.Background()); err == nil || ns != "" {
		t.Fatal("configured namespace fell back")
	}
}
func TestSlowReceiverVerificationHonorsOriginalCallDeadline(t *testing.T) {
	type receiverCredential struct{}
	svc := NewService(&Config{NamespaceResolver: func(ctx context.Context) (NamespaceIdentity, error) {
		if ctx.Value(receiverCredential{}) == true {
			<-ctx.Done()
			return NamespaceIdentity{}, ctx.Err()
		}
		return NamespaceIdentity{Namespace: "owned", ValidUntil: time.Now().Add(time.Minute)}, nil
	}})
	svc.Hub().registerHTTPClient("owned", "client", context.WithValue(context.Background(), receiverCredential{}, true))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	started := time.Now()
	if _, err := svc.Hub().Call(ctx, "owned", "client", "ui.window.setTitle", nil); err == nil {
		t.Fatal("expired caller delivered frame")
	}
	if time.Since(started) > time.Second {
		t.Fatal("receiver verification ignored caller deadline")
	}
}
func TestReceiverLeaseExpiresWhileAwaitingWriteMutex(t *testing.T) {
	type receiverKey struct{}
	armed := atomic.Bool{}
	verified := make(chan struct{})
	var once sync.Once
	svc := NewService(&Config{NamespaceResolver: func(ctx context.Context) (NamespaceIdentity, error) {
		until := time.Now().Add(time.Minute)
		if armed.Load() && ctx.Value(receiverKey{}) == true {
			until = time.Now().Add(20 * time.Millisecond)
			once.Do(func() { close(verified) })
		}
		return NamespaceIdentity{Namespace: "owned", ValidUntil: until}, nil
	}})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		svc.Hub().ServeWS(w, r.WithContext(context.WithValue(r.Context(), receiverKey{}, true)))
	}))
	defer server.Close()
	socket, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer socket.Close()
	if err := socket.WriteJSON(map[string]any{"type": "ui.hello", "clientId": "client"}); err != nil {
		t.Fatal(err)
	}
	var receiver *client
	for deadline := time.Now().Add(time.Second); receiver == nil && time.Now().Before(deadline); {
		svc.Hub().mu.RLock()
		receiver = svc.Hub().clients["owned"]["client"]
		svc.Hub().mu.RUnlock()
		if receiver == nil {
			time.Sleep(time.Millisecond)
		}
	}
	if receiver == nil {
		t.Fatal("receiver absent")
	}
	receiver.mu.Lock()
	armed.Store(true)
	done := make(chan error, 1)
	go func() {
		_, err := svc.Hub().Call(context.Background(), "owned", "client", "ui.window.setTitle", nil)
		done <- err
	}()
	<-verified
	time.Sleep(40 * time.Millisecond)
	receiver.mu.Unlock()
	if err := <-done; err == nil {
		t.Fatal("expired receiver lease emitted frame")
	}
	socket.SetReadDeadline(time.Now().Add(time.Second))
	if _, _, err := socket.ReadMessage(); err == nil {
		t.Fatal("expired receiver frame was visible")
	}
}
func TestOriginalHandshakeLeaseExpiredBeforeUpgradeDoesNotRefresh(t *testing.T) {
	svc := NewService(&Config{})
	svc.ConfigureNamespaceResolver(func(context.Context) (NamespaceIdentity, error) {
		return NamespaceIdentity{Namespace: "owned", ValidUntil: time.Now().Add(10 * time.Millisecond)}, nil
	}, func(ctx context.Context) context.Context { time.Sleep(25 * time.Millisecond); return ctx })
	server := httptest.NewServer(http.HandlerFunc(svc.Hub().ServeWS))
	defer server.Close()
	socket, response, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if socket != nil {
		socket.Close()
	}
	if err == nil || response == nil || response.StatusCode != 403 {
		t.Fatal("expired original handshake identity upgraded")
	}
}
