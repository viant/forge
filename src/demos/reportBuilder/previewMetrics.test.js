import assert from "node:assert/strict";

import {
  createReportBuilderPreviewMetrics,
  ensureReportBuilderPreviewMetrics,
  incrementReportBuilderPreviewMetric,
  recordReportBuilderPreviewObservation,
} from "./previewMetrics.js";

const storage = new Map();
const storageApi = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};

const metrics = createReportBuilderPreviewMetrics({ storage: storageApi });
assert.deepEqual(
  {
    fetchCollectionCount: metrics.fetchCollectionCount,
    fetchRecordsCount: metrics.fetchRecordsCount,
    validateSelectionCount: metrics.validateSelectionCount,
    windowFormChangeCount: metrics.windowFormChangeCount,
    inputSignalChangeCount: metrics.inputSignalChangeCount,
    currentWindowFormJSON: metrics.currentWindowFormJSON,
    currentInputJSON: metrics.currentInputJSON,
    lastFetchRequest: metrics.lastFetchRequest,
    fetchRequestHistory: metrics.fetchRequestHistory,
    fetchEventHistory: metrics.fetchEventHistory,
    semanticValidationBehaviors: metrics.semanticValidationBehaviors,
    detailTargetBehaviors: metrics.detailTargetBehaviors,
    runtimeActionBehaviors: metrics.runtimeActionBehaviors,
    fetchBehaviors: metrics.fetchBehaviors,
  },
  {
    fetchCollectionCount: 0,
    fetchRecordsCount: 0,
    validateSelectionCount: 0,
    windowFormChangeCount: 0,
    inputSignalChangeCount: 0,
    currentWindowFormJSON: "{}",
    currentInputJSON: "{}",
    lastFetchRequest: null,
    fetchRequestHistory: [],
    fetchEventHistory: [],
    semanticValidationBehaviors: [],
    detailTargetBehaviors: [],
    runtimeActionBehaviors: [],
    fetchBehaviors: [],
  },
);

assert.equal(incrementReportBuilderPreviewMetric(metrics, "fetchCollectionCount"), 1);
assert.equal(metrics.fetchCollectionCount, 1);
assert.equal(incrementReportBuilderPreviewMetric(null, "fetchCollectionCount"), 0);

let observed = recordReportBuilderPreviewObservation({
  metrics,
  kind: "windowForm",
  currentJSON: '{"a":1}',
});
assert.deepEqual(observed, {
  previousObservedJSON: '{"a":1}',
  changed: false,
});
assert.equal(metrics.currentWindowFormJSON, '{"a":1}');
assert.equal(metrics.lastWindowFormJSON, '{"a":1}');
assert.equal(metrics.windowFormChangeCount, 0);

observed = recordReportBuilderPreviewObservation({
  metrics,
  kind: "windowForm",
  currentJSON: '{"a":2}',
  previousObservedJSON: observed.previousObservedJSON,
});
assert.deepEqual(observed, {
  previousObservedJSON: '{"a":2}',
  changed: true,
});
assert.equal(metrics.currentWindowFormJSON, '{"a":2}');
assert.equal(metrics.lastWindowFormJSON, '{"a":2}');
assert.equal(metrics.windowFormChangeCount, 1);

let inputObserved = recordReportBuilderPreviewObservation({
  metrics,
  kind: "input",
  currentJSON: '{"parameters":{"x":1}}',
});
assert.deepEqual(inputObserved, {
  previousObservedJSON: '{"parameters":{"x":1}}',
  changed: false,
});

inputObserved = recordReportBuilderPreviewObservation({
  metrics,
  kind: "input",
  currentJSON: '{"parameters":{"x":2}}',
  previousObservedJSON: inputObserved.previousObservedJSON,
});
assert.deepEqual(inputObserved, {
  previousObservedJSON: '{"parameters":{"x":2}}',
  changed: true,
});
assert.equal(metrics.inputSignalChangeCount, 1);

metrics.queueSemanticValidationBehavior({
  match: {
    entity: "line_delivery",
  },
  delayMs: 1200,
});
assert.equal(metrics.semanticValidationBehaviors.length, 1);
assert.equal(metrics.replaceDetailTargetBehaviors([
  {
    match: {
      targetRef: "target://steward/performance/channel-detail",
    },
    result: {
      detailTarget: null,
    },
  },
]), 1);
assert.equal(metrics.detailTargetBehaviors.length, 1);
assert.equal(metrics.replaceRuntimeActionBehaviors([
  {
    match: {
      fieldRef: "eventDate",
    },
    actions: [
      { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
    ],
  },
]), 1);
assert.equal(metrics.runtimeActionBehaviors.length, 1);
assert.equal(metrics.replaceFetchBehaviors([
  {
    match: {
      type: "chartQuery",
      requestFingerprint: "chart::1",
      requestKey: "chart::1::1",
    },
    error: "Chart query failed.",
  },
]), 1);
assert.equal(metrics.fetchBehaviors.length, 1);
assert.equal(storage.size > 0, true);

metrics.resetCounters();
assert.equal(metrics.fetchCollectionCount, 0);
assert.equal(metrics.fetchRecordsCount, 0);
assert.equal(metrics.validateSelectionCount, 0);
assert.equal(metrics.windowFormChangeCount, 0);
assert.equal(metrics.inputSignalChangeCount, 0);
assert.equal(metrics.lastWindowFormJSON, metrics.currentWindowFormJSON);
assert.equal(metrics.lastInputJSON, metrics.currentInputJSON);

const windowLike = {};
const ensured = ensureReportBuilderPreviewMetrics(windowLike, { storage: storageApi });
assert.equal(ensured, windowLike.__REPORT_BUILDER_PREVIEW__);
assert.equal(ensureReportBuilderPreviewMetrics(windowLike, { storage: storageApi }), ensured);

console.log("previewMetrics ✓ create, observe, increment, and persist preview metrics");
