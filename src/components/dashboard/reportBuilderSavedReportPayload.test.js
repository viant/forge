import assert from "node:assert/strict";

import { buildReportBuilderGetReportDocumentResponse } from "./reportBuilderReportDocumentReadResponse.js";
import { buildHydratedReportBuilderDocument } from "./reportBuilderHydratedReportDocument.js";
import { instantiateReportBuilderDocumentTemplate } from "./reportBuilderDocumentTemplates.js";
import {
    buildReportBuilderRuntimePreview,
    buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";
import {
    buildReportBuilderSavedReportPayload,
    buildReportBuilderSavedReportPayloadRecord,
    buildReportBuilderSavedReportPayloadFromBuilderState,
    buildReportBuilderSavedReportPayloadDownload,
    buildReportBuilderSavedReportPayloadInspectorState,
    buildReportBuilderSavedReportPayloadSummary,
    serializeReportBuilderSavedReportPayload,
} from "./reportBuilderSavedReportPayload.js";

const explorationArtifact = {
    version: 1,
    kind: "reportBuilder.explorationArtifact",
    artifactId: "rbexploration_rbexplore_1000_5000",
    savedAt: 5000,
    title: "Exploration Demo",
    sourceSession: {
        sessionId: "rbexplore_1000",
        sourceRef: {
            kind: "reportBuilder.tableRow",
            contextLabel: "2026-05-01 • Display",
        },
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
        diagnostics: [
            {
                code: "semanticProviderDiagnostics",
                severity: "warning",
                message: "The semantic provider returned 1 diagnostic for the current selection.",
            },
        ],
    },
};

const payload = buildReportBuilderSavedReportPayload(explorationArtifact, { savedAt: 6000 });
assert.deepEqual(payload, {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    savedAt: 6000,
    title: "Exploration Demo",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    sourceSession: {
        sessionId: "rbexplore_1000",
        sourceRef: {
            kind: "reportBuilder.tableRow",
            contextLabel: "2026-05-01 • Display",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
        diagnostics: [
            {
                code: "semanticProviderDiagnostics",
                severity: "warning",
                message: "The semantic provider returned 1 diagnostic for the current selection.",
            },
        ],
    },
});

const payloadRecord = buildReportBuilderSavedReportPayloadRecord(payload, {
    runtimeArtifact: {
        reportFill: {
            version: 1,
            kind: "reportFill",
        },
        reportPrint: {
            version: 1,
            kind: "reportPrint",
            title: "Exploration Demo",
        },
    },
});
assert.equal(payloadRecord, null);
assert.equal(buildReportBuilderSavedReportPayloadRecord(payload, { runtimeArtifact: null }), null);

assert.deepEqual(buildReportBuilderSavedReportPayloadSummary(payload), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    sourceLabel: "2026-05-01 • Display",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
});

assert.match(
    serializeReportBuilderSavedReportPayload(payload),
    /"kind": "reportBuilder\.savedReportPayload"/,
);
assert.match(
    serializeReportBuilderSavedReportPayload(payload),
    /"reportDocument": \{/,
);
assert.match(
    serializeReportBuilderSavedReportPayload(payload),
    /"reportSpec": \{/,
);

assert.deepEqual(buildReportBuilderSavedReportPayloadInspectorState(payload), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved authored report payload metadata.",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    sourceLabel: "2026-05-01 • Display",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
    content: serializeReportBuilderSavedReportPayload(payload),
});

assert.deepEqual(buildReportBuilderSavedReportPayloadDownload(payload), {
    filename: "Exploration Demo-saved-report-payload.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderSavedReportPayload(payload),
});

assert.equal(buildReportBuilderSavedReportPayload(null), null);
assert.equal(buildReportBuilderSavedReportPayloadSummary(null), null);
assert.equal(serializeReportBuilderSavedReportPayload(null), "");
assert.equal(buildReportBuilderSavedReportPayloadInspectorState(null), null);
assert.equal(buildReportBuilderSavedReportPayloadDownload(null), null);

assert.equal(buildReportBuilderSavedReportPayloadSummary({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_invalid",
    sourceArtifactId: "invalid_artifact",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "invalidReportBuilder",
        title: "Invalid Authored Blocks",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                config: {
                    measures: [
                        { id: "avails", key: "avails", label: "Available Impressions", default: true },
                    ],
                },
                state: {
                    selectedMeasures: [],
                    selectedDimensions: [],
                },
            },
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "avails",
                valueLabel: "Available Impressions",
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
})?.compileStatus, "clean");

assert.equal(buildReportBuilderSavedReportPayloadSummary({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_stored_compile_state",
    sourceArtifactId: "stored_compile_state",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "storedCompileState",
        title: "Stored Compile State",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                config: {
                    measures: [
                        { id: "avails", key: "avails", label: "Available Impressions", default: true },
                    ],
                },
                state: {
                    selectedMeasures: [],
                    selectedDimensions: [],
                },
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
        diagnostics: [],
    },
})?.compileStatus, "clean");

const templatedPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecast_inventory_brief",
    savedAt: 9100,
    title: "Forecast Inventory Brief",
    sourceArtifactId: "forecasting_q3_inventory_ladder",
    sourceSession: {
        sessionId: "rbexplore_forecast_inventory_brief",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "forecast_inventory_brief",
            templateLabel: "Forecast Inventory Brief",
            contextLabel: "Forecast Inventory Brief • Inventory Ladder",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastInventoryBrief",
        title: "Forecast Inventory Brief",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_inventory_brief",
                    reportDocumentTemplateLabel: "Forecast Inventory Brief",
                },
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "comparisonTable" }],
        datasets: [{ id: "primary" }],
    },
};

assert.deepEqual(buildReportBuilderSavedReportPayloadSummary(templatedPayload), {
    title: "Forecast Inventory Brief",
    payloadId: "rbreport_forecast_inventory_brief",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "forecasting_q3_inventory_ladder",
    sourceLabel: "Forecast Inventory Brief • Inventory Ladder",
    compileStatus: "clean",
    blockCount: 2,
    datasetCount: 1,
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
});

assert.deepEqual(buildReportBuilderSavedReportPayloadInspectorState(templatedPayload), {
    title: "Forecast Inventory Brief",
    payloadId: "rbreport_forecast_inventory_brief",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "forecasting_q3_inventory_ladder",
    sourceLabel: "Forecast Inventory Brief • Inventory Ladder",
    compileStatus: "clean",
    blockCount: 2,
    datasetCount: 1,
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
    content: serializeReportBuilderSavedReportPayload(templatedPayload),
});

const reopenedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3_trend",
    savedAt: 9300,
    title: "Forecasting Trend Q3",
    sourceArtifactId: "forecasting_q3_channel_trend",
    sourceSession: {
        sessionId: "rbexplore_forecastingTrendQ3",
        sourceRef: {
            kind: "reportBuilder.chartResult",
            contextLabel: "Forecasting Trend Q3 • Avails by Date and Channel",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", label: "Channel", default: true },
        ],
        staticFilters: [
            {
                id: "dateRange",
                type: "dateRange",
                required: true,
                startParamPath: "filters.From",
                endParamPath: "filters.To",
            },
        ],
        result: {
            chartCreationMode: "explicit",
            defaultMode: "chart",
            pageSize: 50,
            orderFields: [
                { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        chartSpec: {
            title: "Avails by Date and Channel",
            type: "area",
            xField: "eventDate",
            yFields: ["avails"],
            seriesField: "channelV2",
        },
        staticFilters: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
        reportDocumentReopenSession: {
            reportId: "forecastingTrendQ3",
        },
    },
    savedAt: 9400,
    semanticSummary: {
        kind: "semantic",
        modelRef: "model://steward/performance/ad_delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Event Date" },
            { id: "channel", rawId: "channelV2", label: "Channel" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
        ],
    },
    semanticRuntimeDiagnostics: [
        {
            code: "semanticGovernance",
            severity: "info",
            message: "Audience Age Group • Draft",
        },
    ],
});
assert.equal(reopenedPayload.reportDocument.id, "forecastingTrendQ3");
assert.equal(reopenedPayload.reportDocument.title, "Forecasting Trend Q3");
assert.equal(reopenedPayload.reportSpec.title, "Forecasting Trend Q3");
assert.equal(reopenedPayload.reportSpec.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(reopenedPayload.reportDocument.blocks[0].state.viewMode, "table");
assert.equal(reopenedPayload.compileState.diagnostics[0].code, "semanticGovernance");
assert.equal(reopenedPayload.compileState.status, "clean");
assert.equal(
    Object.prototype.hasOwnProperty.call(reopenedPayload.reportDocument.blocks[0].state, "reportDocumentReopenSession"),
    false,
);
assert.equal(reopenedPayload.savedAt, 9400);

const reopenedPayloadWithDuplicateSemanticDiagnostics = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3_trend",
    savedAt: 9300,
    title: "Forecasting Trend Q3",
    sourceArtifactId: "forecasting_q3_channel_trend",
    sourceSession: {
        sessionId: "rbexplore_forecastingTrendQ3",
        sourceRef: {
            kind: "reportBuilder.chartResult",
            contextLabel: "Forecasting Trend Q3 • Avails by Date and Channel",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", label: "Channel", default: true },
        ],
        staticFilters: [
            {
                id: "dateRange",
                type: "dateRange",
                required: true,
                startParamPath: "filters.From",
                endParamPath: "filters.To",
            },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    semanticRuntimeDiagnostics: [
        {
            code: "semanticGovernance",
            severity: "info",
            message: "Audience Age Group • Draft",
        },
        {
            code: "semanticGovernance",
            severity: "info",
            message: "Audience Age Group • Draft",
        },
    ],
});
assert.equal(reopenedPayloadWithDuplicateSemanticDiagnostics.compileState.diagnostics.length, 1);

const derivedSemanticPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_semantic_runtime",
    savedAt: 9300,
    title: "Semantic Runtime Demo",
    sourceArtifactId: "semantic_runtime_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "semanticRuntimeDemo",
        title: "Semantic Runtime Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", semanticRef: "channel", label: "Channel", default: true },
        ],
        staticFilters: [
            {
                id: "dateRange",
                type: "dateRange",
                required: true,
                startParamPath: "filters.From",
                endParamPath: "filters.To",
            },
        ],
        result: {
            chartCreationMode: "explicit",
            defaultMode: "chart",
            pageSize: 50,
            orderFields: [
                { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        staticFilters: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    savedAt: 9410,
    semanticModel: {
        modelRef: "model://steward/performance/ad_delivery@v1",
        version: 1,
        label: "Ad Delivery",
        entities: [
            {
                id: "line_delivery",
                label: "Line Delivery",
                dimensions: [
                    { id: "event_date", label: "Delivery Date" },
                    { id: "channel", label: "Channel" },
                ],
                measures: [
                    { id: "available_impressions", label: "Available Impressions", format: "compactNumber" },
                ],
            },
        ],
    },
});

assert.equal(derivedSemanticPayload.reportDocument.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(derivedSemanticPayload.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(derivedSemanticPayload.reportDocument.blocks[0].config.measures[0].label, "Available Impressions");
assert.equal(derivedSemanticPayload.reportDocument.blocks[0].config.dimensions[0].label, "Delivery Date");

const payloadWithAuthoredBlocks = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_authored_blocks",
    savedAt: 9300,
    title: "Authored Blocks Demo",
    sourceArtifactId: "authored_blocks_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "authoredBlocksDemo",
        title: "Authored Blocks Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
        ],
        result: {
            chartCreationMode: "explicit",
            defaultMode: "chart",
            pageSize: 50,
            orderFields: [
                { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            ],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
        viewMode: "table",
        reportDocumentBlocks: [
            {
                id: "narrativeIntro",
                kind: "markdownBlock",
                title: "Narrative",
                markdown: "## Narrative\nAuthored context.",
            },
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "avails",
                valueLabel: "Avails",
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [
                { blockId: "narrativeIntro" },
                { blockId: "primaryBuilder" },
                { blockId: "headlineKpi" },
            ],
        },
    },
    savedAt: 9500,
});
assert.deepEqual(payloadWithAuthoredBlocks.reportDocument.layout, {
    type: "stack",
    items: [
        { blockId: "narrativeIntro" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
});
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks[1].kind, "markdownBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks[2].kind, "kpiBlock");
assert.equal(
    Object.prototype.hasOwnProperty.call(payloadWithAuthoredBlocks.reportDocument.blocks[0].state, "reportDocumentBlocks"),
    false,
);
assert.deepEqual(payloadWithAuthoredBlocks.reportSpec.layoutIntent.blockOrder, [
    "narrativeIntro",
    "primaryTable",
    "headlineKpi",
]);

const reopenedPayloadFromResponse = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "forecastingTrendQ3",
    },
    documentVersion: 6,
    savedAt: 9300,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3_channel_trend",
        sourceArtifactId: "forecasting_q3_channel_trend",
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", label: "Channel", default: true },
        ],
        staticFilters: [
            {
                id: "dateRange",
                type: "dateRange",
                required: true,
                startParamPath: "filters.From",
                endParamPath: "filters.To",
            },
        ],
        result: {
            chartCreationMode: "explicit",
            defaultMode: "chart",
            pageSize: 50,
            orderFields: [
                { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        chartSpec: {
            title: "Avails by Date and Channel",
            type: "area",
            xField: "eventDate",
            yFields: ["avails"],
            seriesField: "channelV2",
        },
        staticFilters: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    savedAt: 9500,
    semanticSummary: {
        kind: "semantic",
        modelRef: "model://steward/performance/ad_delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
            { id: "channel", rawId: "channelV2", label: "Channel" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
        ],
    },
});
assert.equal(reopenedPayloadFromResponse.reportDocument.id, "forecastingTrendQ3");
assert.equal(reopenedPayloadFromResponse.reportDocument.title, "Forecasting Trend Q3");
assert.equal(reopenedPayloadFromResponse.kind, "reportBuilder.savedReportPayload");
assert.equal(reopenedPayloadFromResponse.payloadId, "rbreport_forecasting_q3_channel_trend");
assert.equal(reopenedPayloadFromResponse.sourceArtifactId, "forecasting_q3_channel_trend");
assert.equal(reopenedPayloadFromResponse.reportDocument.blocks[0].state.viewMode, "table");
assert.equal(reopenedPayloadFromResponse.reportDocument.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(reopenedPayloadFromResponse.reportSpec.semanticSummary.entityLabel, "Line Delivery");

const calculationContainer = {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Report Builder Demo",
    dataSourceRef: "demoReportSource",
};

const calculationConfig = {
    measures: [
        { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
    dimensions: [
        { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
        { id: "channelV2", key: "channelV2", label: "Channel", default: true },
    ],
    staticFilters: [
        {
            id: "dateRange",
            type: "dateRange",
            required: true,
            startParamPath: "filters.From",
            endParamPath: "filters.To",
        },
    ],
    result: {
        chartCreationMode: "explicit",
        defaultMode: "chart",
        pageSize: 50,
        orderFields: [
            { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
        ],
    },
};

const localCalcSeed = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_calc_persisted",
    savedAt: 9300,
    title: "Calculated Report",
    sourceArtifactId: "calc_persisted",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "calcPersisted",
        title: "Calculated Report",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

const localCalcSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState(localCalcSeed, {
    container: calculationContainer,
    config: calculationConfig,
    state: {
        selectedMeasures: ["reachRate", "reachShare"],
        primaryMeasure: "reachRate",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "chart",
        chartSpec: {
            title: "Reach Rate by Date",
            type: "line",
            xField: "eventDate",
            yFields: ["reachRate"],
        },
        staticFilters: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        localCalculatedFields: [
            {
                id: "reachRate",
                key: "reachRate",
                kind: "rowCalc",
                label: "Reach Rate",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["hhUniqs", "avails"],
                expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
            },
        ],
        localTableCalculations: [
            {
                id: "reachShare",
                key: "reachShare",
                kind: "tableCalc",
                label: "Reach Share",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["avails"],
                compute: {
                    type: "percentOfTotal",
                    sourceField: "avails",
                    scale: 100,
                    decimals: 2,
                },
            },
        ],
    },
    savedAt: 9400,
});

assert.equal(localCalcSavedPayload.reportDocument.blocks[0].state.localCalculatedFields[0].id, "reachRate");
assert.equal(localCalcSavedPayload.reportDocument.blocks[0].state.localTableCalculations[0].id, "reachShare");
assert.equal(localCalcSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(localCalcSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachShare" && field.kind === "tableCalc"), true);

const localCalcResponse = buildReportBuilderGetReportDocumentResponse(localCalcSavedPayload, {
    documentVersion: 7,
    savedAt: 9450,
});
const hydratedLocalCalc = buildHydratedReportBuilderDocument(localCalcResponse, {
    container: calculationContainer,
    builderIdentity: {
        containerId: calculationContainer.id,
        stateKey: calculationContainer.stateKey,
        dataSourceRef: calculationContainer.dataSourceRef,
    },
});

assert.equal(hydratedLocalCalc.valid, true);
assert.equal(hydratedLocalCalc.state.localCalculatedFields[0].id, "reachRate");
assert.equal(hydratedLocalCalc.state.localTableCalculations[0].id, "reachShare");

const localCalcModel = buildReportBuilderRuntimePreviewModel({
    container: calculationContainer,
    config: hydratedLocalCalc.config,
    state: hydratedLocalCalc.state,
});
const localCalcPreview = buildReportBuilderRuntimePreview({
    model: localCalcModel,
    rows: [
        { eventDate: "2026-05-01", channelV2: "Display", avails: 100, hhUniqs: 25 },
        { eventDate: "2026-05-02", channelV2: "CTV", avails: 300, hhUniqs: 120 },
    ],
    hasMore: false,
});

assert.equal(localCalcPreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(localCalcPreview.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(localCalcPreview.reportFill.datasets[0].rows[0].reachShare, 25);
assert.equal(localCalcPreview.reportFill.datasets[0].rows[1].reachShare, 75);
assert.equal(localCalcPreview.reportFill.blocks.find((block) => block.kind === "tableBlock")?.content?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(localCalcPreview.reportFill.blocks.find((block) => block.kind === "tableBlock")?.content?.columns?.some((column) => column.key === "reachShare"), true);
const localCalcSavedRecord = buildReportBuilderSavedReportPayloadRecord(localCalcSavedPayload, {
    runtimeArtifact: localCalcPreview,
    documentVersion: 7,
});
assert.equal(localCalcSavedRecord.documentVersion, 7);
assert.equal(localCalcSavedRecord.savedReportPayload.payloadId, "rbreport_calc_persisted");
assert.equal(localCalcSavedRecord.exportRequest.source.from, "savedPayload");
assert.equal(localCalcSavedRecord.exportRequest.source.documentVersion, 7);
assert.equal(localCalcSavedRecord.exportRequest.reportPrint.title, "Calculated Report");

const authoredDerivedOnlySavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_authored_calc_runtime",
    savedAt: 9500,
    title: "Authored Derived Report",
    sourceArtifactId: "authored_calc_runtime",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "authoredCalcRuntime",
        title: "Authored Derived Report",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: calculationContainer,
    config: calculationConfig,
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
        viewMode: "table",
        chartSpec: null,
        staticFilters: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        localCalculatedFields: [
            {
                id: "reachRate",
                key: "reachRate",
                kind: "rowCalc",
                label: "Reach Rate",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["hhUniqs", "avails"],
                expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
            },
        ],
        localTableCalculations: [
            {
                id: "reachShare",
                key: "reachShare",
                kind: "tableCalc",
                label: "Reach Share",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["avails", "channelV2"],
                compute: {
                    type: "percentOfTotal",
                    sourceField: "avails",
                    partitionBy: ["channelV2"],
                    scale: 100,
                    decimals: 2,
                },
            },
        ],
        reportDocumentBlocks: [
            {
                id: "reachRateChart",
                kind: "chartBlock",
                title: "Reach Rate by Date",
                datasetRef: "primary",
                chartSpec: {
                    title: "Reach Rate by Date",
                    type: "line",
                    xField: "eventDate",
                    yFields: ["reachRate"],
                    seriesField: "channelV2",
                },
            },
            {
                id: "reachShareTable",
                kind: "tableBlock",
                title: "Reach Share Table",
                datasetRef: "primary",
                columns: [
                    { key: "eventDate", label: "Event Date", format: "date" },
                    { key: "reachShare", label: "Reach Share", format: "percent" },
                ],
            },
            {
                id: "reachShareKpi",
                kind: "kpiBlock",
                title: "Reach Share KPI",
                datasetRef: "primary",
                valueField: "reachShare",
                valueLabel: "Reach Share",
                secondaryField: "channelV2",
                secondaryLabel: "Channel",
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [
                { blockId: "primaryBuilder" },
                { blockId: "reachRateChart" },
                { blockId: "reachShareTable" },
                { blockId: "reachShareKpi" },
            ],
        },
    },
    savedAt: 9600,
});

assert.equal(authoredDerivedOnlySavedPayload.compileState.status, "clean");
assert.deepEqual(authoredDerivedOnlySavedPayload.compileState.diagnostics || [], []);
assert.deepEqual(authoredDerivedOnlySavedPayload.reportDocument.blocks[0].state.selectedMeasures, ["avails"]);
assert.equal(authoredDerivedOnlySavedPayload.reportDocument.blocks[0].state.localCalculatedFields[0].id, "reachRate");
assert.equal(authoredDerivedOnlySavedPayload.reportDocument.blocks[0].state.localTableCalculations[0].id, "reachShare");
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachShare" && field.kind === "tableCalc"), true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.measures.avails, true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.measures.reachRate, undefined);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.dimensions.eventDate, true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartSpec?.seriesField, "channelV2");
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartModel?.series?.values?.[0]?.value, "reachRate");

const authoredDerivedOnlyResponse = buildReportBuilderGetReportDocumentResponse(authoredDerivedOnlySavedPayload, {
    documentVersion: 8,
    savedAt: 9650,
});
const hydratedAuthoredDerivedOnly = buildHydratedReportBuilderDocument(authoredDerivedOnlyResponse, {
    container: calculationContainer,
    builderIdentity: {
        containerId: calculationContainer.id,
        stateKey: calculationContainer.stateKey,
        dataSourceRef: calculationContainer.dataSourceRef,
    },
});

assert.equal(hydratedAuthoredDerivedOnly.valid, true);
assert.equal(hydratedAuthoredDerivedOnly.compileState.status, "clean");
assert.deepEqual(hydratedAuthoredDerivedOnly.state.selectedMeasures, ["avails"]);
assert.equal(hydratedAuthoredDerivedOnly.state.localCalculatedFields[0].id, "reachRate");
assert.equal(hydratedAuthoredDerivedOnly.state.localTableCalculations[0].id, "reachShare");
assert.equal(hydratedAuthoredDerivedOnly.state.reportDocumentBlocks.some((block) => block.id === "reachRateChart" && block.kind === "chartBlock"), true);
assert.equal(hydratedAuthoredDerivedOnly.state.reportDocumentBlocks.some((block) => block.id === "reachShareTable" && block.kind === "tableBlock"), true);
assert.equal(hydratedAuthoredDerivedOnly.state.reportDocumentBlocks.some((block) => block.id === "reachShareKpi" && block.kind === "kpiBlock"), true);

const authoredDerivedOnlyModel = buildReportBuilderRuntimePreviewModel({
    container: calculationContainer,
    config: hydratedAuthoredDerivedOnly.config,
    state: hydratedAuthoredDerivedOnly.state,
});
assert.equal(authoredDerivedOnlyModel.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(authoredDerivedOnlyModel.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(authoredDerivedOnlyModel.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartSpec?.seriesField, "channelV2");
const authoredDerivedOnlyPreview = buildReportBuilderRuntimePreview({
    model: authoredDerivedOnlyModel,
    rows: [
        { eventDate: "2026-05-01", channelV2: "Display", avails: 100, hhUniqs: 25 },
        { eventDate: "2026-05-02", channelV2: "CTV", avails: 300, hhUniqs: 120 },
    ],
    hasMore: false,
});

assert.equal(authoredDerivedOnlyPreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(authoredDerivedOnlyPreview.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(authoredDerivedOnlyPreview.reportFill.datasets[0].rows[0].reachShare, 100);
assert.equal(authoredDerivedOnlyPreview.reportFill.datasets[0].rows[1].reachShare, 100);
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachShareTable")?.content?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.value, 100);
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.secondaryValue, "Display");

const authoredDerivedOnlySavedRecord = buildReportBuilderSavedReportPayloadRecord(authoredDerivedOnlySavedPayload, {
    runtimeArtifact: authoredDerivedOnlyPreview,
    documentVersion: 8,
});
assert.equal(authoredDerivedOnlySavedRecord.documentVersion, 8);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.source.from, "savedPayload");
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.source.documentVersion, 8);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "reachShare"), true);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportFill.datasets[0].rows[0].reachShare, 100);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachShareTable")?.content?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.value, 100);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportPrint.pages[0].elements.some((element) => element.kind === "svg" && element.id.includes("reachRateChart")), true);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "tableCellText" && element.columnKey === "reachShare"), true);

const derivedTemplate = {
    id: "market_efficiency_brief",
    label: "Market Efficiency Brief",
    description: "Template-instantiated authored report that uses non-selected derived fields.",
    statePatch: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
        viewMode: "table",
        chartSpec: null,
        staticFilters: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        localCalculatedFields: [
            {
                id: "reachRate",
                key: "reachRate",
                kind: "rowCalc",
                label: "Reach Rate",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["hhUniqs", "avails"],
                expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
            },
        ],
        localTableCalculations: [
            {
                id: "reachShare",
                key: "reachShare",
                kind: "tableCalc",
                label: "Reach Share",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["avails", "channelV2"],
                compute: {
                    type: "percentOfTotal",
                    sourceField: "avails",
                    partitionBy: ["channelV2"],
                    scale: 100,
                    decimals: 2,
                },
            },
        ],
    },
    documentPatch: {
        title: "Market Efficiency Brief",
        subtitle: "Derived Authored Fields",
        description: "Template-instantiated authored report that binds chart, table, and KPI blocks to non-selected derived fields.",
        blocks: [
            {
                id: "reachRateChart",
                kind: "chartBlock",
                title: "Reach Rate by Date",
                datasetRef: "primary",
                chartSpec: {
                    title: "Reach Rate by Date",
                    type: "line",
                    xField: "eventDate",
                    yFields: ["reachRate"],
                    seriesField: "channelV2",
                },
            },
            {
                id: "reachShareTable",
                kind: "tableBlock",
                title: "Reach Share Table",
                datasetRef: "primary",
                columns: [
                    { key: "eventDate", label: "Event Date", format: "date" },
                    { key: "reachShare", label: "Reach Share", format: "percent" },
                ],
            },
            {
                id: "reachShareKpi",
                kind: "kpiBlock",
                title: "Reach Share KPI",
                datasetRef: "primary",
                valueField: "reachShare",
                valueLabel: "Reach Share",
                secondaryField: "channelV2",
                secondaryLabel: "Channel",
            },
        ],
        layout: {
            type: "stack",
            items: [
                { blockId: "primaryBuilder" },
                { blockId: "reachRateChart" },
                { blockId: "reachShareTable" },
                { blockId: "reachShareKpi" },
            ],
        },
    },
};

const instantiatedDerivedTemplate = instantiateReportBuilderDocumentTemplate(calculationConfig, derivedTemplate);
assert.equal(instantiatedDerivedTemplate.valid, true);
assert.deepEqual(instantiatedDerivedTemplate.nextState.selectedMeasures, ["avails"]);
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentTemplateId, "market_efficiency_brief");
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentTemplateLabel, "Market Efficiency Brief");
assert.deepEqual(instantiatedDerivedTemplate.nextState.localCalculatedFields, derivedTemplate.statePatch.localCalculatedFields);
assert.deepEqual(instantiatedDerivedTemplate.nextState.localTableCalculations, derivedTemplate.statePatch.localTableCalculations);
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentBlocks.some((block) => block.id === "reachRateChart"), true);
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentBlocks.some((block) => block.id === "reachShareTable"), true);
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentBlocks.some((block) => block.id === "reachShareKpi"), true);

const templatedDerivedSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_template_derived_runtime",
    savedAt: 9700,
    title: "Market Efficiency Brief",
    sourceArtifactId: "template_derived_runtime",
    sourceSession: {
        sessionId: "rbexplore_market_efficiency_brief",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "market_efficiency_brief",
            templateLabel: "Market Efficiency Brief",
            contextLabel: "Market Efficiency Brief",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "marketEfficiencyBrief",
        title: "Market Efficiency Brief",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: calculationContainer,
    config: calculationConfig,
    state: instantiatedDerivedTemplate.nextState,
    savedAt: 9750,
});

