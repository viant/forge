import assert from "node:assert/strict";

import {
  buildReportRuntimePreviewExtractConfigFingerprint,
  buildReportRuntimePreviewResultContractFingerprint,
  buildReportRuntimePreviewRequestKey,
  resolveReportRuntimePreviewRowsFetchState,
} from "./useReportRuntimePreviewRows.js";
import * as reportRuntimePreviewRowsModule from "./useReportRuntimePreviewRows.js";
import { resolveReportDatasetFetchResult } from "../../reporting/reportDatasetResultContract.js";
import { isDeferredCacheHitEnvelope } from "../dataSourceExtract.js";
import {
  buildReportRuntimePreviewFreshnessError,
  resolveReportRuntimePreviewFreshnessRecovery,
} from "./reportRuntimePreviewFreshnessRecovery.js";

assert.equal(buildReportRuntimePreviewRequestKey("", 0), "");
assert.equal(buildReportRuntimePreviewRequestKey("runtime::1", 0), "runtime::1::0");
assert.equal(buildReportRuntimePreviewRequestKey("runtime::1", 3), "runtime::1::3");
assert.equal(buildReportRuntimePreviewRequestKey(" runtime::2 ", "7"), "runtime::2::7");
assert.equal(buildReportRuntimePreviewRequestKey("runtime::3", "not-a-number"), "runtime::3::0");
assert.equal(buildReportRuntimePreviewRequestKey("runtime::4", 2, "semantic::1"), "runtime::4::2::semantic::1");
assert.equal(
  buildReportRuntimePreviewRequestKey(
    "runtime::5",
    1,
    "semantic::2",
    buildReportRuntimePreviewExtractConfigFingerprint({
      selectors: {
        data: "payload.items",
      },
      paging: {
        enabled: true,
      },
    }),
  ),
  'runtime::5::1::semantic::2::{"selectors":{"data":"payload.items"},"paging":{"enabled":true}}',
);
assert.equal(
  buildReportRuntimePreviewResultContractFingerprint({
    shape: "rowSet",
    rowPath: "payload.records",
    hasMorePath: "page.hasMore",
  }),
  '{"shape":"rowSet","rowPath":"payload.records","hasMorePath":"page.hasMore"}',
);
assert.equal(
  buildReportRuntimePreviewExtractConfigFingerprint({
    selectors: {
      data: "payload.items",
    },
    paging: {
      enabled: true,
    },
  }),
  '{"selectors":{"data":"payload.items"},"paging":{"enabled":true}}',
);

assert.deepEqual(
  resolveReportDatasetFetchResult({
    body: {
      payload: {
        items: [
          { channel: "Display", spend: 12 },
          { channel: "CTV", spend: 7 },
        ],
      },
      dataInfo: {
        hasMore: true,
      },
    },
    extractConfig: {
      selectors: {
        data: "payload.items",
      },
      paging: {
        enabled: true,
      },
    },
  }),
  {
    rows: [
      { channel: "Display", spend: 12 },
      { channel: "CTV", spend: 7 },
    ],
    hasMore: false,
  },
);
assert.deepEqual(
  resolveReportDatasetFetchResult({
    body: {
      payload: {
        records: [
          { channel: "Display", spend: 12 },
          { channel: "CTV", spend: 7 },
        ],
      },
      page: {
        hasMore: true,
      },
    },
    extractConfig: {
      selectors: {
        data: "payload.items",
      },
      paging: {
        enabled: true,
      },
    },
    resultContract: {
      shape: "rowSet",
      rowPath: "payload.records",
      hasMorePath: "page.hasMore",
    },
  }),
  {
    rows: [
      { channel: "Display", spend: 12 },
      { channel: "CTV", spend: 7 },
    ],
    hasMore: true,
  },
);

assert.equal(
  isDeferredCacheHitEnvelope({
    rows: null,
    cache: {
      hit: true,
      fetchedAt: "2026-07-01T19:14:35.344023Z",
      ttlSeconds: 1800,
    },
  }),
  true,
);

const deferredRowsState = resolveReportRuntimePreviewRowsFetchState({
  body: {
    rows: null,
    cache: { hit: true },
  },
  fingerprint: "runtime::freshness",
  requestKey: "runtime::freshness::0",
  previousState: {
    rows: [{ channel: "Retained old row" }],
    hasMore: true,
  },
  rows: [],
  hasMore: false,
});
assert.deepEqual(deferredRowsState, {
  fingerprint: "runtime::freshness",
  requestKey: "runtime::freshness::0",
  freshResultRequestKey: "",
  rows: [{ channel: "Retained old row" }],
  hasMore: true,
  loading: false,
  error: null,
}, "a deferred cache hit may preserve display rows but does not prove a fresh terminal result");

assert.deepEqual(resolveReportRuntimePreviewRowsFetchState({
  body: { rows: [] },
  fingerprint: "runtime::freshness",
  requestKey: "runtime::freshness::0",
  previousState: deferredRowsState,
  rows: [],
  hasMore: false,
}), {
  fingerprint: "runtime::freshness",
  requestKey: "runtime::freshness::0",
  freshResultRequestKey: "runtime::freshness::0",
  rows: [],
  hasMore: false,
  loading: false,
  error: null,
}, "a subsequent fresh current-key response, including zero rows, is terminal and replaces retained rows");

