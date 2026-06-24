import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    matchesReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedReportRecord,
    normalizeReportBuilderSavedReportRecords,
    resolveReportBuilderSavedReportRecordByReportId,
    resolveReportBuilderSavedReportRecordBySource,
} from "./reportBuilderSavedReportRecords.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3",
    savedAt: 9100,
    title: "Capacity Q3",
    sourceArtifactId: "capacity_q3_inventory_ladder",
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
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

const exportRequest = {
    version: 1,
    kind: "reportExportRequest",
    target: { format: "pdf" },
    source: {
        from: "savedPayload",
        artifactKind: "reportBuilder.savedReportPayload",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        title: "Capacity Q3",
        payloadId: "rbreport_capacity_q3",
        sourceArtifactId: "capacity_q3_inventory_ladder",
        reportId: "capacityQ3",
        documentVersion: 4,
    },
    reportSpec: savedReportPayload.reportSpec,
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

assert.deepEqual(normalizeReportBuilderSavedPayloadSourceIdentity(savedReportPayload), {
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3",
    sourceArtifactId: "capacity_q3_inventory_ladder",
    reportId: "capacityQ3",
});

assert.equal(matchesReportBuilderSavedPayloadSourceIdentity(
    { kind: "reportBuilder.savedReportPayload", payloadId: "rbreport_capacity_q3", sourceArtifactId: "capacity_q3_inventory_ladder", reportId: "capacityQ3" },
    { kind: "reportBuilder.savedReportPayload", payloadId: "rbreport_capacity_q3", sourceArtifactId: "other", reportId: "other" },
), true);
assert.equal(matchesReportBuilderSavedPayloadSourceIdentity(
    { kind: "reportBuilder.savedView", sourceArtifactId: "shared_artifact", reportId: "capacityQ3" },
    { kind: "reportBuilder.publishedSnapshot", sourceArtifactId: "shared_artifact", reportId: "capacityQ3" },
), false);

const normalizedPlainRecord = normalizeReportBuilderSavedReportRecord(savedReportPayload, {
    documentVersion: 4,
});
assert.equal(normalizedPlainRecord.reportId, "capacityQ3");
assert.equal(normalizedPlainRecord.templateId, "capacity_inventory_brief");
assert.equal(normalizedPlainRecord.exportable, false);

const normalizedExplicitTemplateRecord = normalizeReportBuilderSavedReportRecord({
    ...savedReportPayload,
    reportDocument: {
        ...savedReportPayload.reportDocument,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        blocks: [],
    },
}, {
    documentVersion: 4,
});
assert.equal(normalizedExplicitTemplateRecord.templateId, "market_brief");
assert.equal(normalizedExplicitTemplateRecord.templateLabel, "Market Brief");

const normalizedRichRecord = normalizeReportBuilderSavedReportRecord({
    documentVersion: 4,
    savedReportPayload,
    exportRequest,
    importedArtifactKind: "reportBuilder.savedReportRecord",
});
assert.equal(normalizedRichRecord.exportable, true);
assert.equal(normalizedRichRecord.exportRequest.source.payloadId, "rbreport_capacity_q3");
assert.equal(normalizedRichRecord.importedArtifactKind, "reportBuilder.savedReportRecord");

const normalizedRecords = normalizeReportBuilderSavedReportRecords([
    savedReportPayload,
    {
        documentVersion: 4,
        savedReportPayload,
        exportRequest,
    },
]);
assert.equal(normalizedRecords.length, 2);
assert.equal(resolveReportBuilderSavedReportRecordByReportId(normalizedRecords, "capacityQ3")?.reportId, "capacityQ3");
assert.equal(resolveReportBuilderSavedReportRecordBySource(normalizedRecords, {
    payloadId: "rbreport_capacity_q3",
})?.exportRequest?.source?.payloadId, "rbreport_capacity_q3");

const embeddedSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_embedded_binding_saved_payload",
    sourceArtifactId: "embedded_binding_saved_payload",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedBindingSavedPayload",
        title: "Embedded Binding Saved Payload",
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
                            description: "Embedded saved-record scope metadata.",
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
};

const normalizedEmbeddedRecord = normalizeReportBuilderSavedReportRecord(embeddedSavedReportPayload, {
    documentVersion: 5,
});
assert.equal(normalizedEmbeddedRecord.reportSpec.kind, "reportSpec");
assert.equal(normalizedEmbeddedRecord.document.binding.modelRef, "model://example/performance/delivery@v1");
assert.equal(normalizedEmbeddedRecord.document.semanticSummary.selectedDimensions[1].label, "Channel");
assert.equal(normalizedEmbeddedRecord.document.scope.params[0].label, "Reporting Window");
assert.equal(normalizedEmbeddedRecord.compileState.reportSpecVersion, 1);
assert.equal(normalizedEmbeddedRecord.compileState.blockCount, 2);

const normalizedEmbeddedRecordWithEmptySpec = normalizeReportBuilderSavedReportRecord({
    ...embeddedSavedReportPayload,
    reportSpec: {},
}, {
    documentVersion: 5,
});
assert.equal(normalizedEmbeddedRecordWithEmptySpec.reportSpec.kind, "reportSpec");
assert.equal(normalizedEmbeddedRecordWithEmptySpec.document.binding.modelRef, "model://example/performance/delivery@v1");
assert.equal(normalizedEmbeddedRecordWithEmptySpec.document.semanticSummary.selectedDimensions[1].label, "Channel");
assert.equal(normalizedEmbeddedRecordWithEmptySpec.document.scope.params[0].label, "Reporting Window");

const audienceSavedRecord = normalizeReportBuilderSavedReportRecord(
    audienceArtifactFixture.savedReportRecord,
    { documentVersion: 13 },
);
assert.equal(audienceSavedRecord.exportable, true);
assert.deepEqual(
    audienceSavedRecord.savedReportPayload.reportSpec?.semanticSummary?.selectedMeasures?.find((field) => field?.id === "audience_index"),
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
);
assert.deepEqual(
    audienceSavedRecord.savedReportPayload.reportSpec?.semanticSummary?.selectedParameters?.find((field) => field?.id === "audience_segment"),
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
);

console.log("reportBuilderSavedReportRecords ✓ normalizes plain and rich saved report records with shared source identity");
