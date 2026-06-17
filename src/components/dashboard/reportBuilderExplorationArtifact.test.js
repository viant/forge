import assert from "node:assert/strict";

import {
    buildReportBuilderExplorationArtifactDownload,
    buildReportBuilderExplorationArtifact,
    buildReportBuilderExplorationArtifactInspectorState,
    buildReportBuilderExplorationArtifactSummary,
    serializeReportBuilderExplorationArtifact,
} from "./reportBuilderExplorationArtifact.js";
import { beginReportBuilderExplorationSession, recordReportBuilderExplorationHistory } from "./reportBuilderExplorationSession.js";

const container = {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Exploration Demo",
    dataSourceRef: "demoReportSource",
};

const config = {
    title: "Exploration Demo",
    dataSourceRef: "demoReportSource",
    measures: [
        { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, paramPath: "measures.totalSpend" },
        { id: "impressions", key: "impressions", label: "Impressions", paramPath: "measures.impressions" },
    ],
    dimensions: [
        { id: "eventDate", key: "eventDate", label: "Date", default: true, chartAxis: true, paramPath: "dimensions.eventDate" },
        { id: "channelId", key: "channelId", label: "Channel", default: true, paramPath: "dimensions.channelId" },
    ],
    staticFilters: [
        {
            id: "dateRange",
            label: "Date Range",
            type: "dateRange",
            required: true,
            default: { start: "2026-05-01", end: "2026-05-04" },
            startParamPath: "filters.from",
            endParamPath: "filters.to",
        },
    ],
    result: {
        defaultMode: "table",
        viewModes: ["table", "chart"],
    },
};

const baseState = {
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    selectedDimensions: ["eventDate", "channelId"],
    viewMode: "table",
    staticFilters: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-04",
        },
    },
};

const sessionState = beginReportBuilderExplorationSession(baseState, {
    container,
    sourceKind: "reportBuilder.tableRow",
    sourceContext: {
        label: "2026-05-01 • Display",
        metadata: {
            rowIndex: 0,
            dimensionValues: {
                eventDate: "2026-05-01",
                channelId: "Display",
            },
        },
    },
    nowMs: 1000,
});

const mutatedState = recordReportBuilderExplorationHistory(sessionState, {
    ...sessionState,
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "impressions",
}, {
    nowMs: 2000,
});

const artifact = buildReportBuilderExplorationArtifact({
    container,
    config,
    state: mutatedState,
    savedAt: 5000,
});

assert.equal(artifact.kind, "reportBuilder.explorationArtifact");
assert.equal(artifact.artifactId, "rbexploration_rbexplore_1000_5000");
assert.equal(artifact.title, "Exploration Demo");
artifact.document.subtitle = "Executive Snapshot";
artifact.document.description = "Saved exploration artifact metadata.";
assert.equal(artifact.sourceSession.sessionId, "rbexplore_1000");
assert.equal(artifact.sourceSession.sourceRef.kind, "reportBuilder.tableRow");
assert.equal(artifact.sourceSession.sourceRef.contextLabel, "2026-05-01 • Display");
assert.equal(artifact.document.kind, "reportDocument");
assert.equal(artifact.document.blocks[0].kind, "reportBuilderBlock");
assert.equal(artifact.document.blocks[0].state.explorationSession, undefined);
assert.deepEqual(artifact.document.blocks[0].state.selectedMeasures, ["totalSpend", "impressions"]);
assert.equal(artifact.reportSpec.kind, "reportSpec");
assert.deepEqual(artifact.reportSpec.blocks.map((block) => block.id), ["primaryTable"]);

assert.deepEqual(buildReportBuilderExplorationArtifactSummary(artifact), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved exploration artifact metadata.",
    artifactId: "rbexploration_rbexplore_1000_5000",
    kind: "reportBuilder.explorationArtifact",
    sourceKind: "reportBuilder.tableRow",
    sourceLabel: "2026-05-01 • Display",
    blockCount: 1,
    datasetCount: 1,
});

assert.match(
    serializeReportBuilderExplorationArtifact(artifact),
    /"kind": "reportBuilder\.explorationArtifact"/,
);
assert.match(
    serializeReportBuilderExplorationArtifact(artifact),
    /"artifactId": "rbexploration_rbexplore_1000_5000"/,
);

assert.deepEqual(buildReportBuilderExplorationArtifactInspectorState(artifact), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved exploration artifact metadata.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved exploration artifact metadata.",
    artifactId: "rbexploration_rbexplore_1000_5000",
    kind: "reportBuilder.explorationArtifact",
    sourceKind: "reportBuilder.tableRow",
    sourceLabel: "2026-05-01 • Display",
    blockCount: 1,
    datasetCount: 1,
    payload: serializeReportBuilderExplorationArtifact(artifact),
});

assert.deepEqual(buildReportBuilderExplorationArtifactDownload(artifact), {
    filename: "Exploration Demo-exploration-artifact.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderExplorationArtifact(artifact),
});

assert.equal(buildReportBuilderExplorationArtifact({ container, config, state: baseState }), null);
assert.equal(serializeReportBuilderExplorationArtifact(null), "");
assert.equal(buildReportBuilderExplorationArtifactInspectorState(null), null);
assert.equal(buildReportBuilderExplorationArtifactDownload(null), null);

const semanticArtifact = buildReportBuilderExplorationArtifact({
    container,
    config: {
        ...config,
        measures: [
            { id: "totalSpend", key: "totalSpend", semanticRef: "total_spend", label: "Spend", default: true, paramPath: "measures.totalSpend" },
            { id: "impressions", key: "impressions", semanticRef: "impressions", label: "Impressions", paramPath: "measures.impressions" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Date", default: true, chartAxis: true, paramPath: "dimensions.eventDate" },
            { id: "channelId", key: "channelId", semanticRef: "channel", label: "Channel", default: true, paramPath: "dimensions.channelId" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend", "impressions"],
        },
    },
    state: {
        ...mutatedState,
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend", "impressions"],
        },
    },
    savedAt: 5100,
    semanticModel: {
        modelRef: "model://steward/performance/ad_delivery@v1",
        version: 1,
        label: "Ad Delivery",
        entities: [
            {
                id: "line_delivery",
                label: "Line Delivery",
                dimensions: [
                    { id: "event_date", label: "Event Date" },
                    { id: "channel", label: "Channel" },
                ],
                measures: [
                    { id: "total_spend", label: "Total Spend", format: "currency" },
                    { id: "impressions", label: "Impressions", format: "compactNumber" },
                ],
            },
        ],
    },
    semanticRuntimeDiagnostics: [
        {
            code: "semanticProviderDiagnostics",
            severity: "warning",
            message: "The semantic provider returned 1 diagnostic for the current selection.",
        },
    ],
});

assert.equal(semanticArtifact.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(semanticArtifact.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(semanticArtifact.document.blocks[0].config.measures[0].label, "Total Spend");
assert.equal(semanticArtifact.document.blocks[0].config.dimensions[0].label, "Event Date");
assert.equal(semanticArtifact.compileState.status, "clean");
assert.equal(semanticArtifact.compileState.diagnostics[0].code, "semanticProviderDiagnostics");

console.log("reportBuilderExplorationArtifact ✓ builds saved exploration artifacts from forked builder state");
