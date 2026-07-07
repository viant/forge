import assert from "node:assert/strict";

import {
    beginReportBuilderExplorationSession,
    buildReportBuilderExplorationSourceContextFromChartSelection,
    buildReportBuilderExplorationSourceContextFromTableRow,
    buildReportBuilderExplorationBannerState,
    discardReportBuilderExplorationState,
    keepReportBuilderExplorationState,
    isReportBuilderExplorationActive,
    normalizeReportBuilderExplorationState,
    recordReportBuilderExplorationHistory,
    redoReportBuilderExplorationState,
    undoReportBuilderExplorationState,
} from "./reportBuilderExplorationSession.js";

const baseState = {
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "totalSpend",
    selectedDimensions: ["eventDate", "channelId"],
    viewMode: "table",
    chartSpec: null,
    scopeParams: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-04",
        },
    },
};

const started = beginReportBuilderExplorationSession(baseState, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
    },
    nowMs: 1000,
    ttlMs: 5000,
});

assert.equal(isReportBuilderExplorationActive(started, { nowMs: 1500 }), true);
assert.equal(started.explorationSession.sourceRef.kind, "reportBuilder.result");
assert.equal(started.explorationSession.sourceRef.containerId, "demoReportBuilder");
assert.equal(started.explorationSession.history.length, 1);
assert.equal(started.explorationSession.historyIndex, 0);
assert.equal(started.explorationSession.dirty, false);

const startedFromRow = beginReportBuilderExplorationSession(baseState, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
    },
    sourceKind: "reportBuilder.tableRow",
    sourceContext: buildReportBuilderExplorationSourceContextFromTableRow({
        row: {
            eventDate: "2026-05-01",
            channelId: "Display",
        },
        rowIndex: 0,
        labelSelectors: ["eventDate", "channelId"],
    }),
    nowMs: 1500,
});
assert.equal(startedFromRow.explorationSession.sourceRef.kind, "reportBuilder.tableRow");
assert.equal(startedFromRow.explorationSession.sourceRef.contextLabel, "2026-05-01 • Display");
assert.deepEqual(startedFromRow.explorationSession.sourceRef.context, {
    rowIndex: 0,
    dimensionValues: {
        eventDate: "2026-05-01",
        channelId: "Display",
    },
});

const startedFromChartSelection = beginReportBuilderExplorationSession(baseState, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
    },
    sourceKind: "reportBuilder.chartSelection",
    sourceContext: buildReportBuilderExplorationSourceContextFromChartSelection({
        chartTitle: "Avails by Date and Channel",
        selection: {
            source: "legend",
            displaySeriesKey: "Display",
            seriesKey: "Display",
            selectionRows: [{ channelV2: "Display" }],
        },
    }),
    nowMs: 1750,
});
assert.equal(startedFromChartSelection.explorationSession.sourceRef.kind, "reportBuilder.chartSelection");
assert.equal(startedFromChartSelection.explorationSession.sourceRef.contextLabel, "Display");
assert.deepEqual(startedFromChartSelection.explorationSession.sourceRef.context, {
    chartTitle: "Avails by Date and Channel",
    selection: {
        source: "legend",
        displaySeriesKey: "Display",
        seriesKey: "Display",
        selectionRows: [{ channelV2: "Display" }],
    },
});

const withHistory = recordReportBuilderExplorationHistory(started, {
    ...started,
    selectedMeasures: ["totalSpend", "impressions", "reachRate"],
    primaryMeasure: "reachRate",
}, {
    nowMs: 2000,
});

assert.equal(withHistory.explorationSession.history.length, 2);
assert.equal(withHistory.explorationSession.historyIndex, 1);
assert.equal(withHistory.explorationSession.dirty, true);
assert.deepEqual(withHistory.selectedMeasures, ["totalSpend", "impressions", "reachRate"]);

const unchangedHistory = recordReportBuilderExplorationHistory(withHistory, withHistory, {
    nowMs: 3000,
});
assert.equal(unchangedHistory.explorationSession.history.length, 2);
assert.equal(unchangedHistory.explorationSession.historyIndex, 1);

const undone = undoReportBuilderExplorationState(withHistory, { nowMs: 2500 });
assert.equal(undone.explorationSession.historyIndex, 0);
assert.deepEqual(undone.selectedMeasures, ["totalSpend", "impressions"]);
assert.equal(undone.explorationSession.dirty, false);

const redone = redoReportBuilderExplorationState(undone, { nowMs: 2600 });
assert.equal(redone.explorationSession.historyIndex, 1);
assert.deepEqual(redone.selectedMeasures, ["totalSpend", "impressions", "reachRate"]);
assert.equal(redone.explorationSession.dirty, true);

