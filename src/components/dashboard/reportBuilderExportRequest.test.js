import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderExportArtifactKindLabel,
    buildReportBuilderExportRequestDownload,
    buildReportBuilderExportRequestInspectorState,
    buildReportBuilderExportRequestSummary,
    resolveReportBuilderExportHandler,
    resolveReportBuilderReportStoreHandler,
    resolveReportBuilderSavedPayloadExportRequest,
    resolveReportBuilderSavedPayloadExportRequestBySource,
    serializeReportBuilderExportRequest,
} from "./reportBuilderExportRequest.js";
const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

assert.equal(buildReportBuilderExportArtifactKindLabel("reportBuilder.savedReportPayload"), "report-file artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("reportBuilder.explorationArtifact"), "draft-snapshot artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("dashboard.reportBuilder"), "draft builder");
assert.equal(buildReportBuilderExportArtifactKindLabel("getReportDocumentResponse"), "reopen-bundle artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("createReportDocumentPayload"), "create-request artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("updateReportDocumentPayload"), "update-request artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("reportBuilder.savedReportRecord"), "report-record artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("reportBuilder.savedView"), "saved-view artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("reportBuilder.publishedSnapshot"), "published-snapshot artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("reportDocument"), "report-document artifact");
assert.equal(buildReportBuilderExportArtifactKindLabel("custom.kind"), "custom.kind");
assert.equal(resolveReportBuilderExportHandler({
    handlers: {
        reportExport: {
            listJobs() {},
        },
    },
})?.listJobs instanceof Function, true);
assert.equal(resolveReportBuilderExportHandler({
    handlers: {
        reportExport: {
            getArtifact() {},
        },
    },
})?.getArtifact instanceof Function, true);
assert.equal(resolveReportBuilderExportHandler({
    handlers: {
        reportExport: {},
    },
}), null);
assert.equal(resolveReportBuilderReportStoreHandler({
    handlers: {
        reportStore: {
            saveReport() {},
        },
    },
})?.saveReport instanceof Function, true);
assert.equal(resolveReportBuilderReportStoreHandler({
    handlers: {
        reportStore: {},
    },
}), null);

const exportRequest = {
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedPayload",
        artifactKind: "reportBuilder.savedReportPayload",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        title: "Capacity Q3",
        reportId: "capacityQ3",
        payloadId: "rbreport_capacity_q3",
        sourceArtifactId: "capacity_q3",
        documentVersion: 4,
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        title: "Capacity Q3",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for export review.",
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
    },
    reportFill: {
        version: 1,
        kind: "reportFill",
    },
    reportPrint: {
        version: 1,
        kind: "reportPrint",
        title: "Capacity Q3",
    },
};

assert.deepEqual(buildReportBuilderExportRequestSummary(exportRequest), {
    title: "Capacity Q3",
    format: "PDF",
    from: "savedPayload",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    artifactKind: "reportBuilder.savedReportPayload",
    artifactKindLabel: "report-file artifact",
    payloadId: "rbreport_capacity_q3",
    reportId: "capacityQ3",
    documentVersion: 4,
    hasReportPrint: true,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
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
});

assert.match(
    serializeReportBuilderExportRequest(exportRequest),
    /"kind": "reportExportRequest"/,
);

assert.deepEqual(buildReportBuilderExportRequestInspectorState(exportRequest), {
    title: "Capacity Q3",
    format: "PDF",
    from: "savedPayload",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    artifactKind: "reportBuilder.savedReportPayload",
    artifactKindLabel: "report-file artifact",
    payloadId: "rbreport_capacity_q3",
    reportId: "capacityQ3",
    documentVersion: 4,
    hasReportPrint: true,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
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
    content: serializeReportBuilderExportRequest(exportRequest),
});

