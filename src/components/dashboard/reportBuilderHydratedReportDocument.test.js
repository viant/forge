import assert from "node:assert/strict";

import {
    applyReportBuilderHydratedDocumentSessionState,
    buildHydratedReportBuilderDocument,
    buildReportBuilderHydratedDocumentSession,
    buildReportBuilderHydratedSessionRoundTrip,
    resolveReportBuilderHydratedDocumentSessionFromState,
    setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction,
    stripReportBuilderHydratedDocumentSessionState,
} from "./reportBuilderHydratedReportDocument.js";

const getResponse = {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "demoReportBuilder",
    },
    documentVersion: 11,
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_demo_report",
        sourceArtifactId: "rbexploration_demo_report",
        reportId: "demoReportBuilder",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            modelLabel: "Canonical Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Canonical Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Canonical Channel" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
            ],
        },
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
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
        scope: {
            params: [
                {
                    id: "dateRange",
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
            ],
        },
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                source: {
                    kind: "dashboard.reportBuilder",
                    containerId: "demoReportBuilder",
                    stateKey: "demoReportBuilder",
                    dataSourceRef: "demoReportSource",
                },
                config: {
                    binding: {
                        mode: "semantic",
                        modelRef: "model://steward/performance/ad_delivery@v1",
                        entity: "line_delivery",
                    },
                    dimensions: [
                        { id: "event_date", key: "eventDate", semanticRef: "event_date", label: "Delivery Date", default: true, chartAxis: true },
                        { id: "channel", key: "channelV2", semanticRef: "channel", label: "Channel" },
                    ],
                    measures: [
                        { id: "available_impressions", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", default: true },
                    ],
                    staticFilters: [
                        { id: "dateRange", type: "dateRange", required: true },
                    ],
                    result: {
                        viewModes: ["table", "chart"],
                    },
                },
                state: {
                    selectedMeasures: ["available_impressions"],
                    primaryMeasure: "available_impressions",
                    selectedDimensions: ["event_date", "channel"],
                    viewMode: "table",
                    staticFilters: {},
                    explorationSession: {
                        sessionId: "rbexplore_1",
                    },
                },
                scopeBindings: [
                    {
                        paramId: "dateRange",
                        target: "staticFilters.dateRange",
                    },
                ],
            },
        ],
    },
};

const builderIdentity = {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
};

const hydrated = buildHydratedReportBuilderDocument(getResponse, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});

assert.deepEqual(hydrated, {
    valid: true,
    reportId: "demoReportBuilder",
    title: "Exploration Demo",
    documentVersion: 11,
    source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    savedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_demo_report",
        sourceArtifactId: "rbexploration_demo_report",
        reportId: "demoReportBuilder",
    },
    config: {
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
        },
        dimensions: [
            { id: "event_date", key: "eventDate", semanticRef: "event_date", label: "Delivery Date", default: true, chartAxis: true },
            { id: "channel", key: "channelV2", semanticRef: "channel", label: "Channel" },
        ],
        measures: [
            { id: "available_impressions", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", default: true },
        ],
        staticFilters: [
            { id: "dateRange", type: "dateRange", required: true },
        ],
        result: {
            viewModes: ["table", "chart"],
        },
    },
    state: {
        selectedMeasures: ["available_impressions"],
        primaryMeasure: "available_impressions",
        selectedDimensions: ["event_date", "channel"],
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: [],
            selectedMeasures: [],
        },
        localCalculatedFields: [],
        localTableCalculations: [],
        viewMode: "table",
        chartSpec: null,
        orderField: "",
        orderDir: "desc",
        staticFilters: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        dynamicGroups: {},
        activeTablePreset: null,
        lastTablePreset: null,
        reportDocumentTitle: "Exploration Demo",
    },
    document: getResponse.document,
    reportSpec: getResponse.reportSpec,
});

