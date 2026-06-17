import assert from "node:assert/strict";

import {
    normalizeSemanticBinding,
    normalizeSemanticModel,
    validateSemanticBinding,
    validateSemanticModel,
} from "./modelValidation.js";

const model = {
    modelRef: "model://steward/performance/ad_delivery@v1",
    version: 1,
    label: "Ad Delivery",
    entities: [
        {
            id: "line_delivery",
            dimensions: [
                {
                    id: "event_date",
                    label: "Date",
                    dataType: "date",
                    timeGrainSupport: ["day", "week"],
                },
            ],
            measures: [
                {
                    id: "spend",
                    label: "Spend",
                    dataType: "number",
                    aggregation: "sum",
                    governance: {
                        status: "approved",
                        certification: "certified",
                    },
                },
            ],
        },
    ],
};

const normalizedModel = normalizeSemanticModel(model);
assert.equal(normalizedModel.modelRef, "model://steward/performance/ad_delivery@v1");
assert.equal(normalizedModel.entities[0].dimensions[0].timeGrainSupport[0], "day");

const validatedModel = validateSemanticModel(model);
assert.equal(validatedModel.valid, true);
assert.deepEqual(validatedModel.errors, []);

const invalidModel = validateSemanticModel({
    modelRef: "model://steward/performance/ad_delivery@v1",
    entities: [
        {
            id: "line_delivery",
            dimensions: [{ id: "event_date", dataType: "badType" }],
            measures: [{ id: "spend", aggregation: "badAgg" }],
        },
    ],
});
assert.equal(invalidModel.valid, false);
assert.deepEqual(
    invalidModel.errors.map((entry) => entry.code),
    ["invalid", "invalid"],
);

const rawBinding = normalizeSemanticBinding({ mode: "raw" });
assert.deepEqual(rawBinding, { mode: "raw" });

const semanticBinding = normalizeSemanticBinding({
    mode: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["spend"],
});
assert.deepEqual(semanticBinding, {
    mode: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["spend"],
});

const validatedBinding = validateSemanticBinding(semanticBinding, model);
assert.equal(validatedBinding.valid, true);
assert.deepEqual(validatedBinding.errors, []);

const invalidBinding = validateSemanticBinding({
    mode: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["missing_dimension"],
    selectedMeasures: ["missing_measure"],
}, model);
assert.equal(invalidBinding.valid, false);
assert.deepEqual(
    invalidBinding.errors.map((entry) => entry.code),
    ["unknownDimension", "unknownMeasure"],
);

console.log("modelValidation ✓ validates semantic models and bindings");
