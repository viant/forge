import assert from "node:assert/strict";

import {
  buildReportBuilderSemanticModelReloadKey,
  resolveReportBuilderSemanticModelSeedState,
} from "./useReportBuilderSemanticModelState.js";

assert.equal(buildReportBuilderSemanticModelReloadKey(null), "");
assert.equal(buildReportBuilderSemanticModelReloadKey({}), "");
assert.equal(buildReportBuilderSemanticModelReloadKey({
  reportId: "",
  documentVersion: 7,
}), "");
assert.equal(buildReportBuilderSemanticModelReloadKey({
  reportId: "capacityTrendQ3",
  documentVersion: 0,
}), "");
assert.equal(buildReportBuilderSemanticModelReloadKey({
  reportId: " capacityTrendQ3 ",
  documentVersion: "6",
}), "capacityTrendQ3::6");
assert.equal(buildReportBuilderSemanticModelReloadKey({
  reportId: "capacityTrendQ3",
  documentVersion: 8,
  extra: true,
}), "capacityTrendQ3::8");

const cachedModel = {
  modelRef: "model://example/performance/delivery@v1",
  label: "Ad Delivery",
};

assert.deepEqual(resolveReportBuilderSemanticModelSeedState({
  binding: { mode: "raw" },
  currentState: {
    loading: false,
    error: "",
    model: null,
  },
}), {
  loading: false,
  error: "",
  model: null,
});

assert.deepEqual(resolveReportBuilderSemanticModelSeedState({
  binding: { mode: "semantic" },
  configSemanticModel: cachedModel,
  semanticModelProvider: { getModel() {} },
  semanticModelRef: "model://example/performance/delivery@v1",
  currentState: {
    loading: true,
    error: "stale",
    model: null,
  },
}), {
  loading: false,
  error: "",
  model: cachedModel,
});

assert.deepEqual(resolveReportBuilderSemanticModelSeedState({
  binding: { mode: "semantic" },
  configSemanticModel: null,
  semanticModelProvider: null,
  semanticModelRef: "model://example/performance/delivery@v1",
  currentState: {
    loading: true,
    error: "",
    model: cachedModel,
  },
}), {
  loading: false,
  error: "",
  model: null,
});

assert.deepEqual(resolveReportBuilderSemanticModelSeedState({
  binding: { mode: "semantic" },
  configSemanticModel: null,
  semanticModelProvider: { getModel() {} },
  semanticModelRef: "",
  currentState: {
    loading: false,
    error: "Failed",
    model: cachedModel,
  },
}), {
  loading: false,
  error: "",
  model: null,
});

assert.deepEqual(resolveReportBuilderSemanticModelSeedState({
  binding: { mode: "semantic" },
  configSemanticModel: null,
  semanticModelProvider: { getModel() {} },
  semanticModelRef: "model://example/performance/delivery@v1",
  currentState: {
    loading: false,
    error: "",
    model: cachedModel,
  },
}), {
  loading: true,
  error: "",
  model: cachedModel,
});

assert.deepEqual(resolveReportBuilderSemanticModelSeedState({
  binding: { mode: "semantic" },
  configSemanticModel: null,
  semanticModelProvider: { getModel() {} },
  semanticModelRef: "model://example/performance/other@v1",
  currentState: {
    loading: false,
    error: "",
    model: cachedModel,
  },
}), {
  loading: true,
  error: "",
  model: null,
});

console.log("useReportBuilderSemanticModelState ✓ resolves deterministic semantic model reload and seed states");
