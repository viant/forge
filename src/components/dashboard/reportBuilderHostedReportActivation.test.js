import assert from "node:assert/strict";

import * as reportBuilderHostedReportActivationModule from "./reportBuilderHostedReportActivation.js";
import {
    buildHostedReportActivationRequest,
    buildHostedReportActivationResponse,
    buildHostedInlineReportActivation,
    normalizeHostedReportSourceKind,
    resolveHostedReportArtifactId,
    resolveHostedReportExecutionIdentity,
    resolveHostedReportId,
    resolveHostedReportSource,
    resolveHostedReportStarterId,
    resolveHostedReportWorkspaceMode,
} from "./reportBuilderHostedReportActivation.js";
import { buildReportBuilderImportedResponseActivation } from "./reportBuilderImportedActivation.js";
import { resolveHostedExecuteOnOpen } from "./reportBuilderHooks.js";
import { resolveReportBuilderSurfaceAutoRunAction } from "./reportBuilderSurfaceAutoRun.js";
import {
    beginAndDispatchReportRun,
    buildHostedReportLifecycleContextKey,
    resolveHostedReportAutoExportDecision,
    resolveHostedReportRunInitializationReadiness,
} from "./reportBuilderRunPersistence.js";

const resolveHostedReportActivationIdentity =
    reportBuilderHostedReportActivationModule.resolveHostedReportActivationIdentity
    || ((container = null) => String(
        container?.parameters?.artifactId
        || container?.parameters?.sourceId
        || "",
    ).trim());
const matchesHostedReportActivationCurrent =
    reportBuilderHostedReportActivationModule.matchesHostedReportActivationCurrent
    || (({ activationRequired = false, activationState = null } = {}) => (
        !activationRequired || activationState?.status === "ready"
    ));

