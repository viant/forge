package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"

	identity "github.com/viant/forge/backend/resource"
	mcpcfg "github.com/viant/mcp/client/config"
)

// MCPDefinitionSource is trusted catalog routing, not a second transport config.
type MCPDefinitionSource struct{ ConnectionName, ProviderIdentity, Namespace string }

// MCPReferenceReader implements manager.DefinitionReader through the shared
// gateway. It retains only bounded, scoped URI-to-owner selections; no catalog
// bytes, credentials or resolved client configurations are stored here.
type MCPReferenceReader struct {
	gateway  *Gateway
	internal MCPDefinitionSource
	catalogs []identity.ResourceRef
	reserved map[string]bool
	memoMu   sync.RWMutex
	memo     map[mcpReferenceMemoKey]mcpReferenceMemoEntry
}

func NewMCPReferenceReader(g *Gateway, internal MCPDefinitionSource, catalogs []identity.ResourceRef) (*MCPReferenceReader, error) {
	if g == nil || g.Manager == nil || internal.ConnectionName == "" || internal.ProviderIdentity == "" || internal.Namespace == "" {
		return nil, fmt.Errorf("MCP definition reader requires an explicit internal source")
	}
	probe := identity.ResourceURI{Kind: "mcp", Namespace: internal.Namespace, Name: "probe"}
	if !probe.Valid() {
		return nil, identity.ErrResource
	}
	seen := map[string]bool{}
	for _, ref := range catalogs {
		uri, err := identity.ParseResourceURI(ref.URI)
		if err != nil || uri.Kind != "mcp" || uri.Namespace != internal.Namespace || seen[ref.URI] {
			return nil, fmt.Errorf("MCP catalog must reference a unique internal MCP definition")
		}
		seen[ref.URI] = true
	}
	return &MCPReferenceReader{gateway: g, internal: internal, catalogs: append([]identity.ResourceRef(nil), catalogs...), reserved: map[string]bool{}}, nil
}

// ReserveLocalNames is construction-only. Dynamic aliases are checked on every
// inventory publication/load; reservation does not fetch private user catalogs.
func (r *MCPReferenceReader) ReserveLocalNames(names []string) error {
	reserved := map[string]bool{}
	for _, name := range names {
		if name == "" {
			return ErrCollision
		}
		reserved[name] = true
	}
	for _, ref := range r.catalogs {
		uri, _ := identity.ParseResourceURI(ref.URI)
		if reserved[uri.Name] {
			return ErrCollision
		}
	}
	r.reserved = reserved
	return nil
}
func (r *MCPReferenceReader) internalRoot() Connection {
	return Connection{Name: r.internal.ConnectionName, ProviderIdentity: r.internal.ProviderIdentity}
}

// DefinitionGeneration fences request-local MCP definition reuse against
// owning-provider resource notifications and connection replacement.
func (r *MCPReferenceReader) DefinitionGeneration(ctx context.Context) string {
	names := []string{r.internal.ConnectionName}
	for _, ref := range r.catalogs {
		uri, _ := identity.ParseResourceURI(ref.URI)
		names = append(names, uri.Name)
	}
	sort.Strings(names)
	parts := make([]string, 0, len(names))
	for _, name := range names {
		parts = append(parts, fmt.Sprintf("%s:%d:%v", name, r.gateway.generation(name), r.gateway.Manager.ResourceCatalogGeneration(ctx, name)))
	}
	return strings.Join(parts, "|")
}

