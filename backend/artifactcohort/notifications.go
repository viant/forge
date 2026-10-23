package artifactcohort

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/viant/jsonrpc"
	protoclient "github.com/viant/mcp-protocol/client"
	"github.com/viant/mcp-protocol/schema"
)

// NotificationHandler decorates the configured MCP client's inbound handler.
// Install it when constructing a stateful MCP client, then AttachReplica after
// constructing the Replica with that client. Notification callbacks only mark
// stale state and queue work; they never call MCP from the transport reader.
type NotificationHandler struct {
	protoclient.Handler
	mu      sync.RWMutex
	replica *Replica
	queue   chan struct{}
	ctx     context.Context
	cancel  context.CancelFunc
	once    sync.Once
}

func NewNotificationHandler(ctx context.Context, next protoclient.Handler) *NotificationHandler {
	if ctx == nil {
		ctx = context.Background()
	}
	if next == nil {
		next = noopClientHandler{}
	}
	workerCtx, cancel := context.WithCancel(ctx)
	return &NotificationHandler{Handler: next, ctx: workerCtx, cancel: cancel, queue: make(chan struct{}, 1)}
}

func (h *NotificationHandler) AttachReplica(replica *Replica) error {
	if h == nil || h.ctx.Err() != nil || replica == nil || !replica.Enabled() {
		return ErrInvalid
	}
	h.mu.Lock()
	if h.replica != nil {
		h.mu.Unlock()
		return ErrConflict
	}
	h.replica = replica
	h.mu.Unlock()
	go h.run()
	return nil
}
func (h *NotificationHandler) Close() {
	if h == nil {
		return
	}
	h.once.Do(func() {
		h.cancel()
		h.mu.RLock()
		replica := h.replica
		h.mu.RUnlock()
		if replica != nil {
			replica.MarkDisconnected()
		}
	})
}

func (h *NotificationHandler) OnNotification(ctx context.Context, notification *jsonrpc.Notification) {
	if h == nil {
		return
	}
	if notification != nil {
		h.mu.RLock()
		replica := h.replica
		h.mu.RUnlock()
		if replica != nil {
			switch notification.Method {
			case NotificationUpdated:
				var params struct {
					URI string `json:"uri"`
				}
				if json.Unmarshal(notification.Params, &params) != nil {
					replica.MarkDisconnected()
					h.signal()
					break
				}
				if !RootKind(scheme(params.URI)) {
					break
				} // unrelated MCP resource
				if replica.MarkUpdated(params.URI) != nil {
					replica.MarkDisconnected()
				}
				h.signal()
			case NotificationListChanged:
				replica.MarkListChanged()
				h.signal()
			}
		}
	}
	h.Handler.OnNotification(ctx, notification)
}
func (h *NotificationHandler) signal() {
	select {
	case h.queue <- struct{}{}:
	default:
	}
}
func (h *NotificationHandler) run() {
	h.mu.RLock()
	replica := h.replica
	h.mu.RUnlock()
	defer replica.MarkDisconnected()
	for {
		select {
		case <-h.ctx.Done():
			return
		case <-h.queue:
			retryDelay := 250 * time.Millisecond
			for {
				if h.ctx.Err() != nil {
					return
				}
				if err := replica.Sync(h.ctx); err == nil {
					break
				}
				timer := time.NewTimer(retryDelay)
				select {
				case <-h.ctx.Done():
					timer.Stop()
					return
				case <-h.queue:
					timer.Stop()
				case <-timer.C:
				}
				if retryDelay < 5*time.Second {
					retryDelay *= 2
					if retryDelay > 5*time.Second {
						retryDelay = 5 * time.Second
					}
				}
			}
		}
	}
}

// A host that only consumes notifications need not implement roots, sampling,
// or elicitation. MCP never dispatches those methods when Implements is false.
type noopClientHandler struct{ protoclient.Handler }

func (noopClientHandler) Implements(string) bool                                { return false }
func (noopClientHandler) Init(context.Context, *schema.ClientCapabilities)      {}
func (noopClientHandler) OnNotification(context.Context, *jsonrpc.Notification) {}
