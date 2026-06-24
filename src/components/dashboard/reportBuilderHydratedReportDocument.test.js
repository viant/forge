import assert from "node:assert/strict";

import {
    applyReportBuilderHydratedDocumentSessionState,
    buildHydratedReportBuilderDocument,
    buildReportBuilderHydratedDocumentSession,
    buildReportBuilderHydratedSessionRoundTrip,
    resolveReportBuilderHydratedDocumentSessionFromState,
    setReportBuilderHydratedDocumentSessionSharedArtifact,
    setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction,
    stripReportBuilderHydratedDocumentSessionState,
} from "./reportBuilderHydratedReportDocument.js";
import {
    buildReportBuilderListReportDocumentsResponseFromBuilderState,
    buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState,
} from "./reportBuilderReportDocumentReadResponse.js";
import { buildReportBuilderSavedReportPayloadFromBuilderState } from "./reportBuilderSavedReportPayload.js";
import { buildReportBuilderRuntimePreviewModel } from "./reportBuilderRuntimePreview.js";
import {
    buildReportBuilderSemanticModelReloadKey,
} from "./useReportBuilderSemanticModelState.js";

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
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for reopened semantic preview.",
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
            ],
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
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
            modelRef: "model://example/performance/delivery@v1",
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
                        modelRef: "model://example/performance/delivery@v1",
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

const selectedGetBuilderContainer = {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Report Builder Demo",
    dataSourceRef: "demoReportSource",
};

const selectedGetSemanticConfig = {
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
        defaultMode: "table",
        pageSize: 50,
        orderFields: [
            { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
        ],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["available_impressions"],
    },
};

const selectedGetSemanticState = {
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
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["available_impressions"],
    },
};

