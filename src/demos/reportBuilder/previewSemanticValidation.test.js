import assert from "node:assert/strict";

import {
  applyPreviewSemanticValidationBehavior,
  attachPreviewSemanticValidationBehaviorApi,
  clearPreviewSemanticValidationBehaviors,
  consumePreviewSemanticValidationBehavior,
  loadStoredPreviewSemanticValidationBehaviors,
  normalizePreviewSemanticValidationBehavior,
  normalizePreviewSemanticSelectionParameters,
  persistPreviewSemanticValidationBehaviors,
  PREVIEW_SEMANTIC_VALIDATION_STORAGE_KEY,
  previewSemanticSelectionIdsEqual,
  previewSemanticSelectionParametersEqual,
  queuePreviewSemanticValidationBehavior,
  replacePreviewSemanticValidationBehaviors,
} from "./previewSemanticValidation.js";

assert.equal(previewSemanticSelectionIdsEqual([" event_date ", "channel"], ["event_date", "channel"]), true);
assert.equal(previewSemanticSelectionIdsEqual(["event_date"], ["event_date", "channel"]), false);
assert.deepEqual(normalizePreviewSemanticSelectionParameters({
  reporting_window: { end: " 2026-05-07 ", start: " 2026-05-01 " },
  delivery_channels_filter: [" Display ", "CTV"],
}), {
  delivery_channels_filter: ["Display", "CTV"],
  reporting_window: { end: "2026-05-07", start: "2026-05-01" },
});
assert.equal(previewSemanticSelectionParametersEqual(
  { reporting_window: { start: "2026-05-01", end: "2026-05-07" } },
  { reporting_window: { end: "2026-05-07", start: "2026-05-01" } },
), true);

assert.deepEqual(normalizePreviewSemanticValidationBehavior({
  match: {
    modelRef: " model://example/performance/delivery@v1 ",
    entity: " line_delivery ",
    dimensions: [" event_date ", " channel "],
    measures: [" available_impressions "],
    parameters: {
      reporting_window: { end: " 2026-05-07 ", start: " 2026-05-01 " },
    },
  },
  delayMs: "1500",
  error: " Semantic provider unavailable. ",
  result: {
    valid: true,
    normalizedSelection: {
      entity: "line_delivery",
      dimensions: ["event_date", "channel"],
      measures: ["available_impressions"],
    },
    diagnostics: [],
  },
}), {
  match: {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    dimensions: ["event_date", "channel"],
    measures: ["available_impressions"],
    parameters: {
      reporting_window: { end: "2026-05-07", start: "2026-05-01" },
    },
  },
  delayMs: 1500,
  error: "Semantic provider unavailable.",
  result: {
    valid: true,
    normalizedSelection: {
      entity: "line_delivery",
      dimensions: ["event_date", "channel"],
      measures: ["available_impressions"],
    },
    diagnostics: [],
  },
});

const metrics = attachPreviewSemanticValidationBehaviorApi({});
assert.equal(metrics.replaceSemanticValidationBehaviors([
  {
    match: {
      entity: "line_delivery",
      dimensions: ["event_date", "channel", "country_code"],
      parameters: {
        reporting_window: { start: "2026-05-01", end: "2026-05-07" },
      },
    },
    delayMs: 1200,
  },
]), 1);
assert.equal(Array.isArray(metrics.semanticValidationBehaviors), true);
assert.equal(metrics.semanticValidationBehaviors.length, 1);

assert.equal(metrics.queueSemanticValidationBehavior({
  match: {
    entity: "line_delivery",
    dimensions: ["event_date", "channel", "age_group"],
  },
  error: "Semantic provider unavailable.",
}), 2);
assert.equal(metrics.semanticValidationBehaviors.length, 2);

assert.deepEqual(consumePreviewSemanticValidationBehavior(
  metrics,
  "model://example/performance/delivery@v1",
  {
    entity: "line_delivery",
    dimensions: ["event_date", "channel", "country_code"],
    measures: ["available_impressions", "household_uniques"],
    parameters: {
      reporting_window: { start: "2026-05-01", end: "2026-05-07" },
    },
  },
), {
  match: {
    entity: "line_delivery",
    dimensions: ["event_date", "channel", "country_code"],
    parameters: {
      reporting_window: { end: "2026-05-07", start: "2026-05-01" },
    },
  },
  delayMs: 1200,
});
assert.equal(metrics.semanticValidationBehaviors.length, 1);

