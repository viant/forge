import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderBulkImportFeedback,
    buildReportBuilderImportFeedback,
    buildReportBuilderListEntryCompatibilityFeedback,
    buildReportBuilderSemanticInlineNotices,
    buildReportBuilderSemanticIssueFeedback,
    buildReportBuilderPresetApplyFeedback,
    buildReportBuilderSelectedGetResponseFeedback,
    buildReportBuilderSemanticStatusFeedback,
    buildReportBuilderSemanticValidationFeedback,
    resolveCompactChartSheetNotice,
} from "./reportBuilderFeedback.js";
import { buildReportBuilderListReportDocumentsEntrySelectionKey } from "./reportBuilderReportDocumentReadResponse.js";
import { normalizeReportBuilderSavedReportRecord } from "./reportBuilderSavedReportRecords.js";
import { buildCapacityAudienceLandscapeFixtureState } from "../../reporting/fixtures/capacityAudienceLandscapeFixtureState.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);
const audienceLandscapeFixtureState = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "table",
    presetTitle: "Delivery Grid",
    selectionChanged: false,
}), {
    level: "info",
    message: "Applied Delivery Grid.",
});

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "table",
    presetTitle: "Delivery Grid",
    selectionChanged: true,
    didFetchPreparedState: true,
}), {
    level: "info",
    message: "Applied Delivery Grid. Refreshing results.",
    action: "",
});

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "tableCalc",
    presetTitle: "Reach Rank",
    selectionChanged: true,
    didFetchPreparedState: false,
    preparedReadiness: { canRun: true },
    requiresManualRun: true,
}), {
    level: "info",
    message: "Added Reach Rank. Run to refresh results.",
    action: "runReport",
});

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "chart",
    changedParts: ["measures", "breakdowns"],
    selectionChanged: true,
    didFetchPreparedState: false,
    preparedReadiness: { canRun: false, reason: "semantic", message: "Validating the semantic selection against the provider." },
    requiresManualRun: false,
}), {
    level: "info",
    message: "Applied this preset's required measures and breakdowns. Validating the semantic selection against the provider.",
    action: "",
});

assert.deepEqual(buildReportBuilderPresetApplyFeedback({
    kind: "chart",
    changedParts: ["measures"],
    selectionChanged: true,
    didFetchPreparedState: false,
    preparedReadiness: { canRun: true },
    requiresManualRun: true,
}), {
    level: "info",
    message: "Applied this preset's required measures. Run to refresh results.",
    action: "runReport",
});

assert.equal(buildReportBuilderSemanticStatusFeedback({
    semanticStatus: null,
    readiness: {},
}), null);

assert.deepEqual(buildReportBuilderSemanticStatusFeedback({
    semanticStatus: {
        level: "danger",
        title: "Semantic model error",
        message: "Semantic model metadata failed.",
    },
    readiness: {
        reason: "semantic",
        action: "retrySemanticModelLoad",
    },
}), {
    level: "danger",
    message: "Semantic model error: Semantic model metadata failed.",
    actionLabel: "Retry model load",
    action: "retrySemanticModelLoad",
});

assert.deepEqual(buildReportBuilderSemanticStatusFeedback({
    semanticStatus: {
        level: "info",
        title: "Semantic binding",
        message: "Ad Delivery • Entity: Line Delivery",
    },
    readiness: {
        reason: "semantic",
        action: "",
    },
}), {
    level: "info",
    message: "Semantic binding: Ad Delivery • Entity: Line Delivery",
    actionLabel: "",
    action: "",
});

assert.equal(buildReportBuilderSemanticValidationFeedback({
    readiness: {
        reason: "",
        message: "",
        action: "",
    },
    semanticStatusLevel: "info",
    semanticSelectedIssueCount: 0,
    semanticSelectionValidationState: {},
}), null);

