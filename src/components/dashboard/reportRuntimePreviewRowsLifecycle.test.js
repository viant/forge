import assert from "node:assert/strict";

import {
  resolveReportRuntimePreviewRowsDispatchPlan,
  resolveReportRuntimePreviewRowsEffectAction,
  resolveReportRuntimePreviewRowsSettlementPlan,
} from "./reportRuntimePreviewRowsLifecycle.js";

assert.deepEqual(resolveReportRuntimePreviewRowsEffectAction({
  transitionType: "reset",
  inFlightRequestKey: "runtime::1::0",
  requestKey: "runtime::1::0",
  currentGeneration: 2,
}), {
  issueFetch: false,
  nextGeneration: 3,
  nextInFlightRequestKey: "",
  requestGeneration: 3,
});

assert.deepEqual(resolveReportRuntimePreviewRowsEffectAction({
  transitionType: "start",
  inFlightRequestKey: "",
  requestKey: "runtime::2::0",
  currentGeneration: 0,
}), {
  issueFetch: true,
  nextGeneration: 1,
  nextInFlightRequestKey: "runtime::2::0",
  requestGeneration: 1,
});

assert.deepEqual(resolveReportRuntimePreviewRowsEffectAction({
  transitionType: "start",
  inFlightRequestKey: "runtime::2::0",
  requestKey: "runtime::2::0",
  currentGeneration: 1,
}), {
  issueFetch: false,
  nextGeneration: 1,
  nextInFlightRequestKey: "runtime::2::0",
  requestGeneration: 1,
});

assert.deepEqual(resolveReportRuntimePreviewRowsDispatchPlan({
  transitionType: "noop",
  inFlightRequestKey: "",
  requestKey: "runtime::3::0",
  currentGeneration: 0,
}), {
  applyState: false,
  issueFetch: false,
  nextGeneration: 0,
  nextInFlightRequestKey: "",
  requestGeneration: 0,
});

assert.deepEqual(resolveReportRuntimePreviewRowsDispatchPlan({
  transitionType: "start",
  inFlightRequestKey: "runtime::3::0",
  requestKey: "runtime::3::0",
  currentGeneration: 4,
}), {
  applyState: false,
  issueFetch: false,
  nextGeneration: 4,
  nextInFlightRequestKey: "runtime::3::0",
  requestGeneration: 4,
});

assert.deepEqual(resolveReportRuntimePreviewRowsDispatchPlan({
  transitionType: "start",
  inFlightRequestKey: "",
  requestKey: "runtime::4::0",
  currentGeneration: 4,
}), {
  applyState: true,
  issueFetch: true,
  nextGeneration: 5,
  nextInFlightRequestKey: "runtime::4::0",
  requestGeneration: 5,
});

assert.deepEqual(resolveReportRuntimePreviewRowsSettlementPlan({
  mounted: true,
  currentRequestKey: "runtime::4::0",
  requestedRequestKey: "runtime::4::0",
  currentGeneration: 5,
  requestGeneration: 5,
  inFlightRequestKey: "runtime::4::0",
}), {
  shouldApply: true,
  shouldReleaseInFlight: true,
});

assert.deepEqual(resolveReportRuntimePreviewRowsSettlementPlan({
  mounted: true,
  currentRequestKey: "runtime::5::0",
  requestedRequestKey: "runtime::4::0",
  currentGeneration: 5,
  requestGeneration: 5,
  inFlightRequestKey: "runtime::4::0",
}), {
  shouldApply: false,
  shouldReleaseInFlight: false,
});

console.log("reportRuntimePreviewRowsLifecycle ✓ avoids duplicate runtime preview fetch dispatch and ignores stale settlements");