const selectedGetSemanticModel = {
    modelRef: "model://example/performance/delivery@v1",
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
            modelRef: "model://example/performance/delivery@v1",
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
    scopeParams: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for reopened semantic preview.",
            value: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
    ],
    state: {
        selectedMeasures: ["available_impressions"],
        primaryMeasure: "available_impressions",
        selectedDimensions: ["event_date", "channel"],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
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
    document: {
        ...getResponse.document,
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    reportSpec: {
        ...getResponse.reportSpec,
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
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
                    reportDocumentTemplateId: "capacity_inventory_brief",
                    reportDocumentTemplateLabel: "Capacity Inventory Brief",
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
assert.equal(hydratedWithTemplateState.state.reportDocumentTemplateId, "capacity_inventory_brief");
assert.equal(hydratedWithTemplateState.state.reportDocumentTemplateLabel, "Capacity Inventory Brief");

const hydratedWithRootTemplateIdentity = buildHydratedReportBuilderDocument({
    ...getResponse,
    document: {
        ...getResponse.document,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        blocks: [
            {
                ...getResponse.document.blocks[0],
                state: {
                    ...getResponse.document.blocks[0].state,
                    reportDocumentTemplateId: "capacity_inventory_brief",
                    reportDocumentTemplateLabel: "Capacity Inventory Brief",
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
assert.equal(hydratedWithRootTemplateIdentity.state.reportDocumentTemplateId, "market_brief");
assert.equal(hydratedWithRootTemplateIdentity.state.reportDocumentTemplateLabel, "Market Brief");

const rootTemplatedSession = buildReportBuilderHydratedDocumentSession(hydratedWithRootTemplateIdentity, {
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
assert.equal(rootTemplatedSession?.templateId, "market_brief");
assert.equal(rootTemplatedSession?.templateLabel, "Market Brief");

const rootTemplatePreviewModel = buildReportBuilderRuntimePreviewModel({
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    config: hydratedWithRootTemplateIdentity.config,
    state: hydratedWithRootTemplateIdentity.state,
});
assert.equal(rootTemplatePreviewModel?.document?.templateId, "market_brief");
assert.equal(rootTemplatePreviewModel?.document?.templateLabel, "Market Brief");

const rebuiltRootTemplatedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_demo_root_template",
    sourceArtifactId: "rbexploration_demo_report",
    title: "Exploration Demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
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
        dataSourceRef: "demoReportSource",
    },
    config: hydratedWithRootTemplateIdentity.config,
    state: hydratedWithRootTemplateIdentity.state,
    savedAt: 9500,
});
assert.equal(rebuiltRootTemplatedPayload?.reportDocument?.templateId, "market_brief");
assert.equal(rebuiltRootTemplatedPayload?.reportDocument?.templateLabel, "Market Brief");
assert.equal(rebuiltRootTemplatedPayload?.reportDocument?.blocks?.[0]?.state?.reportDocumentTemplateId, "market_brief");
assert.equal(rebuiltRootTemplatedPayload?.reportDocument?.blocks?.[0]?.state?.reportDocumentTemplateLabel, "Market Brief");

const hydratedSavedViewOverlay = buildHydratedReportBuilderDocument({
    ...getResponse,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_demo_report",
        reportId: "demoReportBuilder",
    },
    reportSpec: {
        ...getResponse.reportSpec,
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for reopened semantic preview.",
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
                {
                    id: "channelsFilter",
                    label: "Channels",
                    value: [],
                },
            ],
        },
    },
    document: {
        ...getResponse.document,
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
                {
                    id: "channelsFilter",
                    label: "Channels",
                    value: [],
                },
            ],
        },
        blocks: [
            {
                ...getResponse.document.blocks[0],
                config: {
                    ...getResponse.document.blocks[0].config,
                    groupBy: {
                        options: [
                            {
                                value: "channelV2",
                                dimensionId: "channel",
                            },
                        ],
                    },
                    staticFilters: [
                        { id: "dateRange", type: "dateRange", required: true },
                        { id: "channelsFilter", type: "multiSelect", required: false },
                    ],
                    result: {
                        ...getResponse.document.blocks[0].config.result,
                        orderFields: [
                            {
                                value: "channelV2",
                                field: "channelV2",
                                defaultDirection: "desc",
                            },
                        ],
                        defaultTablePresets: [
                            {
                                title: "Inventory Ladder",
                                dimensions: ["event_date", "channel"],
                                measures: ["available_impressions"],
                                primaryMeasure: "available_impressions",
                                groupBy: "channelV2",
                                orderField: "channelV2",
                                orderDir: "desc",
                                pageSize: 25,
                            },
                        ],
                    },
                },
                state: {
                    ...getResponse.document.blocks[0].state,
                    staticFilters: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                        channelsFilter: [],
                    },
                    orderField: "event_date",
                    orderDir: "asc",
                    pageSize: 50,
                    page: 1,
                    groupBy: "",
                },
                scopeBindings: [
                    {
                        paramId: "dateRange",
                        target: "staticFilters.dateRange",
                    },
                    {
                        paramId: "channelsFilter",
                        target: "staticFilters.channelsFilter",
                    },
                ],
            },
        ],
    },
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://demoReportBuilder",
            reportId: "demoReportBuilder",
            documentVersion: 10,
        },
        overlay: {
            parameters: {
                dateRange: {
                    start: "2026-06-01",
                    end: "2026-06-07",
                },
            },
            filters: {
                channelsFilter: ["CTV"],
            },
            order: {
                field: "channelV2",
                direction: "desc",
                pageSize: 25,
                page: 2,
            },
            presentation: {
                viewMode: "table",
                groupBy: "channelV2",
                activeTablePreset: "Inventory Ladder",
                lastTablePreset: "Inventory Ladder",
            },
        },
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.deepEqual(hydratedSavedViewOverlay.state.staticFilters, {
    dateRange: {
        start: "2026-06-01",
        end: "2026-06-07",
    },
    channelsFilter: ["CTV"],
});
assert.equal(hydratedSavedViewOverlay.state.orderField, "channelV2");
assert.equal(hydratedSavedViewOverlay.state.orderDir, "desc");
assert.equal(hydratedSavedViewOverlay.state.pageSize, 25);
assert.equal(hydratedSavedViewOverlay.state.page, 2);
assert.equal(hydratedSavedViewOverlay.state.groupBy, "channelV2");
assert.equal(hydratedSavedViewOverlay.state.activeTablePreset?.title, "Inventory Ladder");
assert.equal(hydratedSavedViewOverlay.state.lastTablePreset?.title, "Inventory Ladder");
assert.deepEqual(hydratedSavedViewOverlay.scopeParams, [
    {
        id: "dateRange",
        label: "Reporting Window",
        description: "Approved reporting window for reopened semantic preview.",
        value: {
            start: "2026-06-01",
            end: "2026-06-07",
        },
    },
    {
        id: "channelsFilter",
        label: "Channels",
        value: [],
    },
]);
assert.equal(hydratedSavedViewOverlay.savedViewOverlay.overlay.filters.channelsFilter[0], "CTV");

const hydratedSavedViewOverlaySession = buildReportBuilderHydratedDocumentSession(hydratedSavedViewOverlay, {
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
assert.deepEqual(hydratedSavedViewOverlaySession?.reopenedScopeParams, [
    {
        id: "dateRange",
        label: "Reporting Window",
        description: "Approved reporting window for reopened semantic preview.",
    },
    {
        id: "channelsFilter",
        label: "Channels",
    },
]);
assert.equal(hydratedSavedViewOverlaySession?.savedViewOverlay?.overlay?.filters?.channelsFilter?.[0], "CTV");

const hydratedSnapshotBackedSavedViewOverlay = buildHydratedReportBuilderDocument({
    ...getResponse,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_demo_report_snapshot_backed",
        reportId: "demoReportBuilder",
    },
    document: {
        ...getResponse.document,
        title: "Exploration Demo Saved View",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
            ],
        },
    },
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://demoReportBuilder",
            reportId: "demoReportBuilder",
            documentVersion: 10,
        },
        publishedSnapshotRef: {
            artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_demo_report",
            reportId: "demoReportBuilder",
            documentVersion: 11,
            sourceArtifactId: "published_snapshot_demo_report",
        },
        overlay: {
            filters: {
                channelsFilter: ["CTV"],
            },
        },
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
    localSavedPayloads: [
        {
            reportId: "demoReportBuilder",
            title: "Exploration Demo Base",
            documentVersion: 10,
            savedAt: 9400,
            document: {
                ...getResponse.document,
                title: "Exploration Demo Base",
                scope: {
                    params: [
                        {
                            id: "dateRange",
                            label: "Reporting Window",
                            value: {
                                start: "2026-05-09",
                                end: "2026-05-10",
                            },
                        },
                    ],
                },
            },
            reportSpec: getResponse.reportSpec,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_demo_report_base",
                sourceArtifactId: "demo_report_base",
                reportId: "demoReportBuilder",
            },
        },
        {
            reportId: "demoReportBuilder",
            title: "Exploration Demo Snapshot",
            documentVersion: 11,
            savedAt: 9500,
            document: {
                ...getResponse.document,
                title: "Exploration Demo Snapshot",
                scope: {
                    params: [
                        {
                            id: "dateRange",
                            label: "Reporting Window",
                            value: {
                                start: "2026-05-11",
                                end: "2026-05-12",
                            },
                        },
                    ],
                },
                blocks: [
                    {
                        ...getResponse.document.blocks[0],
                        config: {
                            ...getResponse.document.blocks[0].config,
                            staticFilters: [
                                { id: "dateRange", type: "dateRange", required: true },
                                { id: "channelsFilter", type: "multiSelect", required: false },
                            ],
                        },
                        state: {
                            ...getResponse.document.blocks[0].state,
                            staticFilters: {
                                dateRange: {
                                    start: "2026-05-11",
                                    end: "2026-05-12",
                                },
                                channelsFilter: [],
                            },
                        },
                        scopeBindings: [
                            {
                                paramId: "dateRange",
                                target: "staticFilters.dateRange",
                            },
                            {
                                paramId: "channelsFilter",
                                target: "staticFilters.channelsFilter",
                            },
                        ],
                    },
                ],
            },
            reportSpec: {
                ...getResponse.reportSpec,
                scope: {
                    params: [
                        {
                            id: "dateRange",
                            label: "Reporting Window",
                            value: {
                                start: "2026-05-11",
                                end: "2026-05-12",
                            },
                        },
                    ],
                },
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_demo_report",
                reportId: "demoReportBuilder",
            },
        },
    ],
});
assert.deepEqual(hydratedSnapshotBackedSavedViewOverlay.state.staticFilters, {
    dateRange: {
        start: "2026-05-11",
        end: "2026-05-12",
    },
    channelsFilter: ["CTV"],
});
assert.equal(hydratedSnapshotBackedSavedViewOverlay.savedViewOverlayBaseSource.kind, "reportBuilder.savedReportPayload");
assert.equal(hydratedSnapshotBackedSavedViewOverlay.savedViewOverlayPublishedSnapshotSource.kind, "reportBuilder.publishedSnapshot");

