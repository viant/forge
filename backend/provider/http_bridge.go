// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"github.com/viant/forge/backend/httptransport"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/viant/jsonrpc"
	"github.com/viant/jsonrpc/transport"
	"github.com/viant/jsonrpc/transport/server/base"
	"github.com/viant/jsonrpc/transport/server/http/streamable"
)

type httpRPCBridge struct {
	hub      *Hub
	mu       sync.Mutex
	sessions map[string]*httpSessionInfo
}

type httpSessionInfo struct {
	clientID string
	ns       string
	notifier transport.Notifier
	receiver *client
}

type uiRPCHandler struct {
	bridge    *httpRPCBridge
	transport transport.Transport
}

// ServeHTTPRPC exposes a streamable HTTP JSON-RPC endpoint for UI clients.
// Methods: ui.hello, ui.snapshot, ui.poll, ui.response
func (h *Hub) ServeHTTPRPC(w http.ResponseWriter, r *http.Request) {
	if h.localOnly && !isLocalRequest(r) {
		http.Error(w, "forbidden: local connections only", http.StatusForbidden)
		return
	}
	handler := h.httpStreamable()
	httptransport.DecodeRequestEncoding(handler).ServeHTTP(w, r)
}

func (h *Hub) httpStreamable() http.Handler {
	h.httpMu.Lock()
	defer h.httpMu.Unlock()
	if h.httpHandler != nil {
		return h.httpHandler
	}
	bridge := &httpRPCBridge{hub: h, sessions: map[string]*httpSessionInfo{}}
	handler := streamable.New(
		bridge.newHandler,
		streamable.WithKeepAliveInterval(20*time.Second),
		streamable.WithOnSessionClose(bridge.onSessionClose),
	)
	h.httpBridge = bridge
	h.httpHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler.ServeHTTP(w, r)
	})
	return h.httpHandler
}

func (b *httpRPCBridge) newHandler(ctx context.Context, transport transport.Transport) transport.Handler {
	return &uiRPCHandler{bridge: b, transport: transport}
}

func (b *httpRPCBridge) onSessionClose(session *base.Session) {
	if session == nil {
		return
	}
	b.mu.Lock()
	info := b.sessions[session.Id]
	delete(b.sessions, session.Id)
	b.mu.Unlock()
	if info == nil {
		return
	}
	if b.hub.ns.Resolver != nil {
		b.hub.closeReceiver(info.receiver)
	}
	b.hub.unregisterHTTPClient(info.ns, info.clientID, info.notifier)
}

func (b *httpRPCBridge) bindSession(ctx context.Context, clientID, ns string, notifier transport.Notifier, receivers ...*client) {
	sessionID := sessionIDFromContext(ctx)
	if sessionID == "" || clientID == "" {
		return
	}
	b.mu.Lock()
	var receiver *client
	if len(receivers) > 0 {
		receiver = receivers[0]
	}
	b.sessions[sessionID] = &httpSessionInfo{clientID: clientID, ns: ns, notifier: notifier, receiver: receiver}
	b.mu.Unlock()
}

func (b *httpRPCBridge) sessionInfo(ctx context.Context) *httpSessionInfo {
	return b.sessionInfoByID(sessionIDFromContext(ctx))
}