assert.equal(templatedDerivedSavedPayload.compileState.status, "clean");
assert.deepEqual(templatedDerivedSavedPayload.compileState.diagnostics || [], []);
assert.deepEqual(templatedDerivedSavedPayload.reportDocument.blocks[0].state.selectedMeasures, ["avails"]);
assert.equal(templatedDerivedSavedPayload.reportDocument.blocks[0].state.reportDocumentTemplateId, "market_efficiency_brief");
assert.equal(templatedDerivedSavedPayload.reportDocument.blocks[0].state.reportDocumentTemplateLabel, "Market Efficiency Brief");
assert.deepEqual(templatedDerivedSavedPayload.reportDocument.blocks[0].state.localCalculatedFields, derivedTemplate.statePatch.localCalculatedFields);
assert.deepEqual(templatedDerivedSavedPayload.reportDocument.blocks[0].state.localTableCalculations, derivedTemplate.statePatch.localTableCalculations);
assert.equal(templatedDerivedSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(templatedDerivedSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachShare" && field.kind === "tableCalc"), true);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.measures.avails, true);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.measures.reachRate, undefined);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.measures.reachShare, undefined);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.dimensions.eventDate, true);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(templatedDerivedSavedPayload.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(templatedDerivedSavedPayload.reportSpec.blocks.find((block) => block.id === "reachShareTable")?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(templatedDerivedSavedPayload.reportSpec.blocks.find((block) => block.id === "reachShareKpi")?.valueField, "reachShare");

const templatedDerivedResponse = buildReportBuilderGetReportDocumentResponse(templatedDerivedSavedPayload, {
    documentVersion: 9,
    savedAt: 9800,
});
const hydratedTemplatedDerived = buildHydratedReportBuilderDocument(templatedDerivedResponse, {
    container: calculationContainer,
    builderIdentity: {
        containerId: calculationContainer.id,
        stateKey: calculationContainer.stateKey,
        dataSourceRef: calculationContainer.dataSourceRef,
    },
});
assert.equal(hydratedTemplatedDerived.valid, true);
assert.equal(hydratedTemplatedDerived.compileState.status, "clean");
assert.deepEqual(hydratedTemplatedDerived.state.selectedMeasures, ["avails"]);
assert.equal(hydratedTemplatedDerived.state.reportDocumentTemplateId, "market_efficiency_brief");
assert.equal(hydratedTemplatedDerived.state.reportDocumentTemplateLabel, "Market Efficiency Brief");
assert.deepEqual(hydratedTemplatedDerived.state.localCalculatedFields, derivedTemplate.statePatch.localCalculatedFields);
assert.deepEqual(hydratedTemplatedDerived.state.localTableCalculations, derivedTemplate.statePatch.localTableCalculations);
assert.equal(hydratedTemplatedDerived.state.reportDocumentBlocks.some((block) => block.id === "reachRateChart"), true);
assert.equal(hydratedTemplatedDerived.state.reportDocumentBlocks.some((block) => block.id === "reachShareTable"), true);
assert.equal(hydratedTemplatedDerived.state.reportDocumentBlocks.some((block) => block.id === "reachShareKpi"), true);

const templatedDerivedModel = buildReportBuilderRuntimePreviewModel({
    container: calculationContainer,
    config: hydratedTemplatedDerived.config,
    state: hydratedTemplatedDerived.state,
});
assert.equal(templatedDerivedModel.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(templatedDerivedModel.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(templatedDerivedModel.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartSpec?.seriesField, "channelV2");
const templatedDerivedPreview = buildReportBuilderRuntimePreview({
    model: templatedDerivedModel,
    rows: [
        { eventDate: "2026-05-01", channelV2: "Display", avails: 100, hhUniqs: 25 },
        { eventDate: "2026-05-02", channelV2: "Display", avails: 300, hhUniqs: 120 },
        { eventDate: "2026-05-03", channelV2: "CTV", avails: 50, hhUniqs: 20 },
        { eventDate: "2026-05-04", channelV2: "CTV", avails: 150, hhUniqs: 60 },
    ],
    hasMore: false,
});
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[0].reachShare, 25);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[1].reachShare, 75);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[2].reachShare, 25);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[3].reachShare, 75);
assert.equal(templatedDerivedPreview.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(templatedDerivedPreview.reportFill.blocks.find((block) => block.id === "reachShareTable")?.content?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(templatedDerivedPreview.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.valueField, "reachShare");
assert.equal(templatedDerivedPreview.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.value, 25);

const rebuiltTemplatedDerivedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_template_derived_runtime",
    savedAt: 9700,
    title: "Market Efficiency Brief",
    sourceArtifactId: "template_derived_runtime",
    sourceSession: {
        sessionId: "rbexplore_market_efficiency_brief",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "market_efficiency_brief",
            templateLabel: "Market Efficiency Brief",
            contextLabel: "Market Efficiency Brief",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "marketEfficiencyBrief",
        title: "Market Efficiency Brief",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: calculationContainer,
    config: hydratedTemplatedDerived.config,
    state: hydratedTemplatedDerived.state,
    savedAt: 9850,
});
assert.deepEqual(rebuiltTemplatedDerivedPayload.reportDocument, templatedDerivedSavedPayload.reportDocument);
assert.deepEqual(rebuiltTemplatedDerivedPayload.reportSpec, templatedDerivedSavedPayload.reportSpec);
assert.deepEqual(rebuiltTemplatedDerivedPayload.compileState, templatedDerivedSavedPayload.compileState);

const templatedDerivedSavedRecord = buildReportBuilderSavedReportPayloadRecord(templatedDerivedSavedPayload, {
    runtimeArtifact: templatedDerivedPreview,
    documentVersion: 9,
});
assert.equal(templatedDerivedSavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "reachShare"), true);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(templatedDerivedSavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachShareTable")?.content?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.value, 25);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportPrint.pages[0].elements.some((element) => element.kind === "svg" && element.id.includes("reachRateChart")), true);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "tableCellText" && element.columnKey === "reachShare"), true);

console.log("reportBuilderSavedReportPayload ✓ derives saved report payloads from exploration artifacts");
