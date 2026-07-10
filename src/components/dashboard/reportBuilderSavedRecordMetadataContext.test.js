import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    resolveEmbeddedReportBuilderSemanticSummary,
    resolveEmbeddedReportBuilderScope,
} from "./reportBuilderImportedDocumentMetadata.js";
import {
    resolveNormalizedSavedReportRecordContext,
    resolveNormalizedReportSpecDocumentContext,
    resolveSavedReportRecordContextByReportId,
    resolveSavedReportRecordContextBySource,
    resolvePreferredScopeParams,
} from "./reportBuilderSavedRecordMetadataContext.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

assert.deepEqual(resolvePreferredScopeParams([], null, [{ id: "dateRange" }]), [{ id: "dateRange" }]);
assert.deepEqual(resolvePreferredScopeParams([], null), []);

const embeddedContext = resolveNormalizedReportSpecDocumentContext({
    document: audienceArtifactFixture.legacySavedReportPayload.reportDocument,
});
assert.equal(embeddedContext.semanticSummary.selectedMeasures[0].label, "Audience Index");
assert.equal(embeddedContext.binding.modelRef, "model://example/performance/delivery@v1");
assert.equal(embeddedContext.scopeParams[0].id, "dateRange");
assert.equal(embeddedContext.scope.dataSourceRef, "demoReportSource");

const emptySpecEmbeddedContext = resolveNormalizedReportSpecDocumentContext({
    reportSpec: {},
    document: audienceArtifactFixture.legacySavedReportPayload.reportDocument,
});
assert.equal(emptySpecEmbeddedContext.reportSpec.kind, "reportSpec");
assert.equal(emptySpecEmbeddedContext.semanticSummary.selectedParameters[1].definitionRef, "harmonizer://feature/user.segment");
assert.equal(emptySpecEmbeddedContext.scopeParams[2].id, "audienceSegmentFilter");

const thinSpecDocumentBackedContext = resolveNormalizedReportSpecDocumentContext({
    reportSpec: {
        title: "Thin Runtime Spec",
        semanticSummary: {
            kind: "semantic",
            selectedDimensions: [],
            selectedMeasures: [],
        },
        scope: {
            params: [],
        },
    },
    document: {
        title: "Document Backed Runtime",
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/audience/performance@v1",
            modelLabel: "Audience Performance",
            entity: "audience_segment",
            entityLabel: "Audience Segment",
            selectedDimensions: [
                {
                    id: "audience_segment",
                    rawId: "audienceSegment",
                    label: "Audience Segment",
                },
            ],
            selectedMeasures: [
                {
                    id: "audience_index",
                    rawId: "audienceIndex",
                    label: "Audience Index",
                },
            ],
        },
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    value: {
                        start: "2026-06-01",
                        end: "2026-06-07",
                    },
                },
            ],
        },
    },
});
assert.equal(thinSpecDocumentBackedContext.semanticSummary.modelLabel, "Audience Performance");
assert.equal(thinSpecDocumentBackedContext.semanticSummary.selectedMeasures[0].label, "Audience Index");
assert.equal(thinSpecDocumentBackedContext.scopeParams[0].id, "dateRange");
assert.equal(thinSpecDocumentBackedContext.reportSpec.semanticSummary.modelLabel, "Audience Performance");
assert.equal(thinSpecDocumentBackedContext.reportSpec.semanticSummary.selectedMeasures[0].label, "Audience Index");
assert.equal(thinSpecDocumentBackedContext.reportSpec.scope.params[0].id, "dateRange");

