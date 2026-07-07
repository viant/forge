import assert from "node:assert/strict";

import {
    buildImportedLocalReopenablePanelSeedEntry,
    buildImportedLocalSavedRecordPanelSeedEntry,
} from "./reportBuilderImportedArtifactPanelSeed.js";

const carriedSemanticBindingViewState = {
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
};

const reopenableSeed = buildImportedLocalReopenablePanelSeedEntry({
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "canonicalImportedDeliveryTrend",
    },
    documentVersion: 7,
    importedArtifactKind: "getReportDocumentResponse",
    semanticBindingViewState: carriedSemanticBindingViewState,
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date"],
            selectedMeasures: ["available_impressions"],
        },
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "canonicalImportedDeliveryTrend",
        title: "Canonical Imported Delivery Trend",
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
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date"],
            selectedMeasures: ["available_impressions"],
        },
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Canonical Reporting Window",
                },
            ],
        },
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_canonical_imported_delivery_trend",
        sourceArtifactId: "canonical_imported_delivery_trend",
    },
});

assert.equal(reopenableSeed.id, "reportBuilder.savedReportPayload::rbreport_canonical_imported_delivery_trend::canonical_imported_delivery_trend::canonicalImportedDeliveryTrend");
assert.equal(reopenableSeed.title, "Canonical Imported Delivery Trend");
assert.equal(reopenableSeed.semanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(reopenableSeed.semanticSummary.entityLabel, "Canonical Line Delivery");
assert.equal(reopenableSeed.semanticSummary.selectedMeasures[0].label, "Canonical Available Impressions");
assert.equal(reopenableSeed.binding.modelRef, "model://example/performance/delivery@v1");
assert.equal(reopenableSeed.scopeParams[0].label, "Canonical Reporting Window");
assert.deepEqual(reopenableSeed.semanticBindingViewState, carriedSemanticBindingViewState);

const savedRecordSeed = buildImportedLocalSavedRecordPanelSeedEntry({
    id: "reportBuilder.savedReportPayload::rbreport_canonical_saved_delivery_trend::canonical_saved_delivery_trend::canonicalSavedDeliveryTrend",
    reportId: "canonicalSavedDeliveryTrend",
    title: "Canonical Saved Delivery Trend",
    documentVersion: 9,
    exportable: true,
    importedArtifactKind: "reportBuilder.savedReportRecord",
    semanticBindingViewState: carriedSemanticBindingViewState,
    savedReportPayload: {
        version: 1,
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_canonical_saved_delivery_trend",
        sourceArtifactId: "canonical_saved_delivery_trend",
        reportDocument: {
            version: 1,
            kind: "reportDocument",
            id: "canonicalSavedDeliveryTrend",
            title: "Canonical Saved Delivery Trend",
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
                    { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
                ],
            },
            binding: {
                mode: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                entity: "line_delivery",
                selectedDimensions: ["event_date"],
                selectedMeasures: ["available_impressions"],
            },
            scope: {
                params: [
                    {
                        id: "dateRange",
                        label: "Canonical Reporting Window",
                    },
                ],
            },
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            semanticSummary: {
                kind: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                entity: "line_delivery",
                selectedDimensions: ["event_date"],
                selectedMeasures: ["available_impressions"],
            },
        },
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_canonical_saved_delivery_trend",
        sourceArtifactId: "canonical_saved_delivery_trend",
    },
});

assert.equal(savedRecordSeed.id, "reportBuilder.savedReportPayload::rbreport_canonical_saved_delivery_trend::canonical_saved_delivery_trend::canonicalSavedDeliveryTrend");
assert.equal(savedRecordSeed.title, "Canonical Saved Delivery Trend");
assert.equal(savedRecordSeed.exportable, true);
assert.equal(savedRecordSeed.semanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(savedRecordSeed.semanticSummary.entityLabel, "Canonical Line Delivery");
assert.equal(savedRecordSeed.semanticSummary.selectedMeasures[0].label, "Canonical Available Impressions");
assert.equal(savedRecordSeed.scopeParams[0].label, "Canonical Reporting Window");
assert.deepEqual(savedRecordSeed.semanticBindingViewState, carriedSemanticBindingViewState);

console.log("reportBuilderImportedArtifactPanelSeed ✓ preserves carried semantic view state while normalizing canonical metadata for builder panel seeds");
