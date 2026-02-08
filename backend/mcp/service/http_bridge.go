package service

import (
	"context"
	"encoding/json"
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
	handler.ServeHTTP(w, r)
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

func (b *httpRPCBridge) newHandler(_ context.Context, transport transport.Transport) transport.Handler {
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
	b.hub.unregisterHTTPClient(info.ns, info.clientID, info.notifier)
}

func (b *httpRPCBridge) bindSession(ctx context.Context, clientID, ns string, notifier transport.Notifier) {
	sessionID := sessionIDFromContext(ctx)
	if sessionID == "" || clientID == "" {
		return
	}
	b.mu.Lock()
	b.sessions[sessionID] = &httpSessionInfo{clientID: clientID, ns: ns, notifier: notifier}
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

func (h *uiRPCHandler) handle(ctx context.Context, method string, params json.RawMessage) (json.RawMessage, *jsonrpc.Error) {
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
		if h.bridge.hub.requireToken {
			if p.Token == "" || p.Token != h.bridge.hub.token {
				return nil, jsonrpc.NewInvalidParamsError("invalid token", nil)
			}
		}
		ns := "default"
		if p.Token != "" {
			ns = namespaceFromTokenString(normalizeBearer(p.Token), ns)
		}
		h.bridge.hub.registerHTTPClient(ns, p.ClientID)
		h.bridge.hub.RegisterHTTPNotifier(ns, p.ClientID, h.transport)
		h.bridge.bindSession(ctx, p.ClientID, ns, h.transport)
		return mustJSON(map[string]any{"ok": true, "clientId": p.ClientID}), nil
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
		timeout := 20 * time.Second
		if p.TimeoutMs > 0 {
			timeout = time.Duration(p.TimeoutMs) * time.Millisecond
		}
		waitCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		reqCmd, err := h.bridge.hub.dequeueCommand(waitCtx, ns, clientID)
		if err != nil || reqCmd == nil {
			return mustJSON(nil), nil
		}
		return mustJSON(reqCmd), nil
	case "ui.response":
		var p rpcResponse
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, jsonrpc.NewInvalidParamsError("invalid params", nil)
		}
		if p.ID == "" {
			return nil, jsonrpc.NewInvalidParamsError("id required", nil)
		}
		h.bridge.hub.deliverResponse(&p)
		return mustJSON(map[string]any{"ok": true}), nil
	default:
		return nil, jsonrpc.NewMethodNotFound("method not found", nil)
	}
}
