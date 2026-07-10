import assert from "node:assert/strict";

import {
  resolveReportBuilderDatasetPreviewFetcher,
  resolveReportBuilderMCPExecutionContext,
} from "./reportBuilderDataSourceFetch.js";

const dataset = {
  id: "forecast_summary",
  dataSourceRef: "mcpOnlySource",
  label: "Forecast Summary",
  source: {
    kind: "mcp",
    toolName: "demo:forecast_summary",
    assistantText: "Legacy dataset assistant text should be ignored",
    toolBundles: ["legacy_bundle_should_be_ignored"],
  },
  request: {
    query: "forecast_summary",
  },
};

const genericMCPToolDataset = {
  id: "performance_summary",
  dataSourceRef: "mcpToolSource",
  label: "Performance Summary",
  source: {
    kind: "mcp_tool",
    tool: "demo:performance_summary",
  },
  request: {
    query: "performance_summary",
  },
};

const declaredMCPDatasetWithAmbientDataSource = {
  id: "declared_mcp_summary",
  dataSourceRef: "ambientDataSource",
  label: "Declared MCP Summary",
  source: {
    kind: "mcp_tool",
    tool: "demo:declared_mcp_summary",
  },
  request: {
    query: "declared_mcp_summary",
  },
};

{
  const builderContext = {
    conversationId: "conv-preview",
  };
  const resolved = resolveReportBuilderMCPExecutionContext(builderContext, dataset, {
    requestKind: "runtimePreviewDataset",
    toolName: "demo:forecast_summary",
  });
  assert.deepEqual(resolved, {
    conversationId: "conv-preview",
    assistantText: "Fetch report dataset Forecast Summary",
    toolBundles: [],
  });
}

{
  const builderContext = {
    windowState: {
      conversationId: "conv-window-fallback",
    },
    handlers: {
      mcpTool: {
        resolveExecution({ conversationId, defaultAssistantText, toolName, dataset: resolvedDataset }) {
          assert.equal(conversationId, "conv-window-fallback");
          assert.equal(defaultAssistantText, "Fetch report dataset Forecast Summary");
          assert.equal(toolName, "demo:forecast_summary");
          assert.equal(resolvedDataset?.source?.assistantText, "Legacy dataset assistant text should be ignored");
          return {
            conversationId,
            assistantText: `${defaultAssistantText} via host`,
            toolBundles: ["mcp_ui_preview_queue"],
          };
        },
        async executeRequest(payload) {
          return {
            structuredContent: {
              payload,
            },
          };
        },
      },
    },
    Context() {
      const error = new Error("DataSource not found: mcpOnlySource");
      error.code = "DataSourceNotFound";
      error.dataSourceRef = "mcpOnlySource";
      throw error;
    },
  };
  const fetcher = resolveReportBuilderDatasetPreviewFetcher(builderContext, dataset);
  assert.equal(fetcher.source, "mcpTool");
  const response = await fetcher.fetcher({
    parameters: dataset.request,
  });
  assert.deepEqual(response, {
    payload: {
      conversationId: "conv-window-fallback",
      toolName: "demo:forecast_summary",
      arguments: {
        query: "forecast_summary",
      },
      assistantText: "Fetch report dataset Forecast Summary via host",
      toolBundles: ["mcp_ui_preview_queue"],
    },
  });
}

{
  const builderContext = {
    conversationId: "conv-mcp-tool",
    handlers: {
      mcpTool: {
        async executeRequest(payload) {
          return {
            structuredContent: {
              payload,
            },
          };
        },
      },
    },
    Context() {
      const error = new Error("DataSource not found: mcpToolSource");
      error.code = "DataSourceNotFound";
      error.dataSourceRef = "mcpToolSource";
      throw error;
    },
  };
  const fetcher = resolveReportBuilderDatasetPreviewFetcher(builderContext, genericMCPToolDataset);
  assert.equal(fetcher.source, "mcpTool");
  const response = await fetcher.fetcher({
    parameters: genericMCPToolDataset.request,
  });
  assert.deepEqual(response, {
    payload: {
      conversationId: "conv-mcp-tool",
      toolName: "demo:performance_summary",
      arguments: {
        query: "performance_summary",
      },
      assistantText: "Fetch report dataset Performance Summary",
      toolBundles: [],
    },
  });
}

