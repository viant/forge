import assert from "node:assert/strict";

import {
    createSemanticModelProvider,
    hasSemanticModelProvider,
    validateSemanticModelProvider,
} from "./modelProvider.js";

const provider = {
    async listModels(namespace) {
        return [{ namespace }];
    },
    async getModel(modelRef) {
        return { modelRef };
    },
    async validateSelection(modelRef, selection) {
        return { modelRef, selection, valid: true };
    },
};

assert.equal(hasSemanticModelProvider(provider), true);
assert.deepEqual(validateSemanticModelProvider({ listModels() {} }), {
    valid: false,
    missing: ["getModel", "validateSelection"],
});

const wrapped = createSemanticModelProvider(provider);
assert.deepEqual(await wrapped.listModels("performance"), [{ namespace: "performance" }]);
assert.deepEqual(await wrapped.getModel("model://steward/performance/ad_delivery@v1"), {
    modelRef: "model://steward/performance/ad_delivery@v1",
});

await assert.rejects(
    async () => createSemanticModelProvider({}),
    /Semantic model provider missing methods/,
);

console.log("modelProvider ✓ validates and wraps provider contracts");