const hydratedWithAuthoredBlocks = buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        layout: {
            type: "stack",
            items: [
                { blockId: "narrativeIntro", size: "half" },
                { blockId: "primaryBuilder" },
                { blockId: "headlineKpi", size: "half" },
            ],
        },
        blocks: [
            ...getResponse.document.blocks,
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
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.deepEqual(hydratedWithAuthoredBlocks.state.reportDocumentLayout, {
    type: "stack",
    items: [
        { blockId: "narrativeIntro", size: "half" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi", size: "half" },
    ],
});
assert.deepEqual(hydratedWithAuthoredBlocks.state.reportDocumentBlocks, [
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
]);
assert.equal(hydratedWithAuthoredBlocks.compileState, undefined);

const hydratedWithTemplateState = buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        blocks: [
            {
                ...getResponse.document.blocks[0],
                state: {
                    ...getResponse.document.blocks[0].state,
                    reportDocumentTemplateId: "forecast_inventory_brief",
                    reportDocumentTemplateLabel: "Forecast Inventory Brief",
                },
            },
        ],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.equal(hydratedWithTemplateState.state.reportDocumentTemplateId, "forecast_inventory_brief");
assert.equal(hydratedWithTemplateState.state.reportDocumentTemplateLabel, "Forecast Inventory Brief");

const hydratedWithInvalidCompileState = buildHydratedReportBuilderDocument({
    ...getResponse,
    compileState: {
        status: "invalid",
        reportSpecVersion: 1,
        blockCount: 2,
        datasetCount: 1,
        diagnostics: [
            {
                code: "documentBlockValueFieldUnavailable",
                severity: "error",
                blockId: "headlineKpi",
                path: "reportDocument.blocks.headlineKpi.valueField",
                message: "Headline KPI references unavailable KPI value field 'avails'.",
                suggestedFix: "Select the measure again or edit the KPI block.",
            },
        ],
    },
    document: {
        ...getResponse.document,
        layout: {
            type: "stack",
            items: [
                { blockId: "primaryBuilder" },
                { blockId: "headlineKpi" },
            ],
        },
        blocks: [
            ...getResponse.document.blocks,
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "avails",
                valueLabel: "Avails",
            },
        ],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.deepEqual(hydratedWithInvalidCompileState.compileState, {
    status: "invalid",
    reportSpecVersion: 1,
    blockCount: 2,
    datasetCount: 1,
    diagnostics: [
        {
            code: "documentBlockValueFieldUnavailable",
            severity: "error",
            blockId: "headlineKpi",
            path: "reportDocument.blocks.headlineKpi.valueField",
            message: "Headline KPI references unavailable KPI value field 'avails'.",
            suggestedFix: "Select the measure again or edit the KPI block.",
        },
    ],
});
assert.deepEqual(buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        layout: null,
        blocks: [
            ...getResponse.document.blocks,
            {
                id: "narrativeIntro",
                kind: "markdownBlock",
                title: "Narrative",
                markdown: "## Narrative\nAuthored context.",
            },
        ],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
}), {
    valid: false,
    code: "invalidDocumentLayout",
    message: "The saved ReportDocument contains authored blocks but does not define a compatible layout.",
});

assert.deepEqual(buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        blocks: [
            {
                ...getResponse.document.blocks[0],
                source: {
                    ...getResponse.document.blocks[0].source,
                    stateKey: "otherBuilder",
                },
            },
        ],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
}), {
    valid: false,
    code: "incompatibleSource",
    message: "This ReportDocument targets a different builder source: state key otherBuilder.",
    source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "otherBuilder",
        dataSourceRef: "demoReportSource",
    },
});

assert.deepEqual(buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        blocks: [
            {
                ...getResponse.document.blocks[0],
                source: {},
            },
        ],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
}), {
    valid: false,
    code: "incompatibleSource",
    message: "This ReportDocument targets a different builder source: missing source kind, missing container, missing state key, missing data source.",
    source: {},
});