const hydratedSnapshotBackedSavedViewOverlaySession = buildReportBuilderHydratedDocumentSession(hydratedSnapshotBackedSavedViewOverlay, {
    liveConfig: {
        result: {
            defaultMode: "table",
        },
    },
    liveState: {
        selectedDimensions: ["eventDate"],
        viewMode: "table",
    },
});
assert.equal(hydratedSnapshotBackedSavedViewOverlaySession?.savedViewOverlayBaseSource?.kind, "reportBuilder.savedReportPayload");
assert.equal(hydratedSnapshotBackedSavedViewOverlaySession?.savedViewOverlayPublishedSnapshotSource?.kind, "reportBuilder.publishedSnapshot");

const hydratedSnapshotBackedSavedViewOverlayIncompatibleSource = buildHydratedReportBuilderDocument({
    ...getResponse,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_demo_report_snapshot_backed_incompatible",
        reportId: "demoReportBuilder",
    },
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
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://demoReportBuilder",
            reportId: "demoReportBuilder",
            documentVersion: 10,
        },
        publishedSnapshotRef: {
            artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_demo_report",
            reportId: "demoReportBuilder",
            documentVersion: 11,
            sourceArtifactId: "published_snapshot_demo_report",
        },
        overlay: {
            filters: {
                channelsFilter: ["CTV"],
            },
        },
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
    localSavedPayloads: [
        {
            reportId: "demoReportBuilder",
            title: "Exploration Demo Base",
            documentVersion: 10,
            savedAt: 9400,
            document: getResponse.document,
            reportSpec: getResponse.reportSpec,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_demo_report_base",
                sourceArtifactId: "demo_report_base",
                reportId: "demoReportBuilder",
            },
        },
        {
            reportId: "demoReportBuilder",
            title: "Exploration Demo Snapshot",
            documentVersion: 11,
            savedAt: 9500,
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
            reportSpec: getResponse.reportSpec,
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_demo_report",
                reportId: "demoReportBuilder",
            },
        },
    ],
});
assert.equal(hydratedSnapshotBackedSavedViewOverlayIncompatibleSource.valid, false);
assert.equal(hydratedSnapshotBackedSavedViewOverlayIncompatibleSource.code, "incompatibleSource");
assert.equal(hydratedSnapshotBackedSavedViewOverlayIncompatibleSource.savedViewOverlayBaseSource?.sourceArtifactId, "demo_report_base");
assert.equal(hydratedSnapshotBackedSavedViewOverlayIncompatibleSource.savedViewOverlayPublishedSnapshotSource?.sourceArtifactId, "published_snapshot_demo_report");

const hydratedInvalidSavedViewOverlay = buildHydratedReportBuilderDocument({
    ...getResponse,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_demo_report_invalid",
        reportId: "demoReportBuilder",
    },
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://demoReportBuilder",
            reportId: "demoReportBuilder",
            documentVersion: 10,
        },
        overlay: {
            order: {
                field: "missingField",
                direction: "sideways",
            },
            presentation: {
                chartSpec: {
                    type: "line",
                    xField: "missingDimension",
                    yFields: ["missingMeasure"],
                },
                groupBy: "missingGroup",
                unexpectedOption: true,
            },
        },
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.equal(hydratedInvalidSavedViewOverlay.valid, true);
assert.equal(hydratedInvalidSavedViewOverlay.compileState.status, "invalid");
assert.deepEqual(
    hydratedInvalidSavedViewOverlay.compileState.diagnostics.map((entry) => entry.code),
    [
        "savedViewOverlayInvalidOrderDirection",
        "savedViewOverlayUnsupportedPresentationKey",
        "savedViewOverlayUnknownOrderField",
        "savedViewOverlayUnknownGroupByField",
        "savedViewOverlayOrderFieldIncompatible",
        "savedViewOverlayChartSpecIncompatible",
    ],
);
assert.equal(hydratedInvalidSavedViewOverlay.state.orderField, "");
assert.equal(hydratedInvalidSavedViewOverlay.state.groupBy, undefined);

