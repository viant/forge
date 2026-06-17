import assert from "node:assert/strict";

import {
    beginReportBuilderExplorationSession,
    buildReportBuilderExplorationSourceContextFromChartSelection,
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
    staticFilters: {
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
    sourceContext: {
        label: "Display • 2026-05-01",
        metadata: {
            rowIndex: 0,
            dimensionValues: {
                channelId: "Display",
                eventDate: "2026-05-01",
            },
        },
    },
    nowMs: 1500,
});
assert.equal(startedFromRow.explorationSession.sourceRef.kind, "reportBuilder.tableRow");
assert.equal(startedFromRow.explorationSession.sourceRef.contextLabel, "Display • 2026-05-01");
assert.deepEqual(startedFromRow.explorationSession.sourceRef.context, {
    rowIndex: 0,
    dimensionValues: {
        channelId: "Display",
        eventDate: "2026-05-01",
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
    staticFilters: {
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

assert.deepEqual(buildReportBuilderExplorationBannerState(started), {
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
assert.match(
    buildReportBuilderExplorationBannerState(startedFromRow).description,
    /Display • 2026-05-01/,
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
