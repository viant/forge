import assert from "node:assert/strict";

import {
  buildReportRuntimePreviewExtractConfigFingerprint,
  buildReportRuntimePreviewResultContractFingerprint,
  buildReportRuntimePreviewRequestKey,
} from "./useReportRuntimePreviewRows.js";
import { resolveReportDatasetFetchResult } from "../../reporting/reportDatasetResultContract.js";
import { isDeferredCacheHitEnvelope } from "../dataSourceExtract.js";

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

console.log("useReportRuntimePreviewRows ✓ builds deterministic runtime preview request keys");
