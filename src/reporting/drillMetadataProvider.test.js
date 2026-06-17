import assert from "node:assert/strict";

import {
  createDrillMetadataProvider,
  hasDrillMetadataProvider,
  normalizeDetailTarget,
  normalizeDrillHierarchy,
  normalizeRefinementActions,
  validateDrillMetadataProvider,
} from "./drillMetadataProvider.js";

const provider = {
  async getDrillHierarchy(fieldRef) {
    return {
      drillHierarchy: {
        fieldRef,
        levels: [
          { id: "state", field: "stateCode", label: "State" },
          { id: "dma", field: "dma", label: "DMA" },
        ],
      },
    };
  },
  async getDetailTarget(targetRef) {
    return {
      detailTarget: {
        targetRef,
        navigationMode: "hostRoute",
        parameters: {
          orderId: "$row.adOrderId",
        },
      },
    };
  },
  async listAvailableRefinements() {
    return {
      actions: [
        { id: "keep", label: "Keep only", kind: "keep" },
        { id: "exclude", label: "Exclude", kind: "exclude" },
        { id: "detail", label: "Show details", kind: "detail", targetRef: "target://steward/performance/order-detail" },
        { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
      ],
    };
  },
};

assert.equal(hasDrillMetadataProvider(provider), true);
assert.deepEqual(validateDrillMetadataProvider({ getDrillHierarchy() {} }), {
  valid: false,
  missing: ["getDetailTarget", "listAvailableRefinements"],
});

assert.deepEqual(normalizeDrillHierarchy({
  drillHierarchy: {
    fieldRef: "stateCode",
    levels: [
      { id: "state", field: "stateCode", label: "State" },
      { id: "dma", field: "dma", label: "DMA" },
    ],
  },
}), {
  fieldRef: "stateCode",
  levels: [
    { id: "state", field: "stateCode", label: "State" },
    { id: "dma", field: "dma", label: "DMA" },
  ],
});

assert.deepEqual(normalizeDetailTarget({
  detailTarget: {
    targetRef: "target://steward/performance/order-detail",
    navigationMode: "hostRoute",
    parameters: {
      orderId: "$row.adOrderId",
    },
  },
}), {
  targetRef: "target://steward/performance/order-detail",
  navigationMode: "hostRoute",
  parameters: {
    orderId: "$row.adOrderId",
  },
});

assert.deepEqual(normalizeRefinementActions({
  actions: [
    { id: "keep", label: "Keep only", kind: "keep" },
    { id: "exclude", label: "Exclude", kind: "exclude" },
    { id: "detail", label: "Show details", kind: "detail", targetRef: "target://steward/performance/order-detail" },
    { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
    { id: "broken", label: "Broken", kind: "unknown" },
  ],
}), [
  { id: "keep", label: "Keep only", kind: "keep" },
  { id: "exclude", label: "Exclude", kind: "exclude" },
  { id: "detail", label: "Show details", kind: "detail", targetRef: "target://steward/performance/order-detail" },
  { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
]);

const wrapped = createDrillMetadataProvider(provider);
assert.deepEqual(await wrapped.getDrillHierarchy("stateCode"), {
  fieldRef: "stateCode",
  levels: [
    { id: "state", field: "stateCode", label: "State" },
    { id: "dma", field: "dma", label: "DMA" },
  ],
});
assert.deepEqual(await wrapped.getDetailTarget("target://steward/performance/order-detail"), {
  targetRef: "target://steward/performance/order-detail",
  navigationMode: "hostRoute",
  parameters: {
    orderId: "$row.adOrderId",
  },
});
assert.deepEqual(await wrapped.listAvailableRefinements("chartBlock", "region"), [
  { id: "keep", label: "Keep only", kind: "keep" },
  { id: "exclude", label: "Exclude", kind: "exclude" },
  { id: "detail", label: "Show details", kind: "detail", targetRef: "target://steward/performance/order-detail" },
  { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
]);

await assert.rejects(
  async () => createDrillMetadataProvider({}),
  /Drill metadata provider missing methods/,
);

console.log("drillMetadataProvider ✓ validates and normalizes drill/detail provider contracts");
