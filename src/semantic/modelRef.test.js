import assert from "node:assert/strict";

import {
    formatSemanticModelRef,
    isSemanticModelRef,
    normalizeSemanticModelRef,
    parseSemanticModelRef,
} from "./modelRef.js";

const parsed = parseSemanticModelRef("model://example/performance/delivery@v1");
assert.deepEqual(parsed, {
    scheme: "model",
    namespace: "example/performance",
    model: "ad_delivery",
    version: "v1",
    ref: "model://example/performance/delivery@v1",
});

assert.equal(formatSemanticModelRef({
    namespace: "example/performance",
    model: "ad_delivery",
    version: "v1",
}), "model://example/performance/delivery@v1");

assert.equal(normalizeSemanticModelRef(" model://example/performance/delivery@v1 "), "model://example/performance/delivery@v1");
assert.equal(isSemanticModelRef("model://example/performance/delivery@v1"), true);
assert.equal(isSemanticModelRef("model://too-short"), false);
assert.equal(parseSemanticModelRef(""), null);

console.log("modelRef ✓ parse/format/normalize semantic model refs");
