// Package mcpname preserves the client-pool naming API while the shared MCP
// package owns tool alias normalization.
package mcpname

import shared "github.com/viant/mcp/client/toolname"

type Name = shared.Name

func Canonical(raw string) string       { return shared.Canonical(raw) }
func Display(raw string) string         { return shared.Display(raw) }
func NewName(service, name string) Name { return shared.NewName(service, name) }
