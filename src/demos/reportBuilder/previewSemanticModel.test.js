import assert from "node:assert/strict";

import {
  applyPreviewSemanticModelBehavior,
  attachPreviewSemanticModelBehaviorApi,
  clearPreviewSemanticModelBehaviors,
  consumePreviewSemanticModelBehavior,
  loadStoredPreviewSemanticModelBehaviors,
  normalizePreviewSemanticModelBehavior,
  persistPreviewSemanticModelBehaviors,
  PREVIEW_SEMANTIC_MODEL_STORAGE_KEY,
  queuePreviewSemanticModelBehavior,
  replacePreviewSemanticModelBehaviors,
} from "./previewSemanticModel.js";

assert.deepEqual(normalizePreviewSemanticModelBehavior({
  match: {
    modelRef: " model://example/commerce/revenue@v1 ",
  },
  delayMs: "1200",
  error: " Semantic model metadata failed. ",
  result: {
    modelRef: "model://example/commerce/revenue@v1",
    label: "Revenue Operations",
  },
}), {
  match: {
    modelRef: "model://example/commerce/revenue@v1",
  },
  delayMs: 1200,
  error: "Semantic model metadata failed.",
  result: {
    modelRef: "model://example/commerce/revenue@v1",
    label: "Revenue Operations",
  },
});

const metrics = attachPreviewSemanticModelBehaviorApi({});
assert.equal(metrics.replaceSemanticModelBehaviors([
  {
    match: {
      modelRef: "model://example/commerce/revenue@v1",
    },
    delayMs: 600,
  },
]), 1);
assert.equal(Array.isArray(metrics.semanticModelBehaviors), true);
assert.equal(metrics.semanticModelBehaviors.length, 1);

assert.equal(metrics.queueSemanticModelBehavior({
  match: {
    modelRef: "model://example/commerce/revenue@v1",
  },
  error: "Semantic model metadata failed.",
}), 2);
assert.equal(metrics.semanticModelBehaviors.length, 2);

assert.deepEqual(consumePreviewSemanticModelBehavior(
  metrics,
  "model://example/commerce/revenue@v1",
), {
  match: {
    modelRef: "model://example/commerce/revenue@v1",
  },
  delayMs: 600,
});
assert.equal(metrics.semanticModelBehaviors.length, 1);

replacePreviewSemanticModelBehaviors(metrics, [
  {
    match: {
      modelRef: "model://example/commerce/revenue@v1",
    },
    result: {
      modelRef: "model://example/commerce/revenue@v1",
      label: "Revenue Operations",
    },
  },
  {
    match: {
      modelRef: "model://example/commerce/revenue@v1",
    },
    error: "Semantic model metadata failed.",
  },
]);
assert.equal(metrics.semanticModelBehaviors.length, 2);

const successResult = await applyPreviewSemanticModelBehavior(
  metrics,
  "model://example/commerce/revenue@v1",
);
assert.deepEqual(successResult, {
  modelRef: "model://example/commerce/revenue@v1",
  label: "Revenue Operations",
});
assert.equal(metrics.semanticModelBehaviors.length, 1);

await assert.rejects(
  applyPreviewSemanticModelBehavior(
    metrics,
    "model://example/commerce/revenue@v1",
  ),
  /Semantic model metadata failed\./,
);
assert.equal(metrics.semanticModelBehaviors.length, 0);

queuePreviewSemanticModelBehavior(metrics, {
  match: {
    modelRef: "model://example/commerce/revenue@v1",
  },
});
assert.equal(metrics.semanticModelBehaviors.length, 1);
assert.equal(clearPreviewSemanticModelBehaviors(metrics), 0);
assert.equal(metrics.semanticModelBehaviors.length, 0);

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
assert.deepEqual(loadStoredPreviewSemanticModelBehaviors(storageApi), []);
assert.equal(persistPreviewSemanticModelBehaviors(storageApi, [
  {
    match: {
      modelRef: "model://example/commerce/revenue@v1",
    },
    delayMs: 600,
  },
]), 1);
assert.deepEqual(loadStoredPreviewSemanticModelBehaviors(storageApi), [
  {
    match: {
      modelRef: "model://example/commerce/revenue@v1",
    },
    delayMs: 600,
  },
]);
assert.equal(storage.has(PREVIEW_SEMANTIC_MODEL_STORAGE_KEY), true);
assert.equal(persistPreviewSemanticModelBehaviors(storageApi, []), 0);
assert.equal(storage.has(PREVIEW_SEMANTIC_MODEL_STORAGE_KEY), false);

console.log("previewSemanticModel ✓ queue, replace, consume, and normalize semantic model behaviors");
