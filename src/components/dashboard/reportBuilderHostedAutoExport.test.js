import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as reportBuilderHostedReportActivationModule from "./reportBuilderHostedReportActivation.js";
import * as reportBuilderRunPersistenceModule from "./reportBuilderRunPersistence.js";
import {
    beginAndDispatchReportRun,
    bindReportRunInvocation,
    captureReportRunDispatchSnapshot,
    captureReportRunSettlementEvent,
    resolveHostedReportAutoExportDecision,
    settleReportRunInvocation,
} from "./reportBuilderRunPersistence.js";
import { resolveReportBuilderExportSubmission } from "./reportBuilderExportSubmission.js";

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
const buildHostedReportLifecycleContextKey =
    reportBuilderRunPersistenceModule.buildHostedReportLifecycleContextKey
    || (() => "");

const reportSpec = {
    kind: "reportSpec",
    version: 1,
    title: "Hosted report",
    blocks: [],
};
const reportPrintDefinition = {
    kind: "reportPrint",
    version: 1,
    specVersion: 1,
    specHash: "hosted-report-spec",
    title: "Hosted report",
    source: { kind: "dashboard.reportBuilder" },
    pageGeometry: { width: 612, height: 792 },
};
const materializedExportRequest = {
    kind: "reportExportRequest",
    target: { format: "pdf" },
    reportSpec,
    reportFill: { kind: "reportFill", version: 1, rows: [] },
    reportPrint: {
        ...reportPrintDefinition,
        fillVersion: 1,
        fillHash: "hosted-report-fill",
        pages: [],
    },
};
const snapshot = captureReportRunDispatchSnapshot({
    request: { orderId: 2676946 },
    readiness: { canRun: true },
    materialization: {
        reportDocument: {
            kind: "reportDocument",
            title: "Hosted report",
            layout: { items: [{ blockId: "summary", span: 12 }] },
        },
        reportSpec,
        reportPrintDefinition,
    },
    materializedExportRequest,
    metadata: {
        origin: "prompt",
        event: {
            context: { conversationId: "conversation-1" },
        },
    },
});
const hostedContextKey = buildHostedReportLifecycleContextKey({ conversationId: "conversation-1" });
let activeRun = bindReportRunInvocation({
    runId: "persisted-run-1",
    reportRunId: "persisted-run-1",
    durable: true,
    status: "running",
}, snapshot);
let completedRunSignal = null;
let submittedRunKey = "";
const runKey = `hosted-report-1::${snapshot.materializationFingerprint}::1::pdf`;
let runSubmissions = 0;
let legacySubmissions = 0;
const reportExportHandler = {
    async submitRun(input) {
        runSubmissions += 1;
        assert.equal(input.reportRunId, "persisted-run-1");
        return { jobId: "run-job-1" };
    },
    async submitRequest() {
        legacySubmissions += 1;
        return { jobId: "legacy-job-1" };
    },
};

async function submitHostedPdfIfReady() {
    const decision = resolveHostedReportAutoExportDecision({
        format: "pdf",
        runKey,
        submittedRunKey,
        activeRun,
        completedRunSignal,
        currentFingerprint: snapshot.fingerprint,
        currentMaterializationFingerprint: snapshot.materializationFingerprint,
        currentContextKey: hostedContextKey,
    });
    if (!decision) {
        return null;
    }
    submittedRunKey = decision.runKey;
    const submission = resolveReportBuilderExportSubmission({
        request: { target: { format: "pdf" } },
        sourceKind: "draft",
        conversationId: "conversation-1",
        reportExportHandler,
        runReference: decision.runReference,
        requireRunReference: decision.requireRunReference,
    });
    assert.equal(submission?.mode, "run");
    return submission.execute();
}

assert.equal(await submitHostedPdfIfReady(), null);
assert.equal(runSubmissions, 0);
assert.equal(legacySubmissions, 0, "pending persistence must not fall back to request export");
assert.equal(submittedRunKey, "", "a pending durable run must not latch auto-export");