const hydratedMismatchedSavedViewOverlay = buildHydratedReportBuilderDocument({
    ...getResponse,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_demo_report_mismatch",
        reportId: "demoReportBuilder",
    },
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://otherReport",
            reportId: "otherReport",
            documentVersion: 10,
        },
        publishedSnapshotRef: {
            artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_other_report",
            reportId: "otherReport",
            documentVersion: 11,
            sourceArtifactId: "published_snapshot_other_report",
        },
        overlay: {
            filters: {
                dateRange: {
                    start: "2026-06-01",
                    end: "2026-06-07",
                },
            },
        },
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.equal(hydratedMismatchedSavedViewOverlay.valid, true);
assert.deepEqual(
    hydratedMismatchedSavedViewOverlay.compileState.diagnostics.map((entry) => entry.code),
    [
        "savedViewOverlayBaseReportMismatch",
        "savedViewOverlayPublishedSnapshotReportMismatch",
    ],
);
assert.deepEqual(hydratedMismatchedSavedViewOverlay.state.staticFilters, {
    dateRange: {
        start: "2026-05-01",
        end: "2026-05-04",
    },
});
assert.equal(hydratedMismatchedSavedViewOverlay.savedViewOverlay.baseReportRef.reportId, "otherReport");
assert.equal(hydratedMismatchedSavedViewOverlay.savedViewOverlay.publishedSnapshotRef.sourceArtifactId, "published_snapshot_other_report");

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
    message: "The saved reopen bundle version is not supported.",
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

