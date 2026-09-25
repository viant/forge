import assert from "node:assert/strict";

import * as reportRuntimePreviewDatasetPayloadsModule from "./useReportRuntimePreviewDatasetPayloads.js";

const {
  buildPendingReportRuntimePreviewDatasetPayloadState,
  buildResolvedReportRuntimePreviewDatasetPayloadState,
  fetchReportRuntimePreviewDatasetPayloadResult,
  fetchReportRuntimePreviewDatasetPayloads,
  resolveFreshReportRuntimePreviewPrimaryDatasetPayload,
  resolveReportRuntimePreviewDatasetResultFreshness,
} = reportRuntimePreviewDatasetPayloadsModule;

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

let primaryDatasetResponse = {
  rows: null,
  cache: { hit: true },
};
const freshnessBuilderContext = {
  Context(dataSourceRef) {
    assert.equal(dataSourceRef, "primaryFreshnessSource");
    return {
      dataSource: {
        selectors: { data: "data" },
        paging: null,
      },
      handlers: {
        dataSource: {
          async fetchRecords() {
            return primaryDatasetResponse;
          },
        },
      },
    };
  },
};
const freshnessDatasets = [{
  id: "primary",
  dataSourceRef: "primaryFreshnessSource",
  label: "Primary",
  request: { dimensions: { channel: true } },
}];
const datasetRequestKey = "published-datasets::current";
const deferredDatasetResult = {
  payloads: {
    primary: {
      rows: [],
      hasMore: false,
      diagnostics: [],
    },
  },
  freshDatasetIds: [],
};
assert.deepEqual(deferredDatasetResult.payloads.primary, {
  rows: [],
  hasMore: false,
  diagnostics: [],
});
assert.deepEqual(deferredDatasetResult.freshDatasetIds, []);
const deferredDatasetState = buildResolvedReportRuntimePreviewDatasetPayloadState({
  requestKey: datasetRequestKey,
  ...deferredDatasetResult,
});
assert.equal(deferredDatasetState.requestKey, datasetRequestKey);
assert.equal(deferredDatasetState.freshResultRequestKey, "");
assert.equal(resolveReportRuntimePreviewDatasetResultFreshness({
  state: deferredDatasetState,
  expectedRequestKey: datasetRequestKey,
  datasetIds: ["primary"],
}), false, "a deferred published primary result is not fresh by request-key equality alone");
assert.equal(resolveReportRuntimePreviewDatasetResultFreshness({
  state: deferredDatasetState,
  expectedRequestKey: datasetRequestKey,
  datasetIds: ["primary"],
  fallbackFreshDatasetIds: ["primary"],
}), true, "the exact fresh primary row-hook result may satisfy only the duplicated primary dataset");
const deferredSecondaryDatasetState = buildResolvedReportRuntimePreviewDatasetPayloadState({
  requestKey: datasetRequestKey,
  payloads: {
    primary: { rows: [], hasMore: false, diagnostics: [] },
    secondary: { rows: [], hasMore: false, diagnostics: [] },
  },
  freshDatasetIds: ["primary"],
});
assert.equal(resolveReportRuntimePreviewDatasetResultFreshness({
  state: deferredSecondaryDatasetState,
  expectedRequestKey: datasetRequestKey,
  datasetIds: ["primary", "secondary"],
  fallbackFreshDatasetIds: ["primary"],
}), false, "primary fallback provenance never masks a deferred secondary dataset");
assert.equal(resolveFreshReportRuntimePreviewPrimaryDatasetPayload({
  state: deferredDatasetState,
  expectedRequestKey: datasetRequestKey,
  primaryDatasetId: "primary",
}), null, "a deferred current-key payload cannot override the fresh primary row-hook result");

