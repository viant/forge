import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderUpdateReportDocumentConflictDiagnostic,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary,
    buildReportBuilderUpdateReportDocumentConflictVersionState,
    resolveReportBuilderUpdateReportDocumentCurrentVersion,
    serializeReportBuilderUpdateReportDocumentConflictDiagnostic,
} from "./reportBuilderUpdateReportDocumentConflictDiagnostic.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const updatePayload = {
    version: 1,
    kind: "updateReportDocumentPayload",
    updatedAt: 8000,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    expectedVersion: 7,
    title: "Exploration Demo",
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Conflict diagnostic metadata summary.",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for conflict diagnostics.",
                },
            ],
        },
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
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    },
};

assert.equal(resolveReportBuilderUpdateReportDocumentCurrentVersion("9"), 9);
assert.equal(resolveReportBuilderUpdateReportDocumentCurrentVersion(""), 0);
assert.equal(resolveReportBuilderUpdateReportDocumentCurrentVersion("9.5"), 0);

assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictVersionState({
    expectedVersion: 7,
    currentVersionDraft: "9",
}), {
    draft: "9",
    expectedVersion: 7,
    currentVersion: 9,
    valid: true,
    conflictReady: true,
    helperText: "Current version 9 conflicts with expected version 7.",
});
assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictVersionState({
    expectedVersion: 7,
    currentVersionDraft: "7",
}), {
    draft: "7",
    expectedVersion: 7,
    currentVersion: 7,
    valid: true,
    conflictReady: false,
    helperText: "Current version 7 matches expected version 7; no conflict diagnostic is needed.",
});

const diagnostic = buildReportBuilderUpdateReportDocumentConflictDiagnostic(updatePayload, {
    currentVersion: "9",
    detectedAt: 9100,
});
assert.deepEqual(diagnostic, {
    version: 1,
    kind: "updateReportDocumentConflictDiagnostic",
    code: "reportDocumentVersionConflict",
    severity: "error",
    detectedAt: 9100,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Conflict diagnostic metadata summary.",
    expectedVersion: 7,
    currentVersion: 9,
    message: "Could not update Exploration Demo because expected version 7 does not match current saved version 9.",
    suggestedAction: "Reload the latest ReportDocument before retrying the update.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for conflict diagnostics.",
        },
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    },
});

assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary(diagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Conflict diagnostic metadata summary.",
    kind: "updateReportDocumentConflictDiagnostic",
    code: "reportDocumentVersionConflict",
    severity: "error",
    reportId: "demoReportBuilder",
    expectedVersion: 7,
    currentVersion: 9,
    message: "Could not update Exploration Demo because expected version 7 does not match current saved version 9.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for conflict diagnostics.",
        },
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
});

assert.match(
    serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
    /"kind": "updateReportDocumentConflictDiagnostic"/,
);
assert.doesNotMatch(
    serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
    /"document": \{/,
);

assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState(diagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Conflict diagnostic metadata summary.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Conflict diagnostic metadata summary.",
    kind: "updateReportDocumentConflictDiagnostic",
    code: "reportDocumentVersionConflict",
    severity: "error",
    reportId: "demoReportBuilder",
    expectedVersion: 7,
    currentVersion: 9,
    message: "Could not update Exploration Demo because expected version 7 does not match current saved version 9.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for conflict diagnostics.",
        },
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    content: serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
});

const staleCarriedConflictDiagnostic = buildReportBuilderUpdateReportDocumentConflictDiagnostic({
    ...updatePayload,
    semanticBindingViewState: {
        title: "Semantic Binding",
        chips: [
            "Model model://example/performance/delivery@v1",
            "Measures available_impressions",
        ],
        fieldGroups: [
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    {
                        id: "available_impressions",
                        rawId: "available_impressions",
                        label: "available_impressions",
                    },
                ],
            },
        ],
    },
    document: {
        ...updatePayload.document,
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Canonical Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Canonical Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date", category: "Time" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions" },
            ],
        },
    },
}, {
    currentVersion: "9",
    detectedAt: 9101,
});
assert.deepEqual(staleCarriedConflictDiagnostic.semanticBindingChips, [
    "Model Canonical Ad Delivery",
    "Entity Canonical Line Delivery",
    "Dimensions Canonical Delivery Date",
    "Measures Canonical Available Impressions",
    "Categories Time",
]);

const richerCarriedConflictDiagnostic = buildReportBuilderUpdateReportDocumentConflictDiagnostic({
    ...updatePayload,
    semanticBindingViewState: {
        title: "Semantic Binding",
        modelLabel: "Carried Ad Delivery",
        entityLabel: "Carried Line Delivery",
        chips: [
            "Model Carried Ad Delivery",
            "Entity Carried Line Delivery",
            "Dimensions Carried Delivery Date",
            "Measures Carried Available Impressions",
        ],
        fieldGroups: [
            {
                id: "dimensions",
                title: "Selected dimensions (1)",
                fields: [
                    {
                        id: "event_date",
                        rawId: "eventDate",
                        label: "Carried Delivery Date",
                        category: "Time",
                        definitionRef: "semantic://example/event_date",
                    },
                ],
            },
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    {
                        id: "available_impressions",
                        rawId: "avails",
                        label: "Carried Available Impressions",
                        definitionRef: "semantic://example/available_impressions",
                    },
                ],
            },
        ],
    },
}, {
    currentVersion: "9",
    detectedAt: 9102,
});
assert.deepEqual(richerCarriedConflictDiagnostic.semanticBindingChips, [
    "Model Carried Ad Delivery",
    "Entity Carried Line Delivery",
    "Dimensions Carried Delivery Date",
    "Measures Carried Available Impressions",
]);

assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload(diagnostic), {
    filename: "Exploration Demo-update-conflict-v7-current-v9.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
});

const audienceLegacyUpdatePayload = {
    ...audienceArtifactFixture.legacyUpdateReportDocumentPayload,
    reportSpec: audienceArtifactFixture.savedReportPayload.reportSpec,
};
const audienceDiagnostic = buildReportBuilderUpdateReportDocumentConflictDiagnostic(audienceLegacyUpdatePayload, {
    currentVersion: 14,
    detectedAt: 9380,
});
assert.equal(audienceDiagnostic.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceDiagnostic.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceDiagnostic.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    audienceDiagnostic.semanticBindingFieldGroups[1].fields[0].definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    audienceDiagnostic.semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);

const embeddedConflictDiagnostic = buildReportBuilderUpdateReportDocumentConflictDiagnostic({
    version: 1,
    kind: "updateReportDocumentPayload",
    updatedAt: 9200,
    reportRef: {
        reportId: "embeddedBindingUpdate",
    },
    expectedVersion: 7,
    title: "Embedded Binding Update",
    document: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedBindingUpdate",
        title: "Embedded Binding Update",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                source: {
                    kind: "dashboard.reportBuilder",
                    dataSourceRef: "demoReportSource",
                },
                config: {
                    dimensions: [
                        { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Delivery Date", category: "Time" },
                        { id: "channelV2", key: "channelV2", semanticRef: "channel", label: "Channel", category: "Delivery" },
                    ],
                    measures: [
                        { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", category: "Metrics" },
                    ],
                    staticFilters: [
                        {
                            id: "dateRange",
                            type: "dateRange",
                            label: "Reporting Window",
                            description: "Embedded conflict scope metadata.",
                            required: true,
                        },
                    ],
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date"],
                        selectedMeasures: ["available_impressions"],
                    },
                },
                state: {
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date", "channel"],
                        selectedMeasures: ["available_impressions"],
                    },
                    selectedDimensions: ["eventDate", "channelV2"],
                    selectedMeasures: ["avails"],
                    scopeParams: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                },
            },
        ],
    },
}, {
    currentVersion: 9,
    detectedAt: 9383,
});
assert.equal(embeddedConflictDiagnostic.semanticBindingChips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(embeddedConflictDiagnostic.scopeSummaryText, "Reporting Window");
assert.equal(embeddedConflictDiagnostic.scopeSummaryItems[0].description, "Embedded conflict scope metadata.");

const embeddedConflictDiagnosticWithEmptySpecScope = buildReportBuilderUpdateReportDocumentConflictDiagnostic({
    version: 1,
    kind: "updateReportDocumentPayload",
    updatedAt: 9201,
    reportRef: {
        reportId: "embeddedBindingUpdate",
    },
    expectedVersion: 7,
    title: "Embedded Binding Update",
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        scope: {
            params: [],
        },
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedBindingUpdate",
        title: "Embedded Binding Update",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                source: {
                    kind: "dashboard.reportBuilder",
                    dataSourceRef: "demoReportSource",
                },
                config: {
                    dimensions: [
                        { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Delivery Date", category: "Time" },
                        { id: "channelV2", key: "channelV2", semanticRef: "channel", label: "Channel", category: "Delivery" },
                    ],
                    measures: [
                        { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", category: "Metrics" },
                    ],
                    staticFilters: [
                        {
                            id: "dateRange",
                            type: "dateRange",
                            label: "Reporting Window",
                            description: "Embedded conflict scope metadata.",
                            required: true,
                        },
                    ],
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date"],
                        selectedMeasures: ["available_impressions"],
                    },
                },
                state: {
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date", "channel"],
                        selectedMeasures: ["available_impressions"],
                    },
                    selectedDimensions: ["eventDate", "channelV2"],
                    selectedMeasures: ["avails"],
                    scopeParams: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                },
            },
        ],
    },
}, {
    currentVersion: 9,
    detectedAt: 9384,
});
assert.equal(embeddedConflictDiagnosticWithEmptySpecScope.semanticBindingChips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(embeddedConflictDiagnosticWithEmptySpecScope.scopeSummaryText, "Reporting Window");
assert.equal(embeddedConflictDiagnosticWithEmptySpecScope.scopeSummaryItems[0].description, "Embedded conflict scope metadata.");

assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnostic(updatePayload, { currentVersion: 7 }), null);
assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnostic(null, { currentVersion: 9 }), null);
assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary(null), null);
assert.equal(serializeReportBuilderUpdateReportDocumentConflictDiagnostic(null), "");
assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState(null), null);
assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload(null), null);

console.log("reportBuilderUpdateReportDocumentConflictDiagnostic ✓ derives structured stale-version diagnostics from update payloads");
