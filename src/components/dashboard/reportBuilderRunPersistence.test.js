import assert from "node:assert/strict";

import {
    bindReportRunInvocation,
    beginAndDispatchReportRun,
    beginAndPromoteReportRun,
    buildReportRunBeginInput,
    buildReportRunCompleteInput,
    buildReportRunMaterializationFingerprint,
    canPersistReportRunInvocation,
    captureReportRunDispatchSnapshot,
    captureReportRunSettlementEvent,
    classifyReportRunSupersede,
    completeAndActivateReportRun,
    failDurableReportRun,
    normalizeReportRunBeginResult,
    REPORT_RUN_SUPERSEDED_CODE,
    resolveCompletedReportRunReference,
    resolveHostedReportAutoExportDecision,
    resolveReportBuilderRunHandler,
    resolveReportRunBuilderRef,
    settleReportRunInvocation,
} from "./reportBuilderRunPersistence.js";

const reportRuns = { begin() {} };
assert.equal(resolveReportBuilderRunHandler({ handlers: { reportRuns } }), reportRuns);
assert.equal(resolveReportBuilderRunHandler({ handlers: { reportRuns: {} } }), null);

assert.equal(resolveReportRunBuilderRef({
    activeBuilderVariant: { builderRef: "enhanced-builder" },
    container: { dashboard: { reportBuilderRef: "dashboard-builder" } },
    config: { id: "legacy-builder" },
}), "enhanced-builder");
assert.equal(resolveReportRunBuilderRef({
    container: { dashboard: { reportBuilderRef: "dashboard-builder" } },
    config: { id: "legacy-builder" },
}), "dashboard-builder");

const requestedParams = { orderId: 2676946, filters: { region: ["central"] } };
const beginInput = buildReportRunBeginInput({
    uiRunRequestId: "ui-run-1",
    conversationId: "conversation-1",
    turnId: "turn-7",
    windowId: "window-3",
    origin: "PROMPT",
    builderRef: "enhanced-builder",
    sourceKind: "preset",
    sourceId: "inventory-brief",
    presetId: "inventory-brief",
    requestedParams,
    effectiveParams: requestedParams,
});
assert.deepEqual(beginInput, {
    uiRunRequestId: "ui-run-1",
    conversationId: "conversation-1",
    turnId: "turn-7",
    windowId: "window-3",
    origin: "prompt",
    builderRef: "enhanced-builder",
    sourceKind: "preset",
    sourceId: "inventory-brief",
    presetId: "inventory-brief",
    requestedParams,
    effectiveParams: requestedParams,
});
requestedParams.filters.region.push("mutated");
assert.deepEqual(beginInput.requestedParams.filters.region, ["central"]);

assert.deepEqual(normalizeReportRunBeginResult({ enabled: false }), { enabled: false });
assert.deepEqual(normalizeReportRunBeginResult({
    enabled: true,
    run: { reportRunId: "server-run-1", revision: 2, status: "running" },
    context: { revision: 9 },
}), {
    enabled: true,
    reportRun: { reportRunId: "server-run-1", revision: 2, status: "running" },
    reportRunId: "server-run-1",
    revision: 2,
    contextRevision: 9,
});
assert.throws(
    () => normalizeReportRunBeginResult({ run: { reportRunId: "client-run", status: "running" } }),
    /server-generated reportRunId and revision/,
);

