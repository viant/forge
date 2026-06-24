import assert from "node:assert/strict";

import {
    normalizeSemanticBinding,
    normalizeSemanticModel,
    validateSemanticBinding,
    validateSemanticModel,
} from "./modelValidation.js";

const model = {
    modelRef: "model://example/performance/delivery@v1",
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
assert.equal(normalizedModel.modelRef, "model://example/performance/delivery@v1");
assert.equal(normalizedModel.entities[0].dimensions[0].timeGrainSupport[0], "day");

const validatedModel = validateSemanticModel(model);
assert.equal(validatedModel.valid, true);
assert.deepEqual(validatedModel.errors, []);

const flatFieldModel = {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Ad Delivery",
    entities: [
        {
            id: "line_delivery",
            fields: [
                {
                    id: "event_date",
                    label: "Date",
                    featureType: "dimension",
                    dataType: "date",
                    timeGrainSupport: ["day", "week"],
                },
                {
                    id: "spend",
                    label: "Spend",
                    featureType: "measure",
                    dataType: "number",
                    aggregation: "sum",
                    governance: {
                        status: "approved",
                        certification: "certified",
                    },
                },
                {
                    id: "reporting_window",
                    label: "Reporting Window",
                    featureType: "parameter",
                    dataType: "date",
                },
            ],
        },
    ],
};

const normalizedFlatFieldModel = normalizeSemanticModel(flatFieldModel);
assert.equal(normalizedFlatFieldModel.entities[0].dimensions[0].featureType, "dimension");
assert.equal(normalizedFlatFieldModel.entities[0].measures[0].featureType, "measure");
assert.equal(normalizedFlatFieldModel.entities[0].parameters[0].featureType, "parameter");

const validatedFlatFieldModel = validateSemanticModel(flatFieldModel);
assert.equal(validatedFlatFieldModel.valid, true);
assert.deepEqual(validatedFlatFieldModel.errors, []);

const invalidModel = validateSemanticModel({
    modelRef: "model://example/performance/delivery@v1",
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

const invalidFlatFieldModel = validateSemanticModel({
    modelRef: "model://example/performance/delivery@v1",
    entities: [
        {
            id: "line_delivery",
            fields: [
                { id: "publisher", featureType: "" },
                { id: "audience_index", featureType: "metric" },
            ],
        },
    ],
});
assert.equal(invalidFlatFieldModel.valid, false);
assert.deepEqual(
    invalidFlatFieldModel.errors.map((entry) => entry.code),
    ["required", "invalid"],
);

const rawBinding = normalizeSemanticBinding({ mode: "raw" });
assert.deepEqual(rawBinding, { mode: "raw" });

const semanticBinding = normalizeSemanticBinding({
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["spend"],
});
assert.deepEqual(semanticBinding, {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["spend"],
});

const validatedBinding = validateSemanticBinding(semanticBinding, model);
assert.equal(validatedBinding.valid, true);
assert.deepEqual(validatedBinding.errors, []);

const validatedFlatFieldBinding = validateSemanticBinding({
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["spend"],
}, flatFieldModel);
assert.equal(validatedFlatFieldBinding.valid, true);
assert.deepEqual(validatedFlatFieldBinding.errors, []);

const invalidBinding = validateSemanticBinding({
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
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
