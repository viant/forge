package mcp

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/forge/backend/mcp/service"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
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
	for _, name := range []string{"forgeActiveWindowList", "forgeActiveWindowGet", "forgeUISnapshot"} {
		if !found[name] {
			t.Errorf("missing MCP tool %s", name)
		}
	}
	if found["window-list"] || found["window-get"] {
		t.Fatal("unconfigured saved catalog advertised definition tools")
	}
}

func TestSavedDefinitionsThroughMCPToolCalls(t *testing.T) {
	root := t.TempDir()
	for name, body := range map[string]string{
		"records.yaml": "dataSource:\n  records:\n    service: {endpoint: '/mock', uri: '/records', method: GET}\nview: {content: {id: root}}\n",
		"catalog.yaml": "baseURL: .\nwindows:\n  - {windowId: records, title: Records, key: records}\n",
	} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	catalog, err := service.LoadWindowCatalog(filepath.Join(root, "catalog.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	base := protoserver.NewDefaultHandler(nil, nil, nil)
	svc := service.NewService(&service.Config{WindowDefinitions: catalog})
	if err = registerTools(base, &Handler{DefaultHandler: base, service: svc}); err != nil {
		t.Fatal(err)
	}
	base.ClientInitialize = &schema.InitializeRequestParams{ProtocolVersion: "2025-06-18"}
	listed, rpcErr := base.ListTools(context.Background(), &jsonrpc.TypedRequest[*schema.ListToolsRequest]{Request: &schema.ListToolsRequest{}})
	if rpcErr != nil {
		t.Fatal(rpcErr)
	}
	found := map[string]bool{}
	for _, tool := range listed.Tools {
		found[tool.Name] = true
	}
	for _, name := range []string{"window-list", "window-get"} {
		if !found[name] {
			t.Fatalf("missing tool %s", name)
		}
	}
	call := func(name string, args map[string]any) (*schema.CallToolResult, *jsonrpc.Error) {
		return base.CallTool(context.Background(), &jsonrpc.TypedRequest[*schema.CallToolRequest]{Request: &schema.CallToolRequest{Params: schema.CallToolRequestParams{Name: name, Arguments: args}}})
	}
	result, rpcErr := call("window-list", map[string]any{"query": "rec", "limit": 1})
	if rpcErr != nil {
		t.Fatal(rpcErr)
	}
	text := result.Content[0].(schema.TextContent).Text
	if !strings.Contains(text, `"windowId":"records"`) || strings.Contains(text, "dataSource") {
		t.Fatalf("list response=%s", text)
	}
	result, rpcErr = call("window-get", map[string]any{"windowId": "records"})
	if rpcErr != nil {
		t.Fatal(rpcErr)
	}
	var response service.WindowDefinitionGetOutput
	if err = json.Unmarshal([]byte(result.Content[0].(schema.TextContent).Text), &response); err != nil {
		t.Fatal(err)
	}
	if response.Definition == nil || response.Definition.DataSource["records"].Service.URI != "/records" {
		t.Fatalf("get omitted datasource definition: %+v", response)
	}
	if _, rpcErr = call("window-get", map[string]any{"windowId": "../records"}); rpcErr == nil {
		t.Fatal("unknown path accepted as windowId")
	}
}
