import assert from "node:assert/strict";

import {
    bindReportRunInvocation,
    bindReportRunTerminalMaterialization,
    beginAndDispatchReportRun,
    beginAndPromoteReportRun,
    buildCancelledReportRunResult,
    buildCompletedReportRunConversationSelectionKey,
    buildHostedReportLifecycleContextKey,
    buildReportRunBeginInput,
    buildReportRunCompleteInput,
    buildReportRunMaterializationFingerprint,
    buildReportRunSettlementEventKey,
    cancelUnmountedReportRunBegin,
    canPersistReportRunInvocation,
    captureReportRunDispatchSnapshot,
    captureReportRunSettlementEvent,
    classifyCompletedReportRunConversationAction,
    classifyReportRunSupersede,
    completeAndActivateReportRun,
    coordinateCompletedReportRunConversation,
    createPendingReportRunExecution,
    executeReportRunSettlementPromiseLifecycle,
    failDurableReportRun,
    matchesReportRunDispatchMaterializationSnapshot,
    matchesReportRunSettlementApplicationCurrency,
    matchesReportRunSettlementCurrency,
    normalizeReportRunBeginResult,
    reconcileCompletedReportRunConversation,
    REPORT_RUN_SUPERSEDED_CODE,
    resolveCompletedReportRunReference,
    resolveHostedReportAutoExportDecision,
    resolveReportBuilderRunHandler,
    resolveReportRunBuilderRef,
    resolveReportRunDispatchMaterialization,
    resolvePendingReportRunExecutionAction,
    settlePendingReportRunExecution,
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

const dateChangeR1Candidate = {
    dispatchReady: true,
    terminalMaterializationFresh: true,
    requestFingerprint: snapshot.requestFingerprint,
    materializationFingerprint: snapshot.materializationFingerprint,
    materialization: snapshot.materialization,
    materializedExportRequest: snapshot.materializedExportRequest,
};
const dateChangeR2Request = {
    orderId: 11,
    filters: {
        region: ["north"],
        dateRange: { start: "2026-08-01", end: "2026-08-31" },
    },
};
const staleDateChangeSelection = resolveReportRunDispatchMaterialization(
    dateChangeR2Request,
    dateChangeR1Candidate,
);
assert.equal(
    staleDateChangeSelection,
    null,
    "a manual date change must not pair its new runtime request with the previous render's export request",
);
const dateChangeBeforeExportRefRefresh = captureReportRunDispatchSnapshot({
    request: dateChangeR2Request,
    readiness: { canRun: true },
    materialization: staleDateChangeSelection?.materialization || null,
    materializedExportRequest: staleDateChangeSelection?.materializedExportRequest || null,
});
assert.equal(
    matchesReportRunDispatchMaterializationSnapshot(
        dateChangeBeforeExportRefRefresh,
        dateChangeR1Candidate,
    ),
    false,
    "manual Run waits while its request is ahead of the render-captured terminal materialization",
);
assert.equal(
    canPersistReportRunInvocation(dateChangeBeforeExportRefRefresh),
    false,
    "the stale terminal request cannot make the new date invocation durable",
);

const dateChangeR2ExportRequest = {
    ...snapshot.materializedExportRequest,
    reportFill: {
        ...snapshot.materializedExportRequest.reportFill,
        rows: [{ orderId: 11, reportDate: "2026-08-31" }],
    },
    reportPrint: {
        ...snapshot.materializedExportRequest.reportPrint,
        fillHash: "fill-date-r2",
    },
};
const dateChangeR2MaterializationFingerprint = buildReportRunMaterializationFingerprint({
    request: dateChangeR2Request,
    materialization: snapshot.materialization,
});
const dateChangeR2Candidate = {
    dispatchReady: true,
    terminalMaterializationFresh: true,
    requestFingerprint: JSON.stringify(dateChangeR2Request),
    materializationFingerprint: dateChangeR2MaterializationFingerprint,
    materialization: snapshot.materialization,
    materializedExportRequest: dateChangeR2ExportRequest,
};
assert.equal(resolveReportRunDispatchMaterialization(dateChangeR2Request, {
    ...dateChangeR2Candidate,
    dispatchReady: false,
}), null, "the matching render still waits until its terminal artifacts are published for R2 dispatch");
const dateChangeR2Selection = resolveReportRunDispatchMaterialization(
    dateChangeR2Request,
    dateChangeR2Candidate,
);
assert.ok(dateChangeR2Selection);
const dateChangeR2Snapshot = captureReportRunDispatchSnapshot({
    request: dateChangeR2Request,
    readiness: { canRun: true },
    materialization: dateChangeR2Selection.materialization,
    materializedExportRequest: dateChangeR2Selection.materializedExportRequest,
    terminalMaterializationFresh: dateChangeR2Selection.terminalMaterializationFresh,
    metadata: {
        origin: "manual",
        builderRef: "enhanced-builder",
        source: { reportId: "report-1", sourceKind: "preset" },
        event: {
            runtimeRequest: dateChangeR2Request,
            context: { conversationId: "", turnId: "", windowId: "window-date" },
        },
    },
});
assert.equal(
    matchesReportRunDispatchMaterializationSnapshot(dateChangeR2Snapshot, dateChangeR2Candidate),
    true,
    "the deferred Run resumes only after request, materialization, and terminal export fingerprints align",
);
assert.equal(canPersistReportRunInvocation(dateChangeR2Snapshot), true);

const dateChangeR2BeginSelection = resolveReportRunDispatchMaterialization(
    dateChangeR2Request,
    {
        ...dateChangeR2Candidate,
        materializedExportRequest: snapshot.materializedExportRequest,
        terminalMaterializationFresh: false,
    },
);
const dateChangeR2BeginSnapshot = captureReportRunDispatchSnapshot({
    request: dateChangeR2Request,
    readiness: { canRun: true },
    materialization: dateChangeR2BeginSelection.materialization,
    materializedExportRequest: dateChangeR2BeginSelection.materializedExportRequest,
    terminalMaterializationFresh: dateChangeR2BeginSelection.terminalMaterializationFresh,
    metadata: dateChangeR2Snapshot.metadata,
});
const dateChangeR2Run = bindReportRunInvocation({
    runId: "manual-date-r2",
    reportRunId: "manual-date-r2",
    revision: 1,
    conversationId: "",
    turnId: "",
    windowId: "window-date",
    origin: "manual",
    durable: true,
    status: "running",
}, dateChangeR2BeginSnapshot);
assert.equal(captureReportRunSettlementEvent(dateChangeR2Run, {
    runId: dateChangeR2Run.runId,
    requestFingerprint: dateChangeR2Snapshot.requestFingerprint,
    materializationFingerprint: dateChangeR2Snapshot.materializationFingerprint,
    currentFingerprint: dateChangeR2Snapshot.requestFingerprint,
    currentMaterializationFingerprint: dateChangeR2Snapshot.materializationFingerprint,
    dispatchFingerprint: `${dateChangeR2Snapshot.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: dateChangeR2Snapshot.materializedExportRequest,
}), null, "the strict terminal fingerprint rejects fresh R2 output until its exact terminal snapshot is bound");
assert.equal(bindReportRunTerminalMaterialization(
    dateChangeR2Run,
    dateChangeR2BeginSnapshot,
    { trustedConversationId: "" },
), null, "stale-while-revalidate R1 rows cannot be rebound as a fresh R2 terminal materialization");
const terminalBoundDateChangeR2Run = bindReportRunTerminalMaterialization(
    dateChangeR2Run,
    dateChangeR2Snapshot,
    { trustedConversationId: "" },
);
assert.ok(terminalBoundDateChangeR2Run);
assert.equal(
    terminalBoundDateChangeR2Run.invocation.requestFingerprint,
    dateChangeR2Run.invocation.requestFingerprint,
);
assert.equal(
    terminalBoundDateChangeR2Run.invocation.materializationFingerprint,
    dateChangeR2Run.invocation.materializationFingerprint,
);
assert.notEqual(
    terminalBoundDateChangeR2Run.invocation.terminalMaterializationFingerprint,
    dateChangeR2Run.invocation.terminalMaterializationFingerprint,
);
assert.equal(bindReportRunTerminalMaterialization(dateChangeR2Run, dateChangeR2Snapshot, {
    trustedConversationId: "another-conversation",
}), null, "terminal rebinding cannot cross the trusted conversation");
assert.equal(captureReportRunSettlementEvent(terminalBoundDateChangeR2Run, {
    runId: terminalBoundDateChangeR2Run.runId,
    requestFingerprint: dateChangeR2Snapshot.requestFingerprint,
    materializationFingerprint: dateChangeR2Snapshot.materializationFingerprint,
    currentFingerprint: dateChangeR2Snapshot.requestFingerprint,
    currentMaterializationFingerprint: dateChangeR2Snapshot.materializationFingerprint,
    dispatchFingerprint: `${dateChangeR2Snapshot.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: snapshot.materializedExportRequest,
}), null, "the rebound strict terminal fingerprint still rejects R1 output for the R2 run");
const dateChangeR2Event = captureReportRunSettlementEvent(terminalBoundDateChangeR2Run, {
    runId: terminalBoundDateChangeR2Run.runId,
    requestFingerprint: dateChangeR2Snapshot.requestFingerprint,
    materializationFingerprint: dateChangeR2Snapshot.materializationFingerprint,
    currentFingerprint: dateChangeR2Snapshot.requestFingerprint,
    currentMaterializationFingerprint: dateChangeR2Snapshot.materializationFingerprint,
    dispatchFingerprint: `${dateChangeR2Snapshot.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: dateChangeR2Snapshot.materializedExportRequest,
    rowCount: 1,
});
assert.ok(dateChangeR2Event);
const dateChangeSettlementRef = { current: null };
const dateChangeEventKey = buildReportRunSettlementEventKey(terminalBoundDateChangeR2Run, dateChangeR2Event);
let dateChangeCompleteCalls = 0;
const settleDateChangeR2 = () => executeReportRunSettlementPromiseLifecycle({
    eventKey: dateChangeEventKey,
    pendingSettlementRef: dateChangeSettlementRef,
    execute: async () => {
        dateChangeCompleteCalls += 1;
        return settleReportRunInvocation(terminalBoundDateChangeR2Run, dateChangeR2Event, {
            complete: async (run) => ({ ...run, revision: 2, status: "completed" }),
        });
    },
});
const dateChangeSettlementA = settleDateChangeR2();
const dateChangeSettlementB = settleDateChangeR2();
assert.equal(dateChangeSettlementA, dateChangeSettlementB);
const dateChangeSettlement = await dateChangeSettlementA;
assert.equal(dateChangeSettlement.run.status, "completed");
assert.equal(dateChangeCompleteCalls, 1, "duplicate R2 terminal observations complete exactly once");
assert.equal(await executeReportRunSettlementPromiseLifecycle({
    eventKey: dateChangeEventKey,
    completedEventKey: dateChangeEventKey,
    pendingSettlementRef: dateChangeSettlementRef,
    completedValue: dateChangeSettlement,
    execute: () => assert.fail("an applied R2 terminal event must not execute again"),
}), dateChangeSettlement);

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

const pendingExecutionRef = { current: null };
const requestPendingExecution = (requestFingerprint) => {
    if (pendingExecutionRef.current?.promise) {
        return pendingExecutionRef.current;
    }
    const pendingRun = createPendingReportRunExecution({
        origin: "manual",
        requestFingerprint,
        materializationFingerprint: "materialization-r1",
    });
    pendingExecutionRef.current = pendingRun;
    return pendingRun;
};
const pendingR1 = requestPendingExecution("request-r1");
const repeatedPendingR1 = requestPendingExecution("request-r1");
assert.equal(
    repeatedPendingR1.promise,
    pendingR1.promise,
    "repeated same-request clicks share the exact deferred Run promise",
);
assert.equal(resolvePendingReportRunExecutionAction(pendingR1, {
    origin: "manual",
    requestFingerprint: "request-r1",
    materializationFingerprint: "materialization-r1",
}), "reuse");
assert.equal(resolvePendingReportRunExecutionAction(pendingR1, {
    origin: "manual",
    requestFingerprint: "request-r2",
    materializationFingerprint: "materialization-r2",
}), "supersede", "R1 pending capture cannot consume a newer R2 click");
assert.equal(resolvePendingReportRunExecutionAction(pendingR1, {
    origin: "manual",
    requestFingerprint: "request-r1",
    materializationFingerprint: "materialization-r2",
}), "supersede", "same-request clicks with a newer report materialization never coalesce");
assert.equal(resolvePendingReportRunExecutionAction(pendingR1, {
    origin: "prompt",
    requestFingerprint: "request-r1",
    materializationFingerprint: "materialization-r1",
}), "supersede", "manual and prompt clicks never coalesce merely because their request matches");
const supersededPendingResult = {
    ok: false,
    superseded: true,
    error: "Report run was superseded before materialization capture.",
};
assert.equal(settlePendingReportRunExecution(
    pendingExecutionRef,
    pendingR1,
    supersededPendingResult,
), true);
assert.equal(await pendingR1.promise, supersededPendingResult);
assert.equal(pendingExecutionRef.current, null);
assert.equal(settlePendingReportRunExecution(
    pendingExecutionRef,
    pendingR1,
    { ok: true },
), false, "R1 supersede settles its deferred promise exactly once");

const pendingR2 = createPendingReportRunExecution({
    origin: "manual",
    requestFingerprint: "request-r2",
});
pendingExecutionRef.current = pendingR2;
const fetchErrorResult = { ok: false, error: "Could not run the report. Datasource failed." };
assert.equal(settlePendingReportRunExecution(
    pendingExecutionRef,
    pendingR2,
    fetchErrorResult,
), true);
assert.equal(await pendingR2.promise, fetchErrorResult, "a deferred R2 fetch error settles non-throwingly");

const pendingDesign = createPendingReportRunExecution({ origin: "manual" });
pendingExecutionRef.current = pendingDesign;
assert.equal(resolvePendingReportRunExecutionAction(pendingDesign, {
    origin: "manual",
    requestFingerprint: "request-after-design-transition",
}), "reuse", "repeated design Preview clicks share the transition-owned pending execution");
const designResult = { ok: true, runId: "design-preview-run", durable: true };
assert.equal(settlePendingReportRunExecution(
    pendingExecutionRef,
    pendingDesign,
    designResult,
), true);
assert.equal(await pendingDesign.promise, designResult, "a design-to-report deferred Run settles with its execution result");

const pendingUnmount = createPendingReportRunExecution({
    origin: "manual",
    requestFingerprint: "request-unmount",
});
pendingExecutionRef.current = pendingUnmount;
const cancelledRunResult = buildCancelledReportRunResult();
assert.deepEqual(cancelledRunResult, {
    ok: false,
    superseded: true,
    cancelled: true,
    code: "browser_run_cancelled",
    error: "Report run was cancelled because the report builder was closed.",
});
assert.equal(settlePendingReportRunExecution(
    pendingExecutionRef,
    pendingUnmount,
    cancelledRunResult,
), true);
assert.equal(await pendingUnmount.promise, cancelledRunResult);
assert.equal(settlePendingReportRunExecution(
    pendingExecutionRef,
    pendingUnmount,
    cancelledRunResult,
), false, "unmount cancellation settles a deferred Run exactly once");
let dispatchAfterCancellation = 0;
const cancelledBeforeBegin = await beginAndDispatchReportRun(snapshot, {
    begin: async () => cancelledRunResult,
    dispatch: () => {
        dispatchAfterCancellation += 1;
    },
});
assert.equal(cancelledBeforeBegin, cancelledRunResult);
assert.equal(dispatchAfterCancellation, 0, "a cancelled unmounted Run never dispatches after Begin gating");

const runInflightBeginUnmountScenario = async ({
    cleanupFails = false,
    enabled = true,
} = {}) => {
    let releaseBegin;
    const beginGate = new Promise((resolve) => {
        releaseBegin = resolve;
    });
    const calls = {
        adopt: 0,
        begin: 0,
        complete: 0,
        dispatch: 0,
        fail: 0,
    };
    let failInput = null;
    const handler = {
        begin: async () => {
            calls.begin += 1;
            await beginGate;
            return enabled
                ? {
                    enabled: true,
                    run: {
                        reportRunId: "inflight-unmount-run",
                        revision: 41,
                        status: "running",
                    },
                    context: { revision: 9 },
                }
                : { enabled: false };
        },
        fail: async (input) => {
            calls.fail += 1;
            failInput = input;
            if (cleanupFails) {
                throw new Error("cleanup failed");
            }
            return {
                reportRunId: input.reportRunId,
                revision: 42,
                status: "failed",
            };
        },
        complete: async () => {
            calls.complete += 1;
        },
        adopt: async () => {
            calls.adopt += 1;
        },
    };
    let mounted = true;
    const uiRunRequestId = `inflight-unmount-${cleanupFails ? "cleanup-fails" : (enabled ? "cleanup-succeeds" : "disabled")}`;
    const execution = (async () => {
        const beginResponse = await handler.begin(buildReportRunBeginInput({
            uiRunRequestId,
            conversationId: snapshot.metadata.event.context.conversationId,
            turnId: snapshot.metadata.event.context.turnId,
            windowId: snapshot.metadata.event.context.windowId,
            origin: snapshot.metadata.origin,
            requestedParams: snapshot.request,
            effectiveParams: snapshot.request,
        }));
        const beginResult = normalizeReportRunBeginResult(beginResponse);
        if (!mounted) {
            return cancelUnmountedReportRunBegin(handler, beginResult, snapshot, {
                uiRunRequestId,
            });
        }
        calls.dispatch += 1;
        return { ok: true };
    })();
    mounted = false;
    releaseBegin();
    return {
        calls,
        result: await execution,
        readFailInput: () => failInput,
    };
};

for (const cleanupFails of [false, true]) {
    const inflightUnmount = await runInflightBeginUnmountScenario({ cleanupFails });
    assert.deepEqual(inflightUnmount.result, buildCancelledReportRunResult());
    assert.deepEqual(inflightUnmount.calls, {
        adopt: 0,
        begin: 1,
        complete: 0,
        dispatch: 0,
        fail: 1,
    });
    assert.deepEqual(inflightUnmount.readFailInput(), {
        reportRunId: "inflight-unmount-run",
        conversationId: "conversation-1",
        turnId: "turn-7",
        windowId: "window-3",
        expectedRevision: 41,
        failureCode: "browser_run_cancelled",
        failureText: "Report run was cancelled because the report builder was closed.",
    }, cleanupFails
        ? "cleanup failure still attempts the exact durable CAS failure once"
        : "unmount after Begin fails the exact durable run identity and correlation once");
}

const disabledInflightUnmount = await runInflightBeginUnmountScenario({ enabled: false });
assert.deepEqual(disabledInflightUnmount.result, buildCancelledReportRunResult());
assert.deepEqual(disabledInflightUnmount.calls, {
    adopt: 0,
    begin: 1,
    complete: 0,
    dispatch: 0,
    fail: 0,
}, "a disabled Begin returns cancellation without issuing Fail");

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

let lifecycleCallsAfterUnmount = 0;
const unmountedSettlement = await settleReportRunInvocation(activeRun, {
    runId: activeRun.invocation.runId,
    requestFingerprint: activeRun.invocation.requestFingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    status: "succeeded",
    terminalRequest: completeInput,
}, {
    shouldSettle: () => false,
    complete: async () => {
        lifecycleCallsAfterUnmount += 1;
        return { ...activeRun, status: "completed" };
    },
});
assert.equal(unmountedSettlement.accepted, false);
assert.equal(lifecycleCallsAfterUnmount, 0, "an unmounted settlement guard never issues Complete");

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

const completionReconciliationStateRef = { current: null };
let completionActivationCalls = 0;
const completionHandler = {
    complete: async (input) => ({ reportRunId: input.reportRunId, revision: 3, status: "completed" }),
    activate: async (input) => {
        completionActivationCalls += 1;
        return {
            activeReportRunId: input.reportRunId,
            conversationId: input.conversationId,
            revision: 10,
        };
    },
};
const deduplicatedCompleted = await completeAndActivateReportRun(
    completionHandler,
    activeRun,
    completeInput,
    { reconciliationStateRef: completionReconciliationStateRef },
);
const repeatedCompletionReconciliation = await coordinateCompletedReportRunConversation({
    handler: completionHandler,
    activeRun: deduplicatedCompleted,
    trustedConversationId: "conversation-1",
    stateRef: completionReconciliationStateRef,
});
assert.equal(repeatedCompletionReconciliation.duplicate, true);
assert.equal(completionActivationCalls, 1, "the integration seam does not reactivate an already activated completion");

const completedManualStandalone = {
    ...activeRun,
    runId: "manual-standalone-1",
    reportRunId: "manual-standalone-1",
    revision: 3,
    contextRevision: 0,
    conversationId: "",
    origin: "manual",
    status: "completed",
    invocation: {
        ...activeRun.invocation,
        metadata: {
            ...activeRun.invocation.metadata,
            origin: "manual",
            event: {
                ...activeRun.invocation.metadata.event,
                context: {
                    ...activeRun.invocation.metadata.event.context,
                    conversationId: "",
                },
            },
        },
    },
};
assert.deepEqual(classifyCompletedReportRunConversationAction(completed, {
    trustedConversationId: "conversation-1",
}), {
    type: "activate",
    request: {
        reportRunId: "server-run-1",
        conversationId: "conversation-1",
        turnId: "turn-7",
        windowId: "window-3",
        expectedRunRevision: 3,
        expectedContextRevision: 10,
        source: "prompt",
    },
});
assert.deepEqual(classifyCompletedReportRunConversationAction(completedManualStandalone, {
    trustedConversationId: "conversation-2",
}), {
    type: "adopt",
    request: {
        reportRunId: "manual-standalone-1",
        conversationId: "conversation-2",
        expectedRunRevision: 3,
        source: "manual",
    },
}, "standalone adoption sends only exact run/CAS identity and trusted conversation/source");
[
    [completedManualStandalone, ""],
    [{ ...completedManualStandalone, conversationId: "foreign-conversation" }, "conversation-2"],
    [{ ...completedManualStandalone, origin: "prompt" }, "conversation-2"],
    [{ ...completedManualStandalone, durable: false }, "conversation-2"],
    [{ ...completedManualStandalone, status: "running" }, "conversation-2"],
].forEach(([run, trustedConversationId]) => {
    assert.deepEqual(
        classifyCompletedReportRunConversationAction(run, { trustedConversationId }),
        { type: "reject" },
    );
});

assert.ok(buildCompletedReportRunConversationSelectionKey(completedManualStandalone, {
    trustedConversationId: "conversation-2",
}));
assert.equal(buildCompletedReportRunConversationSelectionKey(completedManualStandalone, {
    trustedConversationId: "",
}), "");

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, reject, resolve };
};
const selectedR2 = {
    ...completed,
    runId: "server-run-2",
    reportRunId: "server-run-2",
    revision: 5,
    contextRevision: 11,
};

let currentSelection = completed;
const deferredActivation = deferred();
const lateActivation = coordinateCompletedReportRunConversation({
    handler: { activate: () => deferredActivation.promise },
    activeRun: completed,
    trustedConversationId: "conversation-1",
    isCurrent: () => currentSelection.reportRunId === completed.reportRunId,
});
currentSelection = selectedR2;
deferredActivation.resolve({ activeReportRunId: completed.reportRunId, revision: 12 });
const lateActivationResult = await lateActivation;
assert.equal(lateActivationResult.stale, true);
assert.equal(currentSelection.reportRunId, "server-run-2");
assert.equal(currentSelection.contextRevision, 11, "late R1 activation cannot revise or replace selected R2");

currentSelection = completed;
const rejectedActivation = deferred();
const lateRejectedActivation = coordinateCompletedReportRunConversation({
    handler: { activate: () => rejectedActivation.promise },
    activeRun: completed,
    trustedConversationId: "conversation-1",
    isCurrent: () => currentSelection.reportRunId === completed.reportRunId,
});
currentSelection = selectedR2;
rejectedActivation.reject(new Error("stale activation denied"));
assert.equal((await lateRejectedActivation).stale, true, "a stale rejected activation becomes a no-op");
await assert.rejects(reconcileCompletedReportRunConversation({
    activate: async () => {
        throw new Error("current activation denied");
    },
}, completed, {
    trustedConversationId: "conversation-1",
}), /current activation denied/, "a current activation error remains visible");

currentSelection = completedManualStandalone;
const deferredAdoption = deferred();
const deferredAdoptionStarted = deferred();
let deferredAdoptionInput = null;
const lateAdoption = coordinateCompletedReportRunConversation({
    handler: {
        getContext: async () => ({
            enabled: true,
            context: {
                conversationId: "conversation-2",
                activeReportRunId: "existing-run",
                revision: 7,
            },
        }),
        adopt: (input) => {
            deferredAdoptionInput = input;
            deferredAdoptionStarted.resolve();
            return deferredAdoption.promise;
        },
    },
    activeRun: completedManualStandalone,
    trustedConversationId: "conversation-2",
    isCurrent: () => currentSelection.reportRunId === completedManualStandalone.reportRunId,
});
await deferredAdoptionStarted.promise;
currentSelection = selectedR2;
deferredAdoption.resolve({
    run: {
        reportRunId: completedManualStandalone.reportRunId,
        conversationId: "conversation-2",
        origin: "manual",
        status: "completed",
        revision: 4,
    },
    context: {
        activeReportRunId: completedManualStandalone.reportRunId,
        conversationId: "conversation-2",
        revision: 8,
    },
});
const lateAdoptionResult = await lateAdoption;
assert.equal(lateAdoptionResult.stale, true);
assert.equal(deferredAdoptionInput.expectedContextRevision, 7);
assert.equal(currentSelection.reportRunId, "server-run-2");
assert.equal(currentSelection.revision, 5, "late R1 adoption cannot revise or replace selected R2");

currentSelection = completedManualStandalone;
const rejectedAdoption = deferred();
const rejectedAdoptionStarted = deferred();
const lateRejectedAdoption = coordinateCompletedReportRunConversation({
    handler: {
        getContext: async () => ({ enabled: true, context: null }),
        adopt: () => {
            rejectedAdoptionStarted.resolve();
            return rejectedAdoption.promise;
        },
    },
    activeRun: completedManualStandalone,
    trustedConversationId: "conversation-2",
    isCurrent: () => currentSelection.reportRunId === completedManualStandalone.reportRunId,
});
await rejectedAdoptionStarted.promise;
currentSelection = selectedR2;
rejectedAdoption.reject(new Error("stale adoption denied"));
assert.equal((await lateRejectedAdoption).stale, true, "a stale rejected adoption becomes a no-op");
await assert.rejects(reconcileCompletedReportRunConversation({
    getContext: async () => ({ enabled: true, context: null }),
    adopt: async () => {
        throw new Error("current adoption denied");
    },
}, completedManualStandalone, {
    trustedConversationId: "conversation-2",
}), /current adoption denied/, "a current adoption error remains visible");

currentSelection = completedManualStandalone;
const deferredContextRead = deferred();
let adoptionAfterStaleContextRead = 0;
const lateContextRead = coordinateCompletedReportRunConversation({
    handler: {
        getContext: () => deferredContextRead.promise,
        adopt: async () => {
            adoptionAfterStaleContextRead += 1;
            return null;
        },
    },
    activeRun: completedManualStandalone,
    trustedConversationId: "conversation-2",
    isCurrent: () => currentSelection.reportRunId === completedManualStandalone.reportRunId,
});
currentSelection = selectedR2;
deferredContextRead.resolve({ enabled: true, context: null });
assert.equal((await lateContextRead).stale, true);
assert.equal(adoptionAfterStaleContextRead, 0, "stale selection after context read never reaches adopt");

const adoptedSuccess = {
    run: {
        reportRunId: completedManualStandalone.reportRunId,
        conversationId: "conversation-2",
        origin: "manual",
        status: "completed",
        revision: 4,
    },
    context: {
        activeReportRunId: completedManualStandalone.reportRunId,
        conversationId: "conversation-2",
        revision: 1,
    },
};
let noContextAdoptInput = null;
const firstAdoption = await reconcileCompletedReportRunConversation({
    getContext: async () => ({ enabled: true, context: null }),
    adopt: async (input) => {
        noContextAdoptInput = input;
        return adoptedSuccess;
    },
}, completedManualStandalone, {
    trustedConversationId: "conversation-2",
});
assert.equal(firstAdoption.applied, true);
assert.equal(noContextAdoptInput.expectedContextRevision, 0, "an authenticated conversation without context adopts at revision zero");
assert.equal(firstAdoption.run.conversationId, "conversation-2");
assert.equal(firstAdoption.run.invocation.metadata.event.context.conversationId, "conversation-2");
assert.equal(firstAdoption.run.revision, 4);
assert.equal(firstAdoption.run.contextRevision, 1);

let existingContextAdoptInput = null;
const existingContextAdoption = await reconcileCompletedReportRunConversation({
    getContext: async () => ({
        enabled: true,
        context: {
            conversationId: "conversation-2",
            activeReportRunId: "existing-run",
            revision: 7,
        },
    }),
    adopt: async (input) => {
        existingContextAdoptInput = input;
        return {
            ...adoptedSuccess,
            context: { ...adoptedSuccess.context, revision: 8 },
        };
    },
}, completedManualStandalone, {
    trustedConversationId: "conversation-2",
});
assert.equal(existingContextAdoption.applied, true);
assert.equal(existingContextAdoptInput.expectedContextRevision, 7, "adoption uses the exact target context revision");
assert.equal(existingContextAdoption.run.contextRevision, 8);

let disabledContextAdoptCalls = 0;
const disabledContextRead = await reconcileCompletedReportRunConversation({
    getContext: async () => ({ enabled: false, context: null }),
    adopt: async () => {
        disabledContextAdoptCalls += 1;
    },
}, completedManualStandalone, {
    trustedConversationId: "conversation-2",
});
assert.equal(disabledContextRead.enabled, false);
assert.equal(disabledContextAdoptCalls, 0);
await assert.rejects(reconcileCompletedReportRunConversation({
    getContext: async () => ({ enabled: true }),
    adopt: async () => assert.fail("an invalid context response must fail closed before adoption"),
}, completedManualStandalone, {
    trustedConversationId: "conversation-2",
}), /invalid response/);
const disabledAdoption = await reconcileCompletedReportRunConversation({
    getContext: async () => ({ enabled: true, context: null }),
    adopt: async () => ({ enabled: false }),
}, completedManualStandalone, {
    trustedConversationId: "conversation-2",
});
assert.equal(disabledAdoption.applied, false);
assert.equal(disabledAdoption.enabled, false);
assert.equal(disabledAdoption.run, completedManualStandalone, "feature-off is not a false adoption success");

const reconciliationStateRef = { current: null };
let coordinatedContextReads = 0;
let coordinatedAdoptions = 0;
let coordinatedApplications = 0;
let coordinatedSelection = completedManualStandalone;
const coordinatedAdoptResult = deferred();
const coordinatedHandler = {
    getContext: async () => {
        coordinatedContextReads += 1;
        return { enabled: true, context: null };
    },
    adopt: async () => {
        coordinatedAdoptions += 1;
        return coordinatedAdoptResult.promise;
    },
    activate: async () => {
        assert.fail("an adopted result key must not cause redundant activation");
    },
};
const coordinateSelection = () => coordinateCompletedReportRunConversation({
    handler: coordinatedHandler,
    activeRun: coordinatedSelection,
    trustedConversationId: "conversation-2",
    stateRef: reconciliationStateRef,
    isCurrent: () => coordinatedSelection.reportRunId === completedManualStandalone.reportRunId,
    applyRun: (run) => {
        coordinatedApplications += 1;
        coordinatedSelection = run;
    },
});
const coordinatedFirst = coordinateSelection();
const coordinatedDuplicate = coordinateSelection();
assert.equal(coordinatedFirst, coordinatedDuplicate, "duplicate selection observations share one host operation");
coordinatedAdoptResult.resolve(adoptedSuccess);
const coordinatedResult = await coordinatedFirst;
assert.equal(coordinatedResult.applied, true, "an exact retained completed selection triggers reconciliation");
assert.deepEqual({
    contextReads: coordinatedContextReads,
    adoptions: coordinatedAdoptions,
    applications: coordinatedApplications,
}, { contextReads: 1, adoptions: 1, applications: 1 });
assert.equal((await coordinateSelection()).duplicate, true, "the applied adopted identity is deduplicated");

let rejectedAdoptionCalls = 0;
let rejectedContextCalls = 0;
const rejectedHandler = {
    getContext: async () => {
        rejectedContextCalls += 1;
        return { enabled: true, context: null };
    },
    adopt: async () => {
        rejectedAdoptionCalls += 1;
        return adoptedSuccess;
    },
};
await reconcileCompletedReportRunConversation(rejectedHandler, completedManualStandalone, {
    trustedConversationId: "",
});
await reconcileCompletedReportRunConversation(rejectedHandler, {
    ...completedManualStandalone,
    conversationId: "foreign-conversation",
}, {
    trustedConversationId: "conversation-2",
});
assert.equal(rejectedAdoptionCalls, 0, "no-trusted and foreign runs never reach the adoption host boundary");
assert.equal(rejectedContextCalls, 0, "no-trusted and foreign runs never read a conversation context");

const unrelatedStandaloneRun = {
    ...completedManualStandalone,
    runId: "manual-standalone-unrelated",
    reportRunId: "manual-standalone-unrelated",
    invocation: {
        ...completedManualStandalone.invocation,
        runId: "manual-standalone-unrelated",
    },
};
const selectedStandaloneKey = buildCompletedReportRunConversationSelectionKey(
    completedManualStandalone,
    { trustedConversationId: "conversation-2" },
);
let unrelatedContextReads = 0;
let unrelatedAdoptions = 0;
const unrelatedAdoption = await coordinateCompletedReportRunConversation({
    handler: {
        getContext: async () => {
            unrelatedContextReads += 1;
            return { enabled: true, context: null };
        },
        adopt: async () => {
            unrelatedAdoptions += 1;
            return adoptedSuccess;
        },
    },
    activeRun: unrelatedStandaloneRun,
    trustedConversationId: "conversation-2",
    isCurrent: () => buildCompletedReportRunConversationSelectionKey(
        unrelatedStandaloneRun,
        { trustedConversationId: "conversation-2" },
    ) === selectedStandaloneKey,
});
assert.equal(unrelatedAdoption.stale, true);
assert.deepEqual({ unrelatedContextReads, unrelatedAdoptions }, {
    unrelatedContextReads: 0,
    unrelatedAdoptions: 0,
}, "an unrelated null-conversation run cannot auto-adopt merely because a trusted conversation exists");

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
assert.equal(matchesReportRunSettlementApplicationCurrency(activeRun, successEvent, {
    ...exactSuccessSettlementCurrency,
    trustedConversationId: "conversation-1",
    currentTrustedConversationId: "conversation-1",
}), true, "exact settlement success remains applicable in its captured trusted conversation");
assert.equal(matchesReportRunSettlementApplicationCurrency(activeRun, successEvent, {
    ...exactSuccessSettlementCurrency,
    trustedConversationId: "conversation-1",
    currentTrustedConversationId: "conversation-2",
}), false, "a conversation change invalidates success application even when run fingerprints remain exact");
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