let releaseCompletion;
const completionBarrier = new Promise((resolve) => {
    releaseCompletion = resolve;
});
const settlementEvent = captureReportRunSettlementEvent(activeRun, {
    runId: activeRun.invocation.runId,
    fingerprint: activeRun.invocation.fingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    currentFingerprint: snapshot.fingerprint,
    currentMaterializationFingerprint: snapshot.materializationFingerprint,
    dispatchFingerprint: `${snapshot.fingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: snapshot.materializedExportRequest,
});
const pendingSettlement = settleReportRunInvocation(activeRun, settlementEvent, {
    complete: async (run) => {
        await completionBarrier;
        return { ...run, status: "completed" };
    },
});

await Promise.resolve();
assert.equal(await submitHostedPdfIfReady(), null);
assert.equal(runSubmissions, 0);
assert.equal(legacySubmissions, 0, "auto-export must stay idle while persistence is in flight");

releaseCompletion();
activeRun = (await pendingSettlement).run;
assert.equal(await submitHostedPdfIfReady(), null);
assert.equal(runSubmissions, 0, "completion must be published through the exact lifecycle signal first");
completedRunSignal = {
    runId: activeRun.runId,
    reportRunId: activeRun.reportRunId,
    fingerprint: activeRun.invocation.fingerprint,
    requestFingerprint: activeRun.invocation.requestFingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    contextKey: hostedContextKey,
};

await submitHostedPdfIfReady();
await submitHostedPdfIfReady();
assert.equal(runSubmissions, 1, "durable completion should submit exactly one export-from-run PDF");
assert.equal(legacySubmissions, 0);

const staleSignalDecision = resolveHostedReportAutoExportDecision({
    format: "pdf",
    runKey: "hosted-report-2::pdf",
    activeRun: {
        ...activeRun,
        runId: "persisted-run-2",
        reportRunId: "persisted-run-2",
        invocation: {
            runId: "persisted-run-2",
            fingerprint: snapshot.fingerprint,
            requestFingerprint: snapshot.requestFingerprint,
            materializationFingerprint: snapshot.materializationFingerprint,
        },
    },
    completedRunSignal,
    currentFingerprint: snapshot.fingerprint,
    currentMaterializationFingerprint: snapshot.materializationFingerprint,
    currentContextKey: hostedContextKey,
});
assert.equal(staleSignalDecision, null, "a stale completed signal must not export a superseded run");

const staleMaterializationDecision = resolveHostedReportAutoExportDecision({
    format: "pdf",
    runKey: "hosted-report-3::pdf",
    activeRun,
    completedRunSignal,
    currentFingerprint: snapshot.requestFingerprint,
    currentMaterializationFingerprint: `${snapshot.materializationFingerprint}::changed-layout`,
    currentContextKey: hostedContextKey,
});
assert.equal(staleMaterializationDecision, null, "hosted PDF must reject a completed run for an old materialization");

const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
    "utf8",
);
assert.match(
    source,
    /activeRunEventRef\.current = settled;[\s\S]*setCompletedDurableRunSignal\(completedRunReference/,
    "the completion signal must be published only after durable settlement",
);
assert.match(
    source,
    /resolveHostedReportAutoExportDecision\(\{[\s\S]*completedRunSignal: completedDurableRunSignal,[\s\S]*currentMaterializationFingerprint: currentReportMaterializationFingerprint,[\s\S]*if \(!decision\) \{[\s\S]*exportOnCompleteRunKeyRef\.current = decision\.runKey;[\s\S]*requireRunReference: true/,
    "hosted auto-export must wait without latching and then submit its exact run",
);
assert.equal(
    source.includes("const exportIdentity = hostedReportExecutionIdentity"),
    true,
    "hosted export-on-complete must use the same stable identity as dedicated execute-on-open",
);
assert.equal(
    source.includes("const exportRunKey = [\n            hostedReportLifecycleContextKey,")
        && source.includes("hostedReportLifecycleContextKey,"),
    true,
    "hosted auto-export must be scoped to the same mounted host context as execute-on-open and initialization",
);
assert.equal(
    source.includes("if (hostedExecuteOnOpen && hostedExecuteOnOpenHostAction !== \"execute\") {")
        && source.includes("hostedExecuteOnOpenHostAction,"),
    true,
    "historical hosted replay must not resubmit export-on-complete side effects",
);

const mountedContextA = {
    conversationId: "conversation-mounted-a",
    turnId: "",
    windowId: "",
    windowKey: "",
};
const mountedContextB = {
    conversationId: "conversation-mounted-b",
    turnId: "turn-not-required-for-scope",
    windowId: "window-mounted-b",
    windowKey: "window-key-mounted-b",
};
const mountedContextAKey = buildHostedReportLifecycleContextKey(mountedContextA);
const mountedContextARepeatKey = buildHostedReportLifecycleContextKey({
    ...mountedContextA,
    turnId: "a-later-turn-must-not-fragment-the-mounted-context",
});
const mountedContextALateWindowKey = buildHostedReportLifecycleContextKey({
    ...mountedContextA,
    windowId: "late-window-hydration-must-not-fragment-a-known-conversation",
});
const mountedContextBKey = buildHostedReportLifecycleContextKey(mountedContextB);
const mountedWindowFallbackAKey = buildHostedReportLifecycleContextKey({
    conversationId: "",
    windowKey: "window-fallback-a",
});
const mountedWindowFallbackBKey = buildHostedReportLifecycleContextKey({
    conversationId: "",
    windowKey: "window-fallback-b",
});
const mountedLifecycleState = {
    contextKey: mountedContextAKey,
    executeKey: "",
    initializationKey: "",
    ownedRunId: "",
    exportKey: "",
    completedRunSignal: null,
};
let mountedDurableBeginCount = 0;
let mountedContextResetCount = 0;
const renderMountedHostedLifecycle = (context) => {
    const contextKey = buildHostedReportLifecycleContextKey(context);
    if (mountedLifecycleState.contextKey !== contextKey) {
        mountedContextResetCount += 1;
        mountedLifecycleState.contextKey = contextKey;
        mountedLifecycleState.executeKey = "";
        mountedLifecycleState.initializationKey = "";
        mountedLifecycleState.ownedRunId = "";
        mountedLifecycleState.exportKey = "";
        mountedLifecycleState.completedRunSignal = null;
    }
    const executeKey = [
        contextKey,
        "performance_inventory_brief",
        snapshot.requestFingerprint,
        "1",
    ].join("::");
    const initializationKey = [
        contextKey,
        "performance_inventory_brief",
        snapshot.requestFingerprint,
        "1",
        "initialization",
    ].join("::");
    const exportKey = [
        contextKey,
        "performance_inventory_brief",
        snapshot.materializationFingerprint,
        "1",
        "pdf",
    ].join("::");
    if (mountedLifecycleState.executeKey !== executeKey) {
        mountedDurableBeginCount += 1;
        mountedLifecycleState.executeKey = executeKey;
        mountedLifecycleState.ownedRunId = `mounted-run-${mountedDurableBeginCount}`;
    }
    mountedLifecycleState.initializationKey = initializationKey;
    mountedLifecycleState.exportKey = exportKey;
    mountedLifecycleState.completedRunSignal = {
        runId: mountedLifecycleState.ownedRunId,
    };
    return { executeKey, initializationKey, exportKey };
};
const mountedContextAFirst = renderMountedHostedLifecycle(mountedContextA);
const mountedContextARepeat = renderMountedHostedLifecycle({
    ...mountedContextA,
    turnId: "a-later-turn-must-not-fragment-the-mounted-context",
});
const mountedContextBFirst = renderMountedHostedLifecycle(mountedContextB);
const mountedContextBRepeat = renderMountedHostedLifecycle(mountedContextB);
assert.deepEqual({
    contextAKeyDeterministic: mountedContextAKey === mountedContextARepeatKey,
    knownConversationIgnoresLateWindowHydration:
        mountedContextAKey === mountedContextALateWindowKey,
    contextAKeyPresentWithoutTurnOrWindow: !!mountedContextAKey,
    contextChanged: mountedContextAKey !== mountedContextBKey,
    windowFallbackContextsDiffer:
        mountedWindowFallbackAKey !== mountedWindowFallbackBKey,
    sameContextExecuteDeduplicated:
        mountedContextAFirst.executeKey === mountedContextARepeat.executeKey,
    newContextExecuteChanged:
        mountedContextAFirst.executeKey !== mountedContextBFirst.executeKey,
    newContextInitializationChanged:
        mountedContextAFirst.initializationKey !== mountedContextBFirst.initializationKey,
    newContextExportChanged:
        mountedContextAFirst.exportKey !== mountedContextBFirst.exportKey,
    secondContextRerenderDeduplicated:
        mountedContextBFirst.executeKey === mountedContextBRepeat.executeKey,
    durableBeginCount: mountedDurableBeginCount,
    contextResetCount: mountedContextResetCount,
    finalOwnedRunId: mountedLifecycleState.ownedRunId,
    completedSignalRunId: mountedLifecycleState.completedRunSignal?.runId || "",
}, {
    contextAKeyDeterministic: true,
    knownConversationIgnoresLateWindowHydration: true,
    contextAKeyPresentWithoutTurnOrWindow: true,
    contextChanged: true,
    windowFallbackContextsDiffer: true,
    sameContextExecuteDeduplicated: true,
    newContextExecuteChanged: true,
    newContextInitializationChanged: true,
    newContextExportChanged: true,
    secondContextRerenderDeduplicated: true,
    durableBeginCount: 2,
    contextResetCount: 1,
    finalOwnedRunId: "mounted-run-2",
    completedSignalRunId: "mounted-run-2",
}, "a reused mounted builder must scope execute, initialization, ownership, and export lifecycles to host conversation/window context");

const staleCommitContainerA = {
    parameters: {
        sourceKind: "report",
        sourceId: "saved-report-a",
        artifactId: "artifact-a",
        executeOnOpen: true,
        exportOnComplete: "pdf",
    },
};
const staleCommitContainerB = {
    parameters: {
        sourceKind: "report",
        sourceId: "saved-report-b",
        artifactId: "artifact-b",
        executeOnOpen: true,
        exportOnComplete: "pdf",
    },
};
const staleCommitContextA = { conversationId: "conversation-stale-a" };
const staleCommitContextB = { conversationId: "conversation-current-b" };
const staleCommitContextAKey = buildHostedReportLifecycleContextKey(staleCommitContextA);
const staleCommitContextBKey = buildHostedReportLifecycleContextKey(staleCommitContextB);
const staleCommitActivationIdentityB = resolveHostedReportActivationIdentity(staleCommitContainerB);
const staleCommitSnapshotA = captureReportRunDispatchSnapshot({
    request: snapshot.request,
    readiness: snapshot.readiness,
    materialization: snapshot.materialization,
    materializedExportRequest: snapshot.materializedExportRequest,
    metadata: {
        origin: "prompt",
        source: { kind: "report", id: "saved-report-a" },
        event: { context: staleCommitContextA },
    },
});
const staleCommitSnapshotB = captureReportRunDispatchSnapshot({
    request: snapshot.request,
    readiness: snapshot.readiness,
    materialization: snapshot.materialization,
    materializedExportRequest: snapshot.materializedExportRequest,
    metadata: {
        origin: "prompt",
        source: { kind: "report", id: "saved-report-b" },
        event: { context: staleCommitContextB },
    },
});
let staleCommitActiveRun = {
    ...bindReportRunInvocation({
        runId: "stale-commit-run-a",
        reportRunId: "stale-commit-run-a",
        durable: true,
        status: "running",
    }, staleCommitSnapshotA),
    status: "completed",
};
let staleCommitCompletedSignal = {
    runId: "stale-commit-run-a",
    reportRunId: "stale-commit-run-a",
    fingerprint: staleCommitSnapshotA.requestFingerprint,
    requestFingerprint: staleCommitSnapshotA.requestFingerprint,
    materializationFingerprint: staleCommitSnapshotA.materializationFingerprint,
    contextKey: staleCommitContextAKey,
};
let staleCommitExecuteKey = "";
let staleCommitExportKey = "";
let staleCommitBeginCount = 0;
let staleCommitDispatchCount = 0;
let staleCommitExportCount = 0;

async function flushStaleCommitHostedEffects(activationState) {
    const activationCurrent = matchesHostedReportActivationCurrent({
        activationRequired: true,
        activationIdentity: staleCommitActivationIdentityB,
        activationState,
    });
    if (!activationCurrent) {
        return;
    }
    const executeKey = [
        staleCommitContextBKey,
        "saved-report-b",
        staleCommitSnapshotB.requestFingerprint,
        "1",
    ].join("::");
    let beginPromise = null;
    if (staleCommitExecuteKey !== executeKey) {
        staleCommitExecuteKey = executeKey;
        beginPromise = beginAndDispatchReportRun(staleCommitSnapshotB, {
            begin: async (invocationSnapshot) => {
                staleCommitBeginCount += 1;
                await Promise.resolve();
                staleCommitActiveRun = bindReportRunInvocation({
                    runId: "stale-commit-run-b",
                    reportRunId: "stale-commit-run-b",
                    durable: true,
                    status: "running",
                }, invocationSnapshot);
                return { ok: true, runId: "stale-commit-run-b", durable: true };
            },
            dispatch: () => {
                staleCommitDispatchCount += 1;
                return { ok: true };
            },
        });
    }
    const exportKey = [
        staleCommitContextBKey,
        "saved-report-b",
        staleCommitSnapshotB.materializationFingerprint,
        "1",
        "pdf",
    ].join("::");
    const exportDecision = resolveHostedReportAutoExportDecision({
        format: "pdf",
        runKey: exportKey,
        submittedRunKey: staleCommitExportKey,
        activeRun: staleCommitActiveRun,
        completedRunSignal: staleCommitCompletedSignal,
        currentFingerprint: staleCommitSnapshotB.requestFingerprint,
        currentMaterializationFingerprint: staleCommitSnapshotB.materializationFingerprint,
        currentContextKey: staleCommitContextBKey,
    });
    if (exportDecision) {
        staleCommitExportKey = exportDecision.runKey;
        staleCommitExportCount += 1;
    }
    await beginPromise;
}

await flushStaleCommitHostedEffects({ reportId: "artifact-a", status: "ready" });
assert.deepEqual({
    beginCount: staleCommitBeginCount,
    dispatchCount: staleCommitDispatchCount,
    exportCount: staleCommitExportCount,
}, {
    beginCount: 0,
    dispatchCount: 0,
    exportCount: 0,
}, "a stale ready activation and completed run from report A must authorize nothing in report B's passive-effect flush");

await flushStaleCommitHostedEffects({ reportId: "artifact-b", status: "ready" });
assert.deepEqual({
    beginCount: staleCommitBeginCount,
    dispatchCount: staleCommitDispatchCount,
    exportCount: staleCommitExportCount,
    activeRunId: staleCommitActiveRun.runId,
}, {
    beginCount: 1,
    dispatchCount: 1,
    exportCount: 0,
    activeRunId: "stale-commit-run-b",
}, "current report B activation must begin exactly once without exporting before B completes");

staleCommitActiveRun = { ...staleCommitActiveRun, status: "completed" };
staleCommitCompletedSignal = {
    runId: "stale-commit-run-b",
    reportRunId: "stale-commit-run-b",
    fingerprint: staleCommitSnapshotB.requestFingerprint,
    requestFingerprint: staleCommitSnapshotB.requestFingerprint,
    materializationFingerprint: staleCommitSnapshotB.materializationFingerprint,
    contextKey: staleCommitContextBKey,
};
await flushStaleCommitHostedEffects({ reportId: "artifact-b", status: "ready" });
await flushStaleCommitHostedEffects({ reportId: "artifact-b", status: "ready" });
assert.deepEqual({
    beginCount: staleCommitBeginCount,
    dispatchCount: staleCommitDispatchCount,
    exportCount: staleCommitExportCount,
}, {
    beginCount: 1,
    dispatchCount: 1,
    exportCount: 1,
}, "report B must export exactly once only after its exact context-bound completion signal is current");

assert.equal(
    source.includes("hostedReportActivationCurrent")
        && source.includes("currentContextKey: hostedReportLifecycleContextKey"),
    true,
    "ReportBuilder execute, initialization, and export wiring must use synchronous activation and context currency",
);

console.log("reportBuilderHostedAutoExport ✓ waits for exact durable completion, rejects stale signals, and never falls back");
