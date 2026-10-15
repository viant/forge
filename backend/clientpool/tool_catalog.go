// SPDX-License-Identifier: Apache-2.0
// Forge resource client pooling extracted from Viant Agently Core.
package manager

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/viant/forge/backend/clientpool/internal/name"
	"github.com/viant/forge/backend/provider/contract/observe"
	mcpschema "github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	authtransport "github.com/viant/mcp/client/auth/transport"
)

// Only tools/list metadata is retained. Bytes preserve arbitrary _meta and
// prevent callers from mutating the catalog shared with another request.
type toolCatalogPage struct {
	server   string
	ready    chan struct{}
	bytes    []byte
	expires  time.Time
	revision [16]byte
	names    []string
}

type toolCatalogReadSnapshotKey struct{}
type toolCatalogReadSnapshot struct{ pages sync.Map }

// WithToolCatalogReadSnapshot reuses one authenticated tools/list generation
// while assembling a single tool surface. Explicit ttlMs=0 still prevents
// reuse by later independent requests.
func WithToolCatalogReadSnapshot(ctx context.Context) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if existing, _ := ctx.Value(toolCatalogReadSnapshotKey{}).(*toolCatalogReadSnapshot); existing != nil {
		return ctx
	}
	return context.WithValue(ctx, toolCatalogReadSnapshotKey{}, &toolCatalogReadSnapshot{})
}

func (m *Manager) invalidateToolCatalogLocked(server string) {
	if m.toolCatalogGeneration == nil {
		m.toolCatalogGeneration = map[string]uint64{}
	}
	m.toolCatalogGeneration[server]++
	// A tool-list change only invalidates snapshots that depend on this MCP.
	// A snapshot with no source tags is conservatively invalidated because its
	// dependency set is unknown. Other providers may reconnect while a local
	// resource catalog is being populated.
	for key, held := range m.visibleCatalogs {
		if held == nil || held.sources == nil || len(held.sources) == 0 || held.sources[server] {
			delete(m.visibleCatalogs, key)
		}
	}
	for key, page := range m.toolCatalog {
		if page.server == server {
			delete(m.toolCatalog, key)
		}
	}
}