assert.deepEqual(buildHydratedReportBuilderDocument({
    ...getResponse,
    reportSpec: {
        ...getResponse.reportSpec,
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for reopened semantic preview.",
                    value: {
                        start: "2026-06-01",
                        end: "2026-06-07",
                    },
                },
            ],
        },
    },
    document: {
        ...getResponse.document,
        scope: {
            params: [],
        },
        blocks: [
            {
                ...getResponse.document.blocks[0],
                state: {
                    ...getResponse.document.blocks[0].state,
                    staticFilters: {},
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
})?.state?.staticFilters?.dateRange, {
    start: "2026-06-01",
    end: "2026-06-07",
});

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
        modelRef: "model://example/performance/delivery@v1",
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
    reopenedScopeParams: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for reopened semantic preview.",
        },
    ],
    reopenedSemanticFingerprint: JSON.stringify({
        modelRef: "model://example/performance/delivery@v1",
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
assert.equal(templatedSession?.templateId, "capacity_inventory_brief");
assert.equal(templatedSession?.templateLabel, "Capacity Inventory Brief");

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

const fallbackScopeHydrated = buildHydratedReportBuilderDocument({
    ...getResponse,
    reportSpec: {
        ...getResponse.reportSpec,
        scope: undefined,
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.equal(fallbackScopeHydrated.valid, true);
const fallbackScopeSession = buildReportBuilderHydratedDocumentSession(fallbackScopeHydrated, {
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
assert.deepEqual(fallbackScopeSession?.reopenedScopeParams, [
    {
        id: "dateRange",
        label: "dateRange",
    },
]);

const emptySpecScopeHydrated = buildHydratedReportBuilderDocument({
    ...getResponse,
    reportSpec: {
        ...getResponse.reportSpec,
        scope: {
            params: [],
        },
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.equal(emptySpecScopeHydrated.valid, true);
const emptySpecScopeSession = buildReportBuilderHydratedDocumentSession(emptySpecScopeHydrated, {
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
assert.deepEqual(emptySpecScopeSession?.reopenedScopeParams, [
    {
        id: "dateRange",
        label: "dateRange",
    },
]);

const embeddedOnlyGetResponse = {
    ...getResponse,
    reportSpec: {},
    document: {
        ...getResponse.document,
        semanticSummary: undefined,
        scope: undefined,
    },
};
const embeddedOnlyHydrated = buildHydratedReportBuilderDocument(embeddedOnlyGetResponse, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.equal(embeddedOnlyHydrated.valid, true);
const embeddedOnlySession = buildReportBuilderHydratedDocumentSession(embeddedOnlyHydrated, {
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
assert.equal(embeddedOnlySession?.reopenedSemanticSummary?.modelRef, "model://example/performance/delivery@v1");
assert.equal(embeddedOnlySession?.reopenedSemanticSummary?.selectedDimensions?.[1]?.label, "Channel");
assert.deepEqual(embeddedOnlySession?.reopenedScopeParams, [
    {
        id: "dateRange",
        label: "dateRange",
    },
]);

const derivedSelectedGetListResponse = buildReportBuilderListReportDocumentsResponseFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_selected_get_runtime",
    savedAt: 9410,
    title: "Selected Get Runtime Demo",
    sourceArtifactId: "selected_get_runtime_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "selectedGetRuntimeDemo",
        title: "Selected Get Runtime Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: selectedGetBuilderContainer,
    config: selectedGetSemanticConfig,
    state: selectedGetSemanticState,
    semanticModel: selectedGetSemanticModel,
    semanticRuntimeDiagnostics: [
        {
            code: "semanticProviderDiagnostics",
            severity: "warning",
            message: "Selected get session semantic provider diagnostic.",
        },
    ],
    documentVersion: 12,
    cursor: "next-page",
    hasMore: true,
});
const derivedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
    derivedSelectedGetListResponse,
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "selectedGetRuntimeDemo",
        },
        documentVersion: 12,
        savedAt: 9410,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "selectedGetRuntimeDemo",
            title: "Selected Get Runtime Demo",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_selected_get_runtime",
            sourceArtifactId: "selected_get_runtime_demo",
        },
    },
    {
        request: {
            reportRef: {
                reportId: "selectedGetRuntimeDemo",
            },
        },
        container: selectedGetBuilderContainer,
        config: selectedGetSemanticConfig,
        state: selectedGetSemanticState,
        semanticModel: selectedGetSemanticModel,
        semanticRuntimeDiagnostics: [
            {
                code: "semanticProviderDiagnostics",
                severity: "warning",
                message: "Selected get session semantic provider diagnostic.",
            },
        ],
    },
);
const hydratedDerivedSelectedGetResponse = buildHydratedReportBuilderDocument(derivedSelectedGetResponse, {
    container: selectedGetBuilderContainer,
    builderIdentity,
});
assert.equal(hydratedDerivedSelectedGetResponse.valid, true);
const derivedSelectedGetSession = buildReportBuilderHydratedDocumentSession(hydratedDerivedSelectedGetResponse, {
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
assert.equal(buildReportBuilderSemanticModelReloadKey(derivedSelectedGetSession), "selectedGetRuntimeDemo::12");
assert.deepEqual(derivedSelectedGetSession?.reopenedSemanticSummary, {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Delivery Date", format: "date" },
        { id: "channel", rawId: "channelV2", label: "Channel" },
    ],
    selectedMeasures: [
        { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
    ],
});
assert.deepEqual(derivedSelectedGetSession?.reopenedScopeParams, [
    {
        id: "dateRange",
        label: "dateRange",
    },
]);
assert.equal(derivedSelectedGetSession?.reopenedSemanticFingerprint, JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
        entity: "line_delivery",
        dimensions: ["event_date", "channel"],
        measures: ["available_impressions"],
        parameters: {},
    },
}));
assert.deepEqual(derivedSelectedGetSession?.reopenedCompileState, {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 1,
    datasetCount: 1,
    diagnostics: [
        {
            code: "semanticProviderDiagnostics",
            severity: "warning",
            message: "Selected get session semantic provider diagnostic.",
        },
    ],
});
assert.deepEqual(
    resolveReportBuilderHydratedDocumentSessionFromState(
        applyReportBuilderHydratedDocumentSessionState({}, derivedSelectedGetSession),
    ),
    derivedSelectedGetSession,
);
const invalidDerivedSelectedGetListResponse = buildReportBuilderListReportDocumentsResponseFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_selected_get_runtime_invalid",
    savedAt: 9411,
    title: "Selected Get Runtime Invalid Demo",
    sourceArtifactId: "selected_get_runtime_invalid_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "selectedGetRuntimeInvalidDemo",
        title: "Selected Get Runtime Invalid Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryBuilder" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: selectedGetBuilderContainer,
    config: selectedGetSemanticConfig,
    state: {
        ...selectedGetSemanticState,
        reportDocumentBlocks: [
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "missingMetric",
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [
                { blockId: "primaryBuilder" },
                { blockId: "headlineKpi" },
            ],
        },
    },
    semanticModel: selectedGetSemanticModel,
    documentVersion: 13,
    cursor: "next-page",
    hasMore: true,
});
const invalidDerivedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
    invalidDerivedSelectedGetListResponse,
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "selectedGetRuntimeInvalidDemo",
        },
        documentVersion: 13,
        savedAt: 9411,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "selectedGetRuntimeInvalidDemo",
            title: "Selected Get Runtime Invalid Demo",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_selected_get_runtime_invalid",
            sourceArtifactId: "selected_get_runtime_invalid_demo",
        },
    },
    {
        request: {
            reportRef: {
                reportId: "selectedGetRuntimeInvalidDemo",
            },
        },
        container: selectedGetBuilderContainer,
        config: selectedGetSemanticConfig,
        state: {
            ...selectedGetSemanticState,
            reportDocumentBlocks: [
                {
                    id: "headlineKpi",
                    kind: "kpiBlock",
                    title: "Headline KPI",
                    datasetRef: "primary",
                    valueField: "missingMetric",
                },
            ],
            reportDocumentLayout: {
                type: "stack",
                items: [
                    { blockId: "primaryBuilder" },
                    { blockId: "headlineKpi" },
                ],
            },
        },
        semanticModel: selectedGetSemanticModel,
    },
);
assert.equal(invalidDerivedSelectedGetResponse.compileState.status, "invalid");
assert.equal(invalidDerivedSelectedGetResponse.compileState.diagnostics[0].code, "documentBlockValueFieldUnavailable");
const hydratedInvalidDerivedSelectedGetResponse = buildHydratedReportBuilderDocument(invalidDerivedSelectedGetResponse, {
    container: selectedGetBuilderContainer,
    builderIdentity,
});
assert.equal(hydratedInvalidDerivedSelectedGetResponse.valid, true);
const invalidDerivedSelectedGetSession = buildReportBuilderHydratedDocumentSession(hydratedInvalidDerivedSelectedGetResponse, {
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
assert.equal(invalidDerivedSelectedGetSession?.reopenedSemanticSummary?.modelLabel, "Ad Delivery");
assert.equal(invalidDerivedSelectedGetSession?.reopenedSemanticFingerprint, JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
        entity: "line_delivery",
        dimensions: ["event_date", "channel"],
        measures: ["available_impressions"],
        parameters: {},
    },
}));
assert.deepEqual(invalidDerivedSelectedGetSession?.reopenedCompileState, {
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
            message: "Headline KPI references unavailable KPI value field 'missingMetric'.",
            suggestedFix: "Edit the KPI block to use one of the current available measures or restore the missing measure in the builder.",
        },
    ],
});
const calculatedSelectedGetListResponse = buildReportBuilderListReportDocumentsResponseFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_selected_get_calc",
    savedAt: 9412,
    title: "Selected Get Calculated Demo",
    sourceArtifactId: "selected_get_calculated_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "selectedGetCalculatedDemo",
        title: "Selected Get Calculated Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryBuilder" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: selectedGetBuilderContainer,
    config: selectedGetSemanticConfig,
    state: {
        ...selectedGetSemanticState,
        localCalculatedFields: [
            {
                id: "ctvAvails",
                key: "ctvAvails",
                label: "CTV Avails",
                dataType: "number",
                format: "compactNumber",
                expr: "if(channelV2 = 'CTV', avails, null)",
            },
        ],
    },
    semanticModel: selectedGetSemanticModel,
    documentVersion: 14,
    cursor: "next-page",
    hasMore: true,
});
const calculatedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
    calculatedSelectedGetListResponse,
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "selectedGetCalculatedDemo",
        },
        documentVersion: 14,
        savedAt: 9412,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "selectedGetCalculatedDemo",
            title: "Selected Get Calculated Demo",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_selected_get_calc",
            sourceArtifactId: "selected_get_calculated_demo",
        },
    },
    {
        request: {
            reportRef: {
                reportId: "selectedGetCalculatedDemo",
            },
        },
        container: selectedGetBuilderContainer,
        config: selectedGetSemanticConfig,
        state: {
            ...selectedGetSemanticState,
            localCalculatedFields: [
                {
                    id: "ctvAvails",
                    key: "ctvAvails",
                    label: "CTV Avails",
                    dataType: "number",
                    format: "compactNumber",
                    expr: "if(channelV2 = 'CTV', avails, null)",
                },
            ],
        },
        semanticModel: selectedGetSemanticModel,
    },
);
const hydratedCalculatedSelectedGetResponse = buildHydratedReportBuilderDocument(calculatedSelectedGetResponse, {
    container: selectedGetBuilderContainer,
    builderIdentity,
});
assert.equal(hydratedCalculatedSelectedGetResponse.valid, true);
assert.equal(hydratedCalculatedSelectedGetResponse.state.localCalculatedFields?.[0]?.id, "ctvAvails");
assert.equal(hydratedCalculatedSelectedGetResponse.state.localCalculatedFields?.[0]?.expr, "if(channelV2 = 'CTV', avails, null)");
const calculatedSelectedGetSession = buildReportBuilderHydratedDocumentSession(hydratedCalculatedSelectedGetResponse, {
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
assert.equal(calculatedSelectedGetSession?.reopenedSemanticSummary?.modelLabel, "Ad Delivery");
assert.deepEqual(calculatedSelectedGetSession?.reopenedCompileState, {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 1,
    datasetCount: 1,
});
const tableCalcSelectedGetListResponse = buildReportBuilderListReportDocumentsResponseFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_selected_get_table_calc",
    savedAt: 9413,
    title: "Selected Get Table Calc Demo",
    sourceArtifactId: "selected_get_table_calc_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "selectedGetTableCalcDemo",
        title: "Selected Get Table Calc Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryBuilder" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: selectedGetBuilderContainer,
    config: selectedGetSemanticConfig,
    state: {
        ...selectedGetSemanticState,
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
    semanticModel: selectedGetSemanticModel,
    documentVersion: 15,
    cursor: "next-page",
    hasMore: true,
});
const tableCalcSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
    tableCalcSelectedGetListResponse,
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "selectedGetTableCalcDemo",
        },
        documentVersion: 15,
        savedAt: 9413,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "selectedGetTableCalcDemo",
            title: "Selected Get Table Calc Demo",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_selected_get_table_calc",
            sourceArtifactId: "selected_get_table_calc_demo",
        },
    },
    {
        request: {
            reportRef: {
                reportId: "selectedGetTableCalcDemo",
            },
        },
        container: selectedGetBuilderContainer,
        config: selectedGetSemanticConfig,
        state: {
            ...selectedGetSemanticState,
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
        semanticModel: selectedGetSemanticModel,
    },
);
const hydratedTableCalcSelectedGetResponse = buildHydratedReportBuilderDocument(tableCalcSelectedGetResponse, {
    container: selectedGetBuilderContainer,
    builderIdentity,
});
assert.equal(hydratedTableCalcSelectedGetResponse.valid, true);
assert.equal(hydratedTableCalcSelectedGetResponse.state.localTableCalculations?.[0]?.id, "reachShare");
assert.equal(hydratedTableCalcSelectedGetResponse.state.localTableCalculations?.[0]?.compute?.type, "percentOfTotal");
const tableCalcSelectedGetSession = buildReportBuilderHydratedDocumentSession(hydratedTableCalcSelectedGetResponse, {
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
assert.equal(tableCalcSelectedGetSession?.reopenedSemanticSummary?.modelLabel, "Ad Delivery");
assert.deepEqual(tableCalcSelectedGetSession?.reopenedCompileState, {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 1,
    datasetCount: 1,
});
const combinedSelectedGetListResponse = buildReportBuilderListReportDocumentsResponseFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_selected_get_combo",
    savedAt: 9414,
    title: "Selected Get Combined Demo",
    sourceArtifactId: "selected_get_combined_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "selectedGetCombinedDemo",
        title: "Selected Get Combined Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryBuilder" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: selectedGetBuilderContainer,
    config: selectedGetSemanticConfig,
    state: {
        ...selectedGetSemanticState,
        localCalculatedFields: [
            {
                id: "ctvAvails",
                key: "ctvAvails",
                label: "CTV Avails",
                dataType: "number",
                format: "compactNumber",
                expr: "if(channelV2 = 'CTV', avails, null)",
            },
        ],
        localTableCalculations: [
            {
                id: "runningCtvAvails",
                key: "runningCtvAvails",
                kind: "tableCalc",
                label: "Running CTV Avails",
                dataType: "number",
                format: "compactNumber",
                datasetRef: "primary",
                dependencies: ["ctvAvails", "eventDate", "channelV2"],
                compute: {
                    type: "runningTotal",
                    sourceField: "ctvAvails",
                    partitionBy: ["channelV2"],
                    orderBy: [{ field: "eventDate", direction: "asc" }],
                },
            },
        ],
    },
    semanticModel: selectedGetSemanticModel,
    documentVersion: 16,
    cursor: "next-page",
    hasMore: true,
});
const combinedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
    combinedSelectedGetListResponse,
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "selectedGetCombinedDemo",
        },
        documentVersion: 16,
        savedAt: 9414,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "selectedGetCombinedDemo",
            title: "Selected Get Combined Demo",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_selected_get_combo",
            sourceArtifactId: "selected_get_combined_demo",
        },
    },
    {
        request: {
            reportRef: {
                reportId: "selectedGetCombinedDemo",
            },
        },
        container: selectedGetBuilderContainer,
        config: selectedGetSemanticConfig,
        state: {
            ...selectedGetSemanticState,
            localCalculatedFields: [
                {
                    id: "ctvAvails",
                    key: "ctvAvails",
                    label: "CTV Avails",
                    dataType: "number",
                    format: "compactNumber",
                    expr: "if(channelV2 = 'CTV', avails, null)",
                },
            ],
            localTableCalculations: [
                {
                    id: "runningCtvAvails",
                    key: "runningCtvAvails",
                    kind: "tableCalc",
                    label: "Running CTV Avails",
                    dataType: "number",
                    format: "compactNumber",
                    datasetRef: "primary",
                    dependencies: ["ctvAvails", "eventDate", "channelV2"],
                    compute: {
                        type: "runningTotal",
                        sourceField: "ctvAvails",
                        partitionBy: ["channelV2"],
                        orderBy: [{ field: "eventDate", direction: "asc" }],
                    },
                },
            ],
        },
        semanticModel: selectedGetSemanticModel,
    },
);
const hydratedCombinedSelectedGetResponse = buildHydratedReportBuilderDocument(combinedSelectedGetResponse, {
    container: selectedGetBuilderContainer,
    builderIdentity,
});
assert.equal(hydratedCombinedSelectedGetResponse.valid, true);
assert.equal(hydratedCombinedSelectedGetResponse.state.localCalculatedFields?.[0]?.id, "ctvAvails");
assert.equal(hydratedCombinedSelectedGetResponse.state.localTableCalculations?.[0]?.id, "runningCtvAvails");
assert.equal(hydratedCombinedSelectedGetResponse.state.localTableCalculations?.[0]?.compute?.type, "runningTotal");
assert.equal(hydratedCombinedSelectedGetResponse.state.localTableCalculations?.[0]?.compute?.sourceField, "ctvAvails");
const combinedSelectedGetSession = buildReportBuilderHydratedDocumentSession(hydratedCombinedSelectedGetResponse, {
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
assert.equal(combinedSelectedGetSession?.reopenedSemanticSummary?.modelLabel, "Ad Delivery");
assert.deepEqual(combinedSelectedGetSession?.reopenedCompileState, {
    status: "clean",
    reportSpecVersion: 1,
    blockCount: 1,
    datasetCount: 1,
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
        targetRef: "target://example/performance/channel-detail",
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
        targetRef: "target://example/performance/channel-detail",
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
assert.equal(templatedMixedRuntimePreviewInteraction?.templateId, "capacity_inventory_brief");
assert.equal(templatedMixedRuntimePreviewInteraction?.templateLabel, "Capacity Inventory Brief");

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

const sharedArtifactGetResponse = {
    version: 1,
    kind: "getReportDocumentResponse",
    artifactId: "shared_view_capacity_trend",
    artifactKind: "reportBuilder.savedView",
    artifactRef: "reportBuilder.savedView://shared_view_capacity_trend",
    lifecycle: "draft",
    ownerRef: "team://analytics",
    policyRef: "policy://reports/shared",
    shareableVersion: 4,
    badges: [
        { id: "reviewed", label: "Reviewed", tone: "success" },
    ],
    capabilities: {
        share: true,
        publish: true,
    },
    grants: [
        { principalRef: "team://finance", role: "viewer" },
    ],
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    documentVersion: 6,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_capacity_trend",
        reportId: "capacityTrendQ3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
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
                    measures: [
                        { id: "avails", key: "avails", label: "Avails", default: true },
                    ],
                    dimensions: [
                        { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true },
                    ],
                },
                state: {
                    selectedMeasures: ["avails"],
                    selectedDimensions: ["eventDate"],
                    viewMode: "table",
                },
            },
        ],
    },
};

