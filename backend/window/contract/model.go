// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
// Package window defines provider-owned window transport. Provider
// connections and credentials stay on the provider; consumers bind the MCP
// server explicitly in their own configuration.
package window

import (
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/viant/forge/backend/types"
)

const Version = 1
const CatalogTool = "forgeWindowCatalog"
const DefinitionTool = "forgeWindowDefinition"
const FetchTool = "forgeDatasourceFetch"

type CatalogInput struct {
	ContractVersion int    `json:"contractVersion" yaml:"contractVersion"`
	ApplicationID   string `json:"applicationId,omitempty" yaml:"applicationId,omitempty"`
	Group           string `json:"group,omitempty" yaml:"group,omitempty"`
	Cursor          string `json:"cursor,omitempty" yaml:"cursor,omitempty"`
	Limit           int    `json:"limit,omitempty" yaml:"limit,omitempty"`
}
type Group struct {
	ID    string `json:"id" yaml:"id"`
	Title string `json:"title" yaml:"title"`
}
type WindowSummary struct {
	ResourceURI   string                   `json:"resourceUri,omitempty" yaml:"resourceUri,omitempty"`
	Namespace     string                   `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	Name          string                   `json:"name,omitempty" yaml:"name,omitempty"`
	Key           string                   `json:"key" yaml:"key"`
	Title         string                   `json:"title" yaml:"title"`
	GroupID       string                   `json:"groupId,omitempty" yaml:"groupId,omitempty"`
	Icon          string                   `json:"icon,omitempty" yaml:"icon,omitempty"`
	Parameters    map[string]any           `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Authorization *types.AuthorizationSpec `json:"authorization,omitempty" yaml:"authorization,omitempty"`
}
type Catalog struct {
	ContractVersion int             `json:"contractVersion" yaml:"contractVersion"`
	CatalogRevision string          `json:"catalogRevision" yaml:"catalogRevision"`
	Groups          []Group         `json:"groups,omitempty" yaml:"groups,omitempty"`
	Windows         []WindowSummary `json:"windows" yaml:"windows"`
	NextCursor      string          `json:"nextCursor,omitempty" yaml:"nextCursor,omitempty"`
}
type DefinitionInput struct {
	Resource        *identity.ResourceRef `json:"resource,omitempty" yaml:"resource,omitempty"`
	ContractVersion int                   `json:"contractVersion" yaml:"contractVersion"`
	WindowKey       string                `json:"windowKey" yaml:"windowKey"`
}

// Backend uses a provider-local dispatch identity, never a downstream service
// alias. The consumer sets the configured provider's server binding.
type Backend struct {
	// Ownership is "provider" for private delegated execution or "host" for
	// a consumer-owned explicit Service binding. Neither conveys credentials.
	Ownership         string            `json:"ownership,omitempty" yaml:"ownership,omitempty"`
	SchemaFingerprint string            `json:"schemaFingerprint,omitempty" yaml:"schemaFingerprint,omitempty"`
	Component         *ComponentBinding `json:"component,omitempty" yaml:"component,omitempty"`
	Kind              string            `json:"kind" yaml:"kind"`
	// Service is a logical alias for explicit consumer host bindings only.
	// Provider-delegated sources leave this empty.
	Service    string         `json:"service,omitempty" yaml:"service,omitempty"`
	Method     string         `json:"method" yaml:"method"`
	Pinned     map[string]any `json:"pinned" yaml:"pinned"`
	MCPRequest map[string]any `json:"mcpRequest,omitempty" yaml:"mcpRequest,omitempty"`
}
type DataSource struct {
	types.DataSource `json:",inline" yaml:",inline"`
	ID               string            `json:"id" yaml:"id"`
	Backend          *Backend          `json:"backend" yaml:"backend"`
	ResponseAliases  map[string]string `json:"responseAliases,omitempty" yaml:"responseAliases,omitempty"`
}
type Definition struct {
	Resource           *identity.ResolvedResource `json:"resource,omitempty" yaml:"resource,omitempty"`
	ContractVersion    int                        `json:"contractVersion" yaml:"contractVersion"`
	DefinitionRevision string                     `json:"definitionRevision" yaml:"definitionRevision"`
	Window             *types.Window              `json:"window" yaml:"window"`
	Report             *reportspec.ReportSpec     `json:"report,omitempty" yaml:"report,omitempty"`
	DataSources        map[string]*DataSource     `json:"dataSources,omitempty" yaml:"dataSources,omitempty"`
}
type FetchInput struct {
	Resource           *identity.ResolvedResource `json:"resource,omitempty" yaml:"resource,omitempty"`
	ContractVersion    int                        `json:"contractVersion" yaml:"contractVersion"`
	DefinitionRevision string                     `json:"definitionRevision" yaml:"definitionRevision"`
	WindowKey          string                     `json:"windowKey" yaml:"windowKey"`
	DataSourceID       string                     `json:"dataSourceId" yaml:"dataSourceId"`
	Inputs             map[string]any             `json:"inputs,omitempty" yaml:"inputs,omitempty"`
}

// FetchOutput is the raw producer response. Selectors and paging remain in the
// published datasource contract, so there is no second projection on provider.
type FetchOutput = json.RawMessage