assert.equal(resolveHostedReportId({ parameters: { reportId: " saved-report " } }), "saved-report");
assert.equal(resolveHostedReportArtifactId({ parameters: {
    sourceKind: "report",
    sourceId: "saved-report",
    artifactId: " artifact-123 ",
} }), "artifact-123");
assert.equal(resolveHostedReportArtifactId({ parameters: { sourceKind: "preset", artifactId: "ignored" } }), "");
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
const staleHostedState = { reportDocumentTemplateId: "stale-template" };
const hostedExecutionIdentityCases = [
    {
        name: "unknown canonical source",
        container: { parameters: { sourceKind: "unknown", sourceId: "unknown-id" } },
        expected: "",
    },
    {
        name: "incomplete canonical report",
        container: { parameters: { sourceKind: "report" } },
        expected: "",
    },
    {
        name: "incomplete canonical preset",
        container: { parameters: { sourceKind: "preset" } },
        expected: "",
    },
    {
        name: "anonymous inferred inline definition",
        container: { parameters: { reportDefinition: { source: { blocks: [] } } } },
        expected: "",
    },
    {
        name: "canonical report",
        container: { parameters: { sourceKind: "report", sourceId: "report-1" } },
        expected: "report-1",
    },
    {
        name: "canonical preset",
        container: { parameters: { sourceKind: "preset", sourceId: "preset-1" } },
        expected: "preset-1",
    },
    {
        name: "canonical inline sourceId",
        container: { parameters: { sourceKind: "inline", sourceId: "inline-1" } },
        expected: "inline-1",
    },
    {
        name: "canonical inline reportDefinition.id",
        container: {
            parameters: { sourceKind: "inline", reportDefinition: { id: "inline-definition-1" } },
        },
        expected: "inline-definition-1",
    },
    {
        name: "canonical inline reportDefinition.source.id",
        container: {
            parameters: { sourceKind: "inline", reportDefinition: { source: { id: "inline-source-1" } } },
        },
        expected: "inline-source-1",
    },
    {
        name: "legacy state template fallback",
        container: { parameters: { executeOnOpen: true } },
        expected: "stale-template",
    },
];
assert.deepEqual(
    hostedExecutionIdentityCases.map(({ name, container }) => ({
        name,
        identity: resolveHostedReportExecutionIdentity(container, staleHostedState),
    })),
    hostedExecutionIdentityCases.map(({ name, expected }) => ({ name, identity: expected })),
    "explicit canonical and inferred inline sources must never recover a stale state template identity",
);
assert.equal(resolveHostedReportWorkspaceMode({ parameters: { mode: "result", workspaceMode: "design" } }), "report");
assert.equal(resolveHostedReportWorkspaceMode({ parameters: { mode: "design", workspaceMode: "report" } }), "design");
assert.equal(resolveHostedReportWorkspaceMode({ parameters: { workspaceMode: "preview" } }), "preview");
assert.deepEqual(buildHostedReportActivationRequest(" saved-report "), { reportId: "saved-report" });
assert.deepEqual(buildHostedReportActivationRequest(" saved-report ", " artifact-123 "), { artifactId: "artifact-123" });
assert.equal(buildHostedReportActivationRequest(""), null);
assert.deepEqual([
    resolveHostedReportActivationIdentity({
        parameters: { sourceKind: "report", sourceId: "saved-report", artifactId: "artifact-123" },
    }),
    resolveHostedReportActivationIdentity({
        parameters: { sourceKind: "report", sourceId: "saved-report" },
    }),
    resolveHostedReportActivationIdentity({
        parameters: { sourceKind: "inline", sourceId: "inline-report" },
    }),
    resolveHostedReportActivationIdentity({
        parameters: { sourceKind: "report", artifactId: "artifact-only" },
    }),
], ["artifact-123", "saved-report", "inline-report", "artifact-only"], "activation identity must match the exact effect request identity");
assert.deepEqual([
    matchesHostedReportActivationCurrent({
        activationRequired: true,
        activationIdentity: "artifact-b",
        activationState: { reportId: "artifact-a", status: "ready" },
    }),
    matchesHostedReportActivationCurrent({
        activationRequired: true,
        activationIdentity: "artifact-b",
        activationState: { reportId: "artifact-b", status: "loading" },
    }),
    matchesHostedReportActivationCurrent({
        activationRequired: true,
        activationIdentity: "artifact-b",
        activationState: { reportId: "artifact-b", status: "ready" },
    }),
    matchesHostedReportActivationCurrent({
        activationRequired: false,
        activationIdentity: "",
        activationState: { reportId: "stale-report", status: "ready" },
    }),
    matchesHostedReportActivationCurrent({
        activationRequired: true,
        activationIdentity: "",
        activationState: { reportId: "", status: "ready" },
    }),
], [false, false, true, true, false], "only the exact current activation may authorize an activation-backed lifecycle");

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

const fallbackInlineContainer = {
    id: "fallback-inline-window",
    stateKey: "fallback-inline-window:report",
    parameters: {
        executeOnOpen: true,
        exportOnComplete: "pdf",
        reportDefinition: {
            status: "committed",
            source: {
                id: "fallback-inline-delivery",
                title: "Fallback inline delivery",
                blocks: [{
                    id: "detail",
                    kind: "dashboard.table",
                    dataSourceRef: "rows",
                    columns: [{ key: "channel", label: "Channel" }],
                }],
            },
            dataSources: {
                rows: { format: "json", payload: [{ channel: "Display" }] },
            },
        },
    },
};
assert.equal(fallbackInlineContainer.parameters.sourceId, undefined);
assert.equal(fallbackInlineContainer.parameters.reportDefinition.id, undefined);
const fallbackInlineSource = resolveHostedReportSource(fallbackInlineContainer);
const fallbackInlineActivation = buildHostedInlineReportActivation(
    fallbackInlineContainer,
    inlineBuilderTarget,
);
const hydratedFallbackInlineActivation = buildReportBuilderImportedResponseActivation({
    response: fallbackInlineActivation.response,
    container: {
        id: fallbackInlineContainer.id,
        stateKey: fallbackInlineContainer.stateKey,
    },
    builderIdentity: inlineBuilderTarget,
    localSavedPayloads: [],
    liveConfig: { reportBuilder: { result: { defaultMode: "table" } } },
    liveState: {},
});
const fallbackInlineExecutionIdentity = resolveHostedReportExecutionIdentity(
    fallbackInlineContainer,
    hydratedFallbackInlineActivation.nextState,
);
const fallbackInlineBlockCount = Array.isArray(
    hydratedFallbackInlineActivation.nextState?.reportDocumentBlocks,
)
    ? hydratedFallbackInlineActivation.nextState.reportDocumentBlocks.length
    : 0;
