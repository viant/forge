import assert from "node:assert/strict";

import {
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
  actions: [
    { id: "keep_date", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
  ],
}), {
  match: {
    blockKind: "tableBlock",
    fieldRef: "eventDate",
  },
  actions: [
    { id: "keep_date", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
  ],
});

const metrics = attachPreviewRuntimeActionBehaviorApi({});
assert.equal(replacePreviewRuntimeActionBehaviors(metrics, [
  {
    match: {
      blockKind: "tableBlock",
      fieldRef: "eventDate",
    },
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
assert.equal(clearPreviewRuntimeActionBehaviors(metrics), 0);
assert.deepEqual(metrics.runtimeActionBehaviors, []);

console.log("previewRuntimeActionBehaviors ✓ overrides preview runtime actions deterministically for targeted proof scenarios");
