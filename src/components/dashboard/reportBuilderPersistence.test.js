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
    reportBuilderStateStorageKey("forecastingCubeBuilder"),
    "reportBuilder.state.forecastingCubeBuilder",
);

assert.equal(loadStoredReportBuilderState("forecastingCubeBuilder"), null);

assert.equal(
    resolveReportBuilderStateStorageScope({
        stateKey: "forecastingCubeBuilder",
        windowId: "forecastingWindowA",
        dataSourceRef: "forecastingCube",
        containerId: "forecastingCubeBuilder",
    }),
    "forecastingCubeBuilder.forecastingWindowA",
);
assert.equal(
    resolveReportBuilderStateStorageScope({
        stateKey: "forecastingCubeBuilder",
        dataSourceRef: "forecastingCube",
        containerId: "forecastingCubeBuilder",
    }),
    "forecastingCubeBuilder.forecastingCube.forecastingCubeBuilder",
);
assert.deepEqual(
    resolveLegacyReportBuilderStateStorageScopes({
        stateKey: "forecastingCubeBuilder",
        stateStorageScope: "forecastingCubeBuilder.forecastingWindowA",
    }),
    ["forecastingCubeBuilder"],
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

persistStoredReportBuilderState("forecastingCubeBuilder", {
    selectedMeasures: ["avails"],
    selectedDimensions: ["eventDate"],
    viewMode: "chart",
});

assert.deepEqual(
    loadStoredReportBuilderState("forecastingCubeBuilder"),
    {
        selectedMeasures: ["avails"],
        selectedDimensions: ["eventDate"],
        viewMode: "chart",
    },
);

persistStoredReportBuilderState("forecastingCubeBuilder", null);
assert.equal(loadStoredReportBuilderState("forecastingCubeBuilder"), null);

persistStoredReportBuilderState("", { selectedMeasures: ["default"] });
assert.deepEqual(
    loadStoredReportBuilderState(""),
    { selectedMeasures: ["default"] },
);
persistStoredReportBuilderState("", null);
assert.equal(loadStoredReportBuilderState(""), null);

assert.deepEqual(
    replaceReportBuilderWindowState(
        {
            forecastingCubeBuilder: {
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
        "forecastingCubeBuilder",
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
        forecastingCubeBuilder: {
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

persistStoredReportBuilderState("forecastingCubeBuilder", {
    selectedMeasures: ["legacy"],
});
assert.deepEqual(
    loadStoredReportBuilderState(
        "forecastingCubeBuilder.forecastingWindowA",
        ["forecastingCubeBuilder"],
    ),
    {
        selectedMeasures: ["legacy"],
    },
);
persistStoredReportBuilderState(
    "forecastingCubeBuilder.forecastingWindowA",
    { selectedMeasures: ["window"] },
    ["forecastingCubeBuilder"],
);
assert.deepEqual(
    loadStoredReportBuilderState("forecastingCubeBuilder.forecastingWindowA"),
    { selectedMeasures: ["window"] },
);
assert.equal(loadStoredReportBuilderState("forecastingCubeBuilder"), null);

console.log("reportBuilderPersistence ✓ local report-builder state storage");