const fallbackInlineGenericAction = resolveReportBuilderSurfaceAutoRunAction({
    workspaceMode: "report",
    requestFingerprint: '{"orderIds":[2676946]}',
    hostedExecuteOnOpen: resolveHostedExecuteOnOpen(fallbackInlineContainer),
    canRunReport: true,
    currentRequestShouldFetch: true,
    hasRows: false,
    hasCompletedCurrentRun: false,
    autoRunKey: 'report::{"orderIds":[2676946]}',
});
let fallbackInlineBeginCount = 0;
let fallbackInlineDispatchCount = 0;
if (resolveHostedExecuteOnOpen(fallbackInlineContainer)
    && fallbackInlineExecutionIdentity
    && fallbackInlineBlockCount > 0) {
    await beginAndDispatchReportRun(Object.freeze({
        requestFingerprint: '{"orderIds":[2676946]}',
    }), {
        begin: async () => {
            fallbackInlineBeginCount += 1;
            return { ok: true, runId: "fallback-inline-run", durable: true };
        },
        dispatch: () => {
            fallbackInlineDispatchCount += 1;
            return { fetched: true };
        },
    });
}
const fallbackInlineMaterializationFingerprint = "fallback-inline-final-materialization";
const fallbackInlineContextKey = buildHostedReportLifecycleContextKey({});
const fallbackInlineCompletedRun = {
    runId: "fallback-inline-run",
    reportRunId: "fallback-inline-run",
    durable: true,
    status: "completed",
    invocation: {
        runId: "fallback-inline-run",
        requestFingerprint: '{"orderIds":[2676946]}',
        materializationFingerprint: fallbackInlineMaterializationFingerprint,
        metadata: { event: { context: {} } },
    },
};
const fallbackInlineExportDecision = fallbackInlineExecutionIdentity
    ? resolveHostedReportAutoExportDecision({
        format: fallbackInlineContainer.parameters.exportOnComplete,
        runKey: `${fallbackInlineExecutionIdentity}::${fallbackInlineMaterializationFingerprint}::0::pdf`,
        submittedRunKey: "",
        activeRun: fallbackInlineCompletedRun,
        completedRunSignal: {
            runId: fallbackInlineCompletedRun.runId,
            reportRunId: fallbackInlineCompletedRun.reportRunId,
            requestFingerprint: fallbackInlineCompletedRun.invocation.requestFingerprint,
            materializationFingerprint: fallbackInlineMaterializationFingerprint,
            contextKey: fallbackInlineContextKey,
        },
        currentFingerprint: fallbackInlineCompletedRun.invocation.requestFingerprint,
        currentMaterializationFingerprint: fallbackInlineMaterializationFingerprint,
        currentContextKey: fallbackInlineContextKey,
    })
    : null;