assert.equal(consumePreviewSemanticValidationBehavior(
  metrics,
  "model://example/performance/delivery@v1",
  {
    entity: "line_delivery",
    dimensions: ["event_date", "channel", "country_code"],
    measures: ["available_impressions", "household_uniques"],
    parameters: {
      reporting_window: { start: "2026-05-01", end: "2026-05-08" },
    },
  },
), null);
assert.equal(metrics.semanticValidationBehaviors.length, 1);

assert.deepEqual(consumePreviewSemanticValidationBehavior(
  metrics,
  "model://example/performance/delivery@v1",
  {
    entity: "line_delivery",
    dimensions: ["event_date", "channel", "country_code"],
    measures: ["available_impressions", "household_uniques"],
    parameters: {
      reporting_window: { end: "2026-05-07", start: "2026-05-01" },
    },
  },
), null);
assert.equal(metrics.semanticValidationBehaviors.length, 1);

replacePreviewSemanticValidationBehaviors(metrics, [
  {
    match: {
      entity: "line_delivery",
      dimensions: ["event_date", "channel", "country_code"],
      measures: ["available_impressions", "household_uniques"],
      parameters: {
        delivery_channels_filter: ["Display", "CTV"],
      },
    },
    result: {
      valid: true,
      normalizedSelection: {
        entity: "line_delivery",
        dimensions: ["event_date", "channel", "country_code"],
        measures: ["available_impressions", "household_uniques"],
        parameters: {
          delivery_channels_filter: ["Display", "CTV"],
        },
      },
      diagnostics: [],
    },
  },
  {
    match: {
      entity: "line_delivery",
      dimensions: ["event_date", "channel", "age_group"],
      measures: ["available_impressions", "household_uniques"],
    },
    error: "Semantic provider unavailable.",
  },
]);
assert.equal(metrics.semanticValidationBehaviors.length, 2);

const successResult = await applyPreviewSemanticValidationBehavior(
  metrics,
  "model://example/performance/delivery@v1",
  {
    entity: "line_delivery",
    dimensions: ["event_date", "channel", "country_code"],
    measures: ["available_impressions", "household_uniques"],
    parameters: {
      delivery_channels_filter: ["Display", "CTV"],
    },
  },
);
assert.deepEqual(successResult, {
  valid: true,
  normalizedSelection: {
    entity: "line_delivery",
    dimensions: ["event_date", "channel", "country_code"],
    measures: ["available_impressions", "household_uniques"],
    parameters: {
      delivery_channels_filter: ["Display", "CTV"],
    },
  },
  diagnostics: [],
});
assert.equal(metrics.semanticValidationBehaviors.length, 1);

await assert.rejects(
  applyPreviewSemanticValidationBehavior(
    metrics,
    "model://example/performance/delivery@v1",
    {
      entity: "line_delivery",
      dimensions: ["event_date", "channel", "age_group"],
      measures: ["available_impressions", "household_uniques"],
    },
  ),
  /Semantic provider unavailable\./,
);
assert.equal(metrics.semanticValidationBehaviors.length, 0);

queuePreviewSemanticValidationBehavior(metrics, {
  match: {
    entity: "line_delivery",
  },
});
assert.equal(metrics.semanticValidationBehaviors.length, 1);
assert.equal(clearPreviewSemanticValidationBehaviors(metrics), 0);
assert.equal(metrics.semanticValidationBehaviors.length, 0);

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
assert.deepEqual(loadStoredPreviewSemanticValidationBehaviors(storageApi), []);
assert.equal(persistPreviewSemanticValidationBehaviors(storageApi, [
  {
    match: {
      entity: "line_delivery",
      dimensions: ["event_date", "channel", "country_code"],
    },
    delayMs: 600,
  },
]), 1);
assert.deepEqual(loadStoredPreviewSemanticValidationBehaviors(storageApi), [
  {
    match: {
      entity: "line_delivery",
      dimensions: ["event_date", "channel", "country_code"],
    },
    delayMs: 600,
  },
]);
assert.equal(storage.has(PREVIEW_SEMANTIC_VALIDATION_STORAGE_KEY), true);
assert.equal(persistPreviewSemanticValidationBehaviors(storageApi, []), 0);
assert.equal(storage.has(PREVIEW_SEMANTIC_VALIDATION_STORAGE_KEY), false);

console.log("previewSemanticValidation ✓ queue, replace, consume, and normalize semantic behaviors");
