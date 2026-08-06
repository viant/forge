import assert from "node:assert/strict";

import {
  applyPreviewDetailTargetBehavior,
  attachPreviewDetailTargetBehaviorApi,
  normalizePreviewDetailTargetBehavior,
  replacePreviewDetailTargetBehaviors,
} from "./previewDetailTargetBehaviors.js";

assert.deepEqual(normalizePreviewDetailTargetBehavior({
  match: {
    targetRef: " target://steward/performance/channel-detail ",
  },
  result: {
    detailTarget: null,
  },
}), {
  match: {
    targetRef: "target://steward/performance/channel-detail",
  },
  result: {
    detailTarget: null,
  },
});

const metrics = attachPreviewDetailTargetBehaviorApi({});
assert.equal(replacePreviewDetailTargetBehaviors(metrics, [
  {
    match: {
      targetRef: "target://steward/performance/channel-detail",
    },
    result: {
      detailTarget: null,
    },
  },
]), 1);
assert.deepEqual(
  await applyPreviewDetailTargetBehavior(metrics, {
    targetRef: "target://steward/performance/channel-detail",
  }),
  {
    detailTarget: null,
  },
);
assert.deepEqual(metrics.detailTargetBehaviors, []);

replacePreviewDetailTargetBehaviors(metrics, [
  {
    match: {
      targetRef: "target://steward/performance/channel-detail",
    },
    error: "Detail target resolution failed.",
  },
]);
await assert.rejects(
  () => applyPreviewDetailTargetBehavior(metrics, {
    targetRef: "target://steward/performance/channel-detail",
  }),
  /Detail target resolution failed\./,
);
assert.deepEqual(metrics.detailTargetBehaviors, []);

console.log("previewDetailTargetBehaviors ✓ overrides preview detail-target resolution deterministically for targeted proof scenarios");
