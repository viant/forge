// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	service "github.com/viant/forge/backend/provider"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
	protoserver "github.com/viant/mcp-protocol/server"
)

func TestPortableToolsTransport(t *testing.T) {
	definition := &windowprotocol.Definition{ContractVersion: 1, DefinitionRevision: "rev-1", Window: &types.Window{View: types.View{Content: &types.Container{}}}, DataSources: map[string]*windowprotocol.DataSource{
		"rows": {ID: "rows", Backend: &windowprotocol.Backend{Kind: "provider", Method: windowprotocol.FetchTool, Pinned: map[string]any{"windowKey": "report", "dataSourceId": "rows", "definitionRevision": "rev-1"}}},
	}}
	provider := &service.PrimitiveProvider{Authority: service.PrimitiveAuthorityFuncs{AuthenticateFunc: func(context.Context) (string, error) { return "verified", nil }, AuthorizeFunc: func(context.Context, string, string, string, string) error { return nil }}, Host: service.PrimitiveHostFuncs{
		CatalogFunc: func(context.Context, *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error) {
			return &windowprotocol.Catalog{ContractVersion: 1, CatalogRevision: "catalog-1", Windows: []windowprotocol.WindowSummary{{Key: "report", Title: "Report"}}}, nil
		},
		DefinitionFunc: func(context.Context, *windowprotocol.DefinitionInput) (*windowprotocol.Definition, error) {
			return definition, nil
		},
		FetchFunc: func(context.Context, *windowprotocol.FetchInput) (windowprotocol.FetchOutput, error) {
			return json.RawMessage(`{"rows":[{"count":7}],"hasMore":false}`), nil
		},
	}}
	base := protoserver.NewDefaultHandler(nil, nil, nil)
	if err := registerTools(base, &Handler{DefaultHandler: base, service: service.NewService(&service.Config{PrimitiveProvider: provider})}); err != nil {
		t.Fatal(err)
	}
	base.ClientInitialize = &schema.InitializeRequestParams{ProtocolVersion: "2025-06-18"}
	for _, tc := range []struct {
		name     string
		args     map[string]any
		contains string
	}{
		{windowprotocol.CatalogTool, map[string]any{"contractVersion": 1}, `"catalogRevision":"catalog-1"`},
		{windowprotocol.DefinitionTool, map[string]any{"contractVersion": 1, "windowKey": "report"}, `"definitionRevision":"rev-1"`},
		{windowprotocol.FetchTool, map[string]any{"contractVersion": 1, "windowKey": "report", "dataSourceId": "rows", "definitionRevision": "rev-1"}, `"count":7`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result, err := base.CallTool(context.Background(), &jsonrpc.TypedRequest[*schema.CallToolRequest]{Request: &schema.CallToolRequest{Params: schema.CallToolRequestParams{Name: tc.name, Arguments: tc.args}}})
			if err != nil {
				t.Fatal(err)
			}
			if result.IsError != nil && *result.IsError {
				t.Fatalf("tool failed: %+v", result)
			}
			if !strings.Contains(result.Content[0].(schema.TextContent).Text, tc.contains) {
				t.Fatalf("transport projection changed: %+v", result)
			}
		})
	}
}

func TestPortableHandlerExposesOnlyPublishedResourceTools(t *testing.T) {
	svc := service.NewService(&service.Config{PrimitiveProvider: &service.PrimitiveProvider{}})
	handler, err := NewProviderHandler(svc)(context.Background(), nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	tools := handler.(*Handler).Registry.ListRegisteredTools()
	if len(tools) != 3 {
		t.Fatalf("standalone provider exposed %d tools", len(tools))
	}
	allowed := map[string]bool{windowprotocol.CatalogTool: true, windowprotocol.DefinitionTool: true, windowprotocol.FetchTool: true}
	for _, tool := range tools {
		if !allowed[tool.Name] {
			t.Fatalf("UI tool exposed by standalone provider: %s", tool.Name)
		}
	}
	if _, err = NewProviderHandler(service.NewService(nil))(context.Background(), nil, nil, nil); err == nil {
		t.Fatal("unconfigured portable handler accepted")
	}
}
