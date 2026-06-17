import assert from "node:assert/strict";

import {
    formatSemanticModelRef,
    isSemanticModelRef,
    normalizeSemanticModelRef,
    parseSemanticModelRef,
} from "./modelRef.js";

const parsed = parseSemanticModelRef("model://steward/performance/ad_delivery@v1");
assert.deepEqual(parsed, {
    scheme: "model",
    namespace: "steward/performance",
    model: "ad_delivery",
    version: "v1",
    ref: "model://steward/performance/ad_delivery@v1",
});

assert.equal(formatSemanticModelRef({
    namespace: "steward/performance",
    model: "ad_delivery",
    version: "v1",
}), "model://steward/performance/ad_delivery@v1");

assert.equal(normalizeSemanticModelRef(" model://steward/performance/ad_delivery@v1 "), "model://steward/performance/ad_delivery@v1");
assert.equal(isSemanticModelRef("model://steward/performance/ad_delivery@v1"), true);
assert.equal(isSemanticModelRef("model://too-short"), false);
assert.equal(parseSemanticModelRef(""), null);

console.log("modelRef ✓ parse/format/normalize semantic model refs");
