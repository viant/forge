// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
// Package datasource defines the workspace DataSource — a forge types.DataSource
// extended with an MCP-backed Backend and a per-user cache policy.
//
// A DataSource declares: how to fetch rows (Backend), how to project them
// (forge Selectors/Paging/UniqueKey embedded), and how to cache them (Cache).
// The service/datasource package consumes these declarations; the framework
// knows nothing about what any particular datasource "means".
package datasource

import (
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"time"

	"github.com/viant/forge/backend/types"
)

// DataSource is a workspace resource (extension/forge/datasources/*.yaml).
// It embeds the forge DataSource model and adds backend fetching, explicit
// response aliases, and per-user cache policy.
type DataSource struct {
	// Embedded forge DataSource carries Selectors, Parameters, Paging,
	// FilterSet, UniqueKey, Cardinality, SelectionMode, etc.
	types.DataSource `json:",inline" yaml:",inline"`

	// ID uniquely identifies this datasource within a workspace. It is
	// also the URL path segment used by the HTTP endpoint
	// /v1/api/datasources/{id}/fetch.
	ID string `json:"id" yaml:"id"`

	// Title is a human-readable label shown in admin UIs. Optional.
	Title string `json:"title,omitempty" yaml:"title,omitempty"`

	// Backend describes the upstream source. Required.
	Backend *Backend `json:"backend" yaml:"backend"`

	// ResponseAliases maps logical top-level row keys to exact producer keys.
	// It applies only to newly fetched rows, preserving original keys/values.
	ResponseAliases map[string]string `json:"responseAliases,omitempty" yaml:"responseAliases,omitempty"`

	// Cache policy. When nil, defaults apply (enabled=true, scope=user,
	// ttl=30m, refreshPolicy=stale-while-revalidate, maxEntries=5000).
	// Writers should declare cache: {enabled:false}; datasource semantics are
	// never inferred from a tool name or HTTP method.
	Cache *CachePolicy `json:"cache,omitempty" yaml:"cache,omitempty"`
}

// BackendKind enumerates the supported backend types. Adding a new kind is a
// single Source implementation + registration — nothing else in the pipeline
// changes.
type BackendKind string

const (
	BackendMCPTool       BackendKind = "mcp_tool"
	BackendMCPTools      BackendKind = "mcp_tools"
	BackendMCPFanout     BackendKind = "mcp_fanout"
	BackendMCPResource   BackendKind = "mcp_resource"
	BackendFeedRef       BackendKind = "feed_ref"
	BackendInline        BackendKind = "inline"
	BackendAuthorization BackendKind = "authorization"
	BackendDatly         BackendKind = "datly"
)

// Backend declares the upstream source for a DataSource.
//
// Auth is intentionally NOT a field here. The caller's identity flows through
// context.Context to the existing MCP tool-call path
// (internal/tool/registry Registry.Execute → protocol/mcp/proxy CallTool,
// with token attached by protocol/mcp/manager WithAuthTokenContext).
// service/datasource.Fetch preserves ctx by construction.
type Backend struct {
	// Ownership=provider retains execution at the selected resource provider.
	Ownership     string                `json:"ownership,omitempty" yaml:"ownership,omitempty"`
	Authorization *AuthorizationBinding `json:"authorization,omitempty" yaml:"authorization,omitempty"`
	// ProducerKind is host-owned classification. Datly requires an exact component pin.
	ProducerKind  string                           `json:"producerKind,omitempty" yaml:"producerKind,omitempty"`
	Component     *windowprotocol.ComponentBinding `json:"component,omitempty" yaml:"component,omitempty"`
	ServerVersion string                           `json:"serverVersion,omitempty" yaml:"serverVersion,omitempty"`
	Kind          BackendKind                      `json:"kind" yaml:"kind"`

	// mcp_tool
	Service string `json:"service,omitempty" yaml:"service,omitempty"`
	Method  string `json:"method,omitempty" yaml:"method,omitempty"`
	// RequestMetadata names literal top-level logical request keys omitted only
	// from MCP transport arguments. Cache and admission identity retain these keys.
	RequestMetadata []string `json:"requestMetadata,omitempty" yaml:"requestMetadata,omitempty"`
	// MCPRequest declares where an authored report query is placed in tool
	// arguments. Report compilers require an explicit mapping.
	MCPRequest *MCPRequestBinding `json:"mcpRequest,omitempty" yaml:"mcpRequest,omitempty"`
	Calls      []MCPCall          `json:"calls,omitempty" yaml:"calls,omitempty"`
	Fanout     *MCPFanout         `json:"fanout,omitempty" yaml:"fanout,omitempty"`
	Sort       []SortField        `json:"sort,omitempty" yaml:"sort,omitempty"`

	// mcp_resource
	URI string `json:"uri,omitempty" yaml:"uri,omitempty"`

	// feed_ref
	Feed string `json:"feed,omitempty" yaml:"feed,omitempty"`

	// inline
	Rows []map[string]interface{} `json:"rows,omitempty" yaml:"rows,omitempty"`
	// InlineFilters explicitly opt fixtures into request-scoped filtering.
	InlineFilters []InlineFilter `json:"inlineFilters,omitempty" yaml:"inlineFilters,omitempty"`

	// Pinned args — fixed inputs the workspace author sets. On merge with
	// caller-supplied inputs, Pinned wins on conflict.
	Pinned map[string]interface{} `json:"pinned,omitempty" yaml:"pinned,omitempty"`
}