const shareableExportRequestSummary = buildReportBuilderExportRequestSummary(exportRequest, {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 9100,
            savedReportPayload: {
                version: 1,
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3",
                sourceArtifactId: "capacity_q3",
                lifecycle: "published",
                ownerRef: "team://analytics",
                policyRef: "policy://reports/certified",
                badges: [
                    { id: "certified", label: "Certified", tone: "success" },
                ],
                capabilities: {
                    view: true,
                    export: true,
                },
                grants: [
                    { principalRef: "team://finance", role: "viewer" },
                ],
                reportDocument: {
                    version: 1,
                    kind: "reportDocument",
                    id: "capacityQ3",
                    title: "Capacity Q3",
                },
                reportSpec: exportRequest.reportSpec,
            },
        },
    ],
});
assert.deepEqual(shareableExportRequestSummary.shareableMetaChips, [
    "published",
    "v4",
    "Owner team://analytics",
    "policy://reports/certified",
    "Certified",
    "Can View",
    "Can Export",
    "1 grant",
]);

const shareableExportRequestSummaryFromDirectRecord = buildReportBuilderExportRequestSummary(exportRequest, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3",
            documentVersion: 4,
            savedAt: 9100,
            lifecycle: "published",
            ownerRef: "team://analytics",
            badges: [
                { id: "certified", label: "Certified", tone: "success" },
            ],
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3",
                sourceArtifactId: "capacity_q3",
            },
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3",
            },
            reportSpec: exportRequest.reportSpec,
        },
    ],
});
assert.deepEqual(shareableExportRequestSummaryFromDirectRecord.shareableMetaChips, [
    "published",
    "v4",
    "Owner team://analytics",
    "Certified",
]);

const conflictingSavedPayloadExportSummary = buildReportBuilderExportRequestSummary(exportRequest, {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 9100,
            savedReportPayload: {
                version: 1,
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3",
                sourceArtifactId: "capacity_q3",
                sourceSession: {
                    sourceRef: {
                        templateId: "capacity_inventory_brief",
                        templateLabel: "Capacity Inventory Brief",
                    },
                },
                reportDocument: {
                    version: 1,
                    kind: "reportDocument",
                    id: "capacityQ3",
                    title: "Capacity Q3",
                    templateId: "market_brief",
                    templateLabel: "Market Brief",
                },
                reportSpec: exportRequest.reportSpec,
            },
        },
    ],
});
assert.deepEqual(conflictingSavedPayloadExportSummary, {
    title: "Capacity Q3",
    format: "PDF",
    from: "savedPayload",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    artifactKind: "reportBuilder.savedReportPayload",
    artifactKindLabel: "report-file artifact",
    payloadId: "rbreport_capacity_q3",
    reportId: "capacityQ3",
    documentVersion: 4,
    hasReportPrint: true,
    templateConflict: true,
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
    templateId: "market_brief",
    templateLabel: "Market Brief",
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
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
});
assert.deepEqual(buildReportBuilderExportRequestInspectorState(exportRequest, {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 9100,
            savedReportPayload: {
                version: 1,
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3",
                sourceArtifactId: "capacity_q3",
                sourceSession: {
                    sourceRef: {
                        templateId: "capacity_inventory_brief",
                        templateLabel: "Capacity Inventory Brief",
                    },
                },
                reportDocument: {
                    version: 1,
                    kind: "reportDocument",
                    id: "capacityQ3",
                    title: "Capacity Q3",
                    templateId: "market_brief",
                    templateLabel: "Market Brief",
                },
                reportSpec: exportRequest.reportSpec,
            },
        },
    ],
}), {
    ...conflictingSavedPayloadExportSummary,
    content: serializeReportBuilderExportRequest(exportRequest),
});

assert.deepEqual(buildReportBuilderExportRequestDownload(exportRequest), {
    filename: "Capacity Q3-savedPayload-pdf-export-request.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderExportRequest(exportRequest),
});