assert.deepEqual(discardReportBuilderExplorationState(withHistory), baseState);
assert.deepEqual(keepReportBuilderExplorationState(withHistory), {
    selectedMeasures: ["totalSpend", "impressions", "reachRate"],
    primaryMeasure: "reachRate",
    selectedDimensions: ["eventDate", "channelId"],
    viewMode: "table",
    chartSpec: null,
    scopeParams: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-04",
        },
    },
});

assert.deepEqual(
    normalizeReportBuilderExplorationState(withHistory, { nowMs: 8000 }),
    baseState,
);

assert.deepEqual(buildReportBuilderExplorationBannerState(started, { nowMs: 1000 }), {
    active: true,
    sessionId: "rbexplore_1000",
    title: "Local Draft",
    description: "No local changes are active for the current result state. Edit the result to create a draft you can keep or save, or discard this empty draft.",
    hintItems: [
        "Change chart/table view without affecting the source report.",
        "Adjust measures, breakdowns, or filters locally.",
        "Keep the draft only if the result is worth saving.",
    ],
    dirty: false,
    canUndo: false,
    canRedo: false,
    canKeep: false,
    canSaveArtifact: false,
    ttlMs: 5000,
    expiresAt: 6000,
    ttlLabel: "1m left",
    sourceRef: {
        kind: "reportBuilder.result",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        viewMode: "table",
        primaryMeasure: "totalSpend",
    },
});
assert.equal(buildReportBuilderExplorationBannerState(withHistory)?.canKeep, true);
assert.equal(buildReportBuilderExplorationBannerState(withHistory)?.canSaveArtifact, true);
assert.equal(buildReportBuilderExplorationBannerState(undone)?.canKeep, false);
assert.equal(buildReportBuilderExplorationBannerState(undone)?.canSaveArtifact, false);
assert.equal(buildReportBuilderExplorationBannerState(withHistory, { nowMs: 5900 })?.ttlLabel, "1m left");
assert.match(
    buildReportBuilderExplorationBannerState(startedFromRow).description,
    /2026-05-01 • Display/,
);
assert.deepEqual(buildReportBuilderExplorationBannerState(startedFromChartSelection, { nowMs: 1750 }), {
    active: true,
    sessionId: "rbexplore_1750",
    title: "Local Draft",
    description: "No local changes are active for Display. Edit the result to create a draft you can keep or save, or discard this empty draft.",
    hintItems: [
        "Use the selected chart value as a starting point.",
        "Switch to the table to inspect matching rows locally.",
        "Keep the draft only if the changes are worth saving.",
    ],
    dirty: false,
    canUndo: false,
    canRedo: false,
    canKeep: false,
    canSaveArtifact: false,
    ttlMs: 1000 * 60 * 60,
    expiresAt: 1750 + (1000 * 60 * 60),
    ttlLabel: "1h left",
    sourceRef: {
        kind: "reportBuilder.chartSelection",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        viewMode: "table",
        primaryMeasure: "totalSpend",
        contextLabel: "Display",
        context: {
            chartTitle: "Avails by Date and Channel",
            selection: {
                source: "legend",
                displaySeriesKey: "Display",
                seriesKey: "Display",
                selectionRows: [{ channelV2: "Display" }],
            },
        },
    },
});

const startedFromChartResult = beginReportBuilderExplorationSession({
    ...baseState,
    viewMode: "chart",
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
    },
    sourceKind: "reportBuilder.chartResult",
    nowMs: 2000,
});

assert.deepEqual(buildReportBuilderExplorationBannerState(startedFromChartResult, { nowMs: 2000 })?.hintItems, [
    "Swap presets or edit the current view locally.",
    "Switch to the table to inspect the same result rows.",
    "Keep the draft only if the changes are worth saving.",
]);

assert.deepEqual(
    buildReportBuilderExplorationSourceContextFromTableRow({
        row: {
            eventDate: "2026-05-01",
            channelV2: "Display",
            campaign: "Prospect Sprint",
        },
        rowIndex: 2,
    }),
    {
        label: "2026-05-01 • Display",
        metadata: {
            rowIndex: 2,
            dimensionValues: {
                eventDate: "2026-05-01",
                channelV2: "Display",
            },
        },
    },
);

assert.deepEqual(
    buildReportBuilderExplorationSourceContextFromChartSelection({
        chartTitle: "Avails by Date and Channel",
        selection: {
            source: "legend",
            displaySeriesKey: "Display",
            seriesKey: "Display",
            selectionRows: [{ channelV2: "Display" }],
        },
    }),
    {
        label: "Display",
        metadata: {
            chartTitle: "Avails by Date and Channel",
            selection: {
                source: "legend",
                displaySeriesKey: "Display",
                seriesKey: "Display",
                selectionRows: [{ channelV2: "Display" }],
            },
        },
    },
);

console.log("reportBuilderExplorationSession ✓ starts, records history, undoes, redoes, discards, and expires exploration sessions");