const mutableRequest = { orderId: 11, filters: { region: ["north"] } };
const mutableMaterialization = {
    reportDocument: {
        kind: "reportDocument",
        title: "Operations brief",
        layout: { items: [{ blockId: "summary", span: 12 }] },
        blocks: [{ id: "summary", kind: "markdownBlock", markdown: "Initial copy" }],
    },
    reportSpec: { kind: "reportSpec", title: "Operations brief", blocks: [{ id: "summary" }] },
    reportPrintDefinition: {
        kind: "reportPrint",
        version: 1,
        specVersion: 1,
        specHash: "spec-1",
        title: "Operations brief",
        source: { kind: "dashboard.reportBuilder" },
        pageGeometry: { width: 612, height: 792 },
    },
};
const materializedExportRequest = {
    kind: "reportExportRequest",
    target: { format: "pdf" },
    reportSpec: mutableMaterialization.reportSpec,
    reportFill: { kind: "reportFill", specHash: "spec-1", blocks: [] },
    reportPrint: {
        ...mutableMaterialization.reportPrintDefinition,
        fillVersion: 1,
        fillHash: "fill-1",
        pages: [],
    },
};
const mutableMetadata = {
    origin: "prompt",
    source: { reportId: "report-1", reportName: "Operations brief", sourceKind: "preset" },
    event: {
        request: { target: { format: "pdf" } },
        runtimeRequest: mutableRequest,
        context: { conversationId: "conversation-1", turnId: "turn-7", windowId: "window-3" },
    },
};
const snapshot = captureReportRunDispatchSnapshot({
    request: mutableRequest,
    readiness: { canRun: true },
    materialization: mutableMaterialization,
    materializedExportRequest,
    metadata: mutableMetadata,
});
mutableRequest.orderId = 99;
mutableRequest.filters.region.push("south");
mutableMaterialization.reportDocument.title = "Mutated title";
mutableMetadata.source.reportName = "Mutated report";
assert.equal(Object.isFrozen(snapshot), true);
assert.equal(Object.isFrozen(snapshot.request.filters.region), true);
assert.equal(Object.isFrozen(snapshot.materialization.reportDocument.layout.items), true);
assert.equal(Object.isFrozen(snapshot.metadata.event.context), true);
assert.deepEqual(snapshot.request, { orderId: 11, filters: { region: ["north"] } });
assert.equal(snapshot.materialization.reportDocument.title, "Operations brief");
assert.equal(snapshot.metadata.source.reportName, "Operations brief");
assert.equal(snapshot.fingerprint, snapshot.requestFingerprint, "the compatibility fingerprint stays request-only");
assert.notEqual(snapshot.materializationFingerprint, snapshot.requestFingerprint);
assert.equal(canPersistReportRunInvocation(snapshot), true);
assert.equal(Object.isFrozen(snapshot.materializedExportRequest.reportPrint), true);
assert.equal(canPersistReportRunInvocation(captureReportRunDispatchSnapshot({
    request: snapshot.request,
    readiness: snapshot.readiness,
    materialization: null,
    materializedExportRequest: null,
})), false, "non-authored runs without materialized artifacts must remain legacy");
assert.equal(canPersistReportRunInvocation(captureReportRunDispatchSnapshot({
    request: snapshot.request,
    readiness: snapshot.readiness,
    materialization: snapshot.materialization,
    materializedExportRequest: {
        ...snapshot.materializedExportRequest,
        reportPrint: null,
    },
})), false, "durable Begin requires ReportSpec, ReportFill, and ReportPrint");
assert.equal(canPersistReportRunInvocation(captureReportRunDispatchSnapshot({
    request: snapshot.request,
    readiness: snapshot.readiness,
    materialization: snapshot.materialization,
    materializedExportRequest: {
        ...snapshot.materializedExportRequest,
        reportSpec: { ...snapshot.materializedExportRequest.reportSpec, title: "Stale spec" },
    },
})), false, "the captured export artifacts must match the exact materialization");
assert.equal(canPersistReportRunInvocation(captureReportRunDispatchSnapshot({
    request: snapshot.request,
    readiness: snapshot.readiness,
    materialization: snapshot.materialization,
    materializedExportRequest: {
        ...snapshot.materializedExportRequest,
        target: { format: "xlsx" },
    },
})), false, "XLSX stays outside durable PDF persistence");

