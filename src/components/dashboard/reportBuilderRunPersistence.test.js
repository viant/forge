import assert from "node:assert/strict";

import {
    bindReportRunInvocation,
    beginAndDispatchReportRun,
    beginAndPromoteReportRun,
    buildHostedReportLifecycleContextKey,
    buildReportRunBeginInput,
    buildReportRunCompleteInput,
    buildReportRunMaterializationFingerprint,
    buildReportRunSettlementEventKey,
    canPersistReportRunInvocation,
    captureReportRunDispatchSnapshot,
    captureReportRunSettlementEvent,
    classifyReportRunSupersede,
    completeAndActivateReportRun,
    executeReportRunSettlementPromiseLifecycle,
    failDurableReportRun,
    matchesReportRunSettlementCurrency,
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
    reportFill: { kind: "reportFill", specHash: "spec-1", rows: [{ orderId: 11 }] },
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
    reportSpec: snapshot.materializedExportRequest.reportSpec,
    reportFill: {
        ...snapshot.materializedExportRequest.reportFill,
        rows: snapshot.materializedExportRequest.reportFill.rows.map((row) => ({ ...row })),
    },
    reportPrint: snapshot.materializedExportRequest.reportPrint,
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

const ordinaryFailureEvent = captureReportRunSettlementEvent(activeRun, {
    runId: activeRun.runId,
    fingerprint: activeRun.invocation.requestFingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    currentFingerprint: activeRun.invocation.requestFingerprint,
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
    dispatchFingerprint: `${activeRun.invocation.requestFingerprint}::fetch`,
    status: "failed",
    error: { code: "source_failed", message: "Datasource failed" },
});
assert.ok(ordinaryFailureEvent);
assert.equal(
    buildReportRunSettlementEventKey(activeRun, ordinaryFailureEvent),
    `${activeRun.invocation.runId}:${activeRun.invocation.materializationFingerprint}:failed`,
    "ordinary failure retains its existing settlement event identity",
);

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
assert.equal(
    buildReportRunSettlementEventKey(activeRun, successEvent),
    `${activeRun.invocation.runId}:${activeRun.invocation.materializationFingerprint}:succeeded`,
    "ordinary success retains its existing settlement event identity",
);
const exactSuccessSettlementCurrency = {
    currentRun: activeRun,
    currentFingerprint: activeRun.invocation.requestFingerprint,
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
    dispatchFingerprint: `${activeRun.invocation.requestFingerprint}::fetch`,
};
assert.equal(matchesReportRunSettlementCurrency(
    activeRun,
    successEvent,
    exactSuccessSettlementCurrency,
), true, "success remains current only for its exact durable materialization");
assert.equal(matchesReportRunSettlementCurrency(activeRun, successEvent, {
    ...exactSuccessSettlementCurrency,
    currentMaterializationFingerprint: changedLayoutFingerprint,
}), false, "success never receives hosted freshness materialization drift authority");
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
assert.equal(
    buildReportRunSettlementEventKey(activeRun, superseded),
    `${activeRun.invocation.runId}:${activeRun.invocation.materializationFingerprint}:failed`,
    "supersede retains its existing settlement event identity",
);

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
    currentContextKey: buildHostedReportLifecycleContextKey(snapshot.metadata.event.context),
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
        contextKey: buildHostedReportLifecycleContextKey(snapshot.metadata.event.context),
    },
    currentFingerprint: activeRun.invocation.fingerprint,
    currentMaterializationFingerprint: activeRun.invocation.materializationFingerprint,
    currentContextKey: buildHostedReportLifecycleContextKey(snapshot.metadata.event.context),
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
    completedRunSignal: {
        runId: activeRun.runId,
        reportRunId: activeRun.reportRunId,
        requestFingerprint: activeRun.invocation.requestFingerprint,
        materializationFingerprint: activeRun.invocation.materializationFingerprint,
        contextKey: buildHostedReportLifecycleContextKey(snapshot.metadata.event.context),
    },
    currentFingerprint: activeRun.invocation.requestFingerprint,
    currentMaterializationFingerprint: changedPrintFingerprint,
    currentContextKey: buildHostedReportLifecycleContextKey(snapshot.metadata.event.context),
}), {
    runKey: "report::run-1::xlsx",
    requireRunReference: false,
    runReference: null,
}, "XLSX auto-export remains on the request submission path");

function createSettlementLifecycleGate() {
    let release;
    const promise = new Promise((resolve) => {
        release = resolve;
    });
    return { promise, release };
}

