import assert from "node:assert/strict";

import {
  applyPreviewFetchBehavior,
  attachPreviewFetchBehaviorApi,
  normalizePreviewFetchBehavior,
  replacePreviewFetchBehaviors,
} from "./previewFetchBehaviors.js";

assert.deepEqual(normalizePreviewFetchBehavior({
  match: {
    type: " chartQuery ",
    requestFingerprint: " chart::1 ",
    requestKey: " chart::1::1 ",
  },
  error: " chart fetch failed ",
}), {
  match: {
    type: "chartquery",
    requestFingerprint: "chart::1",
    requestKey: "chart::1::1",
  },
  error: "chart fetch failed",
});

assert.deepEqual(normalizePreviewFetchBehavior({
  match: {
    type: " chartQuery ",
  },
  error: " next chart fetch failed ",
}), {
  match: {
    type: "chartquery",
  },
  error: "next chart fetch failed",
});

const metrics = attachPreviewFetchBehaviorApi({});
assert.equal(replacePreviewFetchBehaviors(metrics, [
  {
    match: {
      type: "chartQuery",
      requestFingerprint: "chart::1",
      requestKey: "chart::1::1",
    },
    error: "chart fetch failed",
  },
]), 1);

await assert.rejects(
  () => applyPreviewFetchBehavior(metrics, {
    type: "chartQuery",
    requestFingerprint: "chart::1",
    requestKey: "chart::1::1",
  }),
  /chart fetch failed/,
);
assert.deepEqual(metrics.fetchBehaviors, []);

replacePreviewFetchBehaviors(metrics, [
  {
    match: {
      type: "runtimePreview",
      requestFingerprint: "runtime::1",
      requestKey: "runtime::1::2",
    },
    result: {
      rows: [{ channelV2: "Display" }],
      hasMore: true,
    },
  },
]);

assert.deepEqual(
  await applyPreviewFetchBehavior(metrics, {
    type: "runtimePreview",
    requestFingerprint: "runtime::1",
    requestKey: "runtime::1::2",
  }),
  {
    rows: [{ channelV2: "Display" }],
    hasMore: true,
  },
);
assert.deepEqual(metrics.fetchBehaviors, []);

replacePreviewFetchBehaviors(metrics, [
  {
    match: {
      type: "chartQuery",
    },
    error: "next chart fetch failed",
  },
]);

await assert.rejects(
  () => applyPreviewFetchBehavior(metrics, {
    type: "chartQuery",
    requestFingerprint: "chart::other",
    requestKey: "chart::other::99",
  }),
  /next chart fetch failed/,
);
assert.deepEqual(metrics.fetchBehaviors, []);

console.log("previewFetchBehaviors ✓ overrides preview fetch outcomes deterministically for targeted proof scenarios");