const changedLayoutFingerprint = buildReportRunMaterializationFingerprint({
    request: snapshot.request,
    materialization: {
        ...snapshot.materialization,
        reportDocument: {
            ...snapshot.materialization.reportDocument,
            layout: { items: [{ blockId: "summary", span: 6 }] },
        },
    },
});
const changedTitleFingerprint = buildReportRunMaterializationFingerprint({
    request: snapshot.request,
    materialization: {
        ...snapshot.materialization,
        reportDocument: { ...snapshot.materialization.reportDocument, title: "Changed title" },
    },
});
const changedMarkdownFingerprint = buildReportRunMaterializationFingerprint({
    request: snapshot.request,
    materialization: {
        ...snapshot.materialization,
        reportDocument: {
            ...snapshot.materialization.reportDocument,
            blocks: [{ id: "summary", kind: "markdownBlock", markdown: "Changed copy" }],
        },
    },
});
const changedPrintFingerprint = buildReportRunMaterializationFingerprint({
    request: snapshot.request,
    materialization: {
        ...snapshot.materialization,
        reportPrintDefinition: { pageGeometry: { width: 792, height: 612 } },
    },
});
[changedLayoutFingerprint, changedTitleFingerprint, changedMarkdownFingerprint, changedPrintFingerprint]
    .forEach((fingerprint) => assert.notEqual(fingerprint, snapshot.materializationFingerprint));
const sameRequestChangedMaterializationSnapshot = captureReportRunDispatchSnapshot({
    request: snapshot.request,
    readiness: snapshot.readiness,
    materialization: {
        ...snapshot.materialization,
        reportDocument: {
            ...snapshot.materialization.reportDocument,
            layout: { items: [{ blockId: "summary", span: 6 }] },
        },
    },
});
assert.equal(sameRequestChangedMaterializationSnapshot.requestFingerprint, snapshot.requestFingerprint);
assert.notEqual(sameRequestChangedMaterializationSnapshot.materializationFingerprint, snapshot.materializationFingerprint);

let dispatchedSnapshot = null;
const dispatchResult = await beginAndDispatchReportRun(snapshot, {
    begin: async () => ({ ok: true, runId: "server-run-1", durable: true }),
    dispatch: (captured) => {
        dispatchedSnapshot = captured;
        return captured.request;
    },
});
assert.equal(dispatchedSnapshot, snapshot);
assert.equal(dispatchResult.durable, true);

let promotedSnapshot = null;
const promotionResult = await beginAndPromoteReportRun(snapshot, {
    begin: async () => ({ ok: true, runId: "legacy-run", durable: false }),
    dispatch: () => assert.fail("legacy promotion must not dispatch again"),
    promote: (captured) => {
        promotedSnapshot = captured;
        return "promoted";
    },
});
assert.equal(promotedSnapshot, snapshot);
assert.equal(promotionResult.promoteResult, "promoted");

const activeRun = bindReportRunInvocation({
    runId: "server-run-1",
    reportRunId: "server-run-1",
    revision: 2,
    contextRevision: 9,
    conversationId: "conversation-1",
    turnId: "turn-7",
    windowId: "window-3",
    origin: "prompt",
    durable: true,
    status: "running",
}, snapshot);
assert.equal(activeRun.invocation.metadata.source.reportName, "Operations brief");
assert.equal(Object.isFrozen(activeRun.invocation.metadata.event.request), true);

const exactRequest = {
    reportSpec: { kind: "reportSpec", title: "Exact completed report" },
    reportFill: { kind: "reportFill", rows: [{ orderId: 11 }] },
    reportPrint: { kind: "reportPrint", pages: [{ id: "page-1" }] },
};
const completeInput = buildReportRunCompleteInput(activeRun, exactRequest);
assert.deepEqual(completeInput, {
    reportRunId: "server-run-1",
    expectedRevision: 2,
    conversationId: "conversation-1",
    turnId: "turn-7",
    windowId: "window-3",
    ...exactRequest,
});
exactRequest.reportFill.rows[0].orderId = 999;
assert.equal(completeInput.reportFill.rows[0].orderId, 11);
assert.throws(
    () => buildReportRunCompleteInput(activeRun, { reportSpec: {}, reportFill: {} }),
    /ReportSpec, ReportFill, and ReportPrint/,
);

