import assert from "node:assert/strict";

import {
  applyPreviewRuntimeActionBehavior,
  attachPreviewRuntimeActionBehaviorApi,
  clearPreviewRuntimeActionBehaviors,
  normalizePreviewRuntimeActionBehavior,
  replacePreviewRuntimeActionBehaviors,
  resolvePreviewRuntimeActions,
} from "./previewRuntimeActionBehaviors.js";

assert.deepEqual(normalizePreviewRuntimeActionBehavior({
  match: {
    blockKind: " tableBlock ",
    fieldRef: " eventDate ",
  },
  delayMs: 10,
  actions: [
    { id: "keep_date", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
  ],
}), {
  match: {
    blockKind: "tableBlock",
    fieldRef: "eventDate",
  },
  delayMs: 10,
  actions: [
    { id: "keep_date", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
  ],
});
assert.deepEqual(normalizePreviewRuntimeActionBehavior({
  match: {
    fieldRef: "eventDate",
  },
  error: {
    message: "Preview runtime action provider failed.",
  },
}), {
  match: {
    fieldRef: "eventDate",
  },
  error: "Preview runtime action provider failed.",
});
assert.equal(normalizePreviewRuntimeActionBehavior({
  match: {
    fieldRef: "eventDate",
  },
  delayMs: 250,
}), null);

const metrics = attachPreviewRuntimeActionBehaviorApi({});
assert.equal(replacePreviewRuntimeActionBehaviors(metrics, [
  {
    match: {
      blockKind: "tableBlock",
      fieldRef: "eventDate",
    },
    delayMs: 10,
    actions: [
      { id: "keep_date", label: "Keep only", kind: "keep" },
      { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
    ],
  },
]), 1);
assert.deepEqual(
  resolvePreviewRuntimeActions(metrics, "tableBlock", "eventDate", [
    { id: "fallback", label: "Fallback", kind: "detail", targetRef: "target://fallback/detail" },
  ]),
  [
    { id: "keep_date", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
  ],
);
assert.deepEqual(
  resolvePreviewRuntimeActions(metrics, "chartBlock", "channelV2", [
    { id: "fallback", label: "Fallback", kind: "detail", targetRef: "target://fallback/detail" },
  ]),
  [
    { id: "fallback", label: "Fallback", kind: "detail", targetRef: "target://fallback/detail" },
  ],
);
assert.deepEqual(
  await applyPreviewRuntimeActionBehavior(metrics, "tableBlock", "eventDate", [
    { id: "fallback", label: "Fallback", kind: "detail", targetRef: "target://fallback/detail" },
  ]),
  [
    { id: "keep_date", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
  ],
);
assert.equal(replacePreviewRuntimeActionBehaviors(metrics, [
  {
    match: {
      blockKind: "chartBlock",
      fieldRef: "eventDate",
    },
    delayMs: 10,
    error: "Preview runtime action provider failed.",
  },
]), 1);
assert.throws(
  () => resolvePreviewRuntimeActions(metrics, "chartBlock", "eventDate", []),
  /Preview runtime action provider failed\./,
);
await assert.rejects(
  applyPreviewRuntimeActionBehavior(metrics, "chartBlock", "eventDate", []),
  /Preview runtime action provider failed\./,
);
assert.deepEqual(
  await applyPreviewRuntimeActionBehavior(metrics, "tableBlock", "country", [
    { id: "fallback", label: "Fallback", kind: "detail", targetRef: "target://fallback/detail" },
  ]),
  [
    { id: "fallback", label: "Fallback", kind: "detail", targetRef: "target://fallback/detail" },
  ],
);
assert.equal(clearPreviewRuntimeActionBehaviors(metrics), 0);
assert.deepEqual(metrics.runtimeActionBehaviors, []);

console.log("previewRuntimeActionBehaviors ✓ overrides preview runtime actions deterministically for targeted proof scenarios");