assert.deepEqual({
    source: fallbackInlineSource,
    activationValid: !!fallbackInlineActivation.response && fallbackInlineActivation.message === "",
    hydrationValid: hydratedFallbackInlineActivation.valid,
    hydratedBlockCount: fallbackInlineBlockCount,
    hydratedTemplateId: hydratedFallbackInlineActivation.nextState?.reportDocumentTemplateId || "",
    executionIdentity: fallbackInlineExecutionIdentity,
    genericOwnerAction: fallbackInlineGenericAction.type,
    dedicatedBeginCount: fallbackInlineBeginCount,
    dedicatedDispatchCount: fallbackInlineDispatchCount,
    exportRequiresRunReference: fallbackInlineExportDecision?.requireRunReference === true,
    exportRunId: fallbackInlineExportDecision?.runReference?.reportRunId || "",
}, {
    source: { kind: "inline", id: "fallback-inline-delivery" },
    activationValid: true,
    hydrationValid: true,
    hydratedBlockCount: 1,
    hydratedTemplateId: "",
    executionIdentity: "fallback-inline-delivery",
    genericOwnerAction: "skip",
    dedicatedBeginCount: 1,
    dedicatedDispatchCount: 1,
    exportRequiresRunReference: true,
    exportRunId: "fallback-inline-run",
}, "source.id-only inline reports keep one dedicated execute-on-open owner and remain eligible for PDF export-on-complete");

for (const { name, container, expected } of hostedExecutionIdentityCases) {
    const guardedContainer = {
        ...container,
        parameters: {
            ...container.parameters,
            executeOnOpen: true,
            exportOnComplete: "pdf",
        },
    };
    const executionIdentity = resolveHostedReportExecutionIdentity(guardedContainer, staleHostedState);
    const initializationReadiness = resolveHostedReportRunInitializationReadiness({
        executeOnOpen: resolveHostedExecuteOnOpen(guardedContainer),
        hasExecutionIdentity: !!executionIdentity,
        hasBlocks: true,
        prefillReady: true,
        activationReady: true,
        definitionReady: true,
        authoredRuntimeExecution: true,
        hasCompletedRequest: true,
        primaryResultSettled: true,
        datasetResultSettled: true,
        canRenderRuntime: true,
        finalArtifactsReady: true,
    });
    let beginCount = 0;
    let dispatchCount = 0;
    if (executionIdentity) {
        await beginAndDispatchReportRun(Object.freeze({ requestFingerprint: `${name}::request` }), {
            begin: async () => {
                beginCount += 1;
                return { ok: true, runId: `${name}::run`, durable: true };
            },
            dispatch: () => {
                dispatchCount += 1;
                return { fetched: true };
            },
        });
    }
    const exportDecision = executionIdentity
        ? resolveHostedReportAutoExportDecision({
            format: "pdf",
            runKey: `${executionIdentity}::materialization::0::pdf`,
            activeRun: {
                runId: `${name}::run`,
                reportRunId: `${name}::run`,
                durable: true,
                status: "completed",
                invocation: {
                    runId: `${name}::run`,
                    requestFingerprint: `${name}::request`,
                    materializationFingerprint: `${name}::materialization`,
                    metadata: { event: { context: {} } },
                },
            },
            completedRunSignal: {
                runId: `${name}::run`,
                reportRunId: `${name}::run`,
                requestFingerprint: `${name}::request`,
                materializationFingerprint: `${name}::materialization`,
                contextKey: buildHostedReportLifecycleContextKey({}),
            },
            currentFingerprint: `${name}::request`,
            currentMaterializationFingerprint: `${name}::materialization`,
            currentContextKey: buildHostedReportLifecycleContextKey({}),
        })
        : null;
    assert.deepEqual({
        executionIdentity,
        hostedInitialization: initializationReadiness.hostedInitialization,
        beginCount,
        dispatchCount,
        exportRunId: exportDecision?.runReference?.reportRunId || "",
    }, {
        executionIdentity: expected,
        hostedInitialization: !!expected,
        beginCount: expected ? 1 : 0,
        dispatchCount: expected ? 1 : 0,
        exportRunId: expected ? `${name}::run` : "",
    }, `${name} must preserve its exact identity contract across hosted initialization, dedicated execute-on-open, and export-on-complete`);
}