assert.equal(resolveReportBuilderExportHandler({
    handlers: {
        reportExport: {
            submitRequest() {},
        },
    },
}).submitRequest instanceof Function, true);
assert.equal(resolveReportBuilderExportHandler({ handlers: {} }), null);

const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3",
    sourceArtifactId: "capacity_q3",
    reportDocument: {
        id: "capacityQ3",
        title: "Capacity Q3",
    },
};

const matchingRichRecord = {
    savedReportPayload,
    exportRequest,
};

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequest(savedReportPayload, [matchingRichRecord]),
    exportRequest,
);

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequest(matchingRichRecord, []),
    exportRequest,
);

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequestBySource({
        payloadId: "rbreport_capacity_q3",
        sourceArtifactId: "capacity_q3",
        reportId: "capacityQ3",
    }, [matchingRichRecord]),
    exportRequest,
);

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequestBySource({
        source: {
            payloadId: "rbreport_capacity_q3",
            sourceArtifactId: "capacity_q3",
        },
    }, [matchingRichRecord]),
    exportRequest,
);

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequest({
        ...savedReportPayload,
        payloadId: "",
        sourceArtifactId: "",
    }, [matchingRichRecord]),
    exportRequest,
);

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequestBySource({
        from: "savedPayload",
        reportId: "capacityQ3",
    }, [matchingRichRecord]),
    exportRequest,
);

assert.equal(
    resolveReportBuilderSavedPayloadExportRequest({
        ...savedReportPayload,
        payloadId: "",
        sourceArtifactId: "",
    }, [
        matchingRichRecord,
        {
            savedReportPayload: {
                ...savedReportPayload,
                payloadId: "rbreport_capacity_q3_other",
                sourceArtifactId: "capacity_q3_other",
                reportDocument: {
                    ...savedReportPayload.reportDocument,
                    id: "capacityQ3",
                },
            },
            exportRequest: {
                ...exportRequest,
                source: {
                    ...exportRequest.source,
                    payloadId: "rbreport_capacity_q3_other",
                    sourceArtifactId: "capacity_q3_other",
                },
            },
        },
    ]),
    null,
);

assert.equal(
    resolveReportBuilderSavedPayloadExportRequestBySource({
        from: "savedPayload",
        reportId: "capacityQ3",
    }, [
        {
            reportId: "capacityQ3",
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3",
            },
            exportRequest: {
                ...exportRequest,
                source: {
                    ...exportRequest.source,
                    from: "savedView",
                    artifactKind: "reportBuilder.savedView",
                    sourceArtifactId: "saved_view_capacity_q3",
                },
            },
        },
    ]),
    null,
);

assert.equal(
    resolveReportBuilderSavedPayloadExportRequest({
        ...savedReportPayload,
        payloadId: "",
        sourceArtifactId: "other_artifact",
    }, [matchingRichRecord]),
    null,
);

const audienceExportSummary = buildReportBuilderExportRequestSummary(audienceArtifactFixture.reportExportRequest);
assert.equal(audienceExportSummary.format, "CSV");
assert.equal(audienceExportSummary.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceExportSummary.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceExportSummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    buildReportBuilderExportRequestInspectorState(audienceArtifactFixture.reportExportRequest).semanticBindingFieldGroups[1].fields[0].definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    buildReportBuilderExportRequestInspectorState(audienceArtifactFixture.reportExportRequest).semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);

const audiencePdfExportSummary = buildReportBuilderExportRequestSummary(audienceArtifactFixture.pdfReportExportRequest);
assert.equal(audiencePdfExportSummary.format, "PDF");
assert.equal(audiencePdfExportSummary.hasReportPrint, true);
assert.equal(audiencePdfExportSummary.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audiencePdfExportSummary.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);

