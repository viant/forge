import assert from "node:assert/strict";

import { fetchReportRuntimePreviewDatasetPayloads } from "./useReportRuntimePreviewDatasetPayloads.js";

const builderContext = {
  handlers: {
    mcpTool: {
      resolveExecution({ conversationId, defaultAssistantText }) {
        assert.equal(conversationId, "conv-mcp-preview");
        assert.equal(defaultAssistantText, "Fetch report dataset MCP Only Cube");
        return {
          conversationId,
          assistantText: defaultAssistantText,
          toolBundles: ["mcp_ui_preview_queue"],
        };
      },
      async executeRequest({ conversationId, toolName, arguments: args, assistantText, toolBundles }) {
        assert.equal(conversationId, "conv-mcp-preview");
        assert.equal(toolName, "demo:forecast_summary");
        assert.deepEqual(args, {
          query: "mcp_only_summary",
        });
        assert.equal(assistantText, "Fetch report dataset MCP Only Cube");
        assert.deepEqual(toolBundles, ["mcp_ui_preview_queue"]);
        return {
          conversationId,
          result: '{"payload":{"records":[{"region":"US/TX","forecastRevenue":1400},{"region":"US/FL","forecastRevenue":910}]}}',
          structuredContent: {
            payload: {
              records: [
                { region: "US/TX", forecastRevenue: 1400 },
                { region: "US/FL", forecastRevenue: 910 },
              ],
            },
          },
        };
      },
    },
  },
  conversationId: "conv-mcp-preview",
  Context(dataSourceRef) {
    if (dataSourceRef === "forecastCubeSource") {
      return {
        dataSource: {
          selectors: {
            data: "data",
          },
          paging: null,
        },
        handlers: {
          dataSource: {
            async fetchRecords({ parameters, requestKind }) {
              assert.equal(requestKind, "runtimePreviewDataset");
              assert.deepEqual(parameters, {
                measures: { forecastRevenue: true },
                dimensions: { region: true },
                filters: { region: ["US/NY"] },
                limit: 25,
                offset: 0,
              });
              return {
                data: [
                  { region: "US/NY", forecastRevenue: 1200 },
                  { region: "US/NJ", forecastRevenue: 950 },
                ],
              };
            },
          },
        },
      };
    }
    if (dataSourceRef === "brokenSource") {
      return {
        dataSource: {
          selectors: {
            data: "data",
          },
          paging: null,
        },
        handlers: {
          dataSource: {
            async fetchRecords() {
              throw new Error("Boom");
            },
          },
        },
      };
    }
    if (dataSourceRef === "genericMcpSource") {
      return {
        dataSource: {
          selectors: {
            data: "ignored.by.result.contract",
          },
          paging: null,
        },
        handlers: {
          dataSource: {
            async fetchRecords({ parameters, requestKind }) {
              assert.equal(requestKind, "runtimePreviewDataset");
              assert.deepEqual(parameters, {
                query: "forecast_summary",
              });
              return {
                payload: {
                  records: [
                    { region: "US/NY", forecastRevenue: 1300 },
                    { region: "US/NJ", forecastRevenue: 975 },
                  ],
                },
                page: {
                  hasMore: true,
                },
              };
            },
          },
        },
      };
    }
    if (dataSourceRef === "connectorOnlySource") {
      return {
        dataSource: {
          selectors: {
            data: "data",
          },
          paging: null,
        },
        connector: {
          async get({ inputParameters }) {
            assert.deepEqual(inputParameters, {
              query: "connector_forecast_summary",
            });
            return {
              data: [
                { region: "US/CA", forecastRevenue: 1111 },
                { region: "US/WA", forecastRevenue: 888 },
              ],
            };
          },
        },
        handlers: {
          dataSource: {},
        },
      };
    }
    if (dataSourceRef === "mcpOnlySource") {
      const error = new Error("DataSource not found: mcpOnlySource");
      error.code = "DataSourceNotFound";
      error.dataSourceRef = "mcpOnlySource";
      throw error;
    }
    return {
      dataSource: {},
      handlers: {
        dataSource: {},
      },
    };
  },
};

const payloads = await fetchReportRuntimePreviewDatasetPayloads({
  builderContext,
  datasets: [
    {
      id: "forecast_cube",
      dataSourceRef: "forecastCubeSource",
      label: "Forecast Cube",
      request: {
        measures: { forecastRevenue: true },
        dimensions: { region: true },
        filters: { region: ["US/NY"] },
        limit: 25,
        offset: 0,
      },
    },
    {
      id: "broken_cube",
      dataSourceRef: "brokenSource",
      label: "Broken Cube",
      request: {
        measures: { totalSpend: true },
        dimensions: { channelId: true },
        filters: {},
        limit: 10,
        offset: 0,
      },
    },
    {
      id: "generic_mcp_cube",
      dataSourceRef: "genericMcpSource",
      label: "Generic MCP Cube",
      resultContract: {
        shape: "rowSet",
        rowPath: "payload.records",
        hasMorePath: "page.hasMore",
      },
      request: {
        query: "forecast_summary",
      },
    },
    {
      id: "missing_cube",
      dataSourceRef: "missingSource",
      label: "Missing Cube",
      request: {
        measures: { totalSpend: true },
        dimensions: { channelId: true },
        filters: {},
        limit: 10,
        offset: 0,
      },
    },
    {
      id: "connector_cube",
      dataSourceRef: "connectorOnlySource",
      label: "Connector Cube",
      request: {
        query: "connector_forecast_summary",
      },
    },
    {
      id: "mcp_only_cube",
      dataSourceRef: "mcpOnlySource",
      label: "MCP Only Cube",
      source: {
        kind: "mcp",
        toolName: "demo:forecast_summary",
      },
      resultContract: {
        shape: "rowSet",
        rowPath: "payload.records",
      },
      request: {
        query: "mcp_only_summary",
      },
    },
  ],
});

