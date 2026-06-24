import assert from "node:assert/strict";

import {
  buildShareableLifecycleActionViewState,
  buildShareableLifecycleTransition,
  validateShareableLifecycleTransition,
} from "./shareableLifecycleModel.js";

assert.deepEqual(buildShareableLifecycleTransition({
  artifactRef: "report://doc_123",
  from: "draft",
  to: "published",
  reason: "quarterly release",
}), {
  artifactRef: "report://doc_123",
  from: "draft",
  to: "published",
  reason: "quarterly release",
});

assert.deepEqual(validateShareableLifecycleTransition({
  artifactRef: "report://doc_123",
  from: "draft",
  to: "published",
  reason: "quarterly release",
}), {
  valid: true,
  errors: [],
});

assert.deepEqual(validateShareableLifecycleTransition({
  artifactRef: "report://doc_123",
  from: "published",
  to: "draft",
}), {
  valid: false,
  errors: [
    {
      path: "$.to",
      code: "invalidTransition",
      message: "Lifecycle transition 'published' -> 'draft' is not allowed.",
    },
  ],
});

assert.deepEqual(buildShareableLifecycleActionViewState({
  lifecycle: "draft",
  shareableCapabilities: {
    view: true,
    export: true,
    publish: false,
  },
}), {
  availableActions: ["View", "Export"],
  blockedActions: ["Publish"],
});

assert.deepEqual(buildShareableLifecycleActionViewState({
  lifecycle: "published",
  shareableCapabilities: {
    view: true,
    share: true,
    export: true,
    archive: true,
  },
}), {
  availableActions: ["View", "Share", "Export", "Archive"],
});

assert.equal(buildShareableLifecycleActionViewState({
  lifecycle: "archived",
  shareableCapabilities: {},
}), null);

console.log("shareableLifecycleModel ✓ normalizes lifecycle transitions and derives capability-driven actions");
