// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	"fmt"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/mcp-protocol/schema"
	client "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"time"
)

// NativeSkillSource adapts the standard skills extension to the same gateway
// actor boundary and manager-owned metadata index. It invents no wire methods.
type NativeSkillSource struct {
	Gateway         *Gateway
	LocalConnection string
}

func (s *NativeSkillSource) Names(ctx context.Context) ([]string, error) {
	names, err := s.Gateway.Manager.Names(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(names))
	for _, name := range names {
		if name != s.LocalConnection {
			out = append(out, name)
		}
	}
	return out, nil
}
func (s *NativeSkillSource) Options(ctx context.Context, name string) (*cfg.MCPClient, error) {
	return s.Gateway.Manager.Options(ctx, name)
}
func (s *NativeSkillSource) Get(ctx context.Context, conversation, name string) (client.Interface, error) {
	a, err := s.Gateway.actor(ctx)
	if err != nil {
		return nil, err
	}
	c, err := s.Gateway.Manager.Get(ctx, conversation, name)
	if err != nil {
		return nil, err
	}
	if err = s.Gateway.final(ctx, a); err != nil {
		return nil, err
	}
	return &nativeSkillClient{Interface: c, gateway: s.Gateway}, nil
}
func (s *NativeSkillSource) WithAuthTokenContext(ctx context.Context, name string) context.Context {
	return s.Gateway.Manager.WithAuthTokenContext(ctx, name)
}
func (s *NativeSkillSource) UseIDToken(ctx context.Context, name string) bool {
	return s.Gateway.Manager.UseIDToken(ctx, name)
}
func (s *NativeSkillSource) CatalogScope(ctx context.Context, conversation string, names []string) (string, bool, error) {
	a, err := s.Gateway.actor(ctx)
	if err != nil {
		return "", false, err
	}
	names, err = s.Gateway.Manager.Names(ctx)
	if err != nil {
		return "", false, err
	}
	scope, cacheable, err := s.Gateway.Manager.CatalogScope(ctx, conversation, names)
	return actorKey(a, "", 0) + scope, cacheable, err
}
func (s *NativeSkillSource) VisibleCatalog(ctx context.Context, key string, until time.Time, load func(context.Context) ([]primitive.CatalogItem[json.RawMessage], error), sourceLease ...func() time.Time) (*primitive.Catalog[json.RawMessage], error) {
	a, err := s.Gateway.actor(ctx)
	if err != nil {
		return nil, err
	}
	if a.ValidUntil.Before(until) {
		until = a.ValidUntil
	}
	return s.Gateway.Manager.VisibleCatalog(ctx, key, until, load, sourceLease...)
}
func (s *NativeSkillSource) CheckVisibleCatalog(ctx context.Context, index *primitive.Catalog[json.RawMessage]) error {
	a, err := s.Gateway.actor(ctx)
	if err != nil {
		return err
	}
	if err = s.Gateway.Manager.CheckVisibleCatalog(ctx, index); err != nil {
		return err
	}
	return s.Gateway.final(ctx, a)
}

type nativeSkillClient struct {
	client.Interface
	gateway *Gateway
}

func (c *nativeSkillClient) Discover(ctx context.Context, opts ...client.RequestOption) (*schema.DiscoverResult, error) {
	a, e := c.gateway.actor(ctx)
	if e != nil {
		return nil, e
	}
	d, ok := c.Interface.(client.DiscoveryInterface)
	if !ok {
		return nil, fmt.Errorf("MCP discovery unavailable")
	}
	out, e := d.Discover(ctx, opts...)
	if e == nil {
		e = c.gateway.final(ctx, a)
	}
	if e != nil {
		return nil, e
	}
	return out, nil
}
func (c *nativeSkillClient) ListSkills(ctx context.Context, cursor *string, opts ...client.RequestOption) (*schema.ListSkillsResult, error) {
	a, e := c.gateway.actor(ctx)
	if e != nil {
		return nil, e
	}
	s, ok := c.Interface.(manager.SkillsClient)
	if !ok {
		return nil, fmt.Errorf("MCP skills unavailable")
	}
	out, e := s.ListSkills(ctx, cursor, opts...)
	if e == nil {
		e = c.gateway.final(ctx, a)
	}
	if e != nil {
		return nil, e
	}
	return out, nil
}
func (c *nativeSkillClient) GetSkill(ctx context.Context, uri string, opts ...client.RequestOption) (*schema.GetSkillResult, error) {
	a, e := c.gateway.actor(ctx)
	if e != nil {
		return nil, e
	}
	s, ok := c.Interface.(manager.SkillsClient)
	if !ok {
		return nil, fmt.Errorf("MCP skills unavailable")
	}
	out, e := s.GetSkill(ctx, uri, opts...)
	if e == nil {
		e = c.gateway.final(ctx, a)
	}
	if e != nil {
		return nil, e
	}
	return out, nil
}
func (c *nativeSkillClient) ReadResource(ctx context.Context, in *schema.ReadResourceRequestParams, opts ...client.RequestOption) (*schema.ReadResourceResult, error) {
	a, e := c.gateway.actor(ctx)
	if e != nil {
		return nil, e
	}
	out, e := c.Interface.ReadResource(ctx, in, opts...)
	if e == nil {
		e = c.gateway.final(ctx, a)
	}
	if e != nil {
		return nil, e
	}
	return out, nil
}

func (c *nativeSkillClient) CallTool(ctx context.Context, in *schema.CallToolRequestParams, opts ...client.RequestOption) (*schema.CallToolResult, error) {
	a, e := c.gateway.actor(ctx)
	if e != nil {
		return nil, e
	}
	out, e := c.Interface.CallTool(ctx, in, opts...)
	if e == nil {
		e = c.gateway.final(ctx, a)
	}
	if e != nil {
		return nil, e
	}
	return out, nil
}
func (c *nativeSkillClient) ListTools(ctx context.Context, cursor *string, opts ...client.RequestOption) (*schema.ListToolsResult, error) {
	a, e := c.gateway.actor(ctx)
	if e != nil {
		return nil, e
	}
	out, e := c.Interface.ListTools(ctx, cursor, opts...)
	if e == nil {
		e = c.gateway.final(ctx, a)
	}
	if e != nil {
		return nil, e
	}
	return out, nil
}
func (c *nativeSkillClient) ListResources(ctx context.Context, cursor *string, opts ...client.RequestOption) (*schema.ListResourcesResult, error) {
	a, e := c.gateway.actor(ctx)
	if e != nil {
		return nil, e
	}
	out, e := c.Interface.ListResources(ctx, cursor, opts...)
	if e == nil {
		e = c.gateway.final(ctx, a)
	}
	if e != nil {
		return nil, e
	}
	return out, nil
}

// ReadSkillResource uses the already configured managing connection. Shared-index
// skill definitions do not require the optional native skills extension.
func (s *NativeSkillSource) ReadSkillResource(ctx context.Context, server, uri string) (*schema.ReadResourceResult, error) {
	ctx = s.Gateway.Manager.WithAuthTokenContext(ctx, server)
	cli, err := s.Get(ctx, "", server)
	if err != nil {
		return nil, err
	}
	return cli.ReadResource(ctx, &schema.ReadResourceRequestParams{Uri: uri})
}