assert.deepEqual(buildReportBuilderSemanticValidationFeedback({
    readiness: {
        reason: "semantic",
        message: "Semantic provider unavailable.",
        action: "retrySemanticValidation",
    },
    semanticStatusLevel: "info",
    semanticSelectedIssueCount: 0,
    semanticSelectionValidationState: {
        error: "Semantic provider unavailable.",
        valid: null,
    },
}), {
    level: "danger",
    message: "Semantic validation: Semantic provider unavailable.",
    actionLabel: "Retry validation",
    action: "retrySemanticValidation",
});

assert.deepEqual(buildReportBuilderSemanticValidationFeedback({
    readiness: {
        reason: "semantic",
        message: "Validating the semantic selection against the provider.",
        action: "",
    },
    semanticStatusLevel: "info",
    semanticSelectedIssueCount: 0,
    semanticSelectionValidationState: {
        error: "",
        valid: null,
    },
}), {
    level: "info",
    message: "Semantic validation: Validating the semantic selection against the provider.",
    actionLabel: "",
    action: "",
});

assert.equal(buildReportBuilderSemanticIssueFeedback({
    readiness: {
        reason: "",
    },
    semanticFieldValidationMessage: "",
    semanticSelectedIssueCount: 0,
}), null);

assert.deepEqual(buildReportBuilderSemanticIssueFeedback({
    readiness: {
        reason: "semantic",
    },
    semanticFieldValidationMessage: "Audience Age Group is not mapped to the semantic entity.",
    semanticSelectedIssueCount: 1,
}), {
    level: "danger",
    message: "Semantic selection issue: Audience Age Group is not mapped to the semantic entity.",
    actionLabel: "",
    action: "",
});

assert.deepEqual(buildReportBuilderSemanticInlineNotices({
    semanticStatus: {
        level: "danger",
        title: "Semantic model error",
        message: "Semantic model metadata failed.",
    },
    readiness: {
        reason: "semantic",
        message: "Semantic model metadata failed.",
        action: "retrySemanticModelLoad",
    },
    semanticFieldValidationMessage: "",
    semanticSelectedIssueCount: 0,
    semanticSelectionValidationState: {},
}), [
    {
        level: "danger",
        message: "Semantic model error: Semantic model metadata failed.",
        actionLabel: "Retry model load",
        action: "retrySemanticModelLoad",
    },
]);

assert.deepEqual(buildReportBuilderSemanticInlineNotices({
    semanticStatus: {
        level: "info",
        title: "Semantic binding",
        message: "Ad Delivery • Entity: Line Delivery",
    },
    readiness: {
        reason: "semantic",
        message: "Semantic provider unavailable.",
        action: "retrySemanticValidation",
    },
    semanticFieldValidationMessage: "",
    semanticSelectedIssueCount: 0,
    semanticSelectionValidationState: {
        error: "Semantic provider unavailable.",
        valid: null,
    },
}), [
    {
        level: "info",
        message: "Semantic binding: Ad Delivery • Entity: Line Delivery",
        actionLabel: "",
        action: "",
    },
    {
        level: "danger",
        message: "Semantic validation: Semantic provider unavailable.",
        actionLabel: "Retry validation",
        action: "retrySemanticValidation",
    },
]);