func (r *MCPReferenceReader) DefinitionContentGeneration(ctx context.Context) string {
	names := []string{r.internal.ConnectionName}
	for _, ref := range r.catalogs {
		uri, _ := identity.ParseResourceURI(ref.URI)
		names = append(names, uri.Name)
	}
	sort.Strings(names)
	parts := make([]string, 0, len(names))
	for _, name := range names {
		parts = append(parts, fmt.Sprintf("%s:%d:%v:%v", name, r.gateway.generation(name), r.gateway.Manager.ResourceCatalogGeneration(ctx, name), r.gateway.Manager.ResourceContentGeneration(ctx, name)))
	}
	return strings.Join(parts, "|")
}
func (r *MCPReferenceReader) rows(ctx context.Context, root Connection, namespace string) ([]Located[json.RawMessage], error) {
	if root.Name != r.internal.ConnectionName {
		if selected, supported, err := r.filteredMCPRows(ctx, root); supported || err != nil {
			return selected, err
		}
	}
	var rows []Located[json.RawMessage]
	query := CatalogQuery{Namespace: namespace, Limit: 1000}
	for {
		page, err := ListPageFrom[json.RawMessage](ctx, r.gateway, []Connection{root}, "mcp", query)
		if err != nil {
			return nil, err
		}
		rows = append(rows, page.Items...)
		if page.Complete {
			return rows, nil
		}
		if page.NextCursor == "" {
			return nil, identity.ErrResource
		}
		query.Cursor = page.NextCursor
	}
}
func (r *MCPReferenceReader) externalRoots(ctx context.Context) ([]Connection, error) {
	roots := make([]Connection, 0, len(r.catalogs))
	for _, ref := range r.catalogs {
		config, err := r.internalDefinition(ctx, ref)
		if err != nil {
			return nil, err
		}
		uri, _ := identity.ParseResourceURI(ref.URI)
		roots = append(roots, Connection{Name: uri.Name, ProviderIdentity: config.PrimitiveProviderIdentity})
	}
	return roots, nil
}
func (r *MCPReferenceReader) internalDefinition(ctx context.Context, ref identity.ResourceRef) (*mcpcfg.MCPClient, error) {
	result, err := GetFrom[*mcpcfg.MCPClient](ctx, r.gateway, r.internalRoot(), ref, func(raw json.RawMessage) (*mcpcfg.MCPClient, error) { return DecodeMCPDefinition(1, raw) })
	if err != nil {
		return nil, err
	}
	uri, _ := identity.ParseResourceURI(ref.URI)
	result.Definition.ResolvedIdentity = &mcpcfg.ResolvedServiceIdentity{ServiceName: uri.Name, ResourceURI: ref.URI, ProviderIdentity: result.ResolvedResource.ProviderIdentity}
	return r.effectiveOptions(ctx, r.internalRoot(), r.internal.Namespace, result.Definition)
}
func (r *MCPReferenceReader) effectiveOptions(ctx context.Context, source Connection, namespace string, config *mcpcfg.MCPClient) (*mcpcfg.MCPClient, error) {
	options, err := r.gateway.Manager.Options(ctx, source.Name)
	if err != nil {
		return nil, err
	}
	scope, err := options.ResourceCacheScope(namespace, "mcp")
	if err != nil {
		return nil, err
	}
	if scope == mcpcfg.ResourceCachePublic {
		return config, nil
	}
	// Narrow only the detached effective runtime config. Authored bytes and YAML
	// remain complete; a private parent cannot publish globally shared children.
	config.ToolsListVisibility = mcpcfg.ToolsListVisibilityPrivate
	scopes := map[string]string{}
	for key, value := range config.ResourceCacheScopes {
		if value == mcpcfg.ResourceCachePublic || scope == mcpcfg.ResourceCacheConversation {
			value = scope
		}
		scopes[key] = value
	}
	if scope == mcpcfg.ResourceCacheConversation {
		scopes["*"] = scope
	}
	config.ResourceCacheScopes = scopes
	return config, nil
}
func (r *MCPReferenceReader) inventory(ctx context.Context, external bool, targetNamespace ...string) ([]Located[json.RawMessage], error) {
	rows, err := r.rows(ctx, r.internalRoot(), r.internal.Namespace)
	if err != nil {
		return nil, err
	}
	if external {
		roots, err := r.externalRoots(ctx)
		if err != nil {
			return nil, err
		}
		for _, root := range roots {
			if len(targetNamespace) == 1 && targetNamespace[0] != "" {
				options, optionsErr := r.gateway.Manager.Options(ctx, root.Name)
				if optionsErr != nil {
					return nil, optionsErr
				}
				if options == nil {
					return nil, ErrUnavailable
				}
				if len(options.PrimitiveNamespaces) > 0 {
					matches := false
					for _, namespace := range options.PrimitiveNamespaces {
						if namespace == targetNamespace[0] || namespace == "ns://"+targetNamespace[0] {
							matches = true
						}
					}
					if !matches {
						continue // Explicit producer namespace restrictions exclude this URI.
					}
				}
			}
			additional, err := r.rows(ctx, root, "")
			if err != nil {
				return nil, err
			}
			rows = append(rows, additional...)
		}
	}
	localNames := map[string]bool{}
	for _, row := range rows {
		if row.Connection.Name == r.internal.ConnectionName {
			if r.reserved[row.Resource.Name] {
				return nil, fmt.Errorf("%w: MCP alias collides with a reserved local connection", ErrCollision)
			}
			localNames[row.Resource.Name] = true
		}
	}
	uris := map[string]string{}
	selected := make([]Located[json.RawMessage], 0, len(rows))
	for _, row := range rows {
		// Operator-owned definitions win by logical MCP name, including callers
		// using the published canonical service URI. In-process names above remain
		// reserved independently; this never changes ordinary resource selection.
		if row.Connection.Name != r.internal.ConnectionName && localNames[row.Resource.Name] {
			continue
		}
		origin := row.Connection.Name + "\x00" + row.Connection.ProviderIdentity + "\x00" + row.Resource.URI
		if previous := uris[row.Resource.URI]; previous != "" && previous != origin {
			return nil, fmt.Errorf("%w: ambiguous MCP URI", ErrCollision)
		}
		uris[row.Resource.URI] = origin
		selected = append(selected, row)
	}
	return selected, nil
}