assert.deepEqual(payloads.forecast_cube, {
  rows: [
    { region: "US/NY", forecastRevenue: 1200 },
    { region: "US/NJ", forecastRevenue: 950 },
  ],
  hasMore: false,
  diagnostics: [],
});
assert.deepEqual(payloads.generic_mcp_cube, {
  rows: [
    { region: "US/NY", forecastRevenue: 1300 },
    { region: "US/NJ", forecastRevenue: 975 },
  ],
  hasMore: true,
  diagnostics: [],
});
assert.deepEqual(payloads.connector_cube, {
  rows: [
    { region: "US/CA", forecastRevenue: 1111 },
    { region: "US/WA", forecastRevenue: 888 },
  ],
  hasMore: false,
  diagnostics: [],
});
assert.deepEqual(payloads.mcp_only_cube, {
  rows: [
    { region: "US/TX", forecastRevenue: 1400 },
    { region: "US/FL", forecastRevenue: 910 },
  ],
  hasMore: false,
  diagnostics: [],
});
assert.equal(payloads.broken_cube.rows.length, 0);
assert.equal(payloads.broken_cube.diagnostics[0].code, "runtimePreviewDatasetFetchFailed");
assert.equal(payloads.missing_cube.rows.length, 0);
assert.equal(payloads.missing_cube.diagnostics[0].code, "runtimePreviewDatasetUnavailable");

console.log("useReportRuntimePreviewDatasetPayloads ✓ fetches published secondary dataset rows and degrades to diagnostics on failure");

const pureMCPPayloads = await fetchReportRuntimePreviewDatasetPayloads({
  builderContext: {
    handlers: {
      mcpTool: {
        async executeRequest({ conversationId, toolName, arguments: args, assistantText, toolBundles }) {
          assert.equal(conversationId, "conv-pure-mcp-preview");
          assert.equal(toolName, "demo:pure_mcp_summary");
          assert.deepEqual(args, {
            query: "pure_mcp_summary",
          });
          assert.equal(assistantText, "Fetch report dataset Pure MCP Cube");
          assert.deepEqual(toolBundles, []);
          return {
            structuredContent: {
              payload: {
                rows: [
                  { channel: "Display", forecastRevenue: 2222 },
                  { channel: "CTV", forecastRevenue: 1777 },
                ],
                hasMore: true,
              },
            },
          };
        },
      },
    },
    conversationId: "conv-pure-mcp-preview",
  },
  datasets: [
    {
      id: "pure_mcp_cube",
      label: "Pure MCP Cube",
      source: {
        kind: "mcp_tool",
        tool: "demo:pure_mcp_summary",
      },
      resultContract: {
        shape: "rowSet",
        rowPath: "payload.rows",
        hasMorePath: "payload.hasMore",
      },
      request: {
        query: "pure_mcp_summary",
      },
    },
  ],
});

assert.deepEqual(pureMCPPayloads.pure_mcp_cube, {
  rows: [
    { channel: "Display", forecastRevenue: 2222 },
    { channel: "CTV", forecastRevenue: 1777 },
  ],
  hasMore: true,
  diagnostics: [],
});

console.log("useReportRuntimePreviewDatasetPayloads ✓ supports pure MCP datasets without a dataSourceRef shell");

const brokenContextPayloads = await fetchReportRuntimePreviewDatasetPayloads({
  builderContext: {
    handlers: {
      mcpTool: {
        async executeRequest() {
          throw new Error("MCP fallback should not execute when datasource context resolution fails.");
        },
      },
    },
    Context(dataSourceRef) {
      if (dataSourceRef === "brokenContextSource") {
        throw new Error("Datasource registry cache exploded");
      }
      throw new Error(`Unexpected dataSourceRef ${dataSourceRef}`);
    },
  },
  datasets: [
    {
      id: "broken_context_cube",
      dataSourceRef: "brokenContextSource",
      label: "Broken Context Cube",
      source: {
        kind: "mcp_tool",
        tool: "demo:broken_context_cube",
      },
      request: {
        query: "broken_context_cube",
      },
    },
  ],
});
assert.equal(brokenContextPayloads.broken_context_cube.rows.length, 0);
assert.equal(brokenContextPayloads.broken_context_cube.diagnostics[0].code, "runtimePreviewDatasetFetchFailed");
assert.match(brokenContextPayloads.broken_context_cube.diagnostics[0].message, /Datasource registry cache exploded/);

console.log("useReportRuntimePreviewDatasetPayloads ✓ surfaces datasource context failures instead of silently falling back");