assert.deepEqual(buildReportBuilderSemanticInlineNotices({
    semanticStatus: {
        level: "info",
        title: "Semantic binding",
        message: "Ad Delivery • Entity: Line Delivery",
    },
    readiness: {
        reason: "semantic",
        message: "Resolve semantic field issues before running the report.",
        action: "",
    },
    semanticFieldValidationMessage: "Audience Age Group is not mapped to the semantic entity.",
    semanticSelectedIssueCount: 1,
    semanticSelectionValidationState: {
        error: "",
        valid: null,
    },
}), [
    {
        level: "info",
        message: "Semantic binding: Ad Delivery • Entity: Line Delivery",
        actionLabel: "",
        action: "",
    },
    {
        level: "danger",
        message: "Semantic selection issue: Audience Age Group is not mapped to the semantic entity.",
        actionLabel: "",
        action: "",
    },
]);

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "reportSpec",
    message: "Imported ReportSpec Capacity KPI Blend Q3. Compiled local runtime preview is ready.",
    blockCount: 6,
    datasetCount: 1,
    payload: {
        kind: "reportSpec",
        title: "Capacity KPI Blend Q3",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported runtime preview.",
                },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
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
        blocks: [{ id: "block-1" }, { id: "block-2" }, { id: "block-3" }, { id: "block-4" }, { id: "block-5" }, { id: "block-6" }],
        datasets: [{ id: "primary" }],
    },
}), {
    level: "success",
    message: "Imported ReportSpec Capacity KPI Blend Q3. Compiled local runtime preview is ready.",
    metaChips: ["6 blocks", "1 dataset"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
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
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for imported runtime preview.",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "reportFill",
    message: "Imported ReportFill capacity-kpi-blend.report-fill. Inspect or download is ready.",
    datasetCount: 1,
    blockCount: 6,
    rowCount: 8,
}), {
    level: "success",
    message: "Imported ReportFill capacity-kpi-blend.report-fill. Inspect or download is ready.",
    metaChips: ["1 dataset", "6 blocks", "8 rows"],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "getReportDocumentResponse",
    message: "Imported reopen artifact Capacity Audience Segment Index Q3 is now the active reopen artifact.",
    documentVersion: audienceArtifactFixture.getReportDocumentResponse.documentVersion,
    payload: audienceArtifactFixture.getReportDocumentResponse,
}), {
    level: "success",
    message: "Imported reopen artifact Capacity Audience Segment Index Q3 is now the active reopen artifact.",
    metaChips: ["v13"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "getReportDocumentResponse",
    message: "Imported reopen artifact Capacity Trend Imported is now the active reopen artifact.",
    documentVersion: 12,
    payload: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendImported" },
        documentVersion: 12,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendImported",
            title: "Capacity Trend Imported",
            templateId: "capacity_inventory_brief",
            templateLabel: "Capacity Inventory Brief",
        },
    },
}), {
    level: "warning",
    message: "Imported reopen artifact Capacity Trend Imported is now the active reopen artifact. Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
    metaChips: ["v12", "template mismatch"],
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "listReportDocumentsResponse",
    payload: audienceLandscapeFixtureState.listReportDocumentsResponse,
    entryCount: 1,
    selectedReportId: "capacityAudienceSegmentIndexQ3",
    message: "Imported listReportDocuments response with 1 entry.",
}), {
    level: "success",
    message: "Imported listReportDocuments response with 1 entry.",
    metaChips: ["1 entry"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

const duplicateImportedListEntries = [
    {
        reportRef: { reportId: "capacityShared" },
        documentVersion: 8,
        title: "Capacity Shared Saved View",
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Line Delivery",
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Saved View Impressions" },
            ],
        },
    },
    {
        reportRef: { reportId: "capacityShared" },
        documentVersion: 9,
        title: "Capacity Shared Published Snapshot",
        source: {
            kind: "reportBuilder.publishedSnapshot",
            reportId: "capacityShared",
            sourceArtifactId: "published_snapshot_capacity_shared",
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Line Delivery",
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Published Snapshot Impressions" },
            ],
        },
    },
];
const duplicateImportedSelectionKey = buildReportBuilderListReportDocumentsEntrySelectionKey(
    duplicateImportedListEntries[1],
);
const duplicateImportedFeedback = buildReportBuilderImportFeedback({
    valid: true,
    kind: "listReportDocumentsResponse",
    entryCount: 2,
    selectedEntryKey: duplicateImportedSelectionKey,
    selectedReportId: "capacityShared",
    payload: {
        version: 1,
        kind: "listReportDocumentsResponse",
        entries: duplicateImportedListEntries,
    },
    message: "Imported listReportDocuments response with 2 entries.",
});
assert.equal(duplicateImportedFeedback.semanticBindingChips.includes("Measures Published Snapshot Impressions"), true);
assert.equal(duplicateImportedFeedback.semanticBindingChips.includes("Measures Saved View Impressions"), false);

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "listReportDocumentsResponse",
    entryCount: 1,
    selectedReportId: "importedOnlyTrendQ3",
    payload: {
        version: 1,
        kind: "listReportDocumentsResponse",
        entries: [
            {
                reportRef: { reportId: "importedOnlyTrendQ3" },
                documentVersion: 6,
                title: "Imported Only Trend Q3",
                subtitle: "Imported list entry",
                description: "Local list import without a backing saved payload.",
                binding: {
                    mode: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    entity: "line_delivery",
                },
                semanticSummary: {
                    kind: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    modelLabel: "Imported Ad Delivery",
                    entity: "line_delivery",
                    entityLabel: "Imported Line Delivery",
                    selectedDimensions: [
                        {
                            id: "event_date",
                            rawId: "eventDate",
                            label: "Imported Delivery Date",
                            category: "Time",
                        },
                    ],
                    selectedMeasures: [
                        {
                            id: "available_impressions",
                            rawId: "avails",
                            label: "Imported Available Impressions",
                            category: "Metrics",
                            governance: {
                                ownerRef: "team://example/performance",
                            },
                        },
                    ],
                    selectedParameters: [
                        {
                            id: "reporting_window",
                            rawId: "dateRange",
                            label: "Imported Reporting Window",
                            category: "Scope",
                        },
                    ],
                },
                scope: {
                    dataSourceRef: "demoReportSource",
                    params: [
                        {
                            id: "dateRange",
                            kind: "dateRange",
                            label: "Imported Reporting Window",
                            description: "Imported list scope metadata.",
                        },
                    ],
                },
            },
        ],
    },
    message: "Imported listReportDocuments response with 1 entry.",
}), {
    level: "success",
    message: "Imported listReportDocuments response with 1 entry.",
    metaChips: ["1 entry"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Imported Ad Delivery",
        "Entity Imported Line Delivery",
        "Dimensions Imported Delivery Date",
        "Measures Imported Available Impressions",
        "Parameters Imported Reporting Window",
        "Categories Time, Metrics +1",
        "Owner team://example/performance",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "event_date",
                    rawId: "eventDate",
                    label: "Imported Delivery Date",
                    category: "Time",
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
                    label: "Imported Available Impressions",
                    category: "Metrics",
                    governance: {
                        ownerRef: "team://example/performance",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (1)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Imported Reporting Window",
                    category: "Scope",
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Imported Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Imported Reporting Window",
            description: "Imported list scope metadata.",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "getReportDocumentResponse",
    feedbackLevel: "info",
    message: "Imported reopen artifact Capacity Audience Segment Index Q3 removed from imported local artifacts.",
    documentVersion: audienceArtifactFixture.getReportDocumentResponse.documentVersion,
    payload: audienceArtifactFixture.getReportDocumentResponse,
}), {
    level: "info",
    message: "Imported reopen artifact Capacity Audience Segment Index Q3 removed from imported local artifacts.",
    metaChips: ["v13"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

const thinAudienceCreatePayload = {
    ...audienceArtifactFixture.legacyCreateReportDocumentPayload,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityAudienceSegmentIndexQ3",
        title: "Capacity Audience Segment Index Q3",
        subtitle: "",
        description: "",
    },
};

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "createReportDocumentPayload",
    message: "Imported createReportDocument payload Capacity Audience Segment Index Q3.",
    payload: thinAudienceCreatePayload,
    getReportDocumentResponse: audienceArtifactFixture.getReportDocumentResponse,
}), {
    level: "success",
    message: "Imported createReportDocument payload Capacity Audience Segment Index Q3.",
    metaChips: ["clean", "5 blocks", "1 dataset"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

const structurallyThinAudienceCreatePayload = {
    ...thinAudienceCreatePayload,
    reportSpec: {
        ...thinAudienceCreatePayload.reportSpec,
        semanticSummary: {
            kind: "semantic",
            selectedDimensions: [],
            selectedMeasures: [],
            selectedParameters: [],
        },
        scope: {
            params: [],
        },
    },
};

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "createReportDocumentPayload",
    message: "Imported createReportDocument payload Capacity Audience Segment Index Q3.",
    payload: structurallyThinAudienceCreatePayload,
    getReportDocumentResponse: audienceArtifactFixture.getReportDocumentResponse,
}), {
    level: "success",
    message: "Imported createReportDocument payload Capacity Audience Segment Index Q3.",
    metaChips: ["clean", "5 blocks", "1 dataset"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "reportBuilder.savedReportPayload",
    message: "Imported saved report payload Capacity Audience Segment Index Q3.",
    payload: {
        ...audienceArtifactFixture.legacySavedReportPayload,
        reportSpec: {},
    },
}), {
    level: "success",
    message: "Imported saved report payload Capacity Audience Segment Index Q3.",
    metaChips: ["5 blocks", "1 dataset"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model model://example/performance/delivery@v1",
        "Entity line_delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

const thinAudienceUpdatePayload = {
    ...audienceArtifactFixture.legacyUpdateReportDocumentPayload,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityAudienceSegmentIndexQ3",
        title: "Capacity Audience Segment Index Q3",
        subtitle: "",
        description: "",
    },
};

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "updateReportDocumentPayload",
    message: "Imported updateReportDocument payload Capacity Audience Segment Index Q3.",
    expectedVersion: 13,
    payload: thinAudienceUpdatePayload,
    getReportDocumentResponse: audienceArtifactFixture.getReportDocumentResponse,
}), {
    level: "success",
    message: "Imported updateReportDocument payload Capacity Audience Segment Index Q3.",
    metaChips: ["expected v13", "clean", "5 blocks", "1 dataset"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

const audienceDocumentOnlyGetResponse = {
    ...audienceArtifactFixture.getReportDocumentResponse,
    document: {
        ...audienceArtifactFixture.getReportDocumentResponse.document,
    },
};
delete audienceDocumentOnlyGetResponse.reportSpec;
assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "getReportDocumentResponse",
    message: "Imported reopen artifact Capacity Audience Segment Index Q3 is now the active reopen artifact.",
    documentVersion: audienceDocumentOnlyGetResponse.documentVersion,
    payload: audienceDocumentOnlyGetResponse,
}), {
    level: "success",
    message: "Imported reopen artifact Capacity Audience Segment Index Q3 is now the active reopen artifact.",
    metaChips: ["v13"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "getReportDocumentResponse",
    message: "Imported embedded local reopenable Embedded Binding Trend Q3 is ready.",
    documentVersion: 4,
    payload: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "embeddedBindingTrendQ3" },
        documentVersion: 4,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "embeddedBindingTrendQ3",
            title: "Embedded Binding Trend Q3",
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
                            { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", category: "Metrics", format: "compactNumber" },
                        ],
                        staticFilters: [
                            {
                                id: "dateRange",
                                type: "dateRange",
                                label: "Reporting Window",
                                description: "Embedded feedback scope metadata.",
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
                        staticFilters: {
                            dateRange: {
                                start: "2026-05-01",
                                end: "2026-05-04",
                            },
                        },
                    },
                },
            ],
        },
    },
}), {
    level: "success",
    message: "Imported embedded local reopenable Embedded Binding Trend Q3 is ready.",
    metaChips: ["v4"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model model://example/performance/delivery@v1",
        "Entity line_delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
        "Categories Time, Delivery +1",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time" },
                { id: "channel", rawId: "channelV2", label: "Channel", category: "Delivery" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Embedded feedback scope metadata.",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "reportBuilder.savedReportRecord",
    message: "Imported report file Capacity Audience Segment Index Q3 is now the active report file.",
    documentVersion: normalizeReportBuilderSavedReportRecord(audienceArtifactFixture.savedReportRecord).documentVersion,
    exportable: true,
    savedRecord: normalizeReportBuilderSavedReportRecord(audienceArtifactFixture.savedReportRecord),
}), {
    level: "success",
    message: "Imported report file Capacity Audience Segment Index Q3 is now the active report file.",
    metaChips: ["v13", "export-ready", "5 blocks", "1 dataset"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "reportBuilder.savedReportRecord",
    message: "Imported report file Capacity Trend Imported is now the active report file.",
    documentVersion: 6,
    exportable: false,
    savedRecord: {
        reportId: "capacityTrendImported",
        title: "Capacity Trend Imported",
        documentVersion: 6,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendImported",
            title: "Capacity Trend Imported",
            templateId: "capacity_inventory_brief",
            templateLabel: "Capacity Inventory Brief",
        },
    },
}), {
    level: "warning",
    message: "Imported report file Capacity Trend Imported is now the active report file. Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
    metaChips: ["v6", "reopen-ready", "template mismatch"],
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
});