func (b *httpRPCBridge) sessionInfoByID(sessionID string) *httpSessionInfo {
	if sessionID == "" {
		return nil
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.sessions[sessionID]
}

func sessionIDFromContext(ctx context.Context) string {
	session, _ := ctx.Value(jsonrpc.SessionKey).(*base.Session)
	if session == nil {
		return ""
	}
	return session.Id
}

func (h *uiRPCHandler) Serve(ctx context.Context, request *jsonrpc.Request, response *jsonrpc.Response) {
	result, jerr := h.handle(ctx, request.Method, request.Params)
	if jerr != nil {
		response.Error = jerr
		return
	}
	if result != nil {
		response.Result = result
	}
}

func (h *uiRPCHandler) OnNotification(ctx context.Context, notification *jsonrpc.Notification) {
	_, _ = h.handle(ctx, notification.Method, notification.Params)
}

func (h *uiRPCHandler) handle(ctx context.Context, method string, params json.RawMessage) (result json.RawMessage, jerr *jsonrpc.Error) {

	trustedNS := ""
	strict := h.bridge.hub.ns.Resolver != nil || h.bridge.hub.requireToken
	info := h.bridge.sessionInfo(ctx)
	if h.bridge.hub.ns.Resolver != nil {
		var err error
		identity, resolveErr := h.bridge.hub.ns.Identity(ctx)
		err = resolveErr
		trustedNS = identity.Namespace
		if err == nil {
			var cancel context.CancelFunc
			if identity.ValidUntil.IsZero() {
				cancel = func() {}
			} else {
				ctx, cancel = context.WithDeadline(ctx, identity.ValidUntil)
			}
			defer cancel()
			defer func() {
				if !namespaceIdentityLive(identity, time.Now()) || ctx.Err() != nil {
					result = nil
					jerr = jsonrpc.NewInvalidParamsError("UI identity unavailable", nil)
				}
			}()
		}
		if err != nil {
			return nil, jsonrpc.NewInvalidParamsError("UI identity unavailable", nil)
		}
		if info != nil && info.ns != trustedNS {
			return nil, jsonrpc.NewInvalidParamsError("UI session owner mismatch", nil)
		}
	}
	if strict && method != "ui.hello" {
		if info == nil {
			return nil, jsonrpc.NewInvalidParamsError("UI client session required", nil)
		}
		var claimed struct {
			ClientID string `json:"clientId"`
		}
		if json.Unmarshal(params, &claimed) != nil {
			return nil, jsonrpc.NewInvalidParamsError("invalid params", nil)
		}
		if claimed.ClientID != "" && claimed.ClientID != info.clientID {
			return nil, jsonrpc.NewInvalidParamsError("UI client owner mismatch", nil)
		}
	}
	switch method {
	case "ui.hello":
		var p struct {
			ClientID string `json:"clientId"`
			Token    string `json:"token,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, jsonrpc.NewInvalidParamsError("invalid params", nil)
		}
		if p.ClientID == "" {
			return nil, jsonrpc.NewInvalidParamsError("clientId required", nil)
		}
		if strict && info != nil && info.clientID != p.ClientID {
			return nil, jsonrpc.NewInvalidParamsError("UI client owner mismatch", nil)
		}
		if h.bridge.hub.requireToken {
			if p.Token == "" || p.Token != h.bridge.hub.token {
				return nil, jsonrpc.NewInvalidParamsError("invalid token", nil)
			}
		}
		ns := "default"
		if trustedNS != "" {
			ns = trustedNS
		} else if p.Token != "" {
			ns = namespaceFromTokenString(normalizeBearer(p.Token), ns)
		}
		var receiver *client
		if strict {
			receiver = h.bridge.hub.registerHTTPClient(ns, p.ClientID, ctx)
		} else {
			receiver = h.bridge.hub.registerHTTPClient(ns, p.ClientID)
		}
		if receiver == nil {
			return nil, jsonrpc.NewInvalidParamsError("UI identity unavailable", nil)
		}
		// HTTP bridge clients consume commands through explicit ui.poll
		// round-trips rather than transport notifications. Keep the
		// client/session registration, but do not bind a notifier here.
		h.bridge.bindSession(ctx, p.ClientID, ns, nil, receiver)
		return mustJSON(map[string]any{"ok": true, "clientId": p.ClientID, "capabilities": map[string]any{"snapshotRequestEncodings": []string{"gzip"}, "maxInflatedSnapshotBytes": httptransport.MaxInflatedRequestBytes}}), nil
	case "ui.snapshot":
		var p struct {
			ClientID string          `json:"clientId"`
			Data     json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, jsonrpc.NewInvalidParamsError("invalid params", nil)
		}
		info := h.bridge.sessionInfo(ctx)
		clientID := p.ClientID
		ns := "default"
		if info != nil {
			if clientID == "" {
				clientID = info.clientID
			}
			ns = info.ns
		}
		if clientID == "" {
			return nil, jsonrpc.NewInvalidParamsError("clientId required", nil)
		}
		if len(p.Data) == 0 {
			return nil, jsonrpc.NewInvalidParamsError("data required", nil)
		}
		h.bridge.hub.setSnapshot(ns, clientID, p.Data)
		return mustJSON(map[string]any{"ok": true}), nil
	case "ui.snapshot.get":
		var p struct {
			ClientID string `json:"clientId,omitempty"`
		}
		if len(params) > 0 {
			if err := json.Unmarshal(params, &p); err != nil {
				return nil, jsonrpc.NewInvalidParamsError("invalid params", nil)
			}
		}
		info := h.bridge.sessionInfo(ctx)
		clientID := p.ClientID
		ns := "default"
		if info != nil {
			if clientID == "" {
				clientID = info.clientID
			}
			ns = info.ns
		}
		if clientID == "" {
			return mustJSON(map[string]any{"clientId": "", "connected": false}), nil
		}
		snap := h.bridge.hub.Snapshot(ns, clientID)
		return mustJSON(map[string]any{
			"clientId":  clientID,
			"snapshot":  json.RawMessage(snap),
			"connected": len(snap) > 0,
		}), nil
	case "ui.snapshot.status":
		var p struct {
			ClientID string `json:"clientId,omitempty"`
		}
		if len(params) > 0 {
			if err := json.Unmarshal(params, &p); err != nil {
				return nil, jsonrpc.NewInvalidParamsError("invalid params", nil)
			}
		}
		info := h.bridge.sessionInfo(ctx)
		clientID := p.ClientID
		ns := "default"
		if info != nil {
			if clientID == "" {
				clientID = info.clientID
			}
			ns = info.ns
		}
		if clientID == "" {
			return mustJSON(map[string]any{"clientId": "", "connected": false}), nil
		}
		return mustJSON(map[string]any{
			"clientId":  clientID,
			"connected": len(h.bridge.hub.Snapshot(ns, clientID)) > 0,
		}), nil
	case "ui.poll":
		var p struct {
			ClientID  string `json:"clientId"`
			TimeoutMs int    `json:"timeoutMs,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, jsonrpc.NewInvalidParamsError("invalid params", nil)
		}
		info := h.bridge.sessionInfo(ctx)
		clientID := p.ClientID
		ns := "default"
		if info != nil {
			if clientID == "" {
				clientID = info.clientID
			}
			ns = info.ns
		}
		if clientID == "" {
			return nil, jsonrpc.NewInvalidParamsError("clientId required", nil)
		}
		h.bridge.hub.markPolled(ns, clientID)
		timeout := 20 * time.Second
		if p.TimeoutMs > 0 {
			timeout = time.Duration(p.TimeoutMs) * time.Millisecond
		}
		waitCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		reqCmd, err := h.bridge.hub.dequeueCommand(waitCtx, ns, clientID)
		for err == nil && reqCmd != nil && !h.bridge.hub.commandCurrent(ns, clientID, reqCmd.ID) {
			reqCmd, err = h.bridge.hub.dequeueCommand(waitCtx, ns, clientID)
		}
		if err != nil || reqCmd == nil {
			return mustJSON(nil), nil
		}
		if reqCmd.Method == "ui.window.open" {
			log.Printf("[forge-ui] poll deliver ns=%q client=%q cmd=%q method=%q params=%s", ns, clientID, reqCmd.ID, reqCmd.Method, string(mustJSON(reqCmd.Params)))
		} else {
			log.Printf("[forge-ui] poll deliver ns=%q client=%q cmd=%q method=%q", ns, clientID, reqCmd.ID, reqCmd.Method)
		}
		encoded := mustJSON(map[string]any{"id": reqCmd.ID, "method": "ui.command", "params": reqCmd})
		if !h.bridge.hub.commandCurrent(ns, clientID, reqCmd.ID) {
			return nil, jsonrpc.NewInvalidParamsError("UI command lease expired", nil)
		}
		return encoded, nil
	case "ui.response":
		var p rpcResponse
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, jsonrpc.NewInvalidParamsError("invalid params", nil)
		}
		if p.ID == "" {
			return nil, jsonrpc.NewInvalidParamsError("id required", nil)
		}
		if info != nil {
			if !h.bridge.hub.deliverOwnedResponse(info.ns, info.clientID, &p) {
				return nil, jsonrpc.NewInvalidParamsError("UI command owner mismatch", nil)
			}
		} else {
			h.bridge.hub.deliverResponse(&p)
		}
		return mustJSON(map[string]any{"ok": true}), nil
	default:
		return nil, jsonrpc.NewMethodNotFound("method not found", nil)
	}
}