assert.equal(buildHydratedReportBuilderDocument(null).valid, false);
assert.deepEqual(buildHydratedReportBuilderDocument({
    ...getResponse,
    version: "v1",
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
}), {
    valid: false,
    code: "unsupportedResponseVersion",
    message: "The saved getReportDocument response version is not supported for reopen.",
});
assert.deepEqual(buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        kind: "dashboard.report",
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
}), {
    valid: false,
    code: "invalidDocument",
    message: "Only persisted ReportDocument artifacts can be reopened into the builder.",
});
assert.deepEqual(buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        version: "v1",
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
}), {
    valid: false,
    code: "unsupportedDocumentVersion",
    message: "The saved ReportDocument version is not supported for reopen.",
});
assert.equal(buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        scope: {
            params: [
                {
                    id: "dateRange",
                },
            ],
        },
        blocks: [
            {
                ...getResponse.document.blocks[0],
                state: {
                    ...getResponse.document.blocks[0].state,
                    staticFilters: {
                        dateRange: {
                            start: "2026-05-09",
                            end: "2026-05-10",
                        },
                    },
                },
            },
        ],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
})?.state?.staticFilters?.dateRange?.start, "2026-05-09");

const session = buildReportBuilderHydratedDocumentSession(hydrated, {
    liveConfig: {
        result: {
            defaultMode: "table",
        },
    },
    liveState: {
        selectedDimensions: ["eventDate"],
        viewMode: "chart",
    },
});
assert.deepEqual(session, {
    reportId: "demoReportBuilder",
    title: "Exploration Demo",
    documentVersion: 11,
    source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    savedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_demo_report",
        sourceArtifactId: "rbexploration_demo_report",
        reportId: "demoReportBuilder",
    },
    reopenedConfig: hydrated.config,
    reopenedSemanticSummary: {
        kind: "semantic",
        modelRef: "model://steward/performance/ad_delivery@v1",
        modelLabel: "Canonical Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Canonical Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
            { id: "channel", rawId: "channelV2", label: "Canonical Channel" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
        ],
    },
    reopenedSemanticFingerprint: JSON.stringify({
        modelRef: "model://steward/performance/ad_delivery@v1",
        selection: {
            entity: "line_delivery",
            dimensions: ["event_date", "channel"],
            measures: ["available_impressions"],
            parameters: {},
        },
    }),
    liveSnapshot: {
        config: {
            result: {
                defaultMode: "table",
            },
        },
        state: {
            selectedDimensions: ["eventDate"],
            viewMode: "chart",
        },
    },
});

const templatedSession = buildReportBuilderHydratedDocumentSession(hydratedWithTemplateState, {
    liveConfig: {
        result: {
            defaultMode: "table",
        },
    },
    liveState: {
        selectedDimensions: ["eventDate"],
        viewMode: "chart",
    },
});
assert.equal(templatedSession?.templateId, "forecast_inventory_brief");
assert.equal(templatedSession?.templateLabel, "Forecast Inventory Brief");

const invalidSession = buildReportBuilderHydratedDocumentSession(hydratedWithInvalidCompileState, {
    liveConfig: {
        result: {
            defaultMode: "table",
        },
    },
    liveState: {
        selectedDimensions: ["eventDate"],
        viewMode: "chart",
    },
});
assert.deepEqual(invalidSession?.reopenedCompileState, {
    status: "invalid",
    reportSpecVersion: 1,
    blockCount: 2,
    datasetCount: 1,
    diagnostics: [
        {
            code: "documentBlockValueFieldUnavailable",
            severity: "error",
            blockId: "headlineKpi",
            path: "reportDocument.blocks.headlineKpi.valueField",
            message: "Headline KPI references unavailable KPI value field 'avails'.",
            suggestedFix: "Select the measure again or edit the KPI block.",
        },
    ],
});

