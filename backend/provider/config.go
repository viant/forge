// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"github.com/viant/forge/backend/reporting/catalog"
)

// Config configures the Forge UI bridge service.
type Config struct {
	// NamespaceResolver is a trusted server callback. Configured auth mode must
	// resolve identity before UI registration; client token hints never select it.
	NamespaceResolver       NamespaceResolver
	WindowReadDecisionScope WindowReadDecisionScope
	WindowUIProjection      WindowUIProjection
	WindowSelectionEmitter  WindowSelectionEmitter
	ReportCatalog           catalog.Provider
	// PrimitiveProvider exposes published remote windows and provider execution.
	PrimitiveProvider *PrimitiveProvider
	// WindowDefinitions is the host-owned catalog of saved Forge definitions.
	// Its provider must enforce visibility/read policy before returning entries.
	WindowDefinitions WindowDefinitionCatalog
	// MetadataScope is an explicit verified-principal scope for metadata reads.
	// It is never inferred from PrimitiveProvider or applied to execution.
	MetadataScope MetadataReadScope
	// DynamicWindowAuthorizer checks ui.window.openDynamic using trusted host
	// mappings. It is required alongside the catalog callback in authz mode.
	DynamicWindowAuthorizer WindowAuthorizer
	// Token authenticates UI clients (frontend sends it as ui.hello.token).
	Token string

	// RequireToken enforces that Token is non-empty and must match on ui.hello.
	// Recommended true.
	RequireToken bool

	// LocalOnly enforces that WS clients connect from loopback and use a localhost host.
	// Recommended true.
	LocalOnly bool

	// AllowedOrigins is an optional allowlist for the websocket Origin header.
	// When empty, only empty Origin or localhost/127.0.0.1 origins are accepted.
	AllowedOrigins []string

	// UseData controls whether tool results are returned as structured content
	// (StructuredContent) instead of JSON text in Content[].Text.
	UseData bool
}