// Configuration lookup is a separate metadata operation. Preserve credentials,
// cancellation and tracing, but do not borrow another gateway's selection/facts
// memo. Caller errors still propagate through the manager's normal boundary.
func (r *MCPReferenceReader) metadataContext(ctx context.Context) context.Context {
	if held := sequenceFromContext(ctx); held != nil && held.gateway != r.gateway {
		return context.WithValue(ctx, resourceReadSequenceKey{}, (*resourceReadSequence)(nil))
	}
	return ctx
}
func (r *MCPReferenceReader) List(ctx context.Context) ([]string, error) {
	ctx = r.metadataContext(ctx)
	rows, err := r.inventory(ctx, true)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(rows))
	for _, row := range rows {
		name := row.Resource.Name
		if row.Connection.Name != r.internal.ConnectionName {
			name = row.Resource.URI
		}
		names = append(names, name)
	}
	sort.Strings(names)
	return names, nil
}

// CatalogNames preserves configured discovery roots without promoting every
// datasource's published MCP backend into a second resource provider.
func (r *MCPReferenceReader) CatalogNames(ctx context.Context) ([]string, error) {
	rows, err := r.inventory(r.metadataContext(ctx), false)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(rows))
	for _, row := range rows {
		names = append(names, row.Resource.Name)
	}
	sort.Strings(names)
	return names, nil
}
func (r *MCPReferenceReader) Load(ctx context.Context, name string) (*mcpcfg.MCPClient, error) {
	ctx = r.metadataContext(ctx)
	if r.reserved[name] {
		return nil, ErrCollision
	}
	// Explicit catalog roots always bootstrap from the internal source. They
	// cannot depend on aggregate enumeration of their own connection options.
	for _, ref := range r.catalogs {
		uri, _ := identity.ParseResourceURI(ref.URI)
		if name == uri.Name || name == ref.URI {
			return r.internalDefinition(ctx, ref)
		}
	}
	internal, err := r.inventory(ctx, false)
	if err != nil {
		return nil, err
	}
	localName := name
	if target, parseErr := identity.ParseResourceURI(name); parseErr == nil && target.Kind == "mcp" {
		localName = target.Name
	}
	find := func(rows []Located[json.RawMessage]) (*Located[json.RawMessage], error) {
		var found *Located[json.RawMessage]
		for i := range rows {
			row := &rows[i]
			match := row.Resource.URI == name || row.Resource.Name == name
			if row.Connection.Name == r.internal.ConnectionName && row.Resource.Name == localName {
				match = true
			}
			if !strings.Contains(name, "://") {
				match = match || row.Resource.Name == strings.ReplaceAll(name, "/", "_")
			}
			if match {
				if found != nil && found.Resource.URI != row.Resource.URI {
					return nil, ErrCollision
				}
				found = row
			}
		}
		return found, nil
	}
	selected, err := find(internal)
	if err != nil {
		return nil, err
	}
	var selectionStart mcpReferenceMemoKey
	if selected == nil {
		// Check local precedence before reusing a remote URI-to-owner memo. A
		// newly supplied operator definition must also win over a warm remote.
		if target, parseErr := identity.ParseResourceURI(name); parseErr == nil && target.Kind == "mcp" && target.Namespace != r.internal.Namespace {
			selectionStart, _, err = r.memoKey(ctx, target.String())
			if err != nil {
				return nil, err
			}
			if cached, found, err := r.memoLoad(ctx, target); found || err != nil {
				return cached, err
			}
		}
		namespace := ""
		if target, parseErr := identity.ParseResourceURI(name); parseErr == nil && target.Kind == "mcp" {
			namespace = target.Namespace
		}
		all, err := r.inventory(ctx, true, namespace)
		if err != nil {
			return nil, err
		}
		selected, err = find(all)
		if err != nil {
			return nil, err
		}
	}
	if selected == nil {
		return nil, fmt.Errorf("MCP definition not found")
	}
	var result *Result[*mcpcfg.MCPClient]
	if selected.Connection.Name != r.internal.ConnectionName {
		// The exact URI came from the owning provider's authenticated mcp-only
		// index above. Get still validates the provider's current read, actor,
		// binding, fingerprint and lease before returning the definition.
		ctx = context.WithValue(ctx, mcpReferenceProofKey{}, mcpReferenceProof{connection: selected.Connection, uri: selected.Resource.URI})
		result, err = Get[*mcpcfg.MCPClient](ctx, r.gateway, selected.Connection, identity.ResourceRef{URI: selected.Resource.URI}, nil, func(raw json.RawMessage) (*mcpcfg.MCPClient, error) { return DecodeMCPDefinition(1, raw) })
	} else {
		result, err = GetFrom[*mcpcfg.MCPClient](ctx, r.gateway, selected.Connection, identity.ResourceRef{URI: selected.Resource.URI}, func(raw json.RawMessage) (*mcpcfg.MCPClient, error) { return DecodeMCPDefinition(1, raw) })
	}
	if err != nil {
		return nil, err
	}
	serviceName := selected.Resource.Name
	if selected.Connection.Name != r.internal.ConnectionName {
		serviceName = selected.Resource.URI
	}
	result.Definition.ResolvedIdentity = &mcpcfg.ResolvedServiceIdentity{ServiceName: serviceName, ResourceURI: selected.Resource.URI, ProviderIdentity: selected.Connection.ProviderIdentity}
	options, err := r.effectiveOptions(ctx, selected.Connection, selected.Resource.Namespace, result.Definition)
	if err == nil && selected.Connection.Name != r.internal.ConnectionName && name == selected.Resource.URI && result.ResolvedResource != nil {
		r.memoSave(ctx, selected, result.ResolvedResource.ValidUntil, selectionStart)
	}
	return options, err
}
