import assert from "node:assert/strict";

import {
  resolveReportBuilderChartQueryDispatchPlan,
  resolveReportBuilderChartQuerySettlementPlan,
  resolveReportBuilderChartQueryEffectAction,
  shouldApplyReportBuilderChartQuerySettlement,
  shouldReleaseReportBuilderChartQueryInFlightKey,
} from "./reportBuilderChartQueryLifecycle.js";

assert.equal(shouldApplyReportBuilderChartQuerySettlement({
  mounted: false,
  currentRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: 2,
  requestGeneration: 2,
}), false);

assert.equal(shouldApplyReportBuilderChartQuerySettlement({
  mounted: true,
  currentRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::2",
  currentGeneration: 2,
  requestGeneration: 2,
}), false);

assert.equal(shouldApplyReportBuilderChartQuerySettlement({
  mounted: true,
  currentRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: 3,
  requestGeneration: 2,
}), false);

assert.equal(shouldApplyReportBuilderChartQuerySettlement({
  mounted: true,
  currentRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: 2,
  requestGeneration: 2,
}), true);

assert.equal(shouldApplyReportBuilderChartQuerySettlement({
  mounted: true,
  currentRequestKey: " fingerprint::1 ",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: Number.NaN,
  requestGeneration: 0,
}), true);

assert.equal(shouldReleaseReportBuilderChartQueryInFlightKey({
  inFlightRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::2",
  currentGeneration: 2,
  requestGeneration: 2,
}), false);

assert.equal(shouldReleaseReportBuilderChartQueryInFlightKey({
  inFlightRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: 3,
  requestGeneration: 2,
}), false);

assert.equal(shouldReleaseReportBuilderChartQueryInFlightKey({
  inFlightRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: 2,
  requestGeneration: 2,
}), true);

assert.equal(shouldReleaseReportBuilderChartQueryInFlightKey({
  inFlightRequestKey: " fingerprint::1 ",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: Number.NaN,
  requestGeneration: 0,
}), true);

assert.deepEqual(resolveReportBuilderChartQueryEffectAction({
  transitionType: "reset",
  inFlightRequestKey: "fingerprint::1",
  requestKey: "fingerprint::1",
  currentGeneration: 4,
}), {
  issueFetch: false,
  nextGeneration: 5,
  nextInFlightRequestKey: "",
  requestGeneration: 5,
});

assert.deepEqual(resolveReportBuilderChartQueryEffectAction({
  transitionType: "unavailable",
  inFlightRequestKey: "fingerprint::1",
  requestKey: "fingerprint::1",
  currentGeneration: 4,
}), {
  issueFetch: false,
  nextGeneration: 5,
  nextInFlightRequestKey: "",
  requestGeneration: 5,
});

assert.deepEqual(resolveReportBuilderChartQueryEffectAction({
  transitionType: "noop",
  inFlightRequestKey: "fingerprint::1",
  requestKey: "fingerprint::2",
  currentGeneration: 4,
}), {
  issueFetch: false,
  nextGeneration: 4,
  nextInFlightRequestKey: "fingerprint::1",
  requestGeneration: 4,
});

assert.deepEqual(resolveReportBuilderChartQueryEffectAction({
  transitionType: "start",
  inFlightRequestKey: "fingerprint::1",
  requestKey: "fingerprint::1",
  currentGeneration: 4,
}), {
  issueFetch: false,
  nextGeneration: 4,
  nextInFlightRequestKey: "fingerprint::1",
  requestGeneration: 4,
});

assert.deepEqual(resolveReportBuilderChartQueryEffectAction({
  transitionType: "start",
  inFlightRequestKey: "fingerprint::1",
  requestKey: " fingerprint::2 ",
  currentGeneration: Number.NaN,
}), {
  issueFetch: true,
  nextGeneration: 1,
  nextInFlightRequestKey: "fingerprint::2",
  requestGeneration: 1,
});

assert.deepEqual(resolveReportBuilderChartQueryDispatchPlan({
  transitionType: "noop",
  inFlightRequestKey: "fingerprint::1",
  requestKey: "fingerprint::2",
  currentGeneration: 4,
}), {
  applyState: false,
  issueFetch: false,
  nextGeneration: 4,
  nextInFlightRequestKey: "fingerprint::1",
  requestGeneration: 4,
});

assert.deepEqual(resolveReportBuilderChartQueryDispatchPlan({
  transitionType: "start",
  inFlightRequestKey: "fingerprint::1",
  requestKey: "fingerprint::1",
  currentGeneration: 4,
}), {
  applyState: false,
  issueFetch: false,
  nextGeneration: 4,
  nextInFlightRequestKey: "fingerprint::1",
  requestGeneration: 4,
});

assert.deepEqual(resolveReportBuilderChartQueryDispatchPlan({
  transitionType: "reset",
  inFlightRequestKey: "fingerprint::1",
  requestKey: "fingerprint::1",
  currentGeneration: 4,
}), {
  applyState: true,
  issueFetch: false,
  nextGeneration: 5,
  nextInFlightRequestKey: "",
  requestGeneration: 5,
});

assert.deepEqual(resolveReportBuilderChartQueryDispatchPlan({
  transitionType: "unavailable",
  inFlightRequestKey: "fingerprint::1",
  requestKey: "fingerprint::1",
  currentGeneration: 4,
}), {
  applyState: true,
  issueFetch: false,
  nextGeneration: 5,
  nextInFlightRequestKey: "",
  requestGeneration: 5,
});

assert.deepEqual(resolveReportBuilderChartQueryDispatchPlan({
  transitionType: "start",
  inFlightRequestKey: "fingerprint::1",
  requestKey: " fingerprint::2 ",
  currentGeneration: Number.NaN,
}), {
  applyState: true,
  issueFetch: true,
  nextGeneration: 1,
  nextInFlightRequestKey: "fingerprint::2",
  requestGeneration: 1,
});

assert.deepEqual(resolveReportBuilderChartQuerySettlementPlan({
  mounted: false,
  currentRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: 2,
  requestGeneration: 2,
  inFlightRequestKey: "fingerprint::1",
}), {
  shouldApply: false,
  shouldReleaseInFlight: false,
});

assert.deepEqual(resolveReportBuilderChartQuerySettlementPlan({
  mounted: true,
  currentRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::2",
  currentGeneration: 2,
  requestGeneration: 2,
  inFlightRequestKey: "fingerprint::2",
}), {
  shouldApply: false,
  shouldReleaseInFlight: false,
});

assert.deepEqual(resolveReportBuilderChartQuerySettlementPlan({
  mounted: true,
  currentRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: 3,
  requestGeneration: 2,
  inFlightRequestKey: "fingerprint::1",
}), {
  shouldApply: false,
  shouldReleaseInFlight: false,
});

assert.deepEqual(resolveReportBuilderChartQuerySettlementPlan({
  mounted: true,
  currentRequestKey: "fingerprint::1",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: 2,
  requestGeneration: 2,
  inFlightRequestKey: "fingerprint::2",
}), {
  shouldApply: true,
  shouldReleaseInFlight: false,
});

assert.deepEqual(resolveReportBuilderChartQuerySettlementPlan({
  mounted: true,
  currentRequestKey: " fingerprint::1 ",
  requestedRequestKey: "fingerprint::1",
  currentGeneration: Number.NaN,
  requestGeneration: 0,
  inFlightRequestKey: "fingerprint::1",
}), {
  shouldApply: true,
  shouldReleaseInFlight: true,
});

console.log("reportBuilderChartQueryLifecycle ✓ applies settle and in-flight release guards deterministically");
