// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

// resourceReadBinding belongs to one Get invocation. It shares resolved options
// and the client locator within that invocation; it never stores an allow result
// or the headers used by an actual RPC.
type resourceReadBinding struct {
	manager *manager.Manager
	name    string
	options *cfg.MCPClient
	client  mcpclient.Interface
	key     string
	// catalogKey excludes a target association only for remote transports.
	// The full key above still fences one selected read and its release.
	catalogKey string
}

func (g *Gateway) resolveReadBinding(ctx context.Context, actor identity.VerifiedActor, name string) (*resourceReadBinding, error) {
	options, err := g.Manager.Options(ctx, name)
	if err != nil {
		return nil, err
	}
	if options == nil {
		return nil, ErrUnavailable
	}
	// Initialize the normal manager client before pinning effective options:
	// initialization may fill shared Name/Version defaults. Those defaults are
	// part of the stable contract, not request-time configuration drift.
	client, err := g.client(ctx, name)
	if err != nil {
		return nil, err
	}
	options, err = g.Manager.Options(ctx, name)
	if err != nil {
		return nil, err
	}
	if options == nil {
		return nil, ErrUnavailable
	}
	// Provider configurations may return a shared pointer. Pin its value, rather
	// than letting later mutation change the invocation's original options.
	raw, err := json.Marshal(options)
	if err != nil {
		return nil, identity.ErrResourceDenied
	}
	detached := &cfg.MCPClient{}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if decoder.Decode(detached) != nil {
		return nil, identity.ErrResourceDenied
	}
	effective := g.Manager.WithAuthTokenContext(ctx, name)
	authHash := credentialDigest(effective)
	key, err := g.namespaceReadKeyForCredential(ctx, actor, name, detached, client, authHash)
	if err != nil {
		return nil, err
	}
	catalogKey := key
	if !g.Manager.IsLocalClient(name) {
		catalogKey, err = g.namespaceReadKeyForCredential(ctx, actor, name, detached, client, authHash, [32]byte{})
		if err != nil {
			return nil, err
		}
	}
	return &resourceReadBinding{manager: g.Manager, name: name, options: detached, client: client, key: key, catalogKey: catalogKey}, nil
}

func (b *resourceReadBinding) capabilityKey() string {
	if b.catalogKey != "" {
		return b.catalogKey
	}
	return b.key
}

func (g *Gateway) checkReadBinding(ctx context.Context, actor identity.VerifiedActor, held *resourceReadBinding) error {
	if held == nil || held.manager != g.Manager {
		return identity.ErrResourceDenied
	}
	options, err := g.Manager.Options(ctx, held.name)
	if err != nil {
		return err
	}
	if options == nil {
		return identity.ErrResourceDenied
	}
	client := held.client
	if wrapped, ok := client.(*gatewayAuthClient); ok {
		client = wrapped.Interface
	}
	effective := g.Manager.WithAuthTokenContext(ctx, held.name)
	if !g.Manager.IsCurrentClient(effective, "", held.name, client) {
		return identity.ErrResourceDenied
	}
	key, err := g.namespaceReadKeyForCredential(ctx, actor, held.name, options, held.client, credentialDigest(effective))
	if err != nil {
		return err
	}
	if key != held.key || !g.Manager.IsCurrentClient(effective, "", held.name, client) {
		return identity.ErrResourceDenied
	}
	return nil
}