const retainedDatasetPayloadState = buildResolvedReportRuntimePreviewDatasetPayloadState({
  requestKey: "published-datasets::previous",
  payloads: {
    primary: {
      rows: [{ channel: "Retained display row", spend: 41 }],
      hasMore: true,
      diagnostics: [],
    },
  },
  freshDatasetIds: ["primary"],
});
const pendingRetainedDatasetPayloadState = buildPendingReportRuntimePreviewDatasetPayloadState({
  requestKey: datasetRequestKey,
  currentState: retainedDatasetPayloadState,
});
assert.deepEqual(
  pendingRetainedDatasetPayloadState.payloads.primary.rows,
  [{ channel: "Retained display row", spend: 41 }],
  "a new request may retain prior payloads only for stale-while-revalidate display",
);
assert.deepEqual(pendingRetainedDatasetPayloadState.freshDatasetIds, []);
assert.equal(pendingRetainedDatasetPayloadState.freshResultRequestKey, "");
assert.equal(resolveFreshReportRuntimePreviewPrimaryDatasetPayload({
  state: pendingRetainedDatasetPayloadState,
  expectedRequestKey: datasetRequestKey,
  primaryDatasetId: "primary",
}), null, "retained cross-key display payloads can never satisfy settlement freshness");

const executeDatasetPayloadLifecycle = reportRuntimePreviewDatasetPayloadsModule
  .executeReportRuntimePreviewDatasetPayloadFetchLifecycle;
assert.equal(
  typeof executeDatasetPayloadLifecycle,
  "function",
  "the dataset hook must use a directly testable asynchronous lifecycle with currency checks",
);

const buildLifecycleContext = (fetchRecords) => ({
  Context(dataSourceRef) {
    assert.equal(dataSourceRef, "primaryFreshnessSource");
    return {
      dataSource: {
        selectors: { data: "data" },
        paging: null,
      },
      handlers: { dataSource: { fetchRecords } },
    };
  },
});

let cancelledBeforeRetryFetchCount = 0;
let cancelledBeforeRetryCurrent = true;
let cancelledBeforeRetryApplyCount = 0;
const cancelledBeforeRetryResult = await executeDatasetPayloadLifecycle({
  builderContext: buildLifecycleContext(async () => {
    cancelledBeforeRetryFetchCount += 1;
    cancelledBeforeRetryCurrent = false;
    return { rows: null, cache: { hit: true } };
  }),
  datasets: freshnessDatasets,
  requestKey: datasetRequestKey,
  getCurrentState: () => pendingRetainedDatasetPayloadState,
  shouldContinue: () => cancelledBeforeRetryCurrent,
  applyState: () => {
    cancelledBeforeRetryApplyCount += 1;
  },
});
assert.deepEqual(cancelledBeforeRetryResult, { cancelled: true, nextState: null });
assert.equal(cancelledBeforeRetryFetchCount, 1, "stale or unmounted dataset work cannot start the recovery fetch");
assert.equal(cancelledBeforeRetryApplyCount, 0);

let exhaustedLifecycleFetchCount = 0;
let exhaustedLifecycleApplyCount = 0;
const exhaustedLifecycleResult = await executeDatasetPayloadLifecycle({
  builderContext: buildLifecycleContext(async () => {
    exhaustedLifecycleFetchCount += 1;
    return { rows: null, cache: { hit: true } };
  }),
  datasets: freshnessDatasets,
  requestKey: datasetRequestKey,
  getCurrentState: () => pendingRetainedDatasetPayloadState,
  shouldContinue: () => true,
  applyState: () => {
    exhaustedLifecycleApplyCount += 1;
  },
});
assert.equal(exhaustedLifecycleApplyCount, 1);
assert.equal(exhaustedLifecycleResult.nextState.error?.code, "runtimePreviewFreshnessUnavailable");
assert.equal(exhaustedLifecycleResult.nextState.freshResultRequestKey, "");
assert.deepEqual(exhaustedLifecycleResult.nextState.freshDatasetIds, []);
assert.deepEqual(
  exhaustedLifecycleResult.nextState.payloads.primary.rows,
  [{ channel: "Retained display row", spend: 41 }],
  "freshness exhaustion retains the old display payload rather than replacing it with empty rows",
);
assert.equal(exhaustedLifecycleResult.nextState.payloads.primary.hasMore, true);
assert.equal(
  exhaustedLifecycleResult.nextState.payloads.primary.diagnostics[0].code,
  "runtimePreviewDatasetFetchFailed",
);
assert.match(
  exhaustedLifecycleResult.nextState.payloads.primary.diagnostics[0].message,
  /deferred cache data twice without a fresh terminal result/,
);
await Promise.resolve();
assert.equal(exhaustedLifecycleFetchCount, 2, "dataset freshness exhaustion performs no third fetch or busy loop");