func (c *managedClient) listTools(ctx context.Context, client mcpclient.Interface, cursor *string, options ...mcpclient.RequestOption) (*mcpschema.ListToolsResult, error) {
	m := c.mgr
	ctx, raw, scope, witness, delegatedToken, cacheable, err := c.toolCatalogScope(ctx, options...)
	if err != nil {
		return nil, err
	}
	if !cacheable {
		return c.fetchToolCatalog(ctx, client, cursor, observe.CacheBypass, options...)
	}
	readSnapshot, _ := ctx.Value(toolCatalogReadSnapshotKey{}).(*toolCatalogReadSnapshot)
	pageCursor := "first"
	if cursor != nil {
		pageCursor = "cursor:" + *cursor
	}
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		m.mu.Lock()
		generation := m.toolCatalogGeneration[c.serverName]
		key := fmt.Sprintf("%s:%s:%x:%d:%s", c.serverName, scope, sha256.Sum256(raw), generation, pageCursor)
		if readSnapshot != nil {
			if cached, found := readSnapshot.pages.Load(key); found {
				m.mu.Unlock()
				type plain mcpschema.ListToolsResult
				var result plain
				wire := struct {
					*plain
					CacheScope string `json:"cacheScope"`
				}{plain: &result}
				if err := json.Unmarshal(cached.([]byte), &wire); err != nil {
					return nil, err
				}
				result.CacheScope = mcpschema.ListToolsResultCacheScope(wire.CacheScope)
				return (*mcpschema.ListToolsResult)(&result), nil
			}
		}
		if m.toolCatalog == nil {
			m.toolCatalog = map[string]*toolCatalogPage{}
		}
		if cached := m.toolCatalog[key]; cached != nil {
			if cached.ready != nil {
				ready := cached.ready
				m.mu.Unlock()
				select {
				case <-ready:
					continue
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			if cached.expires.After(time.Now()) {
				bytes := cached.bytes
				m.mu.Unlock()
				type plain mcpschema.ListToolsResult
				var result plain
				wire := struct {
					*plain
					CacheScope string `json:"cacheScope"`
				}{plain: &result}
				if err := json.Unmarshal(bytes, &wire); err != nil {
					return nil, err
				}
				result.CacheScope = mcpschema.ListToolsResultCacheScope(wire.CacheScope)
				return (*mcpschema.ListToolsResult)(&result), nil
			}
			delete(m.toolCatalog, key)
		}
		// Bound retained metadata; pending requests remain valid and their results
		// are published only if their slot and generation are still current.
		for k, v := range m.toolCatalog {
			if v.ready == nil && !v.expires.After(time.Now()) {
				delete(m.toolCatalog, k)
			}
		}
		if len(m.toolCatalog) >= 512 {
			m.mu.Unlock()
			return c.fetchToolCatalog(ctx, client, cursor, observe.CacheBypass, options...)
		}
		pending := &toolCatalogPage{server: c.serverName, ready: make(chan struct{})}
		m.toolCatalog[key] = pending
		m.mu.Unlock()
		result, err := c.fetchToolCatalog(ctx, client, cursor, observe.CacheMiss, options...)
		_, currentRaw, currentScope, _, _, currentCacheable, scopeErr := c.toolCatalogScope(ctx, options...)
		validCredential := scopeErr == nil && currentCacheable && currentScope == scope && bytes.Equal(currentRaw, raw)
		if witness != nil {
			witness.mu.Lock()
			validCredential = validCredential && witness.observed && witness.token == delegatedToken
			witness.mu.Unlock()
		}
		var bytes []byte
		var cacheErr error
		if err == nil && result != nil {
			bytes, cacheErr = json.Marshal(result)
			if cacheErr == nil {
				_, cacheErr = rand.Read(pending.revision[:])
			}
		}
		m.mu.Lock()
		if result != nil && result.CacheScope == mcpschema.ListToolsResultCacheScopePrivate {
			if m.protectedToolCatalog == nil {
				m.protectedToolCatalog = map[string][32]byte{}
			}
			m.protectedToolCatalog[c.serverName] = sha256.Sum256(raw)
		}
		if m.toolCatalog[key] == pending {
			if validCredential && cacheErr == nil && err == nil && result != nil && ctx.Err() == nil && generation == m.toolCatalogGeneration[c.serverName] && !(scope == "public" && result.CacheScope == mcpschema.ListToolsResultCacheScopePrivate) && !(result.CacheScope != "" && result.TtlMs == 0) {
				pending.bytes = bytes
				pending.names = make([]string, len(result.Tools))
				for i, tool := range result.Tools {
					pending.names[i] = tool.Name
				}
				ttl := 5 * time.Minute
				if result.TtlMs > 0 && time.Duration(result.TtlMs)*time.Millisecond < ttl {
					ttl = time.Duration(result.TtlMs) * time.Millisecond
				}
				pending.expires = time.Now().Add(ttl)
			} else {
				delete(m.toolCatalog, key)
			}
		}
		if readSnapshot != nil && validCredential && cacheErr == nil && err == nil && result != nil && ctx.Err() == nil && generation == m.toolCatalogGeneration[c.serverName] {
			readSnapshot.pages.Store(key, bytes)
		}
		close(pending.ready)
		pending.ready = nil
		m.mu.Unlock()
		return result, err
	}
}

// IsToolsListPublic reports whether configured catalog metadata can be shared
// without invoking an authorization context. Unknown/custom transports remain
// principal-scoped even when their workspace principal is anonymous.
func (m *Manager) IsToolsListPublic(ctx context.Context, server string) bool {
	cfg, err := m.Options(ctx, server)
	if err != nil || cfg == nil || cfg.ClientOptions == nil {
		return false
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return false
	}
	m.mu.Lock()
	protected, seen := m.protectedToolCatalog[server]
	m.mu.Unlock()
	if seen && protected == sha256.Sum256(raw) {
		return false
	}
	if !cfg.IsToolsListPublic() || cfg.Auth != nil || m.IsLocalClient(server) || m.newClientFn != nil || cfg.Transport.URL == "" {
		return false
	}
	endpoint, err := url.Parse(cfg.Transport.URL)
	if err != nil {
		return false
	}
	cookies, err := m.catalogCookies(ctx, endpoint, cfg)
	return err == nil && len(cookies) == 0
}

// toolCatalogScope is shared by population and read-only snapshot lookup, so
// consumers cannot invent a second credential or visibility policy.
func (c *managedClient) toolCatalogScope(ctx context.Context, options ...mcpclient.RequestOption) (context.Context, []byte, string, *catalogAuthUse, string, bool, error) {
	m := c.mgr
	cfg, err := m.Options(ctx, c.serverName)
	if err != nil {
		return ctx, nil, "", nil, "", false, err
	}
	// In-process handlers can inspect arbitrary context authority. HTTP cookies
	// are partitioned by the endpoint-specific transport witness below.
	if cfg == nil || cfg.ClientOptions == nil || m.IsLocalClient(c.serverName) {
		return ctx, nil, "", nil, "", false, nil
	}
	transportScope, transportCacheable, err := m.catalogTransportCredentialScope(ctx, c.serverName, cfg)
	if err != nil || !transportCacheable {
		return ctx, nil, "", nil, "", false, err
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return ctx, nil, "", nil, "", false, nil
	}
	request := mcpclient.NewRequestOptions(options)
	// Request IDs and replay controls retain their normal transport semantics.
	if request.RequestId != nil || request.NoRetry || request.JsonrpcVersion != "" {
		return ctx, nil, "", nil, "", false, nil
	}
	token, _ := ctx.Value(authtransport.ContextAuthTokenKey).(string)
	delegatedToken := ""
	var witness *catalogAuthUse
	if cfg.IsDelegatedAuth() {
		if m.credResolver == nil {
			return ctx, nil, "", nil, "", false, nil
		}
		requirement, compileErr := cfg.Auth.CompileRequirement(ctx, c.serverName, cfg.Transport.URL)
		if compileErr != nil {
			return ctx, nil, "", nil, "", false, compileErr
		}
		resolved, resolveErr := m.credResolver.Resolve(ctx, *requirement)
		if resolveErr != nil {
			return ctx, nil, "", nil, "", false, resolveErr
		}
		if resolved == nil || resolved.Verify(requirement, time.Now()) != nil {
			return ctx, nil, "", nil, "", false, nil
		}
		delegatedToken = resolved.Token
		witness = &catalogAuthUse{}
		ctx = context.WithValue(ctx, catalogAuthKey{}, witness)
	}
	principal := authctx.EffectiveUserID(ctx)
	if m.userIDFn != nil {
		principal = m.userIDFn(ctx)
	}
	credential, _ := json.Marshal([]string{principal, delegatedToken, token, request.StringToken, authctx.MCPAuthToken(ctx, false), authctx.MCPAuthToken(ctx, true), authctx.Provider(ctx), authctx.EffectiveUserID(ctx), transportScope})
	scope := fmt.Sprintf("private:%p:%x", c.entry, sha256.Sum256(credential))
	// Explicit public visibility is necessary. Any configured authentication
	// or request credential keeps the page within its connection/principal.
	if m.IsToolsListPublic(ctx, c.serverName) && token == "" && request.StringToken == "" {
		scope = "public"
	}
	return ctx, raw, scope, witness, delegatedToken, true, nil
}

// ToolCatalogSnapshot returns an already cached, complete tools/list catalog,
// including a zero-TTL snapshot held by this operation. Its opaque identity
// expires with the source pages or operation and changes on
// publication, connection/configuration changes or invalidation. It never lists
// tools or stores a parallel catalog.
func (m *Manager) ToolCatalogSnapshot(ctx context.Context, conversation, server string, options ...mcpclient.RequestOption) (string, []mcpschema.Tool, error) {
	client, err := m.Get(ctx, conversation, server)
	if err != nil {
		return "", nil, err
	}
	managed, ok := client.(*managedClient)
	if !ok {
		return "", nil, nil
	}
	return managed.toolCatalogSnapshot(ctx, options...)
}

func (c *managedClient) toolCatalogSnapshot(ctx context.Context, options ...mcpclient.RequestOption) (string, []mcpschema.Tool, error) {
	_, raw, scope, _, _, cacheable, err := c.toolCatalogScope(ctx, options...)
	if err != nil || !cacheable {
		return "", nil, err
	}
	readSnapshot, _ := ctx.Value(toolCatalogReadSnapshotKey{}).(*toolCatalogReadSnapshot)
	m := c.mgr
	m.mu.Lock()
	defer m.mu.Unlock()
	cursor := "first"
	seen := map[string]bool{}
	var tools []mcpschema.Tool
	var revisions []string
	now := time.Now()
	for {
		if seen[cursor] {
			return "", nil, nil
		}
		seen[cursor] = true
		key := fmt.Sprintf("%s:%s:%x:%d:%s", c.serverName, scope, sha256.Sum256(raw), m.toolCatalogGeneration[c.serverName], cursor)
		var pageBytes []byte
		var revision string
		if page := m.toolCatalog[key]; page != nil && page.ready == nil && page.expires.After(now) {
			pageBytes = page.bytes
			revision = fmt.Sprintf("%x", page.revision)
		} else if readSnapshot != nil {
			// Zero-TTL catalogs are reusable only within the current operation.
			// Connection, credentials and notification generation still fence the key.
			if held, found := readSnapshot.pages.Load(key); found {
				pageBytes = held.([]byte)
				revision = fmt.Sprintf("read:%x", sha256.Sum256(pageBytes))
			}
		}
		if pageBytes == nil {
			return "", nil, nil
		}
		type plain mcpschema.ListToolsResult
		var result plain
		wire := struct {
			*plain
			CacheScope string `json:"cacheScope"`
		}{plain: &result}
		if err := json.Unmarshal(pageBytes, &wire); err != nil {
			return "", nil, err
		}
		tools = append(tools, result.Tools...)
		revisions = append(revisions, key+":"+revision)
		if result.NextCursor == nil || *result.NextCursor == "" {
			break
		}
		cursor = "cursor:" + *result.NextCursor
	}
	encoded, _ := json.Marshal(revisions)
	return fmt.Sprintf("%x", sha256.Sum256(encoded)), tools, nil
}

// ToolCatalogGeneration exposes invalidation state without catalog contents.
func (m *Manager) ToolCatalogGeneration(server string) uint64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.toolCatalogGeneration[server]
}