assert.deepEqual(buildReportBuilderSelectedGetResponseFeedback({
    response: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendImported" },
        documentVersion: 12,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendImported",
            title: "Capacity Trend Imported",
        },
        compileState: {
            status: "clean",
            diagnostics: [
                {
                    code: "selectedGetTemplateIdentityConflict",
                    severity: "warning",
                    path: "document.templateId",
                    message: "Selected catalog entry template Market Brief does not match the local reopen artifact template Capacity Inventory Brief.",
                },
            ],
        },
    },
}), {
    level: "warning",
    message: "Prepared reopen bundle for capacityTrendImported. Selected catalog entry template Market Brief does not match the local reopen artifact template Capacity Inventory Brief.",
    metaChips: ["v12", "Market Brief", "template mismatch"],
});

assert.deepEqual(buildReportBuilderListEntryCompatibilityFeedback({
    selectedEntry: {
        reportId: "capacityTrendImported",
        title: "Capacity Trend Imported",
        templateConflict: true,
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief.",
        templateLabel: "Market Brief",
        backingState: "reopen-ready",
        backingSource: "imported get-response",
        backingArtifactKindLabel: "get-response artifact",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
        semanticBindingFieldGroups: [{ id: "dimensions", title: "Selected dimensions (1)", fields: [{ id: "event_date", label: "Delivery Date" }] }],
        scopeSummaryTitle: "Report Scope",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [{ id: "dateRange", label: "Reporting Window" }],
    },
}), {
    level: "warning",
    message: "Selected catalog entry Capacity Trend Imported has a template mismatch with its local backing report file. Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief.",
    metaChips: ["Market Brief", "template mismatch", "reopen-ready", "imported get-response", "get-response artifact"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    semanticBindingFieldGroups: [{ id: "dimensions", title: "Selected dimensions (1)", fields: [{ id: "event_date", label: "Delivery Date" }] }],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [{ id: "dateRange", label: "Reporting Window" }],
});

assert.deepEqual(buildReportBuilderListEntryCompatibilityFeedback({
    diagnostic: {
        title: "Capacity Trend Imported",
        reportRef: { reportId: "capacityTrendImported" },
        code: "missingReportSpec",
        severity: "warning",
    },
}), {
    level: "warning",
    message: "Prepared reopen diagnostic for Capacity Trend Imported. Review or download it when needed.",
    metaChips: ["capacityTrendImported", "missingReportSpec", "warning"],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "reportBuilder.savedReportRecord",
    feedbackLevel: "info",
    message: "Imported report file Capacity Audience Segment Index Q3 removed from imported local files.",
    documentVersion: normalizeReportBuilderSavedReportRecord(audienceArtifactFixture.savedReportRecord).documentVersion,
    exportable: true,
    savedRecord: normalizeReportBuilderSavedReportRecord(audienceArtifactFixture.savedReportRecord),
}), {
    level: "info",
    message: "Imported report file Capacity Audience Segment Index Q3 removed from imported local files.",
    metaChips: ["v13", "export-ready", "5 blocks", "1 dataset"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "reportExportRequest",
    message: "Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.",
    from: "savedPayload",
    format: "CSV",
    payload: audienceArtifactFixture.reportExportRequest,
}), {
    level: "success",
    message: "Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.",
    metaChips: ["savedPayload", "CSV"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

assert.deepEqual(buildReportBuilderImportFeedback({
    valid: true,
    kind: "reportExportRequest",
    message: "Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.",
    from: "savedPayload",
    format: "PDF",
    payload: {
        ...audienceArtifactFixture.pdfReportExportRequest,
        __validationErrors: [
            {
                path: "$.reportPrint.fillHash",
                code: "invalidContract",
                message: "ReportPrint fillHash must match reportFill.",
            },
            {
                path: "$.reportPrint.source",
                code: "invalidContract",
                message: "ReportPrint source must match reportSpec.source.",
            },
        ],
    },
}), {
    level: "success",
    message: "Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.",
    metaChips: ["savedPayload", "PDF", "2 contract issues"],
    validationDiagnostics: [
        {
            id: "invalidContract:0",
            code: "invalidContract",
            path: "$.reportPrint.fillHash",
            message: "ReportPrint fillHash must match reportFill.",
        },
        {
            id: "invalidContract:1",
            code: "invalidContract",
            path: "$.reportPrint.source",
            message: "ReportPrint source must match reportSpec.source.",
        },
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "country_code",
                    rawId: "country",
                    label: "Market",
                    category: "Location",
                    definitionRef: "harmonizer://feature/location",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                    format: "number",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (2)",
            fields: [
                {
                    id: "reporting_window",
                    rawId: "dateRange",
                    label: "Date Range",
                    category: "Scope",
                },
                {
                    id: "audience_segment",
                    rawId: "audienceSegmentFilter",
                    label: "Audience Segment",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
});

assert.deepEqual(buildReportBuilderBulkImportFeedback({
    kind: "reopenables",
    count: 2,
    clearedCurrentGetResponse: true,
}), {
    level: "info",
    message: "Cleared imported reopen artifacts.",
    metaChips: ["2 artifacts", "active reopen artifact cleared"],
});

assert.deepEqual(buildReportBuilderBulkImportFeedback({
    kind: "savedRecords",
    count: 3,
    clearedCurrentSavedRecord: true,
    clearedCurrentGetResponse: false,
}), {
    level: "info",
    message: "Cleared imported report files.",
    metaChips: ["3 records", "active report file cleared"],
});

assert.deepEqual(resolveCompactChartSheetNotice({
    chartApplyFeedback: {
        level: "info",
        message: "Applied Delivery Grid.",
    },
    semanticSelectedIssueCount: 2,
    readinessReason: "semantic",
}), {
    level: "info",
    message: "Applied Delivery Grid.",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    chartApplyFeedback: null,
    semanticSelectedIssueCount: 1,
    semanticFieldValidationMessage: "Audience Age Group is not allowed here.",
    readinessReason: "semantic",
}), {
    level: "danger",
    message: "Semantic selection issue: Audience Age Group is not allowed here.",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    semanticSelectedIssueCount: 0,
    readinessReason: "semantic",
    readinessMessage: "Validating the semantic selection against the provider.",
    semanticStatusLevel: "info",
    semanticSelectionValidationError: "",
    semanticSelectionValidationValid: null,
}), {
    level: "info",
    message: "Semantic validation: Validating the semantic selection against the provider.",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    semanticSelectedIssueCount: 0,
    readinessReason: "semantic",
    readinessMessage: "The semantic provider rejected this selection.",
    semanticStatusLevel: "info",
    semanticSelectionValidationError: "boom",
    semanticSelectionValidationValid: false,
}), {
    level: "danger",
    message: "Semantic validation: The semantic provider rejected this selection.",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    showingChartView: false,
    activeTablePresetTitle: "Delivery Grid",
}), {
    level: "info",
    message: "Active table preset: Delivery Grid",
});

assert.deepEqual(resolveCompactChartSheetNotice({
    showingChartView: false,
    modifiedTablePresetTitle: "Delivery Grid",
}), {
    level: "warning",
    message: "Modified from Delivery Grid. Use Quick view to restore the named table preset.",
});

assert.equal(resolveCompactChartSheetNotice({
    showingChartView: true,
    activeTablePresetTitle: "Delivery Grid",
}), null);

console.log("reportBuilderFeedback ✓ compact chart-sheet notice precedence");