let freshZeroLifecycleFetchCount = 0;
const freshZeroLifecycleResult = await executeDatasetPayloadLifecycle({
  builderContext: buildLifecycleContext(async () => {
    freshZeroLifecycleFetchCount += 1;
    return freshZeroLifecycleFetchCount === 1
      ? { rows: null, cache: { hit: true } }
      : { data: [] };
  }),
  datasets: freshnessDatasets,
  requestKey: datasetRequestKey,
  getCurrentState: () => pendingRetainedDatasetPayloadState,
  shouldContinue: () => true,
});
assert.equal(freshZeroLifecycleFetchCount, 2);
assert.equal(freshZeroLifecycleResult.nextState.error, null);
assert.equal(freshZeroLifecycleResult.nextState.freshResultRequestKey, datasetRequestKey);
assert.deepEqual(freshZeroLifecycleResult.nextState.freshDatasetIds, ["primary"]);
assert.deepEqual(freshZeroLifecycleResult.nextState.payloads.primary.rows, []);

let resolveLaterDatasetFetch;
const laterDatasetFetch = new Promise((resolve) => {
  resolveLaterDatasetFetch = resolve;
});
let markLaterDatasetFetchStarted;
const laterDatasetFetchStarted = new Promise((resolve) => {
  markLaterDatasetFetchStarted = resolve;
});
let staleAfterRetryFetchCount = 0;
let staleAfterRetryCurrent = true;
let staleAfterRetryApplyCount = 0;
const staleAfterRetryLifecyclePromise = executeDatasetPayloadLifecycle({
  builderContext: buildLifecycleContext(async () => {
    staleAfterRetryFetchCount += 1;
    if (staleAfterRetryFetchCount === 1) {
      return { rows: null, cache: { hit: true } };
    }
    markLaterDatasetFetchStarted();
    return laterDatasetFetch;
  }),
  datasets: freshnessDatasets,
  requestKey: datasetRequestKey,
  getCurrentState: () => pendingRetainedDatasetPayloadState,
  shouldContinue: () => staleAfterRetryCurrent,
  applyState: () => {
    staleAfterRetryApplyCount += 1;
  },
});
await laterDatasetFetchStarted;
staleAfterRetryCurrent = false;
resolveLaterDatasetFetch({ data: [{ channel: "Must not apply", spend: 99 }] });
const staleAfterRetryLifecycleResult = await staleAfterRetryLifecyclePromise;
assert.deepEqual(staleAfterRetryLifecycleResult, { cancelled: true, nextState: null });
assert.equal(staleAfterRetryFetchCount, 2);
assert.equal(staleAfterRetryApplyCount, 0, "stale or unmounted work cannot apply a result after later async work");

let sameKeyDatasetRecoveryFetchCount = 0;
const sameKeyDatasetRecoveryResult = await fetchReportRuntimePreviewDatasetPayloadResult({
  builderContext: {
    Context(dataSourceRef) {
      assert.equal(dataSourceRef, "primaryFreshnessSource");
      return {
        dataSource: {
          selectors: { data: "data" },
          paging: null,
        },
        handlers: {
          dataSource: {
            async fetchRecords() {
              sameKeyDatasetRecoveryFetchCount += 1;
              return sameKeyDatasetRecoveryFetchCount === 1
                ? { rows: null, cache: { hit: true } }
                : { data: [] };
            },
          },
        },
      };
    },
  },
  datasets: freshnessDatasets,
});
assert.equal(
  sameKeyDatasetRecoveryFetchCount,
  2,
  "a deferred same-key dataset result receives exactly one controlled fresh-provenance probe",
);
assert.deepEqual(
  sameKeyDatasetRecoveryResult.freshDatasetIds,
  ["primary"],
  "the controlled same-key probe may establish fresh zero-row terminal provenance",
);