// MCPRequestBinding names exact argument paths consumed by an MCP tool.
// Dotted paths are expanded by the datasource service's existing input mapper.
type MCPRequestBinding struct {
	QueryPath      string `json:"queryPath" yaml:"queryPath"`
	DataSourcePath string `json:"dataSourcePath,omitempty" yaml:"dataSourcePath,omitempty"`
	// AuthContextPath receives a server-verified auth.Context value, including
	// the current narrowed allowedEntities. Never populate it from authored
	// report input or caller-provided datasource arguments.
	AuthContextPath string `json:"authContextPath,omitempty" yaml:"authContextPath,omitempty"`
	// HasMorePath is the exact path in the projected DataInfo object used by
	// report callers to determine whether another offset page exists.
	HasMorePath string `json:"hasMorePath,omitempty" yaml:"hasMorePath,omitempty"`
	// CompleteResult is a server-owned assertion that the tool returns the
	// entire result in one call. When false, report callers require an explicit
	// hasMore signal and an offset page to prove completeness.
	CompleteResult bool `json:"completeResult,omitempty" yaml:"completeResult,omitempty"`
}

// MCPCall describes one call in a fixed MCP composite or a fanout stage.
type MCPCall struct {
	ID             string                            `json:"id,omitempty" yaml:"id,omitempty"`
	Service        string                            `json:"service,omitempty" yaml:"service,omitempty"`
	Method         string                            `json:"method,omitempty" yaml:"method,omitempty"`
	Args           map[string]string                 `json:"args,omitempty" yaml:"args,omitempty"`
	Pinned         map[string]interface{}            `json:"pinned,omitempty" yaml:"pinned,omitempty"`
	FieldMap       map[string]string                 `json:"fieldMap,omitempty" yaml:"fieldMap,omitempty"`
	Constants      map[string]interface{}            `json:"constants,omitempty" yaml:"constants,omitempty"`
	ValueMaps      map[string]map[string]interface{} `json:"valueMaps,omitempty" yaml:"valueMaps,omitempty"`
	IgnoreNotFound bool                              `json:"ignoreNotFound,omitempty" yaml:"ignoreNotFound,omitempty"`
}

type SortField struct {
	Field     string `json:"field,omitempty" yaml:"field,omitempty"`
	Direction string `json:"direction,omitempty" yaml:"direction,omitempty"`
}

type ValueSet struct {
	Selector  string                 `json:"selector,omitempty" yaml:"selector,omitempty"`
	Constants map[string]interface{} `json:"constants,omitempty" yaml:"constants,omitempty"`
}

type ListArgument struct {
	Target string            `json:"target,omitempty" yaml:"target,omitempty"`
	Fields map[string]string `json:"fields,omitempty" yaml:"fields,omitempty"`
}

// MCPFanout runs Seed once, expands ValueSets from ItemsSelector, and invokes
// Call once per seed item. Selector prefixes are inputs, item, selection, and result.
type MCPFanout struct {
	Seed                 MCPCall           `json:"seed" yaml:"seed"`
	ItemsSelector        string            `json:"itemsSelector,omitempty" yaml:"itemsSelector,omitempty"`
	Call                 MCPCall           `json:"call" yaml:"call"`
	ValueSets            []ValueSet        `json:"valueSets,omitempty" yaml:"valueSets,omitempty"`
	ListArgument         *ListArgument     `json:"listArgument,omitempty" yaml:"listArgument,omitempty"`
	ResultMap            string            `json:"resultMap,omitempty" yaml:"resultMap,omitempty"`
	ResultKey            string            `json:"resultKey,omitempty" yaml:"resultKey,omitempty"`
	IncludeUnresolved    bool              `json:"includeUnresolved,omitempty" yaml:"includeUnresolved,omitempty"`
	UnmappedAsUnresolved bool              `json:"unmappedAsUnresolved,omitempty" yaml:"unmappedAsUnresolved,omitempty"`
	FieldMap             map[string]string `json:"fieldMap,omitempty" yaml:"fieldMap,omitempty"`
}