const rawSpecDocumentBackedContext = resolveNormalizedReportSpecDocumentContext({
    reportSpec: {
        title: "Raw Semantic Spec",
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    document: {
        title: "Canonical Semantic Document",
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Canonical Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Canonical Line Delivery",
            selectedDimensions: [
                {
                    id: "event_date",
                    rawId: "eventDate",
                    label: "Delivery Date",
                    category: "Time",
                },
                {
                    id: "channel",
                    rawId: "channelV2",
                    label: "Channel",
                    category: "Delivery",
                },
            ],
            selectedMeasures: [
                {
                    id: "available_impressions",
                    rawId: "avails",
                    label: "Available Impressions",
                    category: "Metrics",
                    definitionRef: "semantic://example/available_impressions",
                },
            ],
        },
    },
});
assert.equal(rawSpecDocumentBackedContext.semanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(rawSpecDocumentBackedContext.semanticSummary.entityLabel, "Canonical Line Delivery");
assert.equal(rawSpecDocumentBackedContext.semanticSummary.selectedMeasures[0].definitionRef, "semantic://example/available_impressions");
assert.equal(rawSpecDocumentBackedContext.reportSpec.semanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(rawSpecDocumentBackedContext.reportSpec.semanticSummary.selectedDimensions[1].label, "Channel");

const sparsePrimaryDocument = {
    version: 1,
    kind: "reportDocument",
    title: "Sparse Primary Document",
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    scope: {
        dataSourceRef: "demoReportSource",
    },
    datasets: [
        {
            id: "primary",
            dataSourceRef: "demoReportSource",
            label: "Primary",
            kindLabel: "primary",
            columnOptions: [
                { key: "country", label: "Market", kind: "dimension", rawId: "country_code", semanticRef: "country_code" },
                { key: "avails", label: "Available Impressions", kind: "measure", format: "compactNumber", rawId: "available_impressions", semanticRef: "available_impressions" },
            ],
            valueFieldOptions: [
                { value: "avails", label: "Available Impressions", format: "compactNumber", rawId: "available_impressions", semanticRef: "available_impressions" },
            ],
            secondaryFieldOptions: [
                { value: "country", label: "Market", rawId: "country_code", semanticRef: "country_code" },
            ],
            scopeParamOptions: [
                { value: "dateRange", label: "Date Range", kind: "dateRange", required: true },
            ],
        },
    ],
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
                title: "Sparse Primary Document",
            },
            state: {
                selectedMeasures: ["avails"],
                selectedDimensions: ["country"],
                scopeParams: {
                    dateRange: {
                        start: "2026-06-01",
                        end: "2026-06-07",
                    },
                },
            },
        },
    ],
};
assert.equal(resolveEmbeddedReportBuilderSemanticSummary(sparsePrimaryDocument)?.selectedMeasures?.[0]?.label, "Available Impressions");
assert.equal(resolveEmbeddedReportBuilderSemanticSummary(sparsePrimaryDocument)?.selectedDimensions?.[0]?.label, "Market");
assert.equal(resolveEmbeddedReportBuilderScope(sparsePrimaryDocument)?.params?.[0]?.id, "dateRange");
assert.equal(resolveEmbeddedReportBuilderScope(sparsePrimaryDocument)?.dataSourceRef, "demoReportSource");

const normalizedContext = resolveNormalizedSavedReportRecordContext({
    documentVersion: 13,
    savedAt: 9375,
    importedArtifactKind: "reportBuilder.savedReportPayload",
    savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
});
assert.equal(normalizedContext.title, "Capacity Audience Segment Index Q3");
assert.equal(normalizedContext.binding.modelRef, "model://example/performance/delivery@v1");
assert.equal(normalizedContext.semanticSummary.selectedMeasures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(normalizedContext.semanticSummary.selectedParameters[1].definitionRef, "harmonizer://feature/user.segment");
assert.equal(normalizedContext.scopeParams[2].id, "audienceSegmentFilter");

const contextBySource = resolveSavedReportRecordContextBySource(
    audienceArtifactFixture.reportExportRequest.source,
    [
        {
            documentVersion: 13,
            savedAt: 9375,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
        },
    ],
);
assert.equal(contextBySource.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(contextBySource.scopeParams[0].label, "Date Range");

const contextByReportId = resolveSavedReportRecordContextByReportId(
    "capacityAudienceSegmentIndexQ3",
    [
        {
            documentVersion: 13,
            savedAt: 9375,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
        },
    ],
);
assert.equal(contextByReportId.binding.entity, "line_delivery");
assert.equal(contextByReportId.semanticSummary.selectedDimensions[0].label, "Market");
assert.equal(contextByReportId.scopeParams[1].label, "Channels");

console.log("reportBuilderSavedRecordMetadataContext ✓ resolves normalized companion metadata for thin saved payloads");
