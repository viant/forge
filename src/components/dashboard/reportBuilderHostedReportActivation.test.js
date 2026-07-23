import assert from "node:assert/strict";

import {
    buildHostedReportActivationRequest,
    buildHostedReportActivationResponse,
    buildHostedInlineReportActivation,
    normalizeHostedReportSourceKind,
    resolveHostedReportId,
    resolveHostedReportSource,
    resolveHostedReportStarterId,
    resolveHostedReportWorkspaceMode,
} from "./reportBuilderHostedReportActivation.js";
import { buildReportBuilderImportedResponseActivation } from "./reportBuilderImportedActivation.js";

assert.equal(resolveHostedReportId({ parameters: { reportId: " saved-report " } }), "saved-report");
assert.equal(resolveHostedReportId({ parameters: {} }), "");
assert.deepEqual(resolveHostedReportSource({ parameters: { sourceKind: "report", sourceId: " saved-report " } }), {
    kind: "report",
    id: "saved-report",
});
assert.equal(resolveHostedReportId({ parameters: { sourceKind: "report", sourceId: " saved-report " } }), "saved-report");
assert.equal(resolveHostedReportId({ parameters: { sourceKind: "preset", sourceId: "starter" } }), "");
assert.equal(resolveHostedReportStarterId({ parameters: { sourceKind: "preset", sourceId: " starter " } }), "starter");
assert.equal(resolveHostedReportStarterId({ parameters: { reportStarterId: " legacy-starter " } }), "legacy-starter");
assert.deepEqual(resolveHostedReportSource({ parameters: { reportDefinition: { id: "inline-report" } } }), {
    kind: "inline",
    id: "inline-report",
});
assert.equal(normalizeHostedReportSourceKind("savedReport"), "report");
assert.equal(normalizeHostedReportSourceKind("unknown"), "");
assert.deepEqual(resolveHostedReportSource({
    parameters: { sourceKind: "unknown", sourceId: "canonical", reportId: "legacy" },
}), { kind: "", id: "" });
assert.equal(resolveHostedReportWorkspaceMode({ parameters: { mode: "result", workspaceMode: "design" } }), "report");
assert.equal(resolveHostedReportWorkspaceMode({ parameters: { mode: "design", workspaceMode: "report" } }), "design");
assert.equal(resolveHostedReportWorkspaceMode({ parameters: { workspaceMode: "preview" } }), "preview");
assert.deepEqual(buildHostedReportActivationRequest(" saved-report "), { reportId: "saved-report" });
assert.equal(buildHostedReportActivationRequest(""), null);

const response = buildHostedReportActivationResponse({
    kind: "reportBuilder.savedReportPayload",
    reportId: "saved-report",
    title: "Saved report",
    version: 3,
    createdAt: "2026-07-15T08:00:00Z",
    document: {
        kind: "reportDocument",
        version: "1.0",
        id: "saved-report",
        title: "Saved report",
        dataSources: [],
        blocks: [{ id: "intro", type: "narrative", title: "Summary", body: "Saved content" }],
        layout: [{ blockId: "intro", width: "full" }],
    },
    reportSpec: {
        kind: "reportSpec",
        version: "1.0",
        id: "saved-report",
        title: "Saved report",
        datasets: [],
        blocks: [],
    },
});

assert.equal(response?.reportRef?.reportId, "saved-report");
assert.equal(response?.documentVersion, 3);
assert.equal(response?.document?.title, "Saved report");
assert.equal(buildHostedReportActivationResponse(null), null);

const inlineBuilderTarget = {
    containerId: "report-window",
    stateKey: "report-window:performance",
    dataSourceRef: "",
};
const inlineActivation = buildHostedInlineReportActivation({
    parameters: {
        sourceKind: "inline",
        sourceId: "delivery",
        reportDefinition: {
            scope: "campaign",
            id: "delivery",
            status: "committed",
            source: {
                title: "Inline delivery",
                blocks: [{
                    id: "detail",
                    kind: "dashboard.table",
                    dataSourceRef: "rows",
                    columns: [{ key: "channel", label: "Channel" }],
                }],
            },
            dataSources: {
                rows: { format: "json", payload: [{ channel: "CTV" }] },
            },
        },
    },
}, inlineBuilderTarget);
assert.ok(inlineActivation.key);
assert.equal(inlineActivation.message, "");
assert.equal(inlineActivation.response?.document?.title, "Inline delivery");
assert.equal(inlineActivation.response?.reportSpec?.blocks?.[0]?.kind, "tableBlock");
const hydratedInlineActivation = buildReportBuilderImportedResponseActivation({
    response: inlineActivation.response,
    container: { id: inlineBuilderTarget.containerId, stateKey: inlineBuilderTarget.stateKey },
    builderIdentity: inlineBuilderTarget,
    localSavedPayloads: [],
    liveConfig: { reportBuilder: { result: { defaultMode: "table" } } },
    liveState: {},
});
assert.equal(hydratedInlineActivation.valid, true);
assert.equal(hydratedInlineActivation.title, "Inline delivery");
assert.equal(hydratedInlineActivation.nextState?.reportDocumentBlocks?.[0]?.kind, "tableBlock");
assert.match(buildHostedInlineReportActivation({
    parameters: { sourceKind: "inline", sourceId: "missing" },
}).message, /reportDefinition is required/i);