const firstDeferredRecovery = resolveReportRuntimePreviewFreshnessRecovery({
  deferred: true,
  requestKey: "runtime::freshness::0",
});
assert.deepEqual(firstDeferredRecovery, {
  action: "retry",
  recoveryState: {
    requestKey: "runtime::freshness::0",
    retryCount: 1,
  },
});
assert.deepEqual(resolveReportRuntimePreviewFreshnessRecovery({
  deferred: true,
  requestKey: "runtime::freshness::0",
  recoveryState: firstDeferredRecovery.recoveryState,
}), {
  action: "fail",
  recoveryState: {
    requestKey: "runtime::freshness::0",
    retryCount: 1,
  },
}, "a second deferred response cannot schedule another retry");
assert.deepEqual(resolveReportRuntimePreviewFreshnessRecovery({
  deferred: false,
  requestKey: "runtime::freshness::0",
  recoveryState: firstDeferredRecovery.recoveryState,
}), {
  action: "accept",
  recoveryState: {
    requestKey: "",
    retryCount: 0,
  },
}, "a fresh response clears bounded recovery state");
assert.equal(
  buildReportRuntimePreviewFreshnessError({ requestKey: "runtime::freshness::0" }).code,
  "runtimePreviewFreshnessUnavailable",
);

const fetchFreshRowsResult = reportRuntimePreviewRowsModule.executeReportRuntimePreviewRowsFetchLifecycle;
assert.equal(
  typeof fetchFreshRowsResult,
  "function",
  "the row hook must use a directly testable asynchronous freshness driver",
);
let exhaustedRowsFetchCount = 0;
const exhaustedRowsLifecycle = await fetchFreshRowsResult({
    fetchRecords: async ({ parameters, requestKind }) => {
      exhaustedRowsFetchCount += 1;
      assert.deepEqual(parameters, { dimensions: { channel: true } });
      assert.equal(requestKind, "runtimePreview");
      return { rows: null, cache: { hit: true } };
    },
    request: { dimensions: { channel: true } },
    requestKind: "runtimePreview",
    requestKey: "runtime::freshness::driver",
    fingerprint: "runtime::freshness",
    resolveFetchResult: () => ({ rows: [], hasMore: false }),
    getCurrentState: () => ({
      fingerprint: "runtime::freshness",
      requestKey: "runtime::freshness::driver",
      rows: [{ channel: "Retained old row" }],
      hasMore: true,
      loading: true,
      error: null,
    }),
    shouldContinue: () => true,
  });
assert.equal(exhaustedRowsLifecycle.nextState.error?.code, "runtimePreviewFreshnessUnavailable");
assert.deepEqual(exhaustedRowsLifecycle.nextState.rows, [{ channel: "Retained old row" }]);
assert.equal(
  exhaustedRowsLifecycle.nextState.freshResultRequestKey,
  "",
  "retained rows remain explicitly non-fresh when bounded recovery is exhausted",
);
await Promise.resolve();
assert.equal(exhaustedRowsFetchCount, 2, "row freshness exhaustion performs no third fetch or busy loop");

let recoveredRowsFetchCount = 0;
const recoveredRowsResult = await fetchFreshRowsResult({
  fetchRecords: async () => {
    recoveredRowsFetchCount += 1;
    return recoveredRowsFetchCount === 1
      ? { rows: null, cache: { hit: true } }
      : { data: [] };
  },
  request: { dimensions: { channel: true } },
  requestKind: "runtimePreview",
  requestKey: "runtime::freshness::zero",
  fingerprint: "runtime::freshness",
  resolveFetchResult: () => ({ rows: [], hasMore: false }),
  getCurrentState: () => deferredRowsState,
  shouldContinue: () => true,
});
assert.equal(recoveredRowsFetchCount, 2);
assert.deepEqual(recoveredRowsResult, {
  cancelled: false,
  nextState: {
    fingerprint: "runtime::freshness",
    requestKey: "runtime::freshness::zero",
    freshResultRequestKey: "runtime::freshness::zero",
    rows: [],
    hasMore: false,
    loading: false,
    error: null,
  },
});

let staleRowsFetchCount = 0;
const staleRowsResult = await fetchFreshRowsResult({
  fetchRecords: async () => {
    staleRowsFetchCount += 1;
    return { rows: null, cache: { hit: true } };
  },
  request: { dimensions: { channel: true } },
  requestKind: "runtimePreview",
  requestKey: "runtime::freshness::stale",
  fingerprint: "runtime::freshness",
  resolveFetchResult: () => ({ rows: [], hasMore: false }),
  getCurrentState: () => deferredRowsState,
  shouldContinue: () => false,
});
assert.deepEqual(staleRowsResult, { cancelled: true, nextState: null });
assert.equal(staleRowsFetchCount, 1, "a stale key or unmounted hook cannot issue the recovery fetch");

console.log("useReportRuntimePreviewRows ✓ builds deterministic runtime preview request keys");
