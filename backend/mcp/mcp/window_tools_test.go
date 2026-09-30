package mcp

import (
	"testing"

	"github.com/viant/forge/backend/mcp/service"
	protoserver "github.com/viant/mcp-protocol/server"
)

func TestWindowLookupToolsAreRegistered(t *testing.T) {
	base := protoserver.NewDefaultHandler(nil, nil, nil)
	if err := registerTools(base, &Handler{DefaultHandler: base, service: service.NewService(&service.Config{})}); err != nil {
		t.Fatal(err)
	}
	found := map[string]bool{}
	for _, tool := range base.Registry.ListRegisteredTools() {
		found[tool.Name] = true
	}
	for _, name := range []string{"forgeWindowList", "forgeWindowGet", "forgeUISnapshot"} {
		if !found[name] {
			t.Errorf("missing MCP tool %s", name)
		}
	}
}