const hydratedSharedArtifact = buildHydratedReportBuilderDocument(sharedArtifactGetResponse, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity,
});
assert.equal(hydratedSharedArtifact?.artifactId, "shared_view_capacity_trend");
assert.equal(hydratedSharedArtifact?.artifactKind, "reportBuilder.savedView");
assert.equal(hydratedSharedArtifact?.artifactRef, "reportBuilder.savedView://shared_view_capacity_trend");
assert.equal(hydratedSharedArtifact?.lifecycle, "draft");
assert.equal(hydratedSharedArtifact?.ownerRef, "team://analytics");
assert.equal(hydratedSharedArtifact?.policyRef, "policy://reports/shared");
assert.equal(hydratedSharedArtifact?.shareableVersion, 4);
assert.equal(hydratedSharedArtifact?.badges?.[0]?.label, "Reviewed");
assert.equal(hydratedSharedArtifact?.capabilities?.publish, true);
assert.equal(hydratedSharedArtifact?.grants?.[0]?.principalRef, "team://finance");

const sharedArtifactSession = buildReportBuilderHydratedDocumentSession(hydratedSharedArtifact, {
    liveConfig: selectedGetSemanticConfig,
    liveState: selectedGetSemanticState,
});
assert.equal(sharedArtifactSession?.artifactId, "shared_view_capacity_trend");
assert.equal(sharedArtifactSession?.artifactKind, "reportBuilder.savedView");
assert.equal(sharedArtifactSession?.artifactRef, "reportBuilder.savedView://shared_view_capacity_trend");
assert.equal(sharedArtifactSession?.lifecycle, "draft");
assert.equal(sharedArtifactSession?.ownerRef, "team://analytics");
assert.equal(sharedArtifactSession?.policyRef, "policy://reports/shared");
assert.equal(sharedArtifactSession?.shareableVersion, 4);
assert.equal(sharedArtifactSession?.capabilities?.share, true);
assert.equal(sharedArtifactSession?.grants?.[0]?.role, "viewer");

