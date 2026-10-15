// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"github.com/viant/jsonrpc"
	protoclient "github.com/viant/mcp-protocol/client"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	mcpserver "github.com/viant/mcp/server"
	"sync"
)

// NewLocalMCPClient exports the authoritative local provider through the same
// SDK tools/list/call handler as HTTP. Every operation uses its own request
// context; startup actor/authority is never captured. No aggregate self-proxy
// or network listener is involved. The provider's actor verifier is mandatory.
func NewLocalMCPClient(provider *LocalProvider) (mcpclient.Interface, error) {
	if provider == nil {
		return nil, ErrUnavailable
	}
	server, err := NewMCPServer(provider, true)
	if err != nil {
		return nil, err
	}
	bridge := &localNotifications{}
	handler := server.NewHandler(context.Background(), bridge).(*mcpserver.Handler)
	return &localClient{Interface: mcpserver.NewAdapter(handler), notifications: bridge, handler: handler}, nil
}

type localClient struct {
	mcpclient.Interface
	notifications *localNotifications
	handler       *mcpserver.Handler
}

func (c *localClient) SetNotificationHandler(h protoclient.Handler) {
	c.notifications.mu.Lock()
	if !c.notifications.closed {
		c.notifications.handler = h
	}
	c.notifications.mu.Unlock()
}
func (c *localClient) Close() error {
	c.notifications.mu.Lock()
	c.notifications.closed = true
	c.notifications.handler = nil
	c.notifications.mu.Unlock()
	c.handler.Close()
	return nil
}

type localNotifications struct {
	mu      sync.RWMutex
	handler protoclient.Handler
	closed  bool
}

func (n *localNotifications) Notify(ctx context.Context, event *jsonrpc.Notification) error {
	n.mu.RLock()
	h := n.handler
	closed := n.closed
	n.mu.RUnlock()
	if !closed && h != nil {
		h.OnNotification(ctx, event)
	}
	return nil
}
func (n *localNotifications) Send(ctx context.Context, r *jsonrpc.Request) (*jsonrpc.Response, error) {
	return &jsonrpc.Response{Id: r.Id, Error: jsonrpc.NewMethodNotFound("local client callback unavailable", nil)}, nil
}

// Forward optional native methods without losing them through the base client
// interface embedding. The same handler owns native resources and namespace aliases.
func (c *localClient) ListSkills(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListSkillsResult, error) {
	native, ok := c.Interface.(interface {
		ListSkills(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListSkillsResult, error)
	})
	if !ok {
		return nil, ErrUnavailable
	}
	return native.ListSkills(ctx, cursor, options...)
}
func (c *localClient) GetSkill(ctx context.Context, uri string, options ...mcpclient.RequestOption) (*schema.GetSkillResult, error) {
	native, ok := c.Interface.(interface {
		GetSkill(context.Context, string, ...mcpclient.RequestOption) (*schema.GetSkillResult, error)
	})
	if !ok {
		return nil, ErrUnavailable
	}
	return native.GetSkill(ctx, uri, options...)
}