const thinAudienceExportRequest = structuredClone(audienceArtifactFixture.reportExportRequest);
delete thinAudienceExportRequest.reportSpec.semanticSummary;
delete thinAudienceExportRequest.reportSpec.scope;
const recoveredAudienceExportSummary = buildReportBuilderExportRequestSummary(thinAudienceExportRequest, {
    localSavedPayloads: [
        {
            documentVersion: 13,
            savedAt: 9375,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
        },
    ],
});
assert.equal(recoveredAudienceExportSummary.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(recoveredAudienceExportSummary.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(recoveredAudienceExportSummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    buildReportBuilderExportRequestInspectorState(thinAudienceExportRequest, {
        localSavedPayloads: [
            {
                documentVersion: 13,
                savedAt: 9375,
                importedArtifactKind: "reportBuilder.savedReportPayload",
                savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
            },
        ],
    }).semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);

const structurallyThinAudienceExportRequest = structuredClone(audienceArtifactFixture.reportExportRequest);
structurallyThinAudienceExportRequest.reportSpec.semanticSummary = {
    kind: "semantic",
    selectedDimensions: [],
    selectedMeasures: [],
    selectedParameters: [],
};
structurallyThinAudienceExportRequest.reportSpec.scope = {
    params: [],
};
const structurallyRecoveredAudienceExportSummary = buildReportBuilderExportRequestSummary(structurallyThinAudienceExportRequest, {
    localSavedPayloads: [
        {
            documentVersion: 13,
            savedAt: 9375,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
        },
    ],
});
assert.equal(structurallyRecoveredAudienceExportSummary.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(structurallyRecoveredAudienceExportSummary.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(structurallyRecoveredAudienceExportSummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    buildReportBuilderExportRequestInspectorState(structurallyThinAudienceExportRequest, {
        localSavedPayloads: [
            {
                documentVersion: 13,
                savedAt: 9375,
                importedArtifactKind: "reportBuilder.savedReportPayload",
                savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
            },
        ],
    }).semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);

const carriedSemanticExportRequestSummary = buildReportBuilderExportRequestSummary({
    ...exportRequest,
    semanticBindingViewState: {
        title: "Semantic Binding",
        chips: [
            "Model Carried Delivery",
            "Measures Carried Spend",
        ],
        fieldGroups: [
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    { id: "spend", label: "Carried Spend", format: "currency" },
                ],
            },
        ],
    },
});
assert.deepEqual(carriedSemanticExportRequestSummary.semanticBindingChips, [
    "Model Ad Delivery",
    "Entity Line Delivery",
    "Dimensions Delivery Date, Channel",
    "Measures Available Impressions",
]);
assert.deepEqual(carriedSemanticExportRequestSummary.semanticBindingFieldGroups, [
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
]);

const titleOnlyCarriedSemanticExportRequestSummary = buildReportBuilderExportRequestSummary({
    ...exportRequest,
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        title: "Regional Revenue",
        scope: {
            params: [
                {
                    id: "reportingWindow",
                    label: "Reporting Window",
                },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/commerce/revenue@v1",
            entity: "store_performance",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/commerce/revenue@v1",
            modelLabel: "Revenue Operations",
            entity: "store_performance",
            entityLabel: "Store Performance",
            selectedMeasures: [
                { id: "net_revenue", rawId: "netRevenue", label: "Net Revenue" },
            ],
        },
    },
    semanticBindingViewState: {
        title: "Semantic Binding",
    },
});
assert.equal(titleOnlyCarriedSemanticExportRequestSummary.semanticBindingChips.includes("Model Revenue Operations"), true);
assert.equal(titleOnlyCarriedSemanticExportRequestSummary.semanticBindingChips.includes("Measures Net Revenue"), true);

const companionCarriedSemanticExportSummary = buildReportBuilderExportRequestSummary(thinAudienceExportRequest, {
    localSavedPayloads: [
        {
            documentVersion: 13,
            savedAt: 9375,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            savedReportPayload: {
                ...audienceArtifactFixture.legacySavedReportPayload,
                semanticBindingViewState: {
                    title: "Semantic Binding",
                    chips: [
                        "Model Companion Delivery",
                        "Measures Companion Audience Index",
                    ],
                    fieldGroups: [
                        {
                            id: "measures",
                            title: "Selected measures (1)",
                            fields: [
                                { id: "audience_index", label: "Companion Audience Index", format: "number" },
                            ],
                        },
                    ],
                },
            },
        },
    ],
});
assert.deepEqual(companionCarriedSemanticExportSummary.semanticBindingChips, [
    "Model Ad Delivery",
    "Entity Line Delivery",
    "Dimensions Market",
    "Measures Audience Index",
    "Parameters Date Range, Audience Segment",
    "Categories Location, Audience +1",
    "Lineage harmonizer://feature/location +2",
]);
assert.deepEqual(companionCarriedSemanticExportSummary.semanticBindingFieldGroups, [
    {
        id: "dimensions",
        title: "Selected dimensions (1)",
        fields: [
            {
                id: "country_code",
                label: "Market",
                rawId: "country",
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
                label: "Audience Index",
                rawId: "audienceIndex",
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
                label: "Date Range",
                rawId: "dateRange",
                category: "Scope",
            },
            {
                id: "audience_segment",
                label: "Audience Segment",
                rawId: "audienceSegmentFilter",
                category: "Audience",
                definitionRef: "harmonizer://feature/user.segment",
                governance: {
                    status: "approved",
                    classification: "harmonizer.audience",
                },
            },
        ],
    },
]);

assert.deepEqual(buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedView",
        artifactKind: "reportBuilder.savedView",
        artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
        title: "Capacity Q3 Saved View",
        reportId: "capacityQ3",
        sourceArtifactId: "saved_view_capacity_q3",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}), {
    title: "Capacity Q3 Saved View",
    format: "PDF",
    from: "savedView",
    artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
    artifactKind: "reportBuilder.savedView",
    artifactKindLabel: "saved-view artifact",
    payloadId: "",
    reportId: "capacityQ3",
    documentVersion: 8,
    hasReportPrint: true,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
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
});

const savedViewOverlayExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedView",
        artifactKind: "reportBuilder.savedView",
        artifactRef: "reportBuilder.savedView://saved_view_capacity_q3_overlay",
        title: "Capacity Q3 Saved View Overlay",
        reportId: "capacityQ3",
        sourceArtifactId: "saved_view_capacity_q3_overlay",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Saved View Overlay",
            documentVersion: 8,
            importedArtifactKind: "reportBuilder.savedView",
            lifecycle: "draft",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View Overlay",
            },
            reportSpec: exportRequest.reportSpec,
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3_overlay",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
                    documentVersion: 7,
                },
                overlay: {
                    filters: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                    presentation: {
                        viewMode: "table",
                    },
                },
            },
        },
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Base",
            documentVersion: 7,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Base",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_q3_base",
                reportId: "capacityQ3",
            },
        },
    ],
});
assert.deepEqual(savedViewOverlayExportSummary.savedViewOverlayChips, [
    "1 filter",
    "table view",
    "Base v7",
]);
assert.deepEqual(savedViewOverlayExportSummary.reopenSourceResolutionChips, [
    "Base report file capacity_q3_base • capacityQ3",
]);

const sourceLessSavedViewOverlayExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedView",
        artifactKind: "reportBuilder.savedView",
        artifactRef: "reportBuilder.savedView://saved_view_capacity_q3_overlay",
        title: "Capacity Q3 Saved View Overlay",
        reportId: "capacityQ3",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Saved View Overlay",
            documentVersion: 8,
            importedArtifactKind: "reportBuilder.savedView",
            lifecycle: "draft",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View Overlay",
            },
            reportSpec: exportRequest.reportSpec,
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3_overlay",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
                    documentVersion: 7,
                },
                overlay: {
                    filters: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                    presentation: {
                        viewMode: "table",
                    },
                },
            },
        },
    ],
});
assert.deepEqual(sourceLessSavedViewOverlayExportSummary.savedViewOverlayChips, [
    "1 filter",
    "table view",
    "Base v7",
]);
assert.equal(sourceLessSavedViewOverlayExportSummary.reopenSourceResolutionTitle, undefined);
assert.deepEqual(sourceLessSavedViewOverlayExportSummary.shareableMetaChips, [
    "draft",
    "v8",
]);

const ambiguousSourceLessSavedViewOverlayExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedView",
        artifactKind: "reportBuilder.savedView",
        artifactRef: "reportBuilder.savedView://saved_view_capacity_q3_overlay",
        title: "Capacity Q3 Saved View Overlay",
        reportId: "capacityQ3",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Saved View Overlay",
            documentVersion: 8,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View Overlay",
            },
            reportSpec: exportRequest.reportSpec,
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3_overlay",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
                    documentVersion: 7,
                },
                overlay: {
                    filters: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                    presentation: {
                        viewMode: "table",
                    },
                },
            },
        },
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Published Snapshot",
            documentVersion: 9,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityQ3",
                sourceArtifactId: "published_snapshot_capacity_q3",
            },
        },
    ],
});
assert.equal(ambiguousSourceLessSavedViewOverlayExportSummary.savedViewOverlayTitle, "Saved View Overlay");
assert.deepEqual(ambiguousSourceLessSavedViewOverlayExportSummary.savedViewOverlayChips, [
    "1 filter",
    "table view",
    "Base v7",
]);
assert.equal(ambiguousSourceLessSavedViewOverlayExportSummary.reopenSourceResolutionTitle, undefined);

const mismatchedSourceSavedViewExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedView",
        artifactKind: "reportBuilder.savedView",
        artifactRef: "reportBuilder.savedView://missing_saved_view",
        title: "Capacity Q3 Saved View Overlay",
        reportId: "capacityQ3",
        sourceArtifactId: "missing_saved_view",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Saved View Overlay",
            documentVersion: 8,
            importedArtifactKind: "reportBuilder.savedView",
            lifecycle: "draft",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View Overlay",
            },
            reportSpec: exportRequest.reportSpec,
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3_overlay",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
                    documentVersion: 7,
                },
                overlay: {
                    filters: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                    presentation: {
                        viewMode: "table",
                    },
                },
            },
        },
    ],
});
assert.equal(mismatchedSourceSavedViewExportSummary.savedViewOverlayTitle, undefined);
assert.equal(mismatchedSourceSavedViewExportSummary.shareableMetaChips, undefined);

const wrongKindSourceLessSavedViewExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedView",
        artifactKind: "reportBuilder.savedView",
        artifactRef: "reportBuilder.savedView://saved_view_capacity_q3_overlay",
        title: "Capacity Q3 Saved View Overlay",
        reportId: "capacityQ3",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Published Snapshot",
            documentVersion: 9,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            lifecycle: "published",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityQ3",
                sourceArtifactId: "published_snapshot_capacity_q3",
            },
        },
    ],
});
assert.equal(wrongKindSourceLessSavedViewExportSummary.savedViewOverlayTitle, undefined);
assert.equal(wrongKindSourceLessSavedViewExportSummary.shareableMetaChips, undefined);

const inferredKindSourceLessSavedViewExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedView",
        artifactRef: "reportBuilder.savedView://saved_view_capacity_q3_overlay",
        title: "Capacity Q3 Saved View Overlay",
        reportId: "capacityQ3",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Published Snapshot",
            documentVersion: 9,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            lifecycle: "published",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityQ3",
                sourceArtifactId: "published_snapshot_capacity_q3",
            },
        },
    ],
});
assert.equal(inferredKindSourceLessSavedViewExportSummary.savedViewOverlayTitle, undefined);
assert.equal(inferredKindSourceLessSavedViewExportSummary.shareableMetaChips, undefined);
assert.equal(inferredKindSourceLessSavedViewExportSummary.artifactKind, "reportBuilder.savedView");
assert.equal(inferredKindSourceLessSavedViewExportSummary.artifactKindLabel, "saved-view artifact");

const inferredKindSourceLessSavedPayloadExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedPayload",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3_overlay",
        title: "Capacity Q3 Report File",
        reportId: "capacityQ3",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Published Snapshot",
            documentVersion: 9,
            importedArtifactKind: "reportBuilder.savedView",
            lifecycle: "draft",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Published Snapshot",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3",
            },
        },
    ],
});
assert.equal(inferredKindSourceLessSavedPayloadExportSummary.savedViewOverlayTitle, undefined);
assert.equal(inferredKindSourceLessSavedPayloadExportSummary.shareableMetaChips, undefined);
assert.equal(inferredKindSourceLessSavedPayloadExportSummary.artifactKind, "reportBuilder.savedReportPayload");
assert.equal(inferredKindSourceLessSavedPayloadExportSummary.artifactKindLabel, "report-file artifact");

const conflictingSavedViewExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedView",
        artifactKind: "reportBuilder.savedView",
        artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
        title: "Capacity Q3 Saved View",
        reportId: "capacityQ3",
        sourceArtifactId: "saved_view_capacity_q3",
        documentVersion: 8,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Saved View",
            documentVersion: 8,
            importedArtifactKind: "reportBuilder.savedView",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View",
                templateId: "capacity_inventory_brief",
                templateLabel: "Capacity Inventory Brief",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3",
            },
        },
    ],
});
assert.equal(conflictingSavedViewExportSummary.templateConflict, true);
assert.equal(conflictingSavedViewExportSummary.templateConflictLabel, "template mismatch");
assert.equal(conflictingSavedViewExportSummary.templateLabel, "Market Brief");
assert.match(
    conflictingSavedViewExportSummary.templateConflictMessage,
    /Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief\./,
);

const conflictingPublishedSnapshotExportSummary = buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "publishedSnapshot",
        artifactKind: "reportBuilder.publishedSnapshot",
        artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
        title: "Capacity Q3 Published Snapshot",
        reportId: "capacityQ3",
        sourceArtifactId: "published_snapshot_capacity_q3",
        documentVersion: 9,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Published Snapshot",
            documentVersion: 9,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Published Snapshot",
                templateId: "capacity_inventory_brief",
                templateLabel: "Capacity Inventory Brief",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityQ3",
                sourceArtifactId: "published_snapshot_capacity_q3",
            },
        },
    ],
});
assert.equal(conflictingPublishedSnapshotExportSummary.templateConflict, true);
assert.equal(conflictingPublishedSnapshotExportSummary.templateConflictLabel, "template mismatch");
assert.equal(conflictingPublishedSnapshotExportSummary.templateLabel, "Market Brief");
assert.match(
    conflictingPublishedSnapshotExportSummary.templateConflictMessage,
    /Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief\./,
);

assert.deepEqual(buildReportBuilderExportRequestSummary({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "publishedSnapshot",
        artifactKind: "reportBuilder.publishedSnapshot",
        artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
        title: "Capacity Q3 Published Snapshot",
        reportId: "capacityQ3",
        sourceArtifactId: "published_snapshot_capacity_q3",
        documentVersion: 9,
    },
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    reportPrint: exportRequest.reportPrint,
}), {
    title: "Capacity Q3 Published Snapshot",
    format: "PDF",
    from: "publishedSnapshot",
    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
    artifactKind: "reportBuilder.publishedSnapshot",
    artifactKindLabel: "published-snapshot artifact",
    payloadId: "",
    reportId: "capacityQ3",
    documentVersion: 9,
    hasReportPrint: true,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
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
});

console.log("reportBuilderExportRequest ✓ resolves host export handlers and saved payload export requests");