// MayHaveToolCatalogAlias is only a candidate hint: it cannot authorize or return a
// tool. Callers must subsequently select the current scoped snapshot. Keeping
// names beside the manager's serialized pages avoids decoding unrelated
// catalogs and resolving credentials for aliases that cannot match. Missing
// reusable pages remain an unknown candidate so local/uncacheable clients keep
// their normal discovery path.
func (m *Manager) MayHaveToolCatalogAlias(server, alias string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	observed := false
	for _, page := range m.toolCatalog {
		if page.server != server || page.ready != nil || !page.expires.After(now) {
			continue
		}
		observed = true
		for _, name := range page.names {
			full, colon := server+"/"+name, server+":"+name
			if alias == full || alias == colon || alias == mcpname.Canonical(full) || alias == mcpname.Canonical(colon) {
				return true
			}
		}
	}
	return !observed
}

// fetchToolCatalog measures source work separately from cached page decoding.
// It records configured provider names only, never tokens or tool arguments.
func (c *managedClient) fetchToolCatalog(ctx context.Context, client mcpclient.Interface, cursor *string, cache observe.Cache, options ...mcpclient.RequestOption) (*mcpschema.ListToolsResult, error) {
	span := observe.Start(ctx, "mcp.tools.list.source", observe.Labels{Provider: c.serverName})
	result, err := client.ListTools(ctx, cursor, options...)
	span.End(observe.OutcomeFor(err), cache)
	return result, err
}
