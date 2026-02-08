package service

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/viant/jsonrpc"
	"github.com/viant/jsonrpc/transport"
)

type Hub struct {
	token        string
	requireToken bool
	localOnly    bool
	origins      map[string]bool
	ns           *NamespaceService

	mu        sync.RWMutex
	clients   map[string]map[string]*client // ns -> clientId -> client
	snapshots map[string]map[string]json.RawMessage
	watchers  map[string]map[string]map[chan json.RawMessage]struct{} // ns -> clientId -> set(ch)
	queues    map[string]map[string]*commandQueue
	notifiers map[string]map[string]transport.Notifier

	httpMu      sync.Mutex
	httpHandler http.Handler
	httpBridge  *httpRPCBridge

	pendingMu sync.Mutex
	pending   map[string]chan *rpcResponse

	upgrader websocket.Upgrader
}

type client struct {
	id string
	ns string
	ws *websocket.Conn
	mu sync.Mutex // serialize writes
}

type helloMsg struct {
	Type     string `json:"type"`
	ClientID string `json:"clientId"`
	Token    string `json:"token,omitempty"`
}

type snapshotMsg struct {
	Type     string          `json:"type"`
	ClientID string          `json:"clientId"`
	Data     json.RawMessage `json:"data"`
}

type rpcResponse struct {
	ID     string          `json:"id,omitempty"`
	OK     bool            `json:"ok"`
	Error  string          `json:"error,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
}

type rpcRequest struct {
	ID     string      `json:"id"`
	Method string      `json:"method"`
	Params interface{} `json:"params,omitempty"`
}

type commandQueue struct {
	items   []rpcRequest
	waiters []chan rpcRequest
}

func NewHub(cfg *Config) *Hub {
	if cfg == nil {
		cfg = &Config{}
	}
	origins := map[string]bool{}
	for _, o := range cfg.AllowedOrigins {
		if strings.TrimSpace(o) != "" {
			origins[strings.TrimSpace(o)] = true
		}
	}
	return &Hub{
		token:        cfg.Token,
		requireToken: cfg.RequireToken,
		localOnly:    cfg.LocalOnly,
		origins:      origins,
		ns:           NewNamespaceService(),
		clients:      map[string]map[string]*client{},
		snapshots:    map[string]map[string]json.RawMessage{},
		watchers:     map[string]map[string]map[chan json.RawMessage]struct{}{},
		queues:       map[string]map[string]*commandQueue{},
		notifiers:    map[string]map[string]transport.Notifier{},
		pending:      map[string]chan *rpcResponse{},
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return checkOrigin(origins, r)
			},
		},
	}
}

func (h *Hub) setSnapshot(ns, clientID string, data json.RawMessage) {
	if ns == "" {
		ns = "default"
	}
	if clientID == "" || len(data) == 0 {
		return
	}
	h.mu.Lock()
	if h.snapshots[ns] == nil {
		h.snapshots[ns] = map[string]json.RawMessage{}
	}
	h.snapshots[ns][clientID] = data

	if h.watchers[ns] != nil && h.watchers[ns][clientID] != nil {
		for ch := range h.watchers[ns][clientID] {
			select {
			case ch <- data:
			default:
			}
		}
	}
	h.mu.Unlock()
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	if h.localOnly {
		if !isLocalRequest(r) {
			http.Error(w, "forbidden: local connections only", http.StatusForbidden)
			return
		}
	}
	ws, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ns := "default"
	if h.ns != nil {
		ns = h.ns.NamespaceFromRequest(r)
	}
	c := &client{ws: ws, ns: ns}
	go h.readLoop(c)
}

func (h *Hub) readLoop(c *client) {
	defer func() {
		if c.ws != nil {
			_ = c.ws.Close()
		}
		if c.id != "" {
			h.mu.Lock()
			if h.clients[c.ns] != nil {
				delete(h.clients[c.ns], c.id)
			}
			if h.snapshots[c.ns] != nil {
				delete(h.snapshots[c.ns], c.id)
			}
			h.mu.Unlock()
		}
	}()

	for {
		_, data, err := c.ws.ReadMessage()
		if err != nil {
			return
		}
		var envelope map[string]json.RawMessage
		if err := json.Unmarshal(data, &envelope); err != nil {
			continue
		}

		var msgType string
		if raw, ok := envelope["type"]; ok {
			_ = json.Unmarshal(raw, &msgType)
		}

		switch msgType {
		case "ui.hello":
			var hello helloMsg
			if err := json.Unmarshal(data, &hello); err != nil {
				continue
			}
			if hello.ClientID == "" {
				continue
			}
			if h.requireToken {
				if strings.TrimSpace(h.token) == "" {
					_ = c.ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "server token required"))
					return
				}
				if hello.Token != h.token {
					_ = c.ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "invalid token"))
					return
				}
			}
			c.id = hello.ClientID
			h.mu.Lock()
			if h.clients[c.ns] == nil {
				h.clients[c.ns] = map[string]*client{}
			}
			h.clients[c.ns][c.id] = c
			h.mu.Unlock()
		case "ui.snapshot":
			var sm snapshotMsg
			if err := json.Unmarshal(data, &sm); err != nil {
				continue
			}
			if sm.ClientID == "" || len(sm.Data) == 0 {
				continue
			}
			h.setSnapshot(c.ns, sm.ClientID, sm.Data)
		default:
			if rawID, ok := envelope["id"]; ok {
				var id string
				_ = json.Unmarshal(rawID, &id)
				if id == "" {
					continue
				}
				var resp rpcResponse
				if err := json.Unmarshal(data, &resp); err != nil {
					continue
				}
				h.deliverResponse(&resp)
			}
		}
	}
}

func (h *Hub) ListClients(ns string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	m := h.clients[ns]
	out := make([]string, 0, len(m))
	for id := range m {
		out = append(out, id)
	}
	return out
}

func (h *Hub) Snapshot(ns, clientID string) json.RawMessage {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.snapshots[ns] == nil {
		return nil
	}
	return h.snapshots[ns][clientID]
}

func (h *Hub) DefaultClient(ns string) (string, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for id := range h.clients[ns] {
		return id, true
	}
	return "", false
}

func (h *Hub) SubscribeSnapshots(ns, clientID string) (<-chan json.RawMessage, func()) {
	if ns == "" {
		ns = "default"
	}
	ch := make(chan json.RawMessage, 8)

	h.mu.Lock()
	if h.watchers[ns] == nil {
		h.watchers[ns] = map[string]map[chan json.RawMessage]struct{}{}
	}
	if h.watchers[ns][clientID] == nil {
		h.watchers[ns][clientID] = map[chan json.RawMessage]struct{}{}
	}
	h.watchers[ns][clientID][ch] = struct{}{}
	h.mu.Unlock()

	cancel := func() {
		h.mu.Lock()
		if h.watchers[ns] != nil && h.watchers[ns][clientID] != nil {
			delete(h.watchers[ns][clientID], ch)
			if len(h.watchers[ns][clientID]) == 0 {
				delete(h.watchers[ns], clientID)
			}
		}
		h.mu.Unlock()
		close(ch)
	}
	return ch, cancel
}

func (h *Hub) ensureQueue(ns, clientID string) *commandQueue {
	if h.queues[ns] == nil {
		h.queues[ns] = map[string]*commandQueue{}
	}
	if h.queues[ns][clientID] == nil {
		h.queues[ns][clientID] = &commandQueue{}
	}
	return h.queues[ns][clientID]
}

func (h *Hub) RegisterHTTPNotifier(ns, clientID string, notifier transport.Notifier) {
	if ns == "" {
		ns = "default"
	}
	if clientID == "" || notifier == nil {
		return
	}
	h.mu.Lock()
	if h.notifiers[ns] == nil {
		h.notifiers[ns] = map[string]transport.Notifier{}
	}
	h.notifiers[ns][clientID] = notifier
	h.mu.Unlock()
}

func (h *Hub) registerHTTPClient(ns, clientID string) {
	if ns == "" {
		ns = "default"
	}
	if clientID == "" {
		return
	}
	h.mu.Lock()
	if h.clients[ns] == nil {
		h.clients[ns] = map[string]*client{}
	}
	h.clients[ns][clientID] = &client{id: clientID, ns: ns}
	h.mu.Unlock()
}

func (h *Hub) unregisterHTTPClient(ns, clientID string, notifier transport.Notifier) {
	if ns == "" {
		ns = "default"
	}
	if clientID == "" {
		return
	}
	h.mu.Lock()
	if h.notifiers[ns] != nil && h.notifiers[ns][clientID] == notifier {
		delete(h.notifiers[ns], clientID)
	}
	if h.clients[ns] != nil {
		delete(h.clients[ns], clientID)
	}
	if h.snapshots[ns] != nil {
		delete(h.snapshots[ns], clientID)
	}
	h.mu.Unlock()
}

func (h *Hub) enqueueCommand(ns, clientID string, req rpcRequest) {
	h.mu.Lock()
	q := h.ensureQueue(ns, clientID)
	if len(q.waiters) > 0 {
		ch := q.waiters[0]
		q.waiters = q.waiters[1:]
		select {
		case ch <- req:
		default:
		}
		h.mu.Unlock()
		return
	}
	q.items = append(q.items, req)
	h.mu.Unlock()
}

func (h *Hub) dequeueCommand(ctx context.Context, ns, clientID string) (*rpcRequest, error) {
	h.mu.Lock()
	q := h.ensureQueue(ns, clientID)
	if len(q.items) > 0 {
		req := q.items[0]
		q.items = q.items[1:]
		h.mu.Unlock()
		return &req, nil
	}
	ch := make(chan rpcRequest, 1)
	q.waiters = append(q.waiters, ch)
	h.mu.Unlock()

	select {
	case <-ctx.Done():
		h.mu.Lock()
		q := h.ensureQueue(ns, clientID)
		for i := range q.waiters {
			if q.waiters[i] == ch {
				q.waiters = append(q.waiters[:i], q.waiters[i+1:]...)
				break
			}
		}
		h.mu.Unlock()
		return nil, ctx.Err()
	case req := <-ch:
		return &req, nil
	}
}

func (h *Hub) deliverResponse(resp *rpcResponse) {
	if resp == nil || resp.ID == "" {
		return
	}
	h.pendingMu.Lock()
	ch := h.pending[resp.ID]
	if ch != nil {
		delete(h.pending, resp.ID)
	}
	h.pendingMu.Unlock()
	if ch != nil {
		select {
		case ch <- resp:
		default:
		}
	}
}

func (h *Hub) Call(ctx context.Context, ns, clientID string, method string, params interface{}) (*rpcResponse, error) {
	if clientID == "" {
		if id, ok := h.DefaultClient(ns); ok {
			clientID = id
		} else {
			return nil, errors.New("no UI clients connected")
		}
	}

	h.mu.RLock()
	c := (*client)(nil)
	if h.clients[ns] != nil {
		c = h.clients[ns][clientID]
	}
	n := transport.Notifier(nil)
	if h.notifiers[ns] != nil {
		n = h.notifiers[ns][clientID]
	}
	h.mu.RUnlock()

	id := "cmd_" + ns + "_" + clientID + "_" + time.Now().Format("20060102T150405.000")
	ch := make(chan *rpcResponse, 1)
	h.pendingMu.Lock()
	h.pending[id] = ch
	h.pendingMu.Unlock()

	req := rpcRequest{ID: id, Method: method, Params: params}
	if c != nil && c.ws != nil {
		c.mu.Lock()
		err := c.ws.WriteJSON(req)
		c.mu.Unlock()
		if err != nil {
			h.pendingMu.Lock()
			delete(h.pending, id)
			h.pendingMu.Unlock()
			return nil, err
		}
	} else {
		if n != nil {
			_ = n.Notify(ctx, &jsonrpc.Notification{
				Jsonrpc: "2.0",
				Method:  "ui.command",
				Params:  mustJSON(map[string]any{"id": id, "method": method, "params": params}),
			})
		} else {
			h.enqueueCommand(ns, clientID, req)
		}
	}

	select {
	case <-ctx.Done():
		h.pendingMu.Lock()
		delete(h.pending, id)
		h.pendingMu.Unlock()
		return nil, ctx.Err()
	case resp := <-ch:
		return resp, nil
	}
}

func mustJSON(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

func isLocalRequest(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return false
	}
	h := strings.ToLower(strings.TrimSpace(r.Host))
	if h == "" {
		return false
	}
	if hh, _, err := net.SplitHostPort(h); err == nil {
		h = hh
	}
	return h == "localhost" || h == "127.0.0.1" || h == "::1"
}

func checkOrigin(allow map[string]bool, r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}
	if len(allow) > 0 {
		return allow[origin]
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := strings.ToLower(u.Hostname())
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}