const sessionWithRuntimePreviewInteraction = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(session, {
    refinements: [
        {
            op: "keep",
            field: "channelV2",
            values: ["Display"],
            sourceBlockId: "primaryChart",
            label: "Keep only = Display",
        },
    ],
    drillTransitions: [
        {
            refinementId: "keep:channelV2:primaryChart",
            sourceField: "channelV2",
            nextFieldRef: "country",
            sourceBlockId: "primaryChart",
        },
    ],
    hostIntent: {
        intentKind: "detailTarget",
        targetRef: "target://steward/performance/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
            channel: "Display",
        },
    },
    detailDiagnostic: {
        code: "detailTargetPartial",
        severity: "warning",
        message: "Detail target resolved with omitted parameters: campaign.",
    },
});
assert.deepEqual(sessionWithRuntimePreviewInteraction?.runtimePreviewInteraction, {
    refinements: [
        {
            id: "keep:channelV2:primaryChart",
            op: "keep",
            field: "channelV2",
            values: ["Display"],
            sourceBlockId: "primaryChart",
            label: "Keep only = Display",
        },
    ],
    drillTransitions: [
        {
            refinementId: "keep:channelV2:primaryChart",
            sourceField: "channelV2",
            nextFieldRef: "country",
            sourceBlockId: "primaryChart",
        },
    ],
    hostIntent: {
        intentKind: "detailTarget",
        targetRef: "target://steward/performance/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
            channel: "Display",
        },
    },
    detailDiagnostic: {
        code: "detailTargetPartial",
        severity: "warning",
        message: "Detail target resolved with omitted parameters: campaign.",
    },
});

assert.deepEqual(resolveReportBuilderHydratedDocumentSessionFromState(applyReportBuilderHydratedDocumentSessionState({
    selectedDimensions: ["eventDate", "channelV2"],
}, sessionWithRuntimePreviewInteraction)), sessionWithRuntimePreviewInteraction);

const templatedMixedRuntimePreviewInteraction = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(templatedSession, {
    refinements: [
        {
            op: "drill",
            field: "country",
            values: ["US"],
            sourceBlockId: "reachRateTrend",
            label: "Drill to Region = US",
        },
        {
            op: "keep",
            field: "channelV2",
            values: ["Display"],
            sourceBlockId: "reachRateTable",
            label: "Keep Channel = Display",
        },
    ],
    drillTransitions: [
        {
            refinementId: "drill:country:reachRateTrend",
            sourceField: "country",
            nextFieldRef: "region",
            sourceBlockId: "reachRateTrend",
        },
    ],
    hostIntent: null,
    detailDiagnostic: null,
});
assert.deepEqual(templatedMixedRuntimePreviewInteraction?.runtimePreviewInteraction, {
    refinements: [
        {
            id: "drill:country:reachRateTrend",
            op: "drill",
            field: "country",
            values: ["US"],
            sourceBlockId: "reachRateTrend",
            label: "Drill to Region = US",
        },
        {
            id: "keep:channelV2:reachRateTable",
            op: "keep",
            field: "channelV2",
            values: ["Display"],
            sourceBlockId: "reachRateTable",
            label: "Keep Channel = Display",
        },
    ],
    drillTransitions: [
        {
            refinementId: "drill:country:reachRateTrend",
            sourceField: "country",
            nextFieldRef: "region",
            sourceBlockId: "reachRateTrend",
        },
    ],
    hostIntent: null,
    detailDiagnostic: null,
});
assert.equal(templatedMixedRuntimePreviewInteraction?.templateId, "forecast_inventory_brief");
assert.equal(templatedMixedRuntimePreviewInteraction?.templateLabel, "Forecast Inventory Brief");

assert.deepEqual(stripReportBuilderHydratedDocumentSessionState({
    selectedDimensions: ["eventDate"],
    reportDocumentReopenSession: session,
}), {
    selectedDimensions: ["eventDate"],
});

const roundTripped = buildReportBuilderHydratedSessionRoundTrip({
    config: hydrated.config,
    state: hydrated.state,
    session: sessionWithRuntimePreviewInteraction,
});
assert.deepEqual(resolveReportBuilderHydratedDocumentSessionFromState(roundTripped), sessionWithRuntimePreviewInteraction);

console.log("reportBuilderHydratedReportDocument ✓ hydrates compatible ReportDocument responses back into live builder config and state");
