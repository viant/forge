import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildReportBuilderImportedResponseActivation } from "./reportBuilderImportedActivation.js";
import { parseReportBuilderLocalImport } from "./reportBuilderLocalImport.js";

const invalidActivation = buildReportBuilderImportedResponseActivation({
    response: { kind: "getReportDocumentResponse" },
    builderIdentity: { containerId: "builder", stateKey: "reportBuilder", dataSourceRef: "metrics" },
    hydrateDocument() {
        return {
            valid: false,
            message: "Imported report is incompatible with this builder.",
        };
    },
    buildDiagnostic(response, hydrated) {
        return {
            code: "incompatibleImportedReport",
            title: response.kind,
            message: hydrated.message,
        };
    },
});

assert.deepEqual(invalidActivation, {
    valid: false,
    hydrated: {
        valid: false,
        message: "Imported report is incompatible with this builder.",
    },
    diagnostic: {
        code: "incompatibleImportedReport",
        title: "getReportDocumentResponse",
        message: "Imported report is incompatible with this builder.",
    },
    message: "Imported report is incompatible with this builder.",
});

const validActivation = buildReportBuilderImportedResponseActivation({
    response: { kind: "getReportDocumentResponse" },
    builderIdentity: { containerId: "builder", stateKey: "reportBuilder", dataSourceRef: "metrics" },
    liveConfig: { id: "config" },
    liveState: { id: "state" },
    priorSession: { id: "prior" },
    hydrateDocument() {
        return {
            valid: true,
            title: "Imported Semantic Report",
            config: { id: "next-config" },
            state: { id: "next-state" },
        };
    },
    buildSession(hydrated, props) {
        return {
            id: "session-1",
            hydrated,
            props,
        };
    },
    applySessionState(state, session) {
        return {
            ...state,
            sessionId: session.id,
        };
    },
});

assert.deepEqual(validActivation, {
    valid: true,
    hydrated: {
        valid: true,
        title: "Imported Semantic Report",
        config: { id: "next-config" },
        state: { id: "next-state" },
    },
    session: {
        id: "session-1",
        hydrated: {
            valid: true,
            title: "Imported Semantic Report",
            config: { id: "next-config" },
            state: { id: "next-state" },
        },
        props: {
            liveConfig: { id: "config" },
            liveState: { id: "state" },
            priorSession: { id: "prior" },
        },
    },
    nextConfig: { id: "next-config" },
    nextState: { id: "next-state", sessionId: "session-1" },
    title: "Imported Semantic Report",
});

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);
const importedAudienceSavedPayload = parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.legacySavedReportPayload), {
    fileName: "audience-saved-report.json",
});

const realSemanticActivation = buildReportBuilderImportedResponseActivation({
    response: importedAudienceSavedPayload.getReportDocumentResponse,
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    localSavedPayloads: [],
    priorSession: null,
    liveConfig: {
        reportBuilder: {
            result: {
                defaultMode: "table",
            },
        },
    },
    liveState: {},
});

assert.equal(realSemanticActivation.valid, true);
assert.equal(realSemanticActivation.nextConfig?.binding?.modelRef, "model://example/performance/delivery@v1");
assert.equal(realSemanticActivation.nextState?.binding?.entity, "line_delivery");
assert.deepEqual(realSemanticActivation.nextState?.scopeParams?.audienceSegmentFilter, ["Young Adults"]);
assert.equal(realSemanticActivation.title, "Capacity Audience Segment Index Q3");

console.log("reportBuilderImportedActivation ✓ derives builder activation state from imported reopen artifacts");