// CacheScope keys the cache to a user, a conversation, or shares globally.
// This is a cache-key concern only. It is not an auth policy; auth flows via
// context.Context.
type CacheScope string

const (
	ScopeUser         CacheScope = "user"
	ScopeConversation CacheScope = "conversation"
	ScopeGlobal       CacheScope = "global"
)

// RefreshPolicy controls how stale entries are served.
type RefreshPolicy string

const (
	RefreshStaleWhileRevalidate RefreshPolicy = "stale-while-revalidate"
	RefreshOnMiss               RefreshPolicy = "refresh-on-miss"
	RefreshNone                 RefreshPolicy = "no-refresh"
)

// CachePolicy is per-datasource. Any omitted field picks up the documented
// default via CachePolicyOrDefault. Enabled=false bypasses get/put and makes
// invalidation a no-op.
type CachePolicy struct {
	Enabled       *bool         `json:"enabled,omitempty" yaml:"enabled,omitempty"`
	Scope         CacheScope    `json:"scope,omitempty" yaml:"scope,omitempty"`
	TTL           time.Duration `json:"ttl,omitempty" yaml:"ttl,omitempty"`
	MaxEntries    int           `json:"maxEntries,omitempty" yaml:"maxEntries,omitempty"`
	Key           []string      `json:"key,omitempty" yaml:"key,omitempty"`
	RefreshPolicy RefreshPolicy `json:"refreshPolicy,omitempty" yaml:"refreshPolicy,omitempty"`
}

// Defaults used when CachePolicy is nil or has zero-value fields.
const (
	DefaultTTL        = 30 * time.Minute
	DefaultMaxEntries = 5000
)

// CachePolicyOrDefault returns p filled in with defaults for zero-valued fields.
func CachePolicyOrDefault(p *CachePolicy) CachePolicy {
	enabled := true
	out := CachePolicy{
		Enabled:       &enabled,
		Scope:         ScopeUser,
		TTL:           DefaultTTL,
		MaxEntries:    DefaultMaxEntries,
		RefreshPolicy: RefreshStaleWhileRevalidate,
	}
	if p == nil {
		return out
	}
	if p.Enabled != nil {
		value := *p.Enabled
		out.Enabled = &value
	}
	if p.Scope != "" {
		out.Scope = p.Scope
	}
	if p.TTL > 0 {
		out.TTL = p.TTL
	}
	if p.MaxEntries > 0 {
		out.MaxEntries = p.MaxEntries
	}
	if p.RefreshPolicy != "" {
		out.RefreshPolicy = p.RefreshPolicy
	}
	if len(p.Key) > 0 {
		out.Key = append([]string{}, p.Key...)
	}
	return out
}

// FetchResult is returned by service/datasource.Fetch — the already-projected
// forge payload that Item.Lookup dialogs consume.
type FetchResult struct {
	Rows     []map[string]interface{} `json:"rows"`
	DataInfo map[string]interface{}   `json:"dataInfo,omitempty"`
	Metrics  map[string]interface{}   `json:"metrics,omitempty"`
	Cache    *CacheMeta               `json:"cache,omitempty"`
}

// CacheMeta carries provenance on a FetchResult so clients can render
// "from cache / just fetched / stale".
type CacheMeta struct {
	Hit        bool      `json:"hit"`
	Stale      bool      `json:"stale,omitempty"`
	FetchedAt  time.Time `json:"fetchedAt"`
	TTLSeconds int       `json:"ttlSeconds,omitempty"`
}

// InlineFilter binds a request input to one inline row field. Missing inputs are
// ignored. Operators are eq, gte, and lte; date values use YYYY-MM-DD.
type InlineFilter struct {
	Field    string `json:"field" yaml:"field"`
	Input    string `json:"input" yaml:"input"`
	Operator string `json:"operator" yaml:"operator"`
	Type     string `json:"type,omitempty" yaml:"type,omitempty"`
}

// AuthorizationBinding is a trusted selected-permission query. Only IDs are
// caller inputs; identity, resource type and requested capabilities are not.
type AuthorizationBinding struct {
	IncludePrincipal    bool     `json:"includePrincipal,omitempty" yaml:"includePrincipal,omitempty"`
	SchemaVersion       int      `json:"schemaVersion" yaml:"schemaVersion"`
	ResourceType        string   `json:"resourceType" yaml:"resourceType"`
	ResourceIDsArgument string   `json:"resourceIdsArgument" yaml:"resourceIdsArgument"`
	Capabilities        []string `json:"capabilities" yaml:"capabilities"`
	MaxResourceIDs      int      `json:"maxResourceIds" yaml:"maxResourceIds"`
}