{
  const builderContext = {
    conversationId: "conv-declared-mcp",
    handlers: {
      mcpTool: {
        async executeRequest(payload) {
          throw new Error(`Declared MCP datasets should prefer the datasource boundary when ${payload?.toolName || "the tool"} also has a dataSourceRef.`);
        },
      },
    },
    Context(dataSourceRef) {
      assert.equal(dataSourceRef, "ambientDataSource");
      return {
        dataSource: {
          selectors: {
            data: "rows",
          },
        },
        handlers: {
          dataSource: {
            async fetchRecords({ parameters }) {
              assert.deepEqual(parameters, {
                query: "declared_mcp_summary",
              });
              return {
                rows: [
                  { segment: "A", spend: 14 },
                  { segment: "B", spend: 9 },
                ],
              };
            },
          },
        },
      };
    },
  };
  const fetcher = resolveReportBuilderDatasetPreviewFetcher(builderContext, declaredMCPDatasetWithAmbientDataSource);
  assert.equal(fetcher.source, "dataSource");
  const body = await fetcher.fetcher({
    parameters: declaredMCPDatasetWithAmbientDataSource.request,
  });
  assert.deepEqual(fetcher.resolveResult(body), {
    rows: [
      { segment: "A", spend: 14 },
      { segment: "B", spend: 9 },
    ],
    hasMore: false,
  });
}

{
  const builderContext = {
    conversationId: "conv-route-authoring",
    handlers: {
      reportBuilderPreview: {
        async fetchByRef({ dataSourceRef, parameters, builderContext: nestedBuilderContext, omitConversationId }) {
          assert.equal(dataSourceRef, "ambientDataSource");
          assert.deepEqual(parameters, {
            query: "declared_mcp_summary",
          });
          assert.equal(nestedBuilderContext?.conversationId, "conv-route-authoring");
          assert.equal(omitConversationId, true);
          return {
            rows: [
              { segment: "A", spend: 14 },
              { segment: "B", spend: 9 },
            ],
          };
        },
      },
      mcpTool: {
        async executeRequest(payload) {
          throw new Error(`Datasource route should win before MCP fallback for ${payload?.toolName || "the declared tool"}.`);
        },
      },
    },
    Context(dataSourceRef) {
      assert.equal(dataSourceRef, "ambientDataSource");
      return {
        dataSource: {
          selectors: {
            data: "rows",
          },
        },
        handlers: {
          dataSource: {
            async fetchRecords() {
              throw new Error("Ambient datasource handler should not win when authored runtime preview prefers the datasource route.");
            },
          },
        },
      };
    },
  };
  const fetcher = resolveReportBuilderDatasetPreviewFetcher(builderContext, declaredMCPDatasetWithAmbientDataSource, {
    preferDataSourceRoute: true,
    omitConversationId: true,
  });
  assert.equal(fetcher.source, "dataSourceRoute");
  const body = await fetcher.fetcher({
    parameters: declaredMCPDatasetWithAmbientDataSource.request,
  });
  assert.deepEqual(fetcher.resolveResult(body), {
    rows: [
      { segment: "A", spend: 14 },
      { segment: "B", spend: 9 },
    ],
    hasMore: false,
  });
}

{
  const builderContext = {
    handlers: {
      mcpTool: {
        resolveExecution() {
          return {
            conversationId: "conv-partial",
          };
        },
      },
    },
  };
  const resolved = resolveReportBuilderMCPExecutionContext(builderContext, dataset, {
    requestKind: "runtimePreviewDataset",
    toolName: "demo:forecast_summary",
  });
  assert.deepEqual(resolved, {
    conversationId: "conv-partial",
    assistantText: "Fetch report dataset Forecast Summary",
    toolBundles: [],
  });
}

{
  const builderContext = {
    Context(dataSourceRef) {
      assert.equal(dataSourceRef, "datlyPreviewSource");
      return {
        dataSource: {
          selectors: {
            data: "payload.items",
          },
          paging: {
            enabled: true,
          },
        },
        handlers: {
          dataSource: {
            async fetchRecords() {
              return {
                payload: {
                  items: [
                    { channel: "Display", spend: 12 },
                    { channel: "CTV", spend: 7 },
                  ],
                },
                dataInfo: {
                  hasMore: true,
                },
              };
            },
          },
        },
      };
    },
  };
  const fetcher = resolveReportBuilderDatasetPreviewFetcher(builderContext, {
    id: "datly_preview",
    dataSourceRef: "datlyPreviewSource",
    label: "Datly Preview",
    request: {
      query: "datly_preview",
    },
  });
  assert.equal(fetcher.source, "dataSource");
  const body = await fetcher.fetcher({
    parameters: {
      query: "datly_preview",
    },
  });
  assert.deepEqual(fetcher.resolveResult(body), {
    rows: [
      { channel: "Display", spend: 12 },
      { channel: "CTV", spend: 7 },
    ],
    hasMore: true,
  });
}

