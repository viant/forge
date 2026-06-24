import assert from "node:assert/strict";

import {
    hasStoredReportBuilderState,
    loadStoredReportBuilderState,
    persistStoredReportBuilderState,
    replaceReportBuilderWindowState,
    reportBuilderStateStorageKey,
    resolveLegacyReportBuilderStateStorageScopes,
    resolveReportBuilderStateStorageScope,
    resolveEffectiveReportBuilderState,
    shouldHydrateStoredReportBuilderWindowState,
    shouldPersistReportBuilderWindowState,
} from "./reportBuilderPersistence.js";

const storage = new Map();
global.window = {
    localStorage: {
        getItem(key) {
            return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
            storage.set(key, String(value));
        },
        removeItem(key) {
            storage.delete(key);
        },
    },
};

assert.equal(
    reportBuilderStateStorageKey("capacityCubeBuilder"),
    "reportBuilder.state.capacityCubeBuilder",
);

assert.equal(loadStoredReportBuilderState("capacityCubeBuilder"), null);

assert.equal(
    resolveReportBuilderStateStorageScope({
        stateKey: "capacityCubeBuilder",
        windowId: "capacityWindowA",
        dataSourceRef: "capacityCube",
        containerId: "capacityCubeBuilder",
    }),
    "capacityCubeBuilder.capacityWindowA",
);
assert.equal(
    resolveReportBuilderStateStorageScope({
        stateKey: "capacityCubeBuilder",
        dataSourceRef: "capacityCube",
        containerId: "capacityCubeBuilder",
    }),
    "capacityCubeBuilder.capacityCube.capacityCubeBuilder",
);
assert.deepEqual(
    resolveLegacyReportBuilderStateStorageScopes({
        stateKey: "capacityCubeBuilder",
        stateStorageScope: "capacityCubeBuilder.capacityWindowA",
    }),
    ["capacityCubeBuilder"],
);

assert.equal(hasStoredReportBuilderState(null), false);
assert.equal(hasStoredReportBuilderState({}), false);
assert.equal(hasStoredReportBuilderState({ selectedMeasures: ["avails"] }), true);
assert.deepEqual(
    resolveEffectiveReportBuilderState(
        { selectedMeasures: ["avails"] },
        { selectedMeasures: ["hhUniqs"] },
    ),
    { selectedMeasures: ["avails"] },
);
assert.deepEqual(
    resolveEffectiveReportBuilderState(
        {},
        { selectedMeasures: ["hhUniqs"] },
    ),
    { selectedMeasures: ["hhUniqs"] },
);
assert.equal(
    shouldHydrateStoredReportBuilderWindowState(
        {},
        { selectedMeasures: ["hhUniqs"] },
    ),
    true,
);
assert.equal(
    shouldHydrateStoredReportBuilderWindowState(
        { selectedMeasures: ["avails"] },
        { selectedMeasures: ["hhUniqs"] },
    ),
    false,
);
assert.equal(
    shouldPersistReportBuilderWindowState(
        { selectedMeasures: ["avails"], viewMode: "chart" },
        { selectedMeasures: ["avails"], viewMode: "chart" },
    ),
    false,
);
assert.equal(
    shouldPersistReportBuilderWindowState(
        { selectedMeasures: ["avails"], viewMode: "chart" },
        { selectedMeasures: ["avails"], viewMode: "table" },
    ),
    true,
);

persistStoredReportBuilderState("capacityCubeBuilder", {
    selectedMeasures: ["avails"],
    selectedDimensions: ["eventDate"],
    viewMode: "chart",
});

assert.deepEqual(
    loadStoredReportBuilderState("capacityCubeBuilder"),
    {
        selectedMeasures: ["avails"],
        selectedDimensions: ["eventDate"],
        viewMode: "chart",
    },
);

persistStoredReportBuilderState("capacityCubeBuilder", null);
assert.equal(loadStoredReportBuilderState("capacityCubeBuilder"), null);

persistStoredReportBuilderState("", { selectedMeasures: ["default"] });
assert.deepEqual(
    loadStoredReportBuilderState(""),
    { selectedMeasures: ["default"] },
);
persistStoredReportBuilderState("", null);
assert.equal(loadStoredReportBuilderState(""), null);

const semanticPersistedState = {
    selectedMeasures: ["avails", "hhUniqs"],
    selectedDimensions: ["eventDate", "channelV2"],
    groupBy: "agegroupId",
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["available_impressions", "household_uniques"],
    },
    staticFilters: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-04",
        },
    },
    viewMode: "table",
};
persistStoredReportBuilderState("semanticPreviewWindow", semanticPersistedState);
assert.deepEqual(
    loadStoredReportBuilderState("semanticPreviewWindow"),
    semanticPersistedState,
);
persistStoredReportBuilderState("semanticPreviewWindow", null);
assert.equal(loadStoredReportBuilderState("semanticPreviewWindow"), null);

assert.deepEqual(
    replaceReportBuilderWindowState(
        {
            capacityCubeBuilder: {
                chartSpec: {
                    title: "Area by Date and Channel",
                    type: "area",
                    xField: "eventDate",
                    yFields: ["avails"],
                    seriesField: "channelV2",
                },
                selectedDimensions: ["eventDate", "channelV2"],
            },
            sibling: {
                untouched: true,
            },
        },
        "capacityCubeBuilder",
        {
            chartSpec: {
                title: "Avails by Date",
                type: "line",
                xField: "eventDate",
                yFields: ["avails"],
            },
            selectedDimensions: ["eventDate"],
        },
    ),
    {
        capacityCubeBuilder: {
            chartSpec: {
                title: "Avails by Date",
                type: "line",
                xField: "eventDate",
                yFields: ["avails"],
            },
            selectedDimensions: ["eventDate"],
        },
        sibling: {
            untouched: true,
        },
    },
);

persistStoredReportBuilderState("capacityCubeBuilder", {
    selectedMeasures: ["legacy"],
});
assert.deepEqual(
    loadStoredReportBuilderState(
        "capacityCubeBuilder.capacityWindowA",
        ["capacityCubeBuilder"],
    ),
    {
        selectedMeasures: ["legacy"],
    },
);
persistStoredReportBuilderState(
    "capacityCubeBuilder.capacityWindowA",
    { selectedMeasures: ["window"] },
    ["capacityCubeBuilder"],
);
assert.deepEqual(
    loadStoredReportBuilderState("capacityCubeBuilder.capacityWindowA"),
    { selectedMeasures: ["window"] },
);
assert.equal(loadStoredReportBuilderState("capacityCubeBuilder"), null);

console.log("reportBuilderPersistence ✓ local report-builder state storage");