const persistenceCalls = [];
const completed = await completeAndActivateReportRun({
    complete: async (input) => {
        persistenceCalls.push(["complete", input]);
        return { reportRunId: input.reportRunId, revision: 3, status: "completed" };
    },
    activate: async (input) => {
        persistenceCalls.push(["activate", input]);
        return { activeReportRunId: input.reportRunId, revision: 10 };
    },
}, activeRun, completeInput);
assert.equal(completed.status, "completed");
assert.equal(completed.revision, 3);
assert.equal(completed.contextRevision, 10);
assert.deepEqual(persistenceCalls.map(([kind]) => kind), ["complete", "activate"]);
assert.deepEqual(persistenceCalls[1][1], {
    reportRunId: "server-run-1",
    conversationId: "conversation-1",
    turnId: "turn-7",
    windowId: "window-3",
    expectedRunRevision: 3,
    expectedContextRevision: 9,
    source: "prompt",
});

let staleActivationCount = 0;
let completionStillCurrent = true;
const staleCompleted = await completeAndActivateReportRun({
    complete: async (input) => {
        completionStillCurrent = false;
        return { reportRunId: input.reportRunId, revision: 3, status: "completed" };
    },
    activate: async () => {
        staleActivationCount += 1;
    },
}, activeRun, completeInput, {
    shouldActivate: () => completionStillCurrent,
});
assert.equal(staleCompleted.status, "completed");
assert.equal(staleActivationCount, 0, "a stale completion must never activate the durable context pointer");

let failInput = null;
const failed = await failDurableReportRun({
    fail: async (input) => {
        failInput = input;
        return { reportRunId: input.reportRunId, revision: 3, status: "failed" };
    },
}, activeRun, { code: "source_failed", message: "Datasource failed" });
assert.equal(failed.status, "failed");
assert.equal(failInput.turnId, "turn-7");
assert.equal(failInput.windowId, "window-3");

