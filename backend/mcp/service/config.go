package service

// Config configures the Forge UI bridge service.
type Config struct {
	// WindowDefinitions is the host-owned catalog of saved Forge definitions.
	// Its provider must enforce visibility/read policy before returning entries.
	WindowDefinitions WindowDefinitionCatalog
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
