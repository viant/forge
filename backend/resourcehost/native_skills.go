// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	client "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"sort"
	"time"
)

// NativeSkillSource adapts the standard skills extension to the same gateway
// actor boundary and manager-owned metadata index. It invents no wire methods.
type NativeSkillSource struct {
	Gateway         *Gateway
	LocalConnection string
}

// HasPublishedMetadata describes trusted host configuration only. Capability
// detection has no caller context and must not enumerate session-bound sources.
func (s *NativeSkillSource) HasPublishedMetadata() bool {
	return s != nil && s.Gateway != nil && len(s.Gateway.publishedRegistrations()) > 0
}

func (s *NativeSkillSource) Names(ctx context.Context) ([]string, error) {
	registered := s.Gateway.publishedRegistrations()
	excluded := []string{}
	for _, source := range registered {
		excluded = append(excluded, source.connection.Name)
	}
	names, err := s.Gateway.Manager.NamesExcluding(ctx, excluded)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(names))
	for _, name := range names {
		// Published owners contribute through the shared gateway catalog. They
		// must never also negotiate a native extension on the legacy transport.
		_, published := s.Gateway.publishedByName(name)
		if name != s.LocalConnection && !published {
			out = append(out, name)
		}
	}
	// Keep locally registered owners visible to generic skill delivery. Their
	// options disable native discovery, so capability detection can run without
	// a caller session or an MCP handshake; actual reads still check admission.
	for _, source := range registered {
		if source.connection.Name != s.LocalConnection {
			out = append(out, source.connection.Name)
		}
	}
	sort.Strings(out)
	return out, nil
}
func (s *NativeSkillSource) Options(ctx context.Context, name string) (*cfg.MCPClient, error) {
	if source, published := s.Gateway.publishedByName(name); published {
		// These trusted registration options describe a route, never authority.
		// CatalogScope and every delivery recheck the caller's local admission.
		return &cfg.MCPClient{PrimitiveProviderIdentity: source.connection.ProviderIdentity, SkillDiscovery: &cfg.SkillDiscovery{Enabled: false}}, nil
	}
	return s.Gateway.Manager.Options(ctx, name)
}
func (s *NativeSkillSource) Get(ctx context.Context, conversation, name string) (client.Interface, error) {
	a, err := s.Gateway.actor(ctx)
	if err != nil {
		return nil, &requiredSkillDiscoveryFailure{err}
	}
	if _, published := s.Gateway.publishedByName(name); published {
		return nil, &requiredSkillDiscoveryFailure{identity.ErrResourceDenied}
	}
	c, err := s.Gateway.Manager.Get(ctx, conversation, name)
	if err != nil {
		return nil, err
	}
	if err = s.Gateway.final(ctx, a); err != nil {
		return nil, &requiredSkillDiscoveryFailure{err}
	}
	return &nativeSkillClient{Interface: c, gateway: s.Gateway}, nil
}
func (s *NativeSkillSource) WithAuthTokenContext(ctx context.Context, name string) context.Context {
	if _, published := s.Gateway.publishedByName(name); published {
		return ctx
	}
	return s.Gateway.Manager.WithAuthTokenContext(ctx, name)
}
func (s *NativeSkillSource) UseIDToken(ctx context.Context, name string) bool {
	if _, published := s.Gateway.publishedByName(name); published {
		return false
	}
	return s.Gateway.Manager.UseIDToken(ctx, name)
}
func (s *NativeSkillSource) CatalogScope(ctx context.Context, conversation string, names []string) (string, bool, error) {
	a, err := s.Gateway.actor(ctx)
	if err != nil {
		return "", false, err
	}
	// The caller already selected skill discovery participants. An empty set
	// must remain empty; unrelated connectors do not own this metadata scope.
	names = append([]string(nil), names...)
	sort.Strings(names)
	base, cacheable, err := s.Gateway.Manager.CatalogScope(ctx, conversation, nil)
	if err != nil {
		return "", false, err
	}
	// Generic skill delivery also contributes cohort owners excluded from
	// native discovery Names. Their local admission must fence cached pages.
	publishedScope, err := s.Gateway.publishedAdmissionKeys(ctx)
	if err != nil {
		return "", false, &requiredSkillDiscoveryFailure{err}
	}
	parts := []string{base, publishedScope}
	for _, name := range names {
		if source, published := s.Gateway.publishedByName(name); published {
			admission, err := source.source.AdmissionKey(ctx)
			if ctx.Err() != nil {
				return "", false, ctx.Err()
			}
			if purePublishedDenial(err) {
				parts = append(parts, name, source.connection.ProviderIdentity, "denied")
				continue
			}
			if err != nil || admission == "" {
				if err == nil {
					err = identity.ErrResourceDenied
				}
				return "", false, &requiredSkillDiscoveryFailure{err}
			}
			parts = append(parts, name, source.connection.ProviderIdentity, admission)
			continue
		}
		options, err := s.Gateway.Manager.Options(ctx, name)
		if err != nil {
			return "", false, err
		}
		// Automatic discovery is optional for both configured and published MCPs.
		// Explicit skill discovery retains its required-provider failure semantics.
		automatic := options != nil && options.SkillDiscovery == nil
		if automatic {
			// Separate provider contact from the credential/configuration scope
			// checks below. A contact failure is optional; a scope failure is not.
			_, contactErr := s.Gateway.Manager.Get(s.WithAuthTokenContext(ctx, name), conversation, name)
			if contactErr != nil {
				if ctx.Err() != nil {
					return "", false, ctx.Err()
				}
				if optionalSkillProviderContact(contactErr) {
					cacheable = false
					parts = append(parts, name, "unavailable")
					continue
				}
				return "", false, contactErr
			}
		}
		scope, reusable, scopeErr := s.Gateway.Manager.CatalogScope(ctx, conversation, []string{name})
		if aggregateLinkRequired(scopeErr) {
			// Optional metadata discovery cannot require linking. Do not cache
			// this partial snapshot across a later credential-state change.
			cacheable = false
			parts = append(parts, name, "unlinked")
			continue
		}
		if scopeErr != nil {
			return "", false, scopeErr
		}
		cacheable = cacheable && reusable
		parts = append(parts, name, scope)
	}
	if err = ctx.Err(); err != nil {
		return "", false, err
	}
	if err = s.Gateway.final(ctx, a); err != nil {
		return "", false, err
	}
	raw, err := json.Marshal(parts)
	if err != nil {
		return "", false, err
	}
	return fmt.Sprintf("%s%x", actorKey(a, "", 0), sha256.Sum256(raw)), cacheable, nil
}
func (s *NativeSkillSource) VisibleCatalog(ctx context.Context, key string, until time.Time, load func(context.Context) ([]primitive.CatalogItem[json.RawMessage], error), sourceLease ...func() time.Time) (*primitive.Catalog[json.RawMessage], error) {
	a, err := s.Gateway.actor(ctx)
	if err != nil {
		return nil, err
	}
	if a.ValidUntil.Before(until) {
		until = a.ValidUntil
	}
	names, err := s.Names(ctx)
	if err != nil {
		return nil, err
	}
	partition := s.Gateway.Manager.WithCatalogSources(ctx, manager.VisibleCatalogPartition{}, names)
	return s.Gateway.Manager.VisibleCatalogInPartition(ctx, key, partition, until, load, sourceLease...)
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

func (c *nativeSkillClient) NegotiatedServer() (*schema.InitializeResult, error) {
	negotiated, ok := c.Interface.(interface {
		NegotiatedServer() (*schema.InitializeResult, error)
	})
	if !ok {
		return nil, ErrUnavailable
	}
	return negotiated.NegotiatedServer()
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
		return nil, &requiredSkillDiscoveryFailure{e}
	}
	s, ok := c.Interface.(manager.SkillsClient)
	if !ok {
		return nil, fmt.Errorf("MCP skills unavailable")
	}
	out, e := s.ListSkills(ctx, cursor, opts...)
	if e == nil {
		if e = c.gateway.final(ctx, a); e != nil {
			return nil, &requiredSkillDiscoveryFailure{e}
		}
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
	if result, handled, err := s.readPublishedSkillResource(ctx, server, uri); handled {
		return result, err
	}
	ctx = s.WithAuthTokenContext(ctx, server)
	cli, err := s.Get(ctx, "", server)
	if err != nil {
		return nil, err
	}
	return cli.ReadResource(ctx, &schema.ReadResourceRequestParams{Uri: uri})
}

// Actor and publication fence failures must never be treated as an optional
// provider outage by a federating skill consumer.
type requiredSkillDiscoveryFailure struct{ error }

func (e *requiredSkillDiscoveryFailure) Unwrap() error                     { return e.error }
func (*requiredSkillDiscoveryFailure) RequiredSkillDiscoveryFailure() bool { return true }

func optionalSkillProviderContact(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) || errors.Is(err, identity.ErrResourceDenied) || errors.Is(err, identity.ErrResourceStale) || errors.Is(err, identity.ErrResource) || errors.Is(err, identity.ErrInvalid) {
		return false
	}
	if required, ok := err.(interface{ RequiredSkillDiscoveryFailure() bool }); ok && required.RequiredSkillDiscoveryFailure() {
		return false
	}
	if joined, ok := err.(interface{ Unwrap() []error }); ok {
		children := joined.Unwrap()
		if len(children) == 0 {
			return false
		}
		for _, child := range children {
			if !optionalSkillProviderContact(child) {
				return false
			}
		}
		return true
	}
	if child := errors.Unwrap(err); child != nil {
		return optionalSkillProviderContact(child)
	}
	return true
}