const wrongFingerprintEvent = captureReportRunSettlementEvent(activeRun, {
    runId: activeRun.runId,
    fingerprint: activeRun.invocation.fingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    currentFingerprint: JSON.stringify({ orderId: 12 }),
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
    dispatchFingerprint: `${activeRun.invocation.fingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: completeInput,
});
assert.equal(wrongFingerprintEvent, null);

const wrongResultEvent = captureReportRunSettlementEvent(activeRun, {
    runId: activeRun.runId,
    fingerprint: activeRun.invocation.fingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    currentFingerprint: activeRun.invocation.fingerprint,
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
    dispatchFingerprint: `${activeRun.invocation.fingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: completeInput,
    resultRequestKey: "stale-result",
    expectedResultRequestKey: "current-result",
});
assert.equal(wrongResultEvent, null);

const wrongMaterializationEvent = captureReportRunSettlementEvent(activeRun, {
    runId: activeRun.runId,
    fingerprint: activeRun.invocation.requestFingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    currentFingerprint: activeRun.invocation.requestFingerprint,
    currentMaterializationFingerprint: changedLayoutFingerprint,
    dispatchFingerprint: `${activeRun.invocation.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: completeInput,
});
assert.equal(wrongMaterializationEvent, null, "same-data-request layout changes must block durable settlement");

const successEvent = captureReportRunSettlementEvent(activeRun, {
    runId: activeRun.runId,
    fingerprint: activeRun.invocation.fingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    currentFingerprint: activeRun.invocation.fingerprint,
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
    dispatchFingerprint: `${activeRun.invocation.fingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: completeInput,
    resultRequestKey: "current-result",
    expectedResultRequestKey: "current-result",
});
assert.ok(successEvent);
assert.equal(Object.isFrozen(successEvent.terminalRequest.reportFill.rows), true);
const settled = await settleReportRunInvocation(activeRun, successEvent, {
    complete: async (run) => ({ ...run, status: "completed" }),
});
assert.equal(settled.accepted, true);
assert.equal(settled.run.status, "completed");

const legacyActiveRun = bindReportRunInvocation({
    runId: "legacy-run-1",
    durable: false,
    status: "running",
}, snapshot);
const legacyEvent = captureReportRunSettlementEvent(legacyActiveRun, {
    runId: legacyActiveRun.invocation.runId,
    fingerprint: legacyActiveRun.invocation.requestFingerprint,
    currentFingerprint: legacyActiveRun.invocation.requestFingerprint,
    dispatchFingerprint: `${legacyActiveRun.invocation.requestFingerprint}::fetch`,
    status: "succeeded",
});
assert.ok(legacyEvent, "legacy settlement remains request-based without an exact-materialization requirement");

const superseded = classifyReportRunSupersede(activeRun, {
    currentFingerprint: JSON.stringify({ orderId: 12 }),
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
    dispatchFingerprint: `${activeRun.invocation.fingerprint}::fetch`,
});
assert.equal(superseded.status, "failed");
assert.equal(superseded.error.code, REPORT_RUN_SUPERSEDED_CODE);

const materializationSuperseded = classifyReportRunSupersede(activeRun, {
    currentFingerprint: activeRun.invocation.requestFingerprint,
    currentMaterializationFingerprint: changedMarkdownFingerprint,
    dispatchFingerprint: `${activeRun.invocation.requestFingerprint}::fetch`,
});
assert.equal(materializationSuperseded.status, "failed");

assert.deepEqual(resolveCompletedReportRunReference(completed), { reportRunId: "server-run-1" });
assert.equal(resolveCompletedReportRunReference(completed, {
    materializationFingerprint: changedTitleFingerprint,
}), null, "manual PDF resolution must reject a stale materialization");
assert.deepEqual(resolveCompletedReportRunReference(completed, {
    materializationFingerprint: completed.invocation.materializationFingerprint,
}), { reportRunId: "server-run-1" });
assert.equal(resolveCompletedReportRunReference(activeRun), null);

const pendingAutoExport = resolveHostedReportAutoExportDecision({
    format: "pdf",
    runKey: "report::run-1::pdf",
    activeRun,
    currentFingerprint: activeRun.invocation.fingerprint,
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
});
assert.equal(pendingAutoExport, null);
const completedBoundRun = { ...activeRun, status: "completed" };
const readyAutoExport = resolveHostedReportAutoExportDecision({
    format: "pdf",
    runKey: "report::run-1::pdf",
    activeRun: completedBoundRun,
    completedRunSignal: {
        runId: activeRun.runId,
        reportRunId: activeRun.reportRunId,
        fingerprint: activeRun.invocation.fingerprint,
        requestFingerprint: activeRun.invocation.requestFingerprint,
        materializationFingerprint: activeRun.invocation.materializationFingerprint,
    },
    currentFingerprint: activeRun.invocation.fingerprint,
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
});
assert.deepEqual(readyAutoExport, {
    runKey: "report::run-1::pdf",
    requireRunReference: true,
    runReference: { reportRunId: "server-run-1" },
});
assert.deepEqual(resolveHostedReportAutoExportDecision({
    format: "xlsx",
    runKey: "report::run-1::xlsx",
    activeRun: completedBoundRun,
    currentFingerprint: activeRun.invocation.requestFingerprint,
    currentMaterializationFingerprint: changedPrintFingerprint,
}), {
    runKey: "report::run-1::xlsx",
    requireRunReference: false,
    runReference: null,
}, "XLSX auto-export remains on the request submission path");

console.log("reportBuilderRunPersistence ✓ exact artifacts, durable identity/correlation, activation, waiting, and stale protection");
