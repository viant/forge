import assert from "node:assert/strict";

import {
    beginQuickPresetActivation,
    buildQuickPresetActionState,
    shouldScheduleQuickPresetActivationRelease,
    updateQuickPresetActivationForLoading,
} from "./reportBuilderQuickPresetFeedback.js";

assert.equal(
    beginQuickPresetActivation({
        awaitingFetch: false,
        title: "Overview · HH Uniques by Date",
    }),
    null,
);

const activation = beginQuickPresetActivation({
    title: "Overview · HH Uniques by Date",
    kind: "chart",
    awaitingFetch: true,
    loading: false,
    nowMs: 100,
    minVisibleMs: 1200,
});

assert.deepEqual(
    activation,
    {
        title: "Overview · HH Uniques by Date",
        kind: "chart",
        awaitingFetch: true,
        observedLoading: false,
        minVisibleUntil: 1300,
    },
);

assert.deepEqual(
    updateQuickPresetActivationForLoading(activation, {
        loading: true,
        nowMs: 200,
    }),
    {
        ...activation,
        observedLoading: true,
    },
);

const observed = {
    ...activation,
    observedLoading: true,
};

assert.equal(
    updateQuickPresetActivationForLoading(observed, {
        loading: false,
        nowMs: 1200,
    }),
    observed,
);

assert.equal(
    updateQuickPresetActivationForLoading(observed, {
        loading: false,
        nowMs: 1300,
    }),
    null,
);

assert.equal(
    shouldScheduleQuickPresetActivationRelease(observed, {
        loading: false,
        nowMs: 1000,
    }),
    300,
);

assert.equal(
    shouldScheduleQuickPresetActivationRelease(observed, {
        loading: false,
        nowMs: 1400,
    }),
    0,
);

assert.deepEqual(
    buildQuickPresetActionState(observed),
    {
        busy: true,
        buttonLabel: "Applying...",
        statusMessage: "Applying Overview · HH Uniques by Date. Updating the live report preview.",
    },
);

assert.deepEqual(
    buildQuickPresetActionState({
        title: "Top Sites",
        kind: "table",
        awaitingFetch: true,
    }),
    {
        busy: true,
        buttonLabel: "Applying...",
        statusMessage: "Applying Top Sites. Updating the live table preview.",
    },
);

console.log("reportBuilderQuickPresetFeedback ✓ quick preset busy-state timing and copy");