async function exerciseConcurrentSettlementCompletionOrder(firstCompletedKey) {
    const pendingSettlementRef = { current: null };
    const gates = {
        older: createSettlementLifecycleGate(),
        newer: createSettlementLifecycleGate(),
    };
    const executions = [];
    const start = (key, label) => executeReportRunSettlementPromiseLifecycle({
        eventKey: `run:settlement:${key}`,
        completedEventKey: "",
        pendingSettlementRef,
        execute: async () => {
            executions.push(label);
            await gates[key].promise;
            return key;
        },
    });
    const older = start("older", "older");
    const newer = start("newer", "newer");
    const duplicateOlder = start("older", "older-duplicate");
    const duplicateNewer = start("newer", "newer-duplicate");
    const initialDuplicateReuse = [
        duplicateOlder === older,
        duplicateNewer === newer,
    ];
    gates[firstCompletedKey].release();
    await Promise.all(firstCompletedKey === "older"
        ? [older, duplicateOlder]
        : [newer, duplicateNewer]);
    const stateRetainedForOtherKey = pendingSettlementRef.current !== null;
    const remainingKey = firstCompletedKey === "older" ? "newer" : "older";
    const remaining = remainingKey === "older" ? older : newer;
    const lateDuplicateRemaining = start(remainingKey, `${remainingKey}-late-duplicate`);
    const lateDuplicateReusedOriginal = lateDuplicateRemaining === remaining;
    gates[remainingKey].release();
    await Promise.all([
        older,
        newer,
        duplicateOlder,
        duplicateNewer,
        lateDuplicateRemaining,
    ]);
    return {
        executions,
        initialDuplicateReuse,
        lateDuplicateReusedOriginal,
        stateRetainedForOtherKey,
        finalState: pendingSettlementRef.current,
    };
}

for (const firstCompletedKey of ["older", "newer"]) {
    const result = await exerciseConcurrentSettlementCompletionOrder(firstCompletedKey);
    assert.deepEqual(
        result.initialDuplicateReuse,
        [true, true],
        `every active key reuses its promise when ${firstCompletedKey} completes first`,
    );
    assert.equal(result.stateRetainedForOtherKey, true);
    assert.equal(
        result.lateDuplicateReusedOriginal,
        true,
        `cleanup of ${firstCompletedKey} must retain the other active key`,
    );
    assert.deepEqual(result.executions, ["older", "newer"]);
    assert.equal(result.finalState, null);
}

const rejectionPendingSettlementRef = { current: null };
const rejectionSurvivorGate = createSettlementLifecycleGate();
let survivorExecutionCount = 0;
const survivorSettlementPromise = executeReportRunSettlementPromiseLifecycle({
    eventKey: "run:settlement:survivor",
    pendingSettlementRef: rejectionPendingSettlementRef,
    execute: async () => {
        survivorExecutionCount += 1;
        await rejectionSurvivorGate.promise;
        return "survivor";
    },
});
const rejectionError = new Error("settlement executor rejected");
const rejectedSettlementPromise = executeReportRunSettlementPromiseLifecycle({
    eventKey: "run:settlement:rejected",
    pendingSettlementRef: rejectionPendingSettlementRef,
    execute: async () => {
        throw rejectionError;
    },
});
const observedRejection = rejectedSettlementPromise.then(
    () => null,
    (error) => error,
);
assert.equal(await observedRejection, rejectionError);
const duplicateSurvivorSettlementPromise = executeReportRunSettlementPromiseLifecycle({
    eventKey: "run:settlement:survivor",
    pendingSettlementRef: rejectionPendingSettlementRef,
    execute: () => assert.fail("the surviving executor must remain deduplicated"),
});
const retriedRejectedSettlementPromise = executeReportRunSettlementPromiseLifecycle({
    eventKey: "run:settlement:rejected",
    pendingSettlementRef: rejectionPendingSettlementRef,
    execute: async () => "recovered",
});
const survivorWasReusedAfterRejection = duplicateSurvivorSettlementPromise
    === survivorSettlementPromise;
rejectionSurvivorGate.release();
assert.deepEqual(await Promise.all([
    survivorSettlementPromise,
    duplicateSurvivorSettlementPromise,
    retriedRejectedSettlementPromise,
]), ["survivor", "survivor", "recovered"]);
assert.equal(survivorWasReusedAfterRejection, true);
assert.equal(survivorExecutionCount, 1);
assert.equal(rejectionPendingSettlementRef.current, null);

const completedValue = { status: "completed" };
const completedPendingSettlementRef = { current: null };
let completedExecutorCount = 0;
assert.equal(await executeReportRunSettlementPromiseLifecycle({
    eventKey: "run:settlement:completed",
    completedEventKey: "run:settlement:completed",
    pendingSettlementRef: completedPendingSettlementRef,
    completedValue,
    execute: () => {
        completedExecutorCount += 1;
        return null;
    },
}), completedValue);
assert.equal(completedExecutorCount, 0);
assert.equal(completedPendingSettlementRef.current, null);

console.log("reportBuilderRunPersistence ✓ exact artifacts, durable identity/correlation, activation, waiting, and stale protection");