const promotedSharedArtifactSession = setReportBuilderHydratedDocumentSessionSharedArtifact(sharedArtifactSession, {
    artifactId: "published_snapshot_capacity_trend",
    artifactKind: "reportBuilder.publishedSnapshot",
    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_trend",
    lifecycle: "published",
    ownerRef: "team://analytics",
    policyRef: "policy://reports/shared",
    shareableVersion: 5,
    documentVersion: 7,
    source: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_capacity_trend",
        reportId: "capacityTrendQ3",
    },
});
assert.equal(promotedSharedArtifactSession?.artifactId, "published_snapshot_capacity_trend");
assert.equal(promotedSharedArtifactSession?.artifactKind, "reportBuilder.publishedSnapshot");
assert.equal(promotedSharedArtifactSession?.artifactRef, "reportBuilder.publishedSnapshot://published_snapshot_capacity_trend");
assert.equal(promotedSharedArtifactSession?.lifecycle, "published");
assert.equal(promotedSharedArtifactSession?.shareableVersion, 5);
assert.equal(promotedSharedArtifactSession?.documentVersion, 7);
assert.equal(promotedSharedArtifactSession?.savedSource?.kind, "reportBuilder.publishedSnapshot");
assert.equal(promotedSharedArtifactSession?.savedSource?.sourceArtifactId, "published_snapshot_capacity_trend");