{
  const builderContext = {
    conversationId: "conv-route-preview",
    handlers: {
      reportBuilderPreview: {
        async fetchByRef({ dataSourceRef, parameters, builderContext: nestedBuilderContext }) {
          assert.equal(dataSourceRef, "routeOnlySource");
          assert.deepEqual(parameters, {
            query: "route_only_preview",
          });
          assert.equal(nestedBuilderContext?.conversationId, "conv-route-preview");
          return {
            rows: [
              { country: "US", spend: 1200 },
              { country: "CA", spend: 950 },
            ],
          };
        },
      },
    },
    Context() {
      const error = new Error("DataSource not found: routeOnlySource");
      error.code = "DataSourceNotFound";
      error.dataSourceRef = "routeOnlySource";
      throw error;
    },
  };
  const fetcher = resolveReportBuilderDatasetPreviewFetcher(builderContext, {
    id: "country_snapshot",
    dataSourceRef: "routeOnlySource",
    label: "Country Snapshot",
    request: {
      query: "route_only_preview",
    },
  });
  assert.equal(fetcher.source, "dataSourceRoute");
  const body = await fetcher.fetcher({
    parameters: {
      query: "route_only_preview",
    },
  });
  assert.deepEqual(fetcher.resolveResult(body), {
    rows: [
      { country: "US", spend: 1200 },
      { country: "CA", spend: 950 },
    ],
    hasMore: false,
  });
}

{
  const builderContext = {
    conversationId: "conv-route-preferred",
    handlers: {
      reportBuilderPreview: {
        async fetchByRef({ dataSourceRef, parameters, builderContext: nestedBuilderContext }) {
          assert.equal(dataSourceRef, "routePreferredSource");
          assert.deepEqual(parameters, {
            query: "route_preferred_preview",
          });
          assert.equal(nestedBuilderContext?.conversationId, "conv-route-preferred");
          return {
            payload: {
              records: [
                { country: "US", spend: 1200 },
                { country: "CA", spend: 950 },
              ],
            },
            dataInfo: {
              hasMore: true,
            },
          };
        },
      },
      mcpTool: {
        async executeRequest(payload) {
          throw new Error(`Datasource route should win before MCP fallback for ${payload?.toolName || "the declared tool"}.`);
        },
      },
    },
    Context() {
      const error = new Error("DataSource not found: routePreferredSource");
      error.code = "DataSourceNotFound";
      error.dataSourceRef = "routePreferredSource";
      throw error;
    },
  };
  const fetcher = resolveReportBuilderDatasetPreviewFetcher(builderContext, {
    id: "route_preferred_snapshot",
    dataSourceRef: "routePreferredSource",
    label: "Route Preferred Snapshot",
    source: {
      kind: "mcp_tool",
      tool: "demo:route_preferred_snapshot",
    },
    resultContract: {
      shape: "rowSet",
      rowPath: "payload.records",
    },
    request: {
      query: "route_preferred_preview",
    },
  });
  assert.equal(fetcher.source, "dataSourceRoute");
  const body = await fetcher.fetcher({
    parameters: {
      query: "route_preferred_preview",
    },
  });
  assert.deepEqual(fetcher.resolveResult(body), {
    rows: [
      { country: "US", spend: 1200 },
      { country: "CA", spend: 950 },
    ],
    hasMore: true,
  });
}

assert.throws(() => resolveReportBuilderDatasetPreviewFetcher({
  conversationId: "conv-broken-context",
  handlers: {
    mcpTool: {
      executeRequest() {
        throw new Error("MCP fallback should not execute when datasource context resolution fails.");
      },
    },
  },
  Context(dataSourceRef) {
    assert.equal(dataSourceRef, "brokenContextSource");
    throw new Error("Datasource registry cache exploded");
  },
}, {
  id: "broken_context_dataset",
  dataSourceRef: "brokenContextSource",
  label: "Broken Context Dataset",
  source: {
    kind: "mcp_tool",
    tool: "demo:broken_context_dataset",
  },
  request: {
    query: "broken_context_dataset",
  },
}), /Datasource registry cache exploded/);

console.log("reportBuilderDataSourceFetchExecutionContext ✓ resolves runtime MCP execution context without persisting transport hints on datasets");