let exhaustedDatasetRecoveryFetchCount = 0;
const exhaustedDatasetRecoveryResult = await fetchReportRuntimePreviewDatasetPayloadResult({
  builderContext: {
    Context() {
      return {
        dataSource: {
          selectors: { data: "data" },
          paging: null,
        },
        handlers: {
          dataSource: {
            async fetchRecords() {
              exhaustedDatasetRecoveryFetchCount += 1;
              return { rows: null, cache: { hit: true } };
            },
          },
        },
      };
    },
  },
  datasets: freshnessDatasets,
});
assert.equal(exhaustedDatasetRecoveryFetchCount, 2, "dataset deferred recovery is capped at one retry");
assert.equal(
  exhaustedDatasetRecoveryResult.payloads.primary.diagnostics[0].code,
  "runtimePreviewDatasetFetchFailed",
);
assert.match(
  exhaustedDatasetRecoveryResult.payloads.primary.diagnostics[0].message,
  /deferred cache data twice without a fresh terminal result/,
  "retry exhaustion becomes a deterministic dataset diagnostic instead of a non-fresh idle state",
);
assert.equal(
  exhaustedDatasetRecoveryResult.error?.code,
  "runtimePreviewFreshnessUnavailable",
  "dataset retry exhaustion is also exposed as a deterministic hosted settlement error",
);
assert.deepEqual(
  exhaustedDatasetRecoveryResult.freshDatasetIds,
  [],
  "a deterministic freshness failure never labels its replacement diagnostic payload as fresh data",
);
const exhaustedDatasetRecoveryState = buildResolvedReportRuntimePreviewDatasetPayloadState({
  requestKey: datasetRequestKey,
  ...exhaustedDatasetRecoveryResult,
});
assert.equal(
  exhaustedDatasetRecoveryState.freshResultRequestKey,
  "",
  "dataset exhaustion remains terminal by error, not by fabricated fresh provenance",
);

primaryDatasetResponse = { data: [] };
const freshZeroDatasetResult = await fetchReportRuntimePreviewDatasetPayloadResult({
  builderContext: freshnessBuilderContext,
  datasets: freshnessDatasets,
});
assert.deepEqual(freshZeroDatasetResult.freshDatasetIds, ["primary"]);
assert.equal(freshZeroDatasetResult.error, null);
const freshZeroDatasetState = buildResolvedReportRuntimePreviewDatasetPayloadState({
  requestKey: datasetRequestKey,
  ...freshZeroDatasetResult,
});
assert.equal(freshZeroDatasetState.freshResultRequestKey, datasetRequestKey);
assert.equal(resolveReportRuntimePreviewDatasetResultFreshness({
  state: freshZeroDatasetState,
  expectedRequestKey: datasetRequestKey,
  datasetIds: ["primary"],
}), true, "the fresh current-key zero-row dataset response satisfies dataset readiness directly");
assert.deepEqual(resolveFreshReportRuntimePreviewPrimaryDatasetPayload({
  state: freshZeroDatasetState,
  expectedRequestKey: datasetRequestKey,
  primaryDatasetId: "primary",
}), {
  rows: [],
  hasMore: false,
  diagnostics: [],
}, "a fresh same-key zero-row payload is terminal and may supply the primary dataset");

console.log("useReportRuntimePreviewDatasetPayloads ✓ distinguishes deferred payloads from fresh current-key zero-row results");