const archivedSharedArtifactSession = setReportBuilderHydratedDocumentSessionSharedArtifact(promotedSharedArtifactSession, {
    artifactId: "published_snapshot_capacity_trend_archived",
    artifactKind: "reportBuilder.publishedSnapshot",
    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_trend_archived",
    lifecycle: "archived",
    ownerRef: "team://analytics",
    policyRef: "policy://reports/shared",
    shareableVersion: 5,
    documentVersion: 8,
    capabilities: {
        view: true,
        share: true,
        export: true,
    },
    source: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_capacity_trend_archived",
        reportId: "capacityTrendQ3",
    },
});
assert.equal(archivedSharedArtifactSession?.artifactId, "published_snapshot_capacity_trend_archived");
assert.equal(archivedSharedArtifactSession?.artifactKind, "reportBuilder.publishedSnapshot");
assert.equal(archivedSharedArtifactSession?.artifactRef, "reportBuilder.publishedSnapshot://published_snapshot_capacity_trend_archived");
assert.equal(archivedSharedArtifactSession?.lifecycle, "archived");
assert.equal(archivedSharedArtifactSession?.shareableVersion, 5);
assert.equal(archivedSharedArtifactSession?.documentVersion, 8);
assert.equal(archivedSharedArtifactSession?.savedSource?.kind, "reportBuilder.publishedSnapshot");
assert.equal(archivedSharedArtifactSession?.savedSource?.sourceArtifactId, "published_snapshot_capacity_trend_archived");
assert.equal(archivedSharedArtifactSession?.capabilities?.share, true);
assert.equal(archivedSharedArtifactSession?.capabilities?.archive, undefined);

console.log("reportBuilderHydratedReportDocument ✓ hydrates compatible ReportDocument responses back into live builder config and state");
