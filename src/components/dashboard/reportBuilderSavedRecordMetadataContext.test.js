import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
