import assert from "node:assert/strict";

import * as reportBuilderHooksModule from "./reportBuilderHooks.js";
import * as reportBuilderRunPersistenceModule from "./reportBuilderRunPersistence.js";
import {
    activeWindows,
    getFormSignal,
    restoreWindowsFromSnapshot,
} from "../../core/store/signals.js";
import { runUICommand } from "../../core/ui/commands.js";
import {
    bindReportRunInitializationTransitionAttempt,
    bindReportRunInvocation,
    buildReportRunBeginDeduplicationKey,
    buildReportRunPendingBeginDeduplicationKey,
    buildReportRunInitializationTransitionKey,
    captureReportRunDispatchSnapshot,
    captureReportRunSettlementEvent,
    classifyReportRunSupersede,
    completeAndActivateReportRun,
    coordinateCompletedReportRunConversation,
    matchesHostedReportRunInitializationFreshnessFailure,
    resolveAuthoredRuntimeSettlementDecision,
    resolveAuthoredRuntimeSettlementReadiness,
    resolveHostedReportRunInitializationReadiness,
    resolveHostedReportRunInitializationOwnership,
    resolveReportRunBeginReuseDecision,
    resolveReportRunDisabledLegacyFallback,
    resolveReportRunDurableCapability,
    resolveReportRunInitializationLatch,
    resolveReportRunInitializationTransitionAttempt,
    resolveReportRunInitializationTransition,
    settleReportRunInvocation,
    shouldDeferReportRunSupersedeForInitialization,
} from "./reportBuilderRunPersistence.js";
import {
    buildReportRuntimePreviewFreshnessError,
    resolveReportRuntimePreviewFreshnessRecovery,
} from "./reportRuntimePreviewFreshnessRecovery.js";
import {
    resolveReportBuilderSurfaceAutoRunAction,
} from "./reportBuilderSurfaceAutoRun.js";
import { buildReportRuntimePreviewRequestKey } from "./useReportRuntimePreviewRows.js";

function buildSnapshot({
    request = { advertiserId: 731, dateRange: { start: "2026-07-01", end: "2026-07-31" } },
    rows = [],
    rendererRequest = null,
    calculatedFields = [],
    origin = "prompt",
    title = "Hosted inventory brief",
    reportId = "inventory-brief",
    builderRef = "inventory-report-builder",
    sourceKind = "preset",
    conversationId = "conversation-1",
    turnId = "turn-7",
    windowId = "window-3",
    includeOrigin = true,
} = {}) {
    const reportSpec = {
        kind: "reportSpec",
        version: 1,
        title,
        blocks: [{ id: "inventory-table", kind: "table" }],
        ...(rendererRequest ? {
            datasets: [{
                id: "primary",
                request: rendererRequest,
            }],
        } : {}),
        ...(calculatedFields.length > 0 ? { calculatedFields } : {}),
    };
    const reportPrintDefinition = {
        kind: "reportPrint",
        version: 1,
        specVersion: 1,
        specHash: `spec:${title}`,
        title,
        source: { kind: "dashboard.reportBuilder", from: "preset" },
        pageGeometry: { width: 612, height: 792 },
    };
    const reportFill = {
        kind: "reportFill",
        version: 1,
        specHash: reportPrintDefinition.specHash,
        rows,
    };
    const reportPrint = {
        ...reportPrintDefinition,
        fillVersion: 1,
        fillHash: `fill:${rows.length}`,
        pages: [{ id: "page-1", rowCount: rows.length }],
    };
    const materializedExportRequest = {
        kind: "reportExportRequest",
        target: { format: "pdf" },
        reportSpec,
        reportFill,
        reportPrint,
    };
    return captureReportRunDispatchSnapshot({
        request,
        readiness: { canRun: true },
        materialization: {
            reportDocument: {
                kind: "reportDocument",
                version: 1,
                title,
                blocks: [{ id: "inventory-table", kind: "tableBlock" }],
            },
            reportSpec,
            reportPrintDefinition,
            staticDatasetPayloads: {
                inventory: { rows },
            },
        },
        materializedExportRequest,
        metadata: {
            ...(includeOrigin ? { origin } : {}),
            builderRef,
            source: {
                reportId,
                reportName: title,
                sourceKind,
            },
            event: {
                request: materializedExportRequest,
                runtimeRequest: request,
                context: {
                    conversationId,
                    turnId,
                    windowId,
                },
            },
        },
    });
}

const freshHostedExecuteOnOpenResult = await runUICommand({
    method: "ui.window.open",
    params: {
        windowId: "reportBuilder__gate-c-fresh",
        windowKey: "reportBuilder",
        windowTitle: "Performance Inventory Brief",
        parameters: {
            executeOnOpen: true,
            reportStarterId: "performance_inventory_brief",
        },
        options: {
            conversationId: "conversation-gate-c-fresh",
            presentation: "hosted",
            region: "chat.top",
            parentKey: "chat/new",
        },
    },
});
const freshHostedExecuteOnOpenWindow = activeWindows.peek().find(
    (entry) => entry.windowId === freshHostedExecuteOnOpenResult.windowId,
);
assert.equal(
    freshHostedExecuteOnOpenWindow.hostOpenState,
    "fresh",
    "a newly delivered hosted open must carry fresh host provenance",
);
assert.equal(
    typeof reportBuilderHooksModule.resolveHostedExecuteOnOpenHostAction,
    "function",
    "ReportBuilder must use a production host-provenance decision for execute-on-open",
);
assert.equal(
    reportBuilderHooksModule.resolveHostedExecuteOnOpenHostAction({
        executeOnOpen: true,
        windowState: freshHostedExecuteOnOpenWindow,
    }),
    "execute",
    "a genuinely fresh prompt-hosted open remains eligible for exactly one execute-on-open lifecycle",
);

restoreWindowsFromSnapshot({
    conversationId: "conversation-gate-c-fresh",
    selected: {
        windowId: "reportBuilder__gate-c-fresh",
        tabId: "reportBuilder__gate-c-fresh",
    },
    windows: [{
        windowId: "reportBuilder__gate-c-fresh",
        windowKey: "reportBuilder",
        windowTitle: "Performance Inventory Brief",
        conversationId: "conversation-gate-c-fresh",
        presentation: "hosted",
        region: "chat.top",
        parentKey: "chat/new",
        inTab: true,
        parameters: {
            executeOnOpen: true,
            reportStarterId: "performance_inventory_brief",
        },
    }],
});
const replayedHostedExecuteOnOpenWindow = activeWindows.peek()[0];
assert.equal(
    replayedHostedExecuteOnOpenWindow.hostOpenState,
    "historical_replay",
    "snapshot rehydration must mark the historical hosted open before ReportBuilder mounts",
);
assert.equal(
    reportBuilderHooksModule.resolveHostedExecuteOnOpenHostAction({
        executeOnOpen: true,
        windowState: replayedHostedExecuteOnOpenWindow,
    }),
    "restore",
    "historical execute-on-open must restore/render without dispatching another durable run",
);
assert.equal(
    reportBuilderHooksModule.resolveHostedExecuteOnOpenHostAction({
        executeOnOpen: true,
        windowState: null,
    }),
    "skip",
    "ambiguous hosted provenance must fail closed",
);

let gateCFreshBeginCount = 0;
let gateCFreshDispatchCount = 0;
let gateCFreshCompleteCount = 0;
let gateCFreshActivateCount = 0;
let gateCReplayBeginCount = 0;
let gateCReplayDispatchCount = 0;
const executeGateCHostedLifecycle = async (windowState, counters) => {
    const action = reportBuilderHooksModule.resolveHostedExecuteOnOpenHostAction({
        executeOnOpen: true,
        windowState,
    });
    if (action !== "execute") {
        return { action };
    }
    return reportBuilderRunPersistenceModule.beginAndDispatchReportRun(
        { requestFingerprint: "gate-c-request" },
        {
            begin: async () => {
                counters.begin();
                return { ok: true, durable: true, runId: "gate-c-run" };
            },
            dispatch: () => {
                counters.dispatch();
                return { ok: true };
            },
        },
    );
};
const gateCFreshExecution = await executeGateCHostedLifecycle(freshHostedExecuteOnOpenWindow, {
    begin: () => { gateCFreshBeginCount += 1; },
    dispatch: () => { gateCFreshDispatchCount += 1; },
});
await executeGateCHostedLifecycle(replayedHostedExecuteOnOpenWindow, {
    begin: () => { gateCReplayBeginCount += 1; },
    dispatch: () => { gateCReplayDispatchCount += 1; },
});
await executeGateCHostedLifecycle(replayedHostedExecuteOnOpenWindow, {
    begin: () => { gateCReplayBeginCount += 1; },
    dispatch: () => { gateCReplayDispatchCount += 1; },
});
assert.equal(gateCFreshExecution.runId, "gate-c-run");
const gateCFreshTerminalSnapshot = buildSnapshot({
    rows: [{ channelId: 4, channelName: "Display", totalSpend: 514 }],
    reportId: "performance_inventory_brief",
    conversationId: "conversation-gate-c-fresh",
    turnId: "",
    windowId: "reportBuilder__gate-c-fresh",
});
const gateCFreshCompletedRun = await completeAndActivateReportRun({
    complete: async (input) => {
        gateCFreshCompleteCount += 1;
        return {
            reportRunId: input.reportRunId,
            revision: 2,
            status: "completed",
        };
    },
    activate: async (input) => {
        gateCFreshActivateCount += 1;
        return {
            activeReportRunId: input.reportRunId,
            revision: 1,
        };
    },
}, {
    runId: "gate-c-run",
    reportRunId: "gate-c-run",
    revision: 1,
    contextRevision: 0,
    conversationId: "conversation-gate-c-fresh",
    turnId: "",
    windowId: "reportBuilder__gate-c-fresh",
    origin: "prompt",
    durable: true,
    status: "running",
}, gateCFreshTerminalSnapshot.materializedExportRequest);
assert.deepEqual({
    freshBegin: gateCFreshBeginCount,
    freshDispatch: gateCFreshDispatchCount,
    freshComplete: gateCFreshCompleteCount,
    freshActivate: gateCFreshActivateCount,
    freshStatus: gateCFreshCompletedRun.status,
    replayBegin: gateCReplayBeginCount,
    replayDispatch: gateCReplayDispatchCount,
}, {
    freshBegin: 1,
    freshDispatch: 1,
    freshComplete: 1,
    freshActivate: 1,
    freshStatus: "completed",
    replayBegin: 0,
    replayDispatch: 0,
}, "fresh host delivery executes once while historical replay performs no run lifecycle mutation");

for (const endpointMode of ["enabled", "unmounted"]) {
    const windowId = `reportBuilder__t5b-standalone-${endpointMode}`;
    await runUICommand({
        method: "ui.window.open",
        params: {
            windowId,
            windowKey: `reportBuilder-t5b-${endpointMode}`,
            windowTitle: "Standalone report builder",
            parameters: { mode: "design" },
        },
    });
    const lifecycleCalls = [];
    const handler = {
        complete: async (input) => {
            lifecycleCalls.push(["complete", input.reportRunId]);
            return { reportRunId: input.reportRunId, revision: 2, status: "completed" };
        },
        adopt: async () => {
            lifecycleCalls.push(["adopt"]);
            return endpointMode === "enabled"
                ? { run: {}, context: {} }
                : { enabled: false };
        },
    };
    const runStandaloneSelection = async (reportRunId, advertiserId) => {
        await runUICommand({
            method: "ui.window.setFormData",
            params: { windowId, values: { advertiserId } },
        });
        const currentParameters = getFormSignal(`${windowId}:windowForm`).peek();
        const invocation = buildSnapshot({
            request: { advertiserId: currentParameters.advertiserId },
            rows: [{ advertiserId: currentParameters.advertiserId }],
            origin: "manual",
            conversationId: "",
            turnId: "",
            windowId,
        });
        const completedRun = await completeAndActivateReportRun(handler, bindReportRunInvocation({
            runId: reportRunId,
            reportRunId,
            revision: 1,
            contextRevision: 0,
            conversationId: "",
            turnId: "",
            windowId,
            origin: "manual",
            durable: true,
            status: "running",
        }, invocation), invocation.materializedExportRequest, {
            trustedConversationId: "",
        });
        const reconciliation = await coordinateCompletedReportRunConversation({
            handler,
            activeRun: completedRun,
            trustedConversationId: "",
        });
        assert.equal(reconciliation.classification.type, "reject");
        return completedRun;
    };
    const standaloneR1 = await runStandaloneSelection(`${endpointMode}-r1`, 731);
    const standaloneR2 = await runStandaloneSelection(`${endpointMode}-r2`, 990);
    assert.deepEqual(lifecycleCalls, [
        ["complete", `${endpointMode}-r1`],
        ["complete", `${endpointMode}-r2`],
    ], `standalone R1/R2 must not adopt without a trusted conversation when adoption is ${endpointMode}`);
    assert.deepEqual([standaloneR1.status, standaloneR2.status], ["completed", "completed"]);
    assert.equal(getFormSignal(`${windowId}:windowForm`).peek().advertiserId, 990);
}

const earlySnapshot = buildSnapshot();
const finalRows = [{ inventoryId: 11, available: 42 }];
const finalSnapshot = buildSnapshot({ rows: finalRows });
assert.equal(earlySnapshot.requestFingerprint, finalSnapshot.requestFingerprint);
assert.notEqual(earlySnapshot.materializationFingerprint, finalSnapshot.materializationFingerprint);

const settledReadinessInput = {
    executeOnOpen: true,
    hasExecutionIdentity: true,
    hasBlocks: true,
    prefillReady: true,
    activationReady: true,
    definitionReady: true,
    designWorkspaceMode: false,
    collectionLoading: false,
    hasCompletedRequest: true,
    authoredRuntimeExecution: true,
    datasetLoading: false,
    primaryRowsLoading: false,
    rowsSourceLoading: false,
    updating: false,
    primaryResultSettled: true,
    datasetResultSettled: true,
    canRenderRuntime: true,
    finalArtifactsReady: true,
    error: null,
};
assert.deepEqual(resolveHostedReportRunInitializationReadiness(settledReadinessInput), {
    hostedInitialization: true,
    ready: true,
    deferSupersede: false,
});
assert.deepEqual(resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    primaryRowsLoading: true,
    rowsSourceLoading: true,
    updating: true,
}), {
    hostedInitialization: true,
    ready: false,
    deferSupersede: true,
}, "retained rows must not be treated as final while the exact primary runtime result is updating");
assert.deepEqual(resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    primaryResultSettled: false,
}), {
    hostedInitialization: true,
    ready: false,
    deferSupersede: true,
}, "a non-loading deferred cache result with retained rows remains unready until fresh current-key provenance arrives");
assert.deepEqual(resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    datasetResultSettled: false,
}), {
    hostedInitialization: true,
    ready: false,
    deferSupersede: true,
}, "a current-key published dataset response remains unready until it has fresh result provenance");
assert.deepEqual(resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    error: new Error("runtime failed"),
}), {
    hostedInitialization: true,
    ready: false,
    deferSupersede: false,
}, "runtime errors must never suppress deterministic failure");
assert.deepEqual(resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    finalArtifactsReady: false,
}), {
    hostedInitialization: true,
    ready: false,
    deferSupersede: true,
}, "the exact hosted run remains protected until its final artifacts can be handed off");
assert.deepEqual(resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    primaryResultSettled: false,
    finalArtifactsReady: false,
}), {
    hostedInitialization: true,
    ready: false,
    deferSupersede: true,
}, "the exact hosted execution remains an initialization transition before loading flags catch up to unsettled result keys");
assert.deepEqual(resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    prefillReady: false,
    finalArtifactsReady: false,
}), {
    hostedInitialization: true,
    ready: false,
    deferSupersede: true,
}, "the known same-request transition may defer while preset and prefill initialization is still pending");
assert.deepEqual(resolveAuthoredRuntimeSettlementDecision({
    authoredRuntimeExecution: true,
    hostedInitialization: true,
    hostedHandoffOwned: true,
    durableAvailable: true,
    status: "succeeded",
}), {
    owner: "hosted-final-handoff",
    settle: false,
}, "hosted initialization success belongs exclusively to the exact-final handoff");
assert.deepEqual(resolveAuthoredRuntimeSettlementDecision({
    authoredRuntimeExecution: true,
    hostedInitialization: true,
    hostedHandoffOwned: true,
    durableAvailable: true,
    status: "failed",
}), {
    owner: "authored-runtime-error",
    settle: true,
}, "the authored observer retains an exact deterministic hosted error path");
assert.deepEqual(resolveAuthoredRuntimeSettlementDecision({
    authoredRuntimeExecution: true,
    hostedInitialization: false,
    hostedHandoffOwned: false,
    durableAvailable: true,
    status: "succeeded",
}), {
    owner: "authored-runtime-observer",
    settle: true,
}, "legacy, manual, and non-hosted authored runtime success remain observer-owned");
assert.deepEqual(resolveAuthoredRuntimeSettlementDecision({
    authoredRuntimeExecution: true,
    hostedInitialization: true,
    hostedHandoffOwned: false,
    durableAvailable: false,
    status: "succeeded",
}), {
    owner: "authored-runtime-observer",
    settle: true,
}, "legacy non-durable hosted success remains observer-owned");
const durableObserverReadinessInput = {
    authoredRuntimeExecution: true,
    settlementAllowed: true,
    activeRunId: "report-run-manual",
    durable: true,
    activeRunMatchesCurrentDispatch: true,
    status: "succeeded",
    datasetLoading: false,
    datasetResultCorrelated: true,
    datasetResultFresh: true,
    primaryRowsLoading: false,
    rowsSourceLoading: false,
    updating: false,
    primaryResultCorrelated: true,
    primaryResultFresh: true,
    canRenderRuntime: true,
};
assert.equal(resolveAuthoredRuntimeSettlementReadiness({
    ...durableObserverReadinessInput,
    primaryResultFresh: false,
}), false, "a durable manual/non-hosted observer cannot settle retained primary rows from a deferred cache hit");
assert.equal(resolveAuthoredRuntimeSettlementReadiness({
    ...durableObserverReadinessInput,
    datasetResultFresh: false,
}), false, "a durable observer cannot settle while a published dataset result lacks fresh provenance");
assert.equal(resolveAuthoredRuntimeSettlementReadiness(durableObserverReadinessInput), true,
    "fresh exact primary and published-dataset results allow ordinary durable settlement");
assert.equal(resolveAuthoredRuntimeSettlementReadiness({
    ...durableObserverReadinessInput,
    status: "failed",
    primaryResultFresh: false,
    datasetResultFresh: false,
    canRenderRuntime: false,
}), true, "an exact correlated runtime error remains deterministically settleable without success artifacts");
assert.equal(resolveAuthoredRuntimeSettlementReadiness({
    ...durableObserverReadinessInput,
    durable: false,
    primaryResultFresh: false,
    datasetResultFresh: false,
}), true, "legacy non-durable authored settlement preserves its existing fallback behavior");
assert.equal(
    resolveHostedReportRunInitializationReadiness({
        ...settledReadinessInput,
        finalArtifactsReady: true,
    }).ready,
    true,
    "exactly settled zero-row output remains completable because readiness is not row-count based",
);

const earlyDurableRun = bindReportRunInvocation({
    runId: "report-run-early",
    reportRunId: "report-run-early",
    revision: 2,
    contextRevision: 9,
    conversationId: "conversation-1",
    turnId: "turn-7",
    windowId: "window-3",
    origin: "prompt",
    durable: true,
    status: "running",
}, earlySnapshot);
assert.equal(resolveHostedReportRunInitializationOwnership(earlyDurableRun, {
    hostedInitialization: true,
    durableAvailable: true,
    ownedRunId: "",
}), true, "the first running prompt invocation may be claimed by the hosted final handoff");
assert.equal(resolveHostedReportRunInitializationOwnership(earlyDurableRun, {
    hostedInitialization: true,
    durableAvailable: true,
    ownedRunId: earlyDurableRun.runId,
}), true, "the hosted handoff continues to own the exact run it claimed across rerenders");
assert.equal(resolveHostedReportRunInitializationOwnership({
    ...earlyDurableRun,
    status: "completed",
}, {
    hostedInitialization: true,
    durableAvailable: true,
    ownedRunId: earlyDurableRun.runId,
}), false, "a completed hosted initialization cannot claim later authored runtime observations");
const laterManualRun = bindReportRunInvocation({
    ...earlyDurableRun,
    runId: "report-run-later-manual",
    reportRunId: "report-run-later-manual",
    origin: "manual",
}, buildSnapshot({ rows: finalRows, origin: "manual" }));
assert.equal(resolveHostedReportRunInitializationOwnership(laterManualRun, {
    hostedInitialization: true,
    durableAvailable: true,
    ownedRunId: earlyDurableRun.runId,
}), false, "a subsequent manual run is never owned or replaced by hosted prompt initialization");
assert.deepEqual(resolveAuthoredRuntimeSettlementDecision({
    authoredRuntimeExecution: true,
    hostedInitialization: true,
    hostedHandoffOwned: resolveHostedReportRunInitializationOwnership(laterManualRun, {
        hostedInitialization: true,
        durableAvailable: true,
        ownedRunId: earlyDurableRun.runId,
    }),
    durableAvailable: true,
    status: "succeeded",
}), {
    owner: "authored-runtime-observer",
    settle: true,
}, "a manual run after hosted completion remains observer-owned and reaches terminal settlement");
const laterManualSettlementEvent = captureReportRunSettlementEvent(laterManualRun, {
    runId: laterManualRun.runId,
    requestFingerprint: laterManualRun.invocation.requestFingerprint,
    materializationFingerprint: laterManualRun.invocation.materializationFingerprint,
    currentFingerprint: laterManualRun.invocation.requestFingerprint,
    currentMaterializationFingerprint: laterManualRun.invocation.materializationFingerprint,
    dispatchFingerprint: `${laterManualRun.invocation.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: buildSnapshot({ rows: finalRows, origin: "manual" }).materializedExportRequest,
    rowCount: finalRows.length,
    resultRequestKey: "inventory:manual",
    expectedResultRequestKey: "inventory:manual",
});
let laterManualCompletionCount = 0;
const laterManualSettlement = await settleReportRunInvocation(laterManualRun, laterManualSettlementEvent, {
    complete: async (run) => {
        laterManualCompletionCount += 1;
        return { ...run, revision: run.revision + 1, status: "completed" };
    },
});
assert.equal(laterManualSettlement.accepted, true);
assert.equal(laterManualSettlement.run.status, "completed");
assert.equal(laterManualCompletionCount, 1, "the normal observer completes a later manual durable run exactly once");

const preLoadingReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    hasCompletedRequest: false,
    primaryResultSettled: false,
    datasetResultSettled: false,
    finalArtifactsReady: false,
});
assert.equal(preLoadingReadiness.deferSupersede, true);
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, finalSnapshot, {
    deferSupersede: preLoadingReadiness.deferSupersede,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), true, "the pre-loading render defers only the exact correlated materialization transition");

const liveMaturationBeginRequest = {
    orderIds: [2676946],
    dateRange: { start: "2026-07-01", end: "2026-07-31" },
    dimensions: {
        channelId: true,
        channelName: true,
    },
    measures: {
        totalSpend: true,
        impressions: true,
    },
    semanticSelection: { inventory: true },
    orderBy: [{ field: "totalSpend", direction: "desc" }],
};
const liveMaturationFinalRequest = {
    ...liveMaturationBeginRequest,
    measures: {
        ...liveMaturationBeginRequest.measures,
        clicks: true,
    },
};
const liveMaturationCalculatedFields = [{
    id: "ctr",
    key: "ctr",
    kind: "rowCalc",
    dependencies: ["clicks", "impressions"],
    expression: "clicks / impressions * 100",
}];
const liveMaturationBeginSnapshot = buildSnapshot({
    request: liveMaturationBeginRequest,
    rendererRequest: null,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
});
const liveMaturationFinalSnapshot = buildSnapshot({
    request: liveMaturationFinalRequest,
    rendererRequest: liveMaturationFinalRequest,
    calculatedFields: liveMaturationCalculatedFields,
    rows: [{
        channelId: "display",
        channelName: "Display",
        totalSpend: 514,
        impressions: 147000,
        clicks: 1470,
        ctr: 1,
    }],
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
});
assert.notEqual(
    liveMaturationBeginSnapshot.requestFingerprint,
    liveMaturationFinalSnapshot.requestFingerprint,
);
assert.equal(
    liveMaturationBeginSnapshot.materializedExportRequest.reportSpec.datasets,
    undefined,
    "the live Begin precedes renderer dataset materialization",
);
assert.deepEqual(
    liveMaturationFinalSnapshot.materializedExportRequest.reportSpec.calculatedFields[0].dependencies,
    ["clicks", "impressions"],
);
assert.equal(buildReportRunBeginDeduplicationKey(liveMaturationBeginSnapshot, {
    durable: true,
    origin: "prompt",
}), "", "the captured live Begin identity is intentionally incomplete without turnId/windowId");

let liveMaturationActiveRun = null;
let liveMaturationOriginalRun = null;
let liveMaturationOwnedRunId = "";
let liveMaturationDurableBeginCount = 0;
let liveMaturationAdoptCount = 0;
let liveMaturationDispatchCount = 0;
let liveMaturationCompletedFingerprint = liveMaturationFinalSnapshot.requestFingerprint;
const liveMaturationPostBegin = await reportBuilderRunPersistenceModule
    .beginAndDispatchReportRun(liveMaturationBeginSnapshot, {
        begin: async (snapshot) => {
            liveMaturationDurableBeginCount += 1;
            liveMaturationActiveRun = bindReportRunInvocation({
                runId: "live-maturation-run",
                reportRunId: "live-maturation-run",
                revision: 1,
                contextRevision: 1,
                origin: "prompt",
                durable: true,
                status: "running",
            }, snapshot);
            liveMaturationOriginalRun = liveMaturationActiveRun;
            liveMaturationOwnedRunId = liveMaturationActiveRun.runId;
            return {
                ok: true,
                runId: liveMaturationActiveRun.runId,
                durable: true,
            };
        },
        resolvePostBeginDispatch: (snapshot) => reportBuilderRunPersistenceModule
            .resolveHostedReportRunPostBeginDispatch(
                liveMaturationActiveRun,
                snapshot,
                liveMaturationFinalSnapshot,
                {
                    currentFingerprint: liveMaturationFinalSnapshot.requestFingerprint,
                    currentMaterializationFingerprint:
                        liveMaturationFinalSnapshot.materializationFingerprint,
                    dispatchFingerprint:
                        `${liveMaturationFinalSnapshot.requestFingerprint}::fetch`,
                    ownedRunId: liveMaturationOwnedRunId,
                    origin: "prompt",
                },
            ),
        adopt: (snapshot) => {
            liveMaturationAdoptCount += 1;
            return reportBuilderRunPersistenceModule.adoptHostedReportRunCurrentDispatch(
                snapshot,
                {
                    markCompletedFingerprint: (fingerprint) => {
                        liveMaturationCompletedFingerprint = fingerprint;
                    },
                },
            );
        },
        dispatch: () => {
            liveMaturationDispatchCount += 1;
            return { fetched: true };
        },
    });
const liveMaturationInProgressReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    hasCompletedRequest: true,
    primaryResultSettled: false,
    datasetResultSettled: false,
    canRenderRuntime: false,
    finalArtifactsReady: false,
});
const liveMaturationDeferred = shouldDeferReportRunSupersedeForInitialization(
    liveMaturationActiveRun,
    liveMaturationFinalSnapshot,
    {
        deferSupersede: liveMaturationInProgressReadiness.deferSupersede,
        currentFingerprint: liveMaturationFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint:
            liveMaturationFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${liveMaturationFinalSnapshot.requestFingerprint}::fetch`,
        ownedRunId: liveMaturationOwnedRunId,
        origin: "prompt",
    },
);
const liveMaturationFalseSupersedeCodes = [];
if (!liveMaturationDeferred) {
    const supersedeEvent = classifyReportRunSupersede(liveMaturationActiveRun, {
        currentFingerprint: liveMaturationFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint:
            liveMaturationFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${liveMaturationFinalSnapshot.requestFingerprint}::fetch`,
    });
    if (supersedeEvent) {
        liveMaturationActiveRun = (await settleReportRunInvocation(
            liveMaturationActiveRun,
            supersedeEvent,
            {
                fail: async (run, failure) => {
                    liveMaturationFalseSupersedeCodes.push(failure?.code);
                    return { ...run, revision: run.revision + 1, status: "failed" };
                },
            },
        )).run;
        liveMaturationOriginalRun = liveMaturationActiveRun;
    }
}
const liveMaturationTransitionDecision = resolveReportRunInitializationTransition(
    liveMaturationOriginalRun,
    liveMaturationFinalSnapshot,
    {
        durableAvailable: true,
        ownedRunId: liveMaturationOwnedRunId,
        origin: "prompt",
    },
);
const liveMaturationFinalReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    hasCompletedRequest:
        liveMaturationCompletedFingerprint
            === liveMaturationFinalSnapshot.requestFingerprint,
    finalArtifactsReady: true,
});
let liveMaturationTransitionType = "";
let liveMaturationCompletionCount = 0;
let liveMaturationTransitionLatch = "";
let liveMaturationTransitionAttempt = null;
if (liveMaturationActiveRun?.status === "running" && liveMaturationFinalReadiness.ready) {
    const transition = resolveReportRunInitializationTransition(
        liveMaturationActiveRun,
        liveMaturationFinalSnapshot,
        {
            durableAvailable: true,
            ownedRunId: liveMaturationOwnedRunId,
            origin: "prompt",
        },
    );
    liveMaturationTransitionType = transition.type;
    liveMaturationTransitionAttempt = resolveReportRunInitializationTransitionAttempt(
        liveMaturationFinalSnapshot,
        {
            executionKey: "performance_inventory_brief::live-maturation",
            origin: "prompt",
            activeRunId: liveMaturationActiveRun.runId,
            previousAttempt: null,
            nextAttemptNumber: 1,
        },
    );
    liveMaturationTransitionLatch = resolveReportRunInitializationLatch({
        phase: "acquire",
        latchedKey: "",
        transitionKey: liveMaturationTransitionAttempt.key,
    }).key;
    if (transition.type === "retain") {
        liveMaturationActiveRun = transition.run;
    } else if (transition.type === "begin") {
        liveMaturationFalseSupersedeCodes.push("browser_run_superseded");
        liveMaturationOriginalRun = {
            ...liveMaturationOriginalRun,
            revision: liveMaturationOriginalRun.revision + 1,
            status: "failed",
        };
        liveMaturationDurableBeginCount += 1;
        liveMaturationActiveRun = bindReportRunInvocation({
            runId: "live-maturation-duplicate-run",
            reportRunId: "live-maturation-duplicate-run",
            revision: 1,
            contextRevision: 1,
            origin: "prompt",
            durable: true,
            status: "running",
        }, liveMaturationFinalSnapshot);
    }
    const settlementEvent = captureReportRunSettlementEvent(liveMaturationActiveRun, {
        runId: liveMaturationActiveRun.invocation.runId,
        requestFingerprint: liveMaturationFinalSnapshot.requestFingerprint,
        materializationFingerprint: liveMaturationFinalSnapshot.materializationFingerprint,
        currentFingerprint: liveMaturationFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint:
            liveMaturationFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${liveMaturationFinalSnapshot.requestFingerprint}::fetch`,
        status: "succeeded",
        terminalRequest: liveMaturationFinalSnapshot.materializedExportRequest,
        rowCount: 1,
        resultRequestKey: "live-maturation:fresh",
        expectedResultRequestKey: "live-maturation:fresh",
    });
    if (settlementEvent) {
        liveMaturationActiveRun = (await settleReportRunInvocation(
            liveMaturationActiveRun,
            settlementEvent,
            {
                complete: async (run) => {
                    liveMaturationCompletionCount += 1;
                    return { ...run, revision: run.revision + 1, status: "completed" };
                },
            },
        )).run;
        if (liveMaturationActiveRun.runId === liveMaturationOriginalRun.runId) {
            liveMaturationOriginalRun = liveMaturationActiveRun;
        }
        liveMaturationTransitionLatch = resolveReportRunInitializationLatch({
            phase: "settle",
            latchedKey: liveMaturationTransitionLatch,
            transitionKey: liveMaturationTransitionAttempt.key,
            settledRun: liveMaturationActiveRun,
            requestFingerprint: liveMaturationFinalSnapshot.requestFingerprint,
            materializationFingerprint: liveMaturationFinalSnapshot.materializationFingerprint,
        }).key;
    }
}

const buildLiveMaturationNegativeDecision = ({
    activeRun = liveMaturationOriginalRun,
    capturedSnapshot = liveMaturationBeginSnapshot,
    snapshot = liveMaturationFinalSnapshot,
    ownedRunId = liveMaturationOwnedRunId,
    origin = "prompt",
} = {}) => ({
    postBegin: reportBuilderRunPersistenceModule.resolveHostedReportRunPostBeginDispatch(
        activeRun,
        capturedSnapshot,
        snapshot,
        {
            currentFingerprint: snapshot.requestFingerprint,
            currentMaterializationFingerprint: snapshot.materializationFingerprint,
            dispatchFingerprint: `${snapshot.requestFingerprint}::fetch`,
            ownedRunId,
            origin,
        },
    ).type,
    deferred: shouldDeferReportRunSupersedeForInitialization(activeRun, snapshot, {
        deferSupersede: true,
        currentFingerprint: snapshot.requestFingerprint,
        currentMaterializationFingerprint: snapshot.materializationFingerprint,
        dispatchFingerprint: `${snapshot.requestFingerprint}::fetch`,
        ownedRunId,
        origin,
    }),
    transition: resolveReportRunInitializationTransition(activeRun, snapshot, {
        durableAvailable: true,
        ownedRunId,
        origin,
    }).type,
});
const liveMaturationControlRun = bindReportRunInvocation({
    runId: "live-maturation-control-run",
    reportRunId: "live-maturation-control-run",
    revision: 1,
    contextRevision: 1,
    origin: "prompt",
    durable: true,
    status: "running",
}, liveMaturationBeginSnapshot);
const liveMaturationForeignSnapshot = buildSnapshot({
    request: liveMaturationFinalRequest,
    rendererRequest: liveMaturationFinalRequest,
    calculatedFields: liveMaturationCalculatedFields,
    rows: [{ channelId: "display", clicks: 1470 }],
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "foreign-conversation",
    turnId: "",
    windowId: "",
});
const liveMaturationDifferentRequestSnapshot = buildSnapshot({
    request: {
        ...liveMaturationFinalRequest,
        orderIds: [2676947],
    },
    rendererRequest: {
        ...liveMaturationFinalRequest,
        orderIds: [2676947],
    },
    calculatedFields: liveMaturationCalculatedFields,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
});
const liveMaturationUnrelatedMeasureRequest = {
    ...liveMaturationBeginRequest,
    measures: {
        ...liveMaturationBeginRequest.measures,
        conversions: true,
    },
};
const liveMaturationUnrelatedMeasureSnapshot = buildSnapshot({
    request: liveMaturationUnrelatedMeasureRequest,
    rendererRequest: liveMaturationUnrelatedMeasureRequest,
    calculatedFields: liveMaturationCalculatedFields,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
});
const liveMaturationUnionRequest = {
    ...liveMaturationBeginRequest,
    measures: {
        ...liveMaturationBeginRequest.measures,
        clicks: true,
        videoViews: true,
    },
};
const liveMaturationUnionSnapshot = buildSnapshot({
    request: liveMaturationUnionRequest,
    rendererRequest: liveMaturationUnionRequest,
    calculatedFields: [
        ...liveMaturationCalculatedFields,
        {
            id: "vtr",
            key: "vtr",
            kind: "rowCalc",
            dependencies: ["videoViews", "impressions"],
            expression: "videoViews / impressions * 100",
        },
    ],
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
});
const liveMaturationRemovedBaseMeasureRequest = {
    ...liveMaturationBeginRequest,
    measures: {
        totalSpend: true,
        clicks: true,
    },
};
const liveMaturationRemovedBaseMeasureSnapshot = buildSnapshot({
    request: liveMaturationRemovedBaseMeasureRequest,
    rendererRequest: liveMaturationRemovedBaseMeasureRequest,
    calculatedFields: liveMaturationCalculatedFields,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
});
const liveMaturationChangedBaseMeasureRequest = {
    ...liveMaturationFinalRequest,
    measures: {
        ...liveMaturationFinalRequest.measures,
        impressions: false,
    },
};
const liveMaturationChangedBaseMeasureSnapshot = buildSnapshot({
    request: liveMaturationChangedBaseMeasureRequest,
    rendererRequest: liveMaturationChangedBaseMeasureRequest,
    calculatedFields: liveMaturationCalculatedFields,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
});
const liveMaturationManualBeginSnapshot = buildSnapshot({
    request: liveMaturationBeginRequest,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
    origin: "manual",
});
const liveMaturationManualFinalSnapshot = buildSnapshot({
    request: liveMaturationFinalRequest,
    rendererRequest: liveMaturationFinalRequest,
    calculatedFields: liveMaturationCalculatedFields,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "62e80a77-040a-4cd7-a43e-9d2086edbead",
    turnId: "",
    windowId: "",
    origin: "manual",
});
const liveMaturationManualRun = bindReportRunInvocation({
    runId: "live-maturation-manual-run",
    reportRunId: "live-maturation-manual-run",
    revision: 1,
    contextRevision: 1,
    origin: "manual",
    durable: true,
    status: "running",
}, liveMaturationManualBeginSnapshot);
assert.deepEqual({
    postBeginAction: liveMaturationPostBegin.dispatchAction,
    adoptCount: liveMaturationAdoptCount,
    dispatchCount: liveMaturationDispatchCount,
    inProgressDeferred: liveMaturationDeferred,
    directTransitionDecision: liveMaturationTransitionDecision.type,
    finalReadiness: liveMaturationFinalReadiness.ready,
    transitionType: liveMaturationTransitionType,
    durableBeginCount: liveMaturationDurableBeginCount,
    falseSupersedeCodes: liveMaturationFalseSupersedeCodes,
    activeRunId: liveMaturationActiveRun.runId,
    originalRunStatus: liveMaturationOriginalRun.status,
    finalStatus: liveMaturationActiveRun.status,
    completionCount: liveMaturationCompletionCount,
    latchRetained:
        liveMaturationTransitionLatch === liveMaturationTransitionAttempt?.key,
    missingOwnership: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationControlRun,
        ownedRunId: "",
    }),
    wrongOwnership: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationControlRun,
        ownedRunId: "another-locally-begun-run",
    }),
    foreignCorrelation: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationControlRun,
        snapshot: liveMaturationForeignSnapshot,
        ownedRunId: liveMaturationControlRun.runId,
    }),
    differentRequest: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationControlRun,
        snapshot: liveMaturationDifferentRequestSnapshot,
        ownedRunId: liveMaturationControlRun.runId,
    }),
    unrelatedMeasure: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationControlRun,
        snapshot: liveMaturationUnrelatedMeasureSnapshot,
        ownedRunId: liveMaturationControlRun.runId,
    }),
    dependencyUnion: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationControlRun,
        snapshot: liveMaturationUnionSnapshot,
        ownedRunId: liveMaturationControlRun.runId,
    }),
    removedBaseMeasure: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationControlRun,
        snapshot: liveMaturationRemovedBaseMeasureSnapshot,
        ownedRunId: liveMaturationControlRun.runId,
    }),
    changedBaseMeasure: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationControlRun,
        snapshot: liveMaturationChangedBaseMeasureSnapshot,
        ownedRunId: liveMaturationControlRun.runId,
    }),
    manualOrigin: buildLiveMaturationNegativeDecision({
        activeRun: liveMaturationManualRun,
        capturedSnapshot: liveMaturationManualBeginSnapshot,
        snapshot: liveMaturationManualFinalSnapshot,
        ownedRunId: liveMaturationManualRun.runId,
        origin: "manual",
    }),
}, {
    postBeginAction: "adopt",
    adoptCount: 1,
    dispatchCount: 0,
    inProgressDeferred: true,
    directTransitionDecision: "retain",
    finalReadiness: true,
    transitionType: "retain",
    durableBeginCount: 1,
    falseSupersedeCodes: [],
    activeRunId: "live-maturation-run",
    originalRunStatus: "completed",
    finalStatus: "completed",
    completionCount: 1,
    latchRetained: true,
    missingOwnership: { postBegin: "skip", deferred: false, transition: "begin" },
    wrongOwnership: { postBegin: "skip", deferred: false, transition: "begin" },
    foreignCorrelation: { postBegin: "skip", deferred: false, transition: "begin" },
    differentRequest: { postBegin: "skip", deferred: false, transition: "begin" },
    unrelatedMeasure: { postBegin: "skip", deferred: false, transition: "begin" },
    dependencyUnion: { postBegin: "adopt", deferred: true, transition: "retain" },
    removedBaseMeasure: { postBegin: "skip", deferred: false, transition: "begin" },
    changedBaseMeasure: { postBegin: "skip", deferred: false, transition: "begin" },
    manualOrigin: { postBegin: "skip", deferred: false, transition: "begin" },
}, "a locally begun hosted run must survive only the live renderer-derived +clicks maturation and complete once");

const gateACanonicalRequest = {
    orderIds: [2676946],
    dateRange: { start: "2026-07-01", end: "2026-07-31" },
    dimensions: { channel: true },
    measures: {
        totalSpend: true,
        impressions: true,
    },
};
const gateARendererRequest = {
    ...gateACanonicalRequest,
    measures: {
        ...gateACanonicalRequest.measures,
        clicks: true,
    },
};
const gateAEarlySnapshot = buildSnapshot({
    request: gateACanonicalRequest,
    rendererRequest: gateARendererRequest,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
});
const gateAFinalSnapshot = buildSnapshot({
    request: gateARendererRequest,
    rendererRequest: gateARendererRequest,
    rows: [{ channel: "Display", totalSpend: 514, impressions: 147000, clicks: 1470 }],
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
});
const gateAActiveRun = bindReportRunInvocation({
    runId: "bfdacd90-55de-42e3-b0fe-17da577604fe",
    reportRunId: "bfdacd90-55de-42e3-b0fe-17da577604fe",
    revision: 1,
    contextRevision: 1,
    conversationId: "conversation-1",
    turnId: "turn-7",
    windowId: "window-3",
    origin: "prompt",
    durable: true,
    status: "running",
}, gateAEarlySnapshot);
assert.notEqual(gateAActiveRun.invocation.requestFingerprint, gateAFinalSnapshot.requestFingerprint);
const gateADeferSupersede = shouldDeferReportRunSupersedeForInitialization(
    gateAActiveRun,
    gateAFinalSnapshot,
    {
        deferSupersede: true,
        currentFingerprint: gateAFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${gateAFinalSnapshot.requestFingerprint}::fetch`,
        origin: "prompt",
    },
);
const gateASupersedeEvent = gateADeferSupersede
    ? null
    : classifyReportRunSupersede(gateAActiveRun, {
        currentFingerprint: gateAFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${gateAFinalSnapshot.requestFingerprint}::fetch`,
    });
const gateADurableFailureCodes = [];
if (gateASupersedeEvent) {
    await settleReportRunInvocation(gateAActiveRun, gateASupersedeEvent, {
        fail: async (run, failure) => {
            gateADurableFailureCodes.push(failure?.code);
            return { ...run, revision: run.revision + 1, status: "failed" };
        },
    });
}
assert.deepEqual(
    gateADurableFailureCodes,
    [],
    "the captured CTR renderer dependency must not fail the sole prompt-owned Gate A run as superseded",
);
assert.equal(gateADeferSupersede, true);
const gateAFinalTransition = resolveReportRunInitializationTransition(
    gateAActiveRun,
    gateAFinalSnapshot,
    { durableAvailable: true, origin: "prompt" },
);
assert.equal(gateAFinalTransition.type, "retain");
assert.equal(gateAFinalTransition.run.runId, gateAActiveRun.runId);
assert.equal(
    gateAFinalTransition.run.invocation.requestFingerprint,
    gateAFinalSnapshot.requestFingerprint,
    "final handoff adopts the captured renderer-expanded request without beginning a second durable run",
);
const gateAFinalSettlementEvent = captureReportRunSettlementEvent(gateAFinalTransition.run, {
    runId: gateAFinalTransition.run.invocation.runId,
    requestFingerprint: gateAFinalSnapshot.requestFingerprint,
    materializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
    currentFingerprint: gateAFinalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${gateAFinalSnapshot.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: gateAFinalSnapshot.materializedExportRequest,
    rowCount: 1,
    resultRequestKey: "performance-inventory:2676946:fresh",
    expectedResultRequestKey: "performance-inventory:2676946:fresh",
});
assert.ok(gateAFinalSettlementEvent);
let gateACompletionCount = 0;
const gateACompletedSettlement = await settleReportRunInvocation(
    gateAFinalTransition.run,
    gateAFinalSettlementEvent,
    {
        complete: async (run, terminalRequest) => {
            gateACompletionCount += 1;
            assert.ok(terminalRequest?.reportSpec);
            assert.ok(terminalRequest?.reportFill);
            assert.ok(terminalRequest?.reportPrint);
            return { ...run, revision: run.revision + 1, status: "completed" };
        },
    },
);
assert.equal(gateACompletedSettlement.accepted, true);
assert.equal(gateACompletedSettlement.run.status, "completed");
assert.equal(gateACompletionCount, 1);

let releaseDelayedGateABegin;
const delayedGateABeginBarrier = new Promise((resolve) => {
    releaseDelayedGateABegin = resolve;
});
let delayedGateAActiveRun = null;
const delayedGateACurrentSnapshot = gateAFinalSnapshot;
let delayedGateADispatchFingerprint = `${gateAFinalSnapshot.requestFingerprint}::fetch`;
let delayedGateACompletedFingerprint = "";
const delayedGateADispatches = [];
let delayedGateAManualRunSequence = 7;
const delayedGateARuntimeFingerprint = JSON.stringify(gateAFinalSnapshot.request);
const delayedGateAPublishedDatasets = [{
    id: "performance-inventory",
    dataSourceRef: "metricsCube",
    request: gateAFinalSnapshot.request,
}];
const buildDelayedGateARequestKeys = () => {
    const rowsRequestKey = buildReportRuntimePreviewRequestKey(
        delayedGateARuntimeFingerprint,
        delayedGateAManualRunSequence,
    );
    return {
        rowsRequestKey,
        datasetRequestKey: JSON.stringify({
            previewRequestKey: rowsRequestKey,
            datasets: delayedGateAPublishedDatasets,
        }),
    };
};
const delayedGateAInitialRequestKeys = buildDelayedGateARequestKeys();
let delayedGateACurrentRequestKeys = delayedGateAInitialRequestKeys;
let delayedGateARowsFetchCount = 1;
let delayedGateADatasetFetchCount = 1;
const delayedGateAFreshRowsRequestKey = delayedGateAInitialRequestKeys.rowsRequestKey;
const delayedGateAFreshDatasetRequestKey = delayedGateAInitialRequestKeys.datasetRequestKey;
const resolveDelayedGateACurrentDispatchAdoption =
    reportBuilderRunPersistenceModule.adoptHostedReportRunCurrentDispatch
    || ((snapshot, { markCompletedFingerprint } = {}) => {
        markCompletedFingerprint?.(snapshot.requestFingerprint);
        delayedGateAManualRunSequence += 1;
        return {
            request: snapshot.request,
            fingerprint: snapshot.requestFingerprint,
            readiness: snapshot.readiness,
            shouldFetch: true,
            adoptedCurrentDispatch: true,
        };
    });
const delayedGateAPendingExecution = reportBuilderRunPersistenceModule.beginAndDispatchReportRun(
    gateAEarlySnapshot,
    {
        begin: async (snapshot) => {
            await delayedGateABeginBarrier;
            delayedGateAActiveRun = bindReportRunInvocation({
                runId: "8eed9ea2-eb59-4e41-94aa-ba48256661fe",
                reportRunId: "8eed9ea2-eb59-4e41-94aa-ba48256661fe",
                revision: 1,
                contextRevision: 1,
                conversationId: "e7b822c0-b869-40df-9f4d-bc10dfb9bf15",
                turnId: "turn-7",
                windowId: "window-3",
                origin: "prompt",
                durable: true,
                status: "running",
            }, snapshot);
            return {
                ok: true,
                runId: delayedGateAActiveRun.runId,
                durable: true,
            };
        },
        resolvePostBeginDispatch: (snapshot) => reportBuilderRunPersistenceModule
            .resolveHostedReportRunPostBeginDispatch(
                delayedGateAActiveRun,
                snapshot,
                delayedGateACurrentSnapshot,
                {
                    currentFingerprint: delayedGateACurrentSnapshot.requestFingerprint,
                    currentMaterializationFingerprint:
                        delayedGateACurrentSnapshot.materializationFingerprint,
                    dispatchFingerprint: delayedGateADispatchFingerprint,
                    origin: "prompt",
                },
            ),
        adopt: (snapshot) => {
            const adoption = resolveDelayedGateACurrentDispatchAdoption(snapshot, {
                markCompletedFingerprint: (fingerprint) => {
                    delayedGateACompletedFingerprint = fingerprint;
                },
            });
            const nextRequestKeys = buildDelayedGateARequestKeys();
            if (nextRequestKeys.rowsRequestKey
                !== delayedGateACurrentRequestKeys.rowsRequestKey) {
                delayedGateARowsFetchCount += 1;
            }
            if (nextRequestKeys.datasetRequestKey
                !== delayedGateACurrentRequestKeys.datasetRequestKey) {
                delayedGateADatasetFetchCount += 1;
            }
            delayedGateACurrentRequestKeys = nextRequestKeys;
            return adoption;
        },
        dispatch: (snapshot) => {
            delayedGateADispatches.push(snapshot.requestFingerprint);
            delayedGateADispatchFingerprint = `${snapshot.requestFingerprint}::fetch`;
            delayedGateACompletedFingerprint = snapshot.requestFingerprint;
            return { fingerprint: snapshot.requestFingerprint, fetched: true };
        },
    },
);
await Promise.resolve();
releaseDelayedGateABegin();
const delayedGateAExecution = await delayedGateAPendingExecution;
const delayedGateAReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    hasCompletedRequest:
        delayedGateACompletedFingerprint === delayedGateACurrentSnapshot.requestFingerprint,
});
const delayedGateATransition = delayedGateAReadiness.ready
    ? resolveReportRunInitializationTransition(
        delayedGateAActiveRun,
        delayedGateACurrentSnapshot,
        { durableAvailable: true, origin: "prompt" },
    )
    : null;
if (delayedGateATransition?.type === "retain") {
    delayedGateAActiveRun = delayedGateATransition.run;
}
const delayedGateASupersedeEvent = classifyReportRunSupersede(delayedGateAActiveRun, {
    currentFingerprint: delayedGateACurrentSnapshot.requestFingerprint,
    currentMaterializationFingerprint: delayedGateACurrentSnapshot.materializationFingerprint,
    dispatchFingerprint: delayedGateADispatchFingerprint,
});
const delayedGateAFailureCodes = [];
if (delayedGateASupersedeEvent) {
    await settleReportRunInvocation(delayedGateAActiveRun, delayedGateASupersedeEvent, {
        fail: async (run, failure) => {
            delayedGateAFailureCodes.push(failure?.code);
            return { ...run, revision: run.revision + 1, status: "failed" };
        },
    });
}
assert.deepEqual({
    dispatchAction: delayedGateAExecution.dispatchAction,
    dispatchedFingerprints: delayedGateADispatches,
    finalDispatchFingerprint: delayedGateADispatchFingerprint,
    completedFingerprint: delayedGateACompletedFingerprint,
    initializationReady: delayedGateAReadiness.ready,
    transitionType: delayedGateATransition?.type || "",
    activeRequestFingerprint:
        delayedGateAActiveRun?.invocation?.requestFingerprint || "",
    failureCodes: delayedGateAFailureCodes,
    manualRunSequence: delayedGateAManualRunSequence,
    rowsRequestKeyStable:
        delayedGateACurrentRequestKeys.rowsRequestKey
            === delayedGateAInitialRequestKeys.rowsRequestKey,
    datasetRequestKeyStable:
        delayedGateACurrentRequestKeys.datasetRequestKey
            === delayedGateAInitialRequestKeys.datasetRequestKey,
    rowsFetchCount: delayedGateARowsFetchCount,
    datasetFetchCount: delayedGateADatasetFetchCount,
    rowsRemainFresh:
        delayedGateAFreshRowsRequestKey === delayedGateACurrentRequestKeys.rowsRequestKey,
    datasetRemainsFresh:
        delayedGateAFreshDatasetRequestKey === delayedGateACurrentRequestKeys.datasetRequestKey,
}, {
    dispatchAction: "adopt",
    dispatchedFingerprints: [],
    finalDispatchFingerprint: `${gateAFinalSnapshot.requestFingerprint}::fetch`,
    completedFingerprint: gateAFinalSnapshot.requestFingerprint,
    initializationReady: true,
    transitionType: "retain",
    activeRequestFingerprint: gateAFinalSnapshot.requestFingerprint,
    failureCodes: [],
    manualRunSequence: 7,
    rowsRequestKeyStable: true,
    datasetRequestKeyStable: true,
    rowsFetchCount: 1,
    datasetFetchCount: 1,
    rowsRemainFresh: true,
    datasetRemainsFresh: true,
}, "a delayed hosted Begin must adopt the already-current renderer dispatch instead of replaying its stale captured request");

let releaseSameRequestGateABegin;
const sameRequestGateABeginBarrier = new Promise((resolve) => {
    releaseSameRequestGateABegin = resolve;
});
let sameRequestGateAActiveRun = null;
const sameRequestGateACapturedSnapshot = earlySnapshot;
const sameRequestGateACurrentSnapshot = finalSnapshot;
let sameRequestGateADispatchFingerprint = `${finalSnapshot.requestFingerprint}::fetch`;
let sameRequestGateACompletedFingerprint = "";
let sameRequestGateAManualRunSequence = 7;
let sameRequestGateATopLevelFetchCount = 1;
let sameRequestGateARowsFetchCount = 1;
let sameRequestGateADatasetFetchCount = 1;
const sameRequestGateARuntimeFingerprint = JSON.stringify(finalSnapshot.request);
const sameRequestGateAPublishedDatasets = [{
    id: "inventory",
    dataSourceRef: "inventoryCube",
    request: finalSnapshot.request,
}];
const buildSameRequestGateAKeys = () => {
    const rowsRequestKey = buildReportRuntimePreviewRequestKey(
        sameRequestGateARuntimeFingerprint,
        sameRequestGateAManualRunSequence,
    );
    return {
        rowsRequestKey,
        datasetRequestKey: JSON.stringify({
            previewRequestKey: rowsRequestKey,
            datasets: sameRequestGateAPublishedDatasets,
        }),
    };
};
const sameRequestGateAInitialKeys = buildSameRequestGateAKeys();
const resolveSameRequestGateAPostBeginDispatch =
    reportBuilderRunPersistenceModule.resolveHostedReportRunPostBeginDispatch
    || ((_activeRun, capturedSnapshot, currentSnapshot) => (
        capturedSnapshot.requestFingerprint === currentSnapshot.requestFingerprint
            ? { type: "dispatch", snapshot: capturedSnapshot }
            : { type: "skip", snapshot: null }
    ));
const sameRequestGateAPendingExecution = reportBuilderRunPersistenceModule.beginAndDispatchReportRun(
    sameRequestGateACapturedSnapshot,
    {
        begin: async (snapshot) => {
            await sameRequestGateABeginBarrier;
            sameRequestGateAActiveRun = bindReportRunInvocation({
                runId: "same-request-gate-a-run",
                reportRunId: "same-request-gate-a-run",
                revision: 1,
                contextRevision: 1,
                conversationId: "same-request-gate-a-conversation",
                turnId: "turn-7",
                windowId: "window-3",
                origin: "prompt",
                durable: true,
                status: "running",
            }, snapshot);
            return {
                ok: true,
                runId: sameRequestGateAActiveRun.runId,
                durable: true,
            };
        },
        resolvePostBeginDispatch: (snapshot) => resolveSameRequestGateAPostBeginDispatch(
            sameRequestGateAActiveRun,
            snapshot,
            sameRequestGateACurrentSnapshot,
            {
                currentFingerprint: sameRequestGateACurrentSnapshot.requestFingerprint,
                currentMaterializationFingerprint:
                    sameRequestGateACurrentSnapshot.materializationFingerprint,
                dispatchFingerprint: sameRequestGateADispatchFingerprint,
                origin: "prompt",
            },
        ),
        adopt: (snapshot) => reportBuilderRunPersistenceModule
            .adoptHostedReportRunCurrentDispatch(snapshot, {
                markCompletedFingerprint: (fingerprint) => {
                    sameRequestGateACompletedFingerprint = fingerprint;
                },
            }),
        dispatch: (snapshot) => {
            sameRequestGateATopLevelFetchCount += 1;
            sameRequestGateADispatchFingerprint = `${snapshot.requestFingerprint}::fetch`;
            sameRequestGateACompletedFingerprint = snapshot.requestFingerprint;
            sameRequestGateAManualRunSequence += 1;
            return { fingerprint: snapshot.requestFingerprint, fetched: true };
        },
    },
);
await Promise.resolve();
releaseSameRequestGateABegin();
const sameRequestGateAExecution = await sameRequestGateAPendingExecution;
let sameRequestGateAHoldFetchCount = 0;
let sameRequestGateAHoldMaterializationFingerprint = "";
const sameRequestGateAHoldExecution = await reportBuilderRunPersistenceModule
    .beginAndDispatchReportRun(sameRequestGateACapturedSnapshot, {
        begin: async () => ({
            ok: true,
            runId: sameRequestGateAActiveRun.runId,
            durable: true,
        }),
        resolvePostBeginDispatch: (snapshot) => reportBuilderRunPersistenceModule
            .resolveHostedReportRunPostBeginDispatch(
                sameRequestGateAActiveRun,
                snapshot,
                sameRequestGateACurrentSnapshot,
                {
                    currentFingerprint: sameRequestGateACurrentSnapshot.requestFingerprint,
                    currentMaterializationFingerprint:
                        sameRequestGateACurrentSnapshot.materializationFingerprint,
                    dispatchFingerprint:
                        `${sameRequestGateACurrentSnapshot.requestFingerprint}::hold`,
                    origin: "prompt",
                },
            ),
        adopt: () => assert.fail("an exact held request must fetch instead of being adopted"),
        dispatch: (snapshot) => {
            sameRequestGateAHoldFetchCount += 1;
            sameRequestGateAHoldMaterializationFingerprint =
                snapshot.materializationFingerprint;
            return { fingerprint: snapshot.requestFingerprint, fetched: true };
        },
    });
const sameRequestGateAFinalKeys = buildSameRequestGateAKeys();
if (sameRequestGateAFinalKeys.rowsRequestKey !== sameRequestGateAInitialKeys.rowsRequestKey) {
    sameRequestGateARowsFetchCount += 1;
}
if (sameRequestGateAFinalKeys.datasetRequestKey !== sameRequestGateAInitialKeys.datasetRequestKey) {
    sameRequestGateADatasetFetchCount += 1;
}
assert.deepEqual({
    requestFingerprintStayedExact:
        sameRequestGateACapturedSnapshot.requestFingerprint
            === sameRequestGateACurrentSnapshot.requestFingerprint,
    materializationAdvanced:
        sameRequestGateACapturedSnapshot.materializationFingerprint
            !== sameRequestGateACurrentSnapshot.materializationFingerprint,
    dispatchAction: sameRequestGateAExecution.dispatchAction,
    dispatchFingerprint: sameRequestGateADispatchFingerprint,
    completedFingerprint: sameRequestGateACompletedFingerprint,
    manualRunSequence: sameRequestGateAManualRunSequence,
    rowsRequestKeyStable:
        sameRequestGateAFinalKeys.rowsRequestKey
            === sameRequestGateAInitialKeys.rowsRequestKey,
    datasetRequestKeyStable:
        sameRequestGateAFinalKeys.datasetRequestKey
            === sameRequestGateAInitialKeys.datasetRequestKey,
    topLevelFetchCount: sameRequestGateATopLevelFetchCount,
    rowsFetchCount: sameRequestGateARowsFetchCount,
    datasetFetchCount: sameRequestGateADatasetFetchCount,
    holdDispatchAction: sameRequestGateAHoldExecution.dispatchAction,
    holdDispatchUsesCurrentMaterialization:
        sameRequestGateAHoldMaterializationFingerprint
            === sameRequestGateACurrentSnapshot.materializationFingerprint,
    holdFetchCount: sameRequestGateAHoldFetchCount,
}, {
    requestFingerprintStayedExact: true,
    materializationAdvanced: true,
    dispatchAction: "adopt",
    dispatchFingerprint: `${sameRequestGateACurrentSnapshot.requestFingerprint}::fetch`,
    completedFingerprint: sameRequestGateACurrentSnapshot.requestFingerprint,
    manualRunSequence: 7,
    rowsRequestKeyStable: true,
    datasetRequestKeyStable: true,
    topLevelFetchCount: 1,
    rowsFetchCount: 1,
    datasetFetchCount: 1,
    holdDispatchAction: "dispatch",
    holdDispatchUsesCurrentMaterialization: true,
    holdFetchCount: 1,
}, "same-request hosted adoption must reuse the already-issued fetch across a newer current materialization");

const incompleteIdentityExactSnapshot = buildSnapshot({
    conversationId: "",
    turnId: "",
    reportId: "incomplete-identity-report",
    title: "Incomplete identity report",
});
let incompleteIdentityExactRun = bindReportRunInvocation({
    runId: "incomplete-identity-exact-run",
    reportRunId: "incomplete-identity-exact-run",
    revision: 1,
    contextRevision: 0,
    origin: "prompt",
    durable: true,
    status: "running",
}, incompleteIdentityExactSnapshot);
let incompleteIdentityExactCompletedFingerprint = "";
let incompleteIdentityExactAdoptCount = 0;
let incompleteIdentityExactDispatchCount = 0;
let incompleteIdentityExactDurableBeginCount = 0;
const incompleteIdentityExactExecution = await reportBuilderRunPersistenceModule
    .beginAndDispatchReportRun(incompleteIdentityExactSnapshot, {
        begin: async () => {
            incompleteIdentityExactDurableBeginCount += 1;
            return {
                ok: true,
                runId: incompleteIdentityExactRun.runId,
                durable: true,
            };
        },
        resolvePostBeginDispatch: (snapshot) => reportBuilderRunPersistenceModule
            .resolveHostedReportRunPostBeginDispatch(
                incompleteIdentityExactRun,
                snapshot,
                incompleteIdentityExactSnapshot,
                {
                    currentFingerprint: incompleteIdentityExactSnapshot.requestFingerprint,
                    currentMaterializationFingerprint:
                        incompleteIdentityExactSnapshot.materializationFingerprint,
                    dispatchFingerprint:
                        `${incompleteIdentityExactSnapshot.requestFingerprint}::fetch`,
                    origin: "prompt",
                },
            ),
        adopt: (snapshot) => {
            incompleteIdentityExactAdoptCount += 1;
            return reportBuilderRunPersistenceModule.adoptHostedReportRunCurrentDispatch(
                snapshot,
                {
                    markCompletedFingerprint: (fingerprint) => {
                        incompleteIdentityExactCompletedFingerprint = fingerprint;
                    },
                },
            );
        },
        dispatch: (snapshot) => {
            incompleteIdentityExactDispatchCount += 1;
            incompleteIdentityExactCompletedFingerprint = snapshot.requestFingerprint;
            return { fingerprint: snapshot.requestFingerprint, fetched: true };
        },
    });
const incompleteIdentityExactReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    hasCompletedRequest:
        incompleteIdentityExactCompletedFingerprint
            === incompleteIdentityExactSnapshot.requestFingerprint,
});
const incompleteIdentityExactOriginalRunId = incompleteIdentityExactRun.runId;
let incompleteIdentityExactOriginalRun = incompleteIdentityExactRun;
const incompleteIdentityExactTransition = incompleteIdentityExactReadiness.ready
    ? resolveReportRunInitializationTransition(
        incompleteIdentityExactRun,
        incompleteIdentityExactSnapshot,
        { durableAvailable: true, origin: "prompt" },
    )
    : null;
const incompleteIdentityExactTransitionAttempt = incompleteIdentityExactTransition
    ? resolveReportRunInitializationTransitionAttempt(incompleteIdentityExactSnapshot, {
        executionKey: "incomplete-identity-report::execute-on-open",
        origin: "prompt",
        activeRunId: incompleteIdentityExactRun.runId,
        previousAttempt: null,
        nextAttemptNumber: 1,
    })
    : null;
let incompleteIdentityExactTransitionLatch = incompleteIdentityExactTransitionAttempt
    ? resolveReportRunInitializationLatch({
        phase: "acquire",
        latchedKey: "",
        transitionKey: incompleteIdentityExactTransitionAttempt.key,
    }).key
    : "";
const incompleteIdentityExactFalseSupersedeCodes = [];
if (incompleteIdentityExactTransition?.type === "retain") {
    incompleteIdentityExactRun = incompleteIdentityExactTransition.run;
} else if (incompleteIdentityExactTransition?.type === "begin") {
    incompleteIdentityExactFalseSupersedeCodes.push("browser_run_superseded");
    incompleteIdentityExactOriginalRun = {
        ...incompleteIdentityExactOriginalRun,
        revision: incompleteIdentityExactOriginalRun.revision + 1,
        status: "failed",
    };
    incompleteIdentityExactDurableBeginCount += 1;
    incompleteIdentityExactRun = bindReportRunInvocation({
        runId: "incomplete-identity-duplicate-run",
        reportRunId: "incomplete-identity-duplicate-run",
        revision: 1,
        contextRevision: 0,
        origin: "prompt",
        durable: true,
        status: "running",
    }, incompleteIdentityExactSnapshot);
}
const incompleteIdentityExactSupersede = classifyReportRunSupersede(
    incompleteIdentityExactRun,
    {
        currentFingerprint: incompleteIdentityExactSnapshot.requestFingerprint,
        currentMaterializationFingerprint:
            incompleteIdentityExactSnapshot.materializationFingerprint,
        dispatchFingerprint: `${incompleteIdentityExactSnapshot.requestFingerprint}::fetch`,
    },
);
let incompleteIdentityExactCompletionCount = 0;
if (incompleteIdentityExactReadiness.ready) {
    const completionEvent = captureReportRunSettlementEvent(incompleteIdentityExactRun, {
        runId: incompleteIdentityExactRun.invocation.runId,
        requestFingerprint: incompleteIdentityExactSnapshot.requestFingerprint,
        materializationFingerprint: incompleteIdentityExactSnapshot.materializationFingerprint,
        currentFingerprint: incompleteIdentityExactSnapshot.requestFingerprint,
        currentMaterializationFingerprint:
            incompleteIdentityExactSnapshot.materializationFingerprint,
        dispatchFingerprint: `${incompleteIdentityExactSnapshot.requestFingerprint}::fetch`,
        status: "succeeded",
        terminalRequest: incompleteIdentityExactSnapshot.materializedExportRequest,
        rowCount: 0,
    });
    if (completionEvent) {
        incompleteIdentityExactRun = (await settleReportRunInvocation(
            incompleteIdentityExactRun,
            completionEvent,
            {
                complete: async (run) => {
                    incompleteIdentityExactCompletionCount += 1;
                    return {
                        ...run,
                        revision: run.revision + 1,
                        status: "completed",
                    };
                },
            },
        )).run;
        if (incompleteIdentityExactRun.runId === incompleteIdentityExactOriginalRunId) {
            incompleteIdentityExactOriginalRun = incompleteIdentityExactRun;
        }
        incompleteIdentityExactTransitionLatch = resolveReportRunInitializationLatch({
            phase: "settle",
            latchedKey: incompleteIdentityExactTransitionLatch,
            transitionKey: incompleteIdentityExactTransitionAttempt.key,
            settledRun: incompleteIdentityExactRun,
            requestFingerprint: incompleteIdentityExactSnapshot.requestFingerprint,
            materializationFingerprint:
                incompleteIdentityExactSnapshot.materializationFingerprint,
        }).key;
    }
}

const incompleteIdentityExactConflictingSnapshot = buildSnapshot({
    conversationId: "",
    turnId: "",
    reportId: "foreign-incomplete-identity-report",
    title: "Incomplete identity report",
});
const incompleteIdentityExactMissingOriginSnapshot = buildSnapshot({
    conversationId: "",
    turnId: "",
    reportId: "incomplete-identity-report",
    title: "Incomplete identity report",
    includeOrigin: false,
});
const incompleteIdentityExactManualSnapshot = buildSnapshot({
    conversationId: "",
    turnId: "",
    reportId: "incomplete-identity-report",
    title: "Incomplete identity report",
    origin: "manual",
});
const incompleteIdentityExactManualRun = bindReportRunInvocation({
    runId: "incomplete-identity-manual-run",
    reportRunId: "incomplete-identity-manual-run",
    revision: 1,
    contextRevision: 0,
    origin: "manual",
    durable: true,
    status: "running",
}, incompleteIdentityExactManualSnapshot);
const incompleteIdentityExactTransitionControlRun = bindReportRunInvocation({
    runId: "incomplete-identity-transition-control-run",
    reportRunId: "incomplete-identity-transition-control-run",
    revision: 1,
    contextRevision: 0,
    origin: "prompt",
    durable: true,
    status: "running",
}, incompleteIdentityExactSnapshot);
assert.equal(
    incompleteIdentityExactConflictingSnapshot.materializationFingerprint,
    incompleteIdentityExactSnapshot.materializationFingerprint,
);
assert.equal(
    incompleteIdentityExactConflictingSnapshot.requestFingerprint,
    incompleteIdentityExactSnapshot.requestFingerprint,
);
assert.equal(
    incompleteIdentityExactMissingOriginSnapshot.materializationFingerprint,
    incompleteIdentityExactSnapshot.materializationFingerprint,
);
assert.equal(
    incompleteIdentityExactMissingOriginSnapshot.requestFingerprint,
    incompleteIdentityExactSnapshot.requestFingerprint,
);

let incompleteIdentityHoldFetchCount = 0;
let incompleteIdentityHoldMaterializationFingerprint = "";
const incompleteIdentityHoldRun = bindReportRunInvocation({
    runId: "incomplete-identity-hold-run",
    reportRunId: "incomplete-identity-hold-run",
    revision: 1,
    contextRevision: 0,
    origin: "prompt",
    durable: true,
    status: "running",
}, incompleteIdentityExactSnapshot);
const incompleteIdentityHoldExecution = await reportBuilderRunPersistenceModule
    .beginAndDispatchReportRun(incompleteIdentityExactSnapshot, {
        begin: async () => ({
            ok: true,
            runId: incompleteIdentityHoldRun.runId,
            durable: true,
        }),
        resolvePostBeginDispatch: (snapshot) => reportBuilderRunPersistenceModule
            .resolveHostedReportRunPostBeginDispatch(
                incompleteIdentityHoldRun,
                snapshot,
                incompleteIdentityExactSnapshot,
                {
                    currentFingerprint: incompleteIdentityExactSnapshot.requestFingerprint,
                    currentMaterializationFingerprint:
                        incompleteIdentityExactSnapshot.materializationFingerprint,
                    dispatchFingerprint:
                        `${incompleteIdentityExactSnapshot.requestFingerprint}::hold`,
                    origin: "prompt",
                },
            ),
        adopt: () => assert.fail("an exact held incomplete-identity run must fetch"),
        dispatch: (snapshot) => {
            incompleteIdentityHoldFetchCount += 1;
            incompleteIdentityHoldMaterializationFingerprint =
                snapshot.materializationFingerprint;
            return { fingerprint: snapshot.requestFingerprint, fetched: true };
        },
    });

const incompleteIdentityDriftSnapshot = buildSnapshot({
    conversationId: "",
    turnId: "",
    reportId: "incomplete-identity-report",
    title: "Incomplete identity report",
    rows: [{ inventoryId: 41, available: 19 }],
});
let incompleteIdentityDriftRun = bindReportRunInvocation({
    runId: "incomplete-identity-drift-run",
    reportRunId: "incomplete-identity-drift-run",
    revision: 1,
    contextRevision: 0,
    origin: "prompt",
    durable: true,
    status: "running",
}, incompleteIdentityExactSnapshot);
const incompleteIdentityDriftDecision = reportBuilderRunPersistenceModule
    .resolveHostedReportRunPostBeginDispatch(
        incompleteIdentityDriftRun,
        incompleteIdentityExactSnapshot,
        incompleteIdentityDriftSnapshot,
        {
            currentFingerprint: incompleteIdentityDriftSnapshot.requestFingerprint,
            currentMaterializationFingerprint:
                incompleteIdentityDriftSnapshot.materializationFingerprint,
            dispatchFingerprint: `${incompleteIdentityDriftSnapshot.requestFingerprint}::fetch`,
            origin: "prompt",
        },
    );
const incompleteIdentityDriftSupersede = classifyReportRunSupersede(
    incompleteIdentityDriftRun,
    {
        currentFingerprint: incompleteIdentityDriftSnapshot.requestFingerprint,
        currentMaterializationFingerprint:
            incompleteIdentityDriftSnapshot.materializationFingerprint,
        dispatchFingerprint: `${incompleteIdentityDriftSnapshot.requestFingerprint}::fetch`,
    },
);
const incompleteIdentityDriftFailureCodes = [];
if (incompleteIdentityDriftSupersede) {
    incompleteIdentityDriftRun = (await settleReportRunInvocation(
        incompleteIdentityDriftRun,
        incompleteIdentityDriftSupersede,
        {
            fail: async (run, failure) => {
                incompleteIdentityDriftFailureCodes.push(failure?.code);
                return { ...run, revision: run.revision + 1, status: "failed" };
            },
        },
    )).run;
}
const incompleteIdentityForeignDriftSnapshot = buildSnapshot({
    reportId: "foreign-incomplete-identity-report",
    title: "Foreign incomplete identity report",
    rows: [{ inventoryId: 52, available: 7 }],
});
const incompleteIdentityForeignDriftDecision = reportBuilderRunPersistenceModule
    .resolveHostedReportRunPostBeginDispatch(
        bindReportRunInvocation({
            runId: "incomplete-identity-foreign-run",
            reportRunId: "incomplete-identity-foreign-run",
            revision: 1,
            contextRevision: 0,
            origin: "prompt",
            durable: true,
            status: "running",
        }, incompleteIdentityExactSnapshot),
        incompleteIdentityExactSnapshot,
        incompleteIdentityForeignDriftSnapshot,
        {
            currentFingerprint: incompleteIdentityForeignDriftSnapshot.requestFingerprint,
            currentMaterializationFingerprint:
                incompleteIdentityForeignDriftSnapshot.materializationFingerprint,
            dispatchFingerprint:
                `${incompleteIdentityForeignDriftSnapshot.requestFingerprint}::fetch`,
            origin: "prompt",
        },
    );
assert.deepEqual({
    exactFetchAction: incompleteIdentityExactExecution.dispatchAction,
    exactFetchAdoptCount: incompleteIdentityExactAdoptCount,
    exactFetchDispatchCount: incompleteIdentityExactDispatchCount,
    exactInitializationReady: incompleteIdentityExactReadiness.ready,
    exactTransitionAction: incompleteIdentityExactTransition?.type || "",
    exactDurableBeginCount: incompleteIdentityExactDurableBeginCount,
    exactOriginalRunStatus: incompleteIdentityExactOriginalRun.status,
    exactActiveRunId: incompleteIdentityExactRun.runId,
    exactFalseSupersedeCodes: incompleteIdentityExactFalseSupersedeCodes,
    exactCompletionCount: incompleteIdentityExactCompletionCount,
    exactTransitionLatchRetained:
        incompleteIdentityExactTransitionLatch
            === incompleteIdentityExactTransitionAttempt?.key,
    exactSupersedeCode: incompleteIdentityExactSupersede?.error?.code || "",
    exactFinalStatus: incompleteIdentityExactRun.status,
    exactHoldAction: incompleteIdentityHoldExecution.dispatchAction,
    exactHoldFetchCount: incompleteIdentityHoldFetchCount,
    exactHoldUsesCurrentMaterialization:
        incompleteIdentityHoldMaterializationFingerprint
            === incompleteIdentityExactSnapshot.materializationFingerprint,
    incompleteDriftAction: incompleteIdentityDriftDecision.type,
    incompleteDriftFailureCodes: incompleteIdentityDriftFailureCodes,
    incompleteDriftFinalStatus: incompleteIdentityDriftRun.status,
    foreignDriftAction: incompleteIdentityForeignDriftDecision.type,
    exactConflictingTransition: resolveReportRunInitializationTransition(
        incompleteIdentityExactTransitionControlRun,
        incompleteIdentityExactConflictingSnapshot,
        { durableAvailable: true, origin: "prompt" },
    ).type,
    exactMissingOriginTransition: resolveReportRunInitializationTransition(
        incompleteIdentityExactTransitionControlRun,
        incompleteIdentityExactMissingOriginSnapshot,
        { durableAvailable: true, origin: "prompt" },
    ).type,
    exactManualTransition: resolveReportRunInitializationTransition(
        incompleteIdentityExactManualRun,
        incompleteIdentityExactManualSnapshot,
        { durableAvailable: true, origin: "manual" },
    ).type,
}, {
    exactFetchAction: "adopt",
    exactFetchAdoptCount: 1,
    exactFetchDispatchCount: 0,
    exactInitializationReady: true,
    exactTransitionAction: "retain",
    exactDurableBeginCount: 1,
    exactOriginalRunStatus: "completed",
    exactActiveRunId: incompleteIdentityExactOriginalRunId,
    exactFalseSupersedeCodes: [],
    exactCompletionCount: 1,
    exactTransitionLatchRetained: true,
    exactSupersedeCode: "",
    exactFinalStatus: "completed",
    exactHoldAction: "dispatch",
    exactHoldFetchCount: 1,
    exactHoldUsesCurrentMaterialization: true,
    incompleteDriftAction: "skip",
    incompleteDriftFailureCodes: ["browser_run_superseded"],
    incompleteDriftFinalStatus: "failed",
    foreignDriftAction: "skip",
    exactConflictingTransition: "begin",
    exactMissingOriginTransition: "begin",
    exactManualTransition: "begin",
}, "the production final handoff must retain and complete one exact no-drift hosted run while every unauthorized identity remains fail-closed");

const settleExpandedGateAFailure = async (failure) => {
    const event = captureReportRunSettlementEvent(gateAActiveRun, {
        runId: gateAActiveRun.invocation.runId,
        requestFingerprint: gateAActiveRun.invocation.requestFingerprint,
        materializationFingerprint: gateAActiveRun.invocation.materializationFingerprint,
        currentFingerprint: gateAFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${gateAFinalSnapshot.requestFingerprint}::fetch`,
        hostedInitializationFailureSnapshot: gateAFinalSnapshot,
        allowDurableFailureWithInvocationDrift: true,
        allowDurableFailureWithMaterializationDrift: true,
        status: "failed",
        error: failure,
        rowCount: 0,
        resultRequestKey: "performance-inventory:2676946:error",
        expectedResultRequestKey: "performance-inventory:2676946:error",
    });
    const selectedEvent = event || classifyReportRunSupersede(gateAActiveRun, {
        currentFingerprint: gateAFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${gateAFinalSnapshot.requestFingerprint}::fetch`,
    });
    const failureCodes = [];
    if (selectedEvent) {
        const pendingSettlementRef = { current: null };
        await reportBuilderRunPersistenceModule.executeReportRunSettlementPromiseLifecycle({
            eventKey: reportBuilderRunPersistenceModule.buildReportRunSettlementEventKey(
                gateAActiveRun,
                selectedEvent,
            ),
            completedEventKey: "",
            pendingSettlementRef,
            completedValue: gateAActiveRun,
            execute: () => settleReportRunInvocation(gateAActiveRun, selectedEvent, {
                shouldSettle: selectedEvent.superseded === true
                    ? undefined
                    : () => reportBuilderRunPersistenceModule.matchesReportRunSettlementCurrency(
                        gateAActiveRun,
                        selectedEvent,
                        {
                            currentRun: gateAActiveRun,
                            currentFingerprint: gateAFinalSnapshot.requestFingerprint,
                            currentMaterializationFingerprint:
                                gateAFinalSnapshot.materializationFingerprint,
                            dispatchFingerprint: `${gateAFinalSnapshot.requestFingerprint}::fetch`,
                        },
                    ),
                fail: async (run, selectedFailure) => {
                    failureCodes.push(selectedFailure?.code);
                    return { ...run, revision: run.revision + 1, status: "failed" };
                },
            }),
        });
        assert.equal(pendingSettlementRef.current, null);
    }
    return failureCodes;
};
const gateAOrdinaryRuntimeError = Object.assign(
    new Error("Renderer execution failed before final handoff."),
    { code: "runtimePreviewExecutionFailed" },
);
const gateAFreshnessRuntimeError = buildReportRuntimePreviewFreshnessError({
    requestKey: "performance-inventory:2676946:freshness",
    scope: "runtime preview rows",
});
const gateAStaleTerminalEvent = captureReportRunSettlementEvent(gateAFinalTransition.run, {
    runId: gateAFinalTransition.run.invocation.runId,
    requestFingerprint: gateAFinalSnapshot.requestFingerprint,
    materializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
    currentFingerprint: gateAFinalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${gateAFinalSnapshot.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: finalSnapshot.materializedExportRequest,
    rowCount: 1,
    resultRequestKey: "performance-inventory:2676946:fresh",
    expectedResultRequestKey: "performance-inventory:2676946:fresh",
});
const gateAMissingOriginSnapshot = buildSnapshot({
    request: gateARendererRequest,
    rendererRequest: gateARendererRequest,
    rows: finalRows,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    includeOrigin: false,
});
const gateAReviewFindingResults = {
    ordinaryFailureCodes: await settleExpandedGateAFailure(gateAOrdinaryRuntimeError),
    freshnessFailureCodes: await settleExpandedGateAFailure(gateAFreshnessRuntimeError),
    staleTerminalAccepted: !!gateAStaleTerminalEvent,
    missingOriginDeferred: shouldDeferReportRunSupersedeForInitialization(
        gateAActiveRun,
        gateAMissingOriginSnapshot,
        {
            deferSupersede: true,
            currentFingerprint: gateAMissingOriginSnapshot.requestFingerprint,
            currentMaterializationFingerprint: gateAMissingOriginSnapshot.materializationFingerprint,
            dispatchFingerprint: `${gateAMissingOriginSnapshot.requestFingerprint}::fetch`,
            origin: "prompt",
        },
    ),
    missingOriginTransition: resolveReportRunInitializationTransition(
        gateAActiveRun,
        gateAMissingOriginSnapshot,
        { durableAvailable: true, origin: "prompt" },
    ).type,
    staleOldDispatchDeferred: shouldDeferReportRunSupersedeForInitialization(
        gateAActiveRun,
        gateAFinalSnapshot,
        {
            deferSupersede: true,
            currentFingerprint: gateAFinalSnapshot.requestFingerprint,
            currentMaterializationFingerprint: gateAFinalSnapshot.materializationFingerprint,
            dispatchFingerprint: `${gateAEarlySnapshot.requestFingerprint}::fetch`,
            origin: "prompt",
        },
    ),
};
assert.deepEqual(gateAReviewFindingResults, {
    ordinaryFailureCodes: ["runtimePreviewExecutionFailed"],
    freshnessFailureCodes: ["runtimePreviewFreshnessUnavailable"],
    staleTerminalAccepted: false,
    missingOriginDeferred: false,
    missingOriginTransition: "begin",
    staleOldDispatchDeferred: false,
}, "all four Gate A review findings must fail closed through production lifecycle helpers");

const gateAUnapprovedRequest = {
    ...gateARendererRequest,
    measures: {
        ...gateARendererRequest.measures,
        conversions: true,
    },
};
const gateAUnapprovedSnapshot = buildSnapshot({
    request: gateAUnapprovedRequest,
    rendererRequest: gateAUnapprovedRequest,
    rows: finalRows,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
});
assert.equal(shouldDeferReportRunSupersedeForInitialization(gateAActiveRun, gateAUnapprovedSnapshot, {
    deferSupersede: true,
    currentFingerprint: gateAUnapprovedSnapshot.requestFingerprint,
    currentMaterializationFingerprint: gateAUnapprovedSnapshot.materializationFingerprint,
    dispatchFingerprint: `${gateAUnapprovedSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "an additive measure absent from the captured renderer request remains a real supersession");
assert.equal(
    classifyReportRunSupersede(gateAActiveRun, {
        currentFingerprint: gateAUnapprovedSnapshot.requestFingerprint,
        currentMaterializationFingerprint: gateAUnapprovedSnapshot.materializationFingerprint,
        dispatchFingerprint: `${gateAUnapprovedSnapshot.requestFingerprint}::fetch`,
    })?.error?.code,
    "browser_run_superseded",
);
assert.equal(resolveReportRunInitializationTransition(gateAActiveRun, gateAUnapprovedSnapshot, {
    durableAvailable: true,
    origin: "prompt",
}).type, "begin", "an unapproved request expansion must receive a distinct durable run");

const gateAChangedOrderSnapshot = buildSnapshot({
    request: {
        ...gateARendererRequest,
        orderIds: [2676947],
    },
    rendererRequest: gateARendererRequest,
    rows: finalRows,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
});
assert.equal(shouldDeferReportRunSupersedeForInitialization(gateAActiveRun, gateAChangedOrderSnapshot, {
    deferSupersede: true,
    currentFingerprint: gateAChangedOrderSnapshot.requestFingerprint,
    currentMaterializationFingerprint: gateAChangedOrderSnapshot.materializationFingerprint,
    dispatchFingerprint: `${gateAChangedOrderSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "a changed order scope remains a newer request even when renderer measures overlap");

const gateAForeignSnapshot = buildSnapshot({
    request: gateARendererRequest,
    rendererRequest: gateARendererRequest,
    rows: finalRows,
    reportId: "foreign_inventory_brief",
    title: "Foreign Inventory Brief",
});
assert.equal(shouldDeferReportRunSupersedeForInitialization(gateAActiveRun, gateAForeignSnapshot, {
    deferSupersede: true,
    currentFingerprint: gateAForeignSnapshot.requestFingerprint,
    currentMaterializationFingerprint: gateAForeignSnapshot.materializationFingerprint,
    dispatchFingerprint: `${gateAForeignSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "captured renderer measures cannot cross stable report identity");
assert.equal(resolveReportRunInitializationTransition(gateAActiveRun, gateAForeignSnapshot, {
    durableAvailable: true,
    origin: "prompt",
}).type, "begin");

const gateAManualEarlySnapshot = buildSnapshot({
    request: gateACanonicalRequest,
    rendererRequest: gateARendererRequest,
    origin: "manual",
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
});
const gateAManualRun = bindReportRunInvocation({
    ...gateAActiveRun,
    runId: "gate-a-manual-run",
    reportRunId: "gate-a-manual-run",
    origin: "manual",
}, gateAManualEarlySnapshot);
const gateAManualFinalSnapshot = buildSnapshot({
    request: gateARendererRequest,
    rendererRequest: gateARendererRequest,
    rows: finalRows,
    origin: "manual",
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
});
assert.equal(shouldDeferReportRunSupersedeForInitialization(gateAManualRun, gateAManualFinalSnapshot, {
    deferSupersede: true,
    currentFingerprint: gateAManualFinalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: gateAManualFinalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${gateAManualFinalSnapshot.requestFingerprint}::fetch`,
    origin: "manual",
}), false, "manual runs never receive prompt-hosted renderer-expansion authority");
assert.equal(resolveReportRunInitializationTransition(gateAManualRun, gateAManualFinalSnapshot, {
    durableAvailable: true,
    origin: "manual",
}).type, "begin");

const liveGateARequest = {
    orderIds: [2676946],
    dimensions: {
        channelId: true,
        channelName: true,
    },
    measures: {
        totalSpend: true,
        impressions: true,
    },
};
const liveGateABeginSnapshot = buildSnapshot({
    request: liveGateARequest,
    rendererRequest: liveGateARequest,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "b1236a0d-804e-43b4-9a9c-474e5e3e4c51",
});
const liveGateARenderedSnapshot = buildSnapshot({
    request: liveGateARequest,
    rendererRequest: liveGateARequest,
    rows: [{
        channelId: 4,
        channelName: "Display",
        totalSpend: 514,
        impressions: 147000,
        ctr: 0.01,
    }],
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "b1236a0d-804e-43b4-9a9c-474e5e3e4c51",
});
const liveGateAPartialTerminalSnapshot = captureReportRunDispatchSnapshot({
    request: liveGateARenderedSnapshot.request,
    readiness: liveGateARenderedSnapshot.readiness,
    materialization: liveGateARenderedSnapshot.materialization,
    materializedExportRequest: null,
    metadata: liveGateARenderedSnapshot.metadata,
});
const liveGateAActivePromptRun = bindReportRunInvocation({
    runId: "a13edb9b-c028-483b-b453-6b3f2e5e9b28",
    reportRunId: "a13edb9b-c028-483b-b453-6b3f2e5e9b28",
    revision: 1,
    contextRevision: 1,
    conversationId: "b1236a0d-804e-43b4-9a9c-474e5e3e4c51",
    turnId: "turn-7",
    windowId: "window-3",
    origin: "prompt",
    durable: true,
    status: "running",
}, liveGateABeginSnapshot);
const liveGateASurfaceAutoRunAction = resolveReportBuilderSurfaceAutoRunAction({
    workspaceMode: "report",
    requestFingerprint: liveGateAPartialTerminalSnapshot.requestFingerprint,
    hostedExecuteOnOpen: true,
    canRunReport: true,
    currentRequestShouldFetch: true,
    loading: false,
    error: null,
    hasRows: true,
    hasCompletedCurrentRun: false,
    autoRunKey: `report::${liveGateAPartialTerminalSnapshot.requestFingerprint}::performance_inventory_brief::1`,
    consumedAutoRunKey: "",
    currentRequestDispatchFingerprint: `${liveGateAPartialTerminalSnapshot.requestFingerprint}::fetch`,
    requestDispatchFingerprint: `${liveGateAPartialTerminalSnapshot.requestFingerprint}::fetch`,
});
const liveGateALaterDurableEligible = reportBuilderRunPersistenceModule
    .canPersistReportRunInvocation(liveGateAPartialTerminalSnapshot);
const liveGateASecondBeginDecision = liveGateASurfaceAutoRunAction.type === "skip"
    ? "not-attempted"
    : resolveReportRunBeginReuseDecision({
        reuseCurrent: true,
        activeRunId: liveGateAActivePromptRun.runId,
        activeStatus: liveGateAActivePromptRun.status,
        activeOrigin: "prompt",
        requestedOrigin: "manual",
        activeInvocationFingerprint:
            liveGateAActivePromptRun.invocation.materializationFingerprint,
        requestedInvocationFingerprint: liveGateALaterDurableEligible
            ? liveGateAPartialTerminalSnapshot.materializationFingerprint
            : liveGateAPartialTerminalSnapshot.requestFingerprint,
        beginDeduplicationKey: buildReportRunBeginDeduplicationKey(
            liveGateAPartialTerminalSnapshot,
            { durable: liveGateALaterDurableEligible, origin: "manual" },
        ),
        activeBeginDeduplicationKey: buildReportRunBeginDeduplicationKey(
            liveGateAActivePromptRun,
            { durable: true, origin: "prompt" },
        ),
    });
const liveGateASecondLifecycleAttempt = liveGateASurfaceAutoRunAction.type !== "skip"
    && liveGateASecondBeginDecision === "begin";
assert.deepEqual({
    initialDurableEligible: reportBuilderRunPersistenceModule
        .canPersistReportRunInvocation(liveGateABeginSnapshot),
    renderedRequestStillExact:
        liveGateABeginSnapshot.requestFingerprint
            === liveGateAPartialTerminalSnapshot.requestFingerprint,
    renderedMaterializationAdvanced:
        liveGateABeginSnapshot.materializationFingerprint
            !== liveGateAPartialTerminalSnapshot.materializationFingerprint,
    laterDurableEligible: liveGateALaterDurableEligible,
    surfaceAction: liveGateASurfaceAutoRunAction.type,
    secondBeginDecision: liveGateASecondBeginDecision,
    durableBeginPostCount: liveGateASecondLifecycleAttempt && liveGateALaterDurableEligible ? 1 : 0,
    localLegacyReplacement: liveGateASecondLifecycleAttempt && !liveGateALaterDurableEligible,
    durableFailureCode: liveGateASecondLifecycleAttempt && liveGateAActivePromptRun.durable
        ? reportBuilderRunPersistenceModule.REPORT_RUN_SUPERSEDED_CODE
        : null,
}, {
    initialDurableEligible: true,
    renderedRequestStillExact: true,
    renderedMaterializationAdvanced: true,
    laterDurableEligible: false,
    surfaceAction: "skip",
    secondBeginDecision: "not-attempted",
    durableBeginPostCount: 0,
    localLegacyReplacement: false,
    durableFailureCode: null,
}, "hosted execute-on-open must exclusively own the live row-to-terminal gap without a manual promotion lifecycle");

const stableLiveRequest = {
    orderIds: [2676946],
    dimensions: {
        channelId: true,
        channelName: true,
    },
    measures: {
        totalSpend: true,
        impressions: true,
        clicks: true,
    },
};
const stableLiveBeginSnapshot = buildSnapshot({
    request: stableLiveRequest,
    rendererRequest: stableLiveRequest,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "f6a20885-e942-41c2-9082-087ceeab2037",
    turnId: "",
    windowId: "",
});
const stableLiveFinalSnapshot = buildSnapshot({
    request: stableLiveRequest,
    rendererRequest: stableLiveRequest,
    rows: [{
        channelId: 4,
        channelName: "Display",
        totalSpend: 514,
        impressions: 147000,
        clicks: 1470,
    }],
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "f6a20885-e942-41c2-9082-087ceeab2037",
    turnId: "",
    windowId: "",
});
const stableLiveRunId = "571ef0c0-ae65-43e1-b03b-a36c106b0093";
const stableLiveOwnedRun = bindReportRunInvocation({
    runId: stableLiveRunId,
    reportRunId: stableLiveRunId,
    revision: 1,
    contextRevision: 1,
    conversationId: "f6a20885-e942-41c2-9082-087ceeab2037",
    origin: "prompt",
    durable: true,
    status: "running",
}, stableLiveBeginSnapshot);
const stableLiveMaturingReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    primaryResultSettled: false,
    datasetResultSettled: false,
    finalArtifactsReady: false,
});
const stableLiveOwned = resolveHostedReportRunInitializationOwnership(stableLiveOwnedRun, {
    hostedInitialization: stableLiveMaturingReadiness.hostedInitialization,
    durableAvailable: true,
    ownedRunId: stableLiveRunId,
});
const stableLiveDeferred = shouldDeferReportRunSupersedeForInitialization(
    stableLiveOwnedRun,
    stableLiveFinalSnapshot,
    {
        deferSupersede: stableLiveMaturingReadiness.deferSupersede,
        currentFingerprint: stableLiveFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: stableLiveFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${stableLiveFinalSnapshot.requestFingerprint}::fetch`,
        ownedRunId: stableLiveRunId,
        origin: "prompt",
    },
);
const stableLiveMaturingSupersede = stableLiveDeferred
    ? null
    : classifyReportRunSupersede(stableLiveOwnedRun, {
        currentFingerprint: stableLiveFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: stableLiveFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${stableLiveFinalSnapshot.requestFingerprint}::fetch`,
    });
const stableLiveTransition = resolveReportRunInitializationTransition(
    stableLiveOwnedRun,
    stableLiveFinalSnapshot,
    {
        durableAvailable: true,
        ownedRunId: stableLiveRunId,
        origin: "prompt",
    },
);
const stableLiveRunAfterAcquire = stableLiveTransition.type === "retain"
    ? stableLiveTransition.run
    : stableLiveOwnedRun;
const stableLivePostAcquireSupersede = classifyReportRunSupersede(stableLiveRunAfterAcquire, {
    currentFingerprint: stableLiveFinalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: stableLiveFinalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${stableLiveFinalSnapshot.requestFingerprint}::fetch`,
});
const stableLiveCompletionEvent = stableLiveTransition.type === "retain"
    ? captureReportRunSettlementEvent(stableLiveRunAfterAcquire, {
        runId: stableLiveRunAfterAcquire.invocation.runId,
        fingerprint: stableLiveFinalSnapshot.requestFingerprint,
        materializationFingerprint: stableLiveFinalSnapshot.materializationFingerprint,
        currentFingerprint: stableLiveFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: stableLiveFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${stableLiveFinalSnapshot.requestFingerprint}::fetch`,
        status: "succeeded",
        terminalRequest: stableLiveFinalSnapshot.materializedExportRequest,
        rowCount: 1,
        resultRequestKey: "stable-live-result",
        expectedResultRequestKey: "stable-live-result",
    })
    : null;
let stableLiveCompletionCount = 0;
const stableLiveSettlement = stableLiveCompletionEvent
    ? await settleReportRunInvocation(stableLiveRunAfterAcquire, stableLiveCompletionEvent, {
        complete: async (run) => {
            stableLiveCompletionCount += 1;
            return { ...run, revision: run.revision + 1, status: "completed" };
        },
    })
    : { accepted: false, run: stableLiveRunAfterAcquire };
const stableLiveForeignSnapshot = buildSnapshot({
    request: stableLiveRequest,
    rendererRequest: stableLiveRequest,
    rows: stableLiveFinalSnapshot.materializedExportRequest.reportFill.rows,
    reportId: "another-report",
    title: "Another report",
    conversationId: "f6a20885-e942-41c2-9082-087ceeab2037",
    turnId: "",
    windowId: "",
});
const stableLiveManualSnapshot = buildSnapshot({
    request: stableLiveRequest,
    rendererRequest: stableLiveRequest,
    rows: stableLiveFinalSnapshot.materializedExportRequest.reportFill.rows,
    origin: "manual",
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "f6a20885-e942-41c2-9082-087ceeab2037",
    turnId: "",
    windowId: "",
});
const stableLiveConflictingConversationSnapshot = buildSnapshot({
    request: stableLiveRequest,
    rendererRequest: stableLiveRequest,
    rows: stableLiveFinalSnapshot.materializedExportRequest.reportFill.rows,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "another-conversation",
    turnId: "",
    windowId: "",
});
const stableLiveChangedRequestSnapshot = buildSnapshot({
    request: {
        ...stableLiveRequest,
        orderIds: [2676947],
    },
    rendererRequest: {
        ...stableLiveRequest,
        orderIds: [2676947],
    },
    rows: stableLiveFinalSnapshot.materializedExportRequest.reportFill.rows,
    reportId: "performance_inventory_brief",
    title: "Performance Inventory Brief",
    conversationId: "f6a20885-e942-41c2-9082-087ceeab2037",
    turnId: "",
    windowId: "",
});
const resolveStableLivePostBegin = (currentSnapshot, {
    dispatchFingerprint = `${currentSnapshot.requestFingerprint}::fetch`,
    ownedRunId = stableLiveRunId,
    origin = "prompt",
} = {}) => reportBuilderRunPersistenceModule.resolveHostedReportRunPostBeginDispatch(
    stableLiveOwnedRun,
    stableLiveBeginSnapshot,
    currentSnapshot,
    {
        currentFingerprint: currentSnapshot.requestFingerprint,
        currentMaterializationFingerprint: currentSnapshot.materializationFingerprint,
        dispatchFingerprint,
        ownedRunId,
        origin,
    },
);
async function exerciseStableLivePostBegin(dispatchKind) {
    let adoptCount = 0;
    let dispatchCount = 0;
    let selectedSnapshot = null;
    const dispatchFingerprint = `${stableLiveFinalSnapshot.requestFingerprint}::${dispatchKind}`;
    const result = await reportBuilderRunPersistenceModule.beginAndDispatchReportRun(
        stableLiveBeginSnapshot,
        {
            begin: async () => {
                await Promise.resolve();
                return {
                    ok: true,
                    runId: stableLiveRunId,
                    durable: true,
                    started: true,
                };
            },
            resolvePostBeginDispatch: () => resolveStableLivePostBegin(
                stableLiveFinalSnapshot,
                { dispatchFingerprint },
            ),
            adopt: (snapshot) => {
                adoptCount += 1;
                selectedSnapshot = snapshot;
                return { adopted: true };
            },
            dispatch: (snapshot) => {
                dispatchCount += 1;
                selectedSnapshot = snapshot;
                return { dispatched: true };
            },
        },
    );
    return {
        action: result.dispatchAction,
        adoptCount,
        dispatchCount,
        selectedCurrentSnapshot: selectedSnapshot === stableLiveFinalSnapshot,
    };
}
const stableLiveFetchPostBegin = await exerciseStableLivePostBegin("fetch");
const stableLiveHoldPostBegin = await exerciseStableLivePostBegin("hold");
const stableLiveNegativeDeferral = (snapshot, options = {}) => (
    shouldDeferReportRunSupersedeForInitialization(stableLiveOwnedRun, snapshot, {
        deferSupersede: true,
        currentFingerprint: snapshot.requestFingerprint,
        currentMaterializationFingerprint: snapshot.materializationFingerprint,
        dispatchFingerprint: `${snapshot.requestFingerprint}::fetch`,
        ownedRunId: stableLiveRunId,
        origin: "prompt",
        ...options,
    })
);
assert.deepEqual({
    exactRequestStable:
        stableLiveBeginSnapshot.requestFingerprint === stableLiveFinalSnapshot.requestFingerprint,
    materializationMatured:
        stableLiveBeginSnapshot.materializationFingerprint
            !== stableLiveFinalSnapshot.materializationFingerprint,
    completeStableTransitionKey: buildReportRunInitializationTransitionKey(
        stableLiveFinalSnapshot,
        {
            executionKey: `performance_inventory_brief::${stableLiveFinalSnapshot.requestFingerprint}::1`,
            origin: "prompt",
        },
    ),
    owned: stableLiveOwned,
    maturingReadiness: stableLiveMaturingReadiness,
    deferredDuringMaturation: stableLiveDeferred,
    maturingSupersedeCode: stableLiveMaturingSupersede?.error?.code || null,
    finalTransition: stableLiveTransition.type,
    postAcquireSupersedeCode: stableLivePostAcquireSupersede?.error?.code || null,
    completionEventCaptured: !!stableLiveCompletionEvent,
    completionAccepted: stableLiveSettlement.accepted,
    completionCount: stableLiveCompletionCount,
    finalStatus: stableLiveSettlement.run.status,
    wrongOwnedRunDeferred: stableLiveNegativeDeferral(stableLiveFinalSnapshot, {
        ownedRunId: "another-owned-run",
    }),
    missingOwnedRunDeferred: stableLiveNegativeDeferral(stableLiveFinalSnapshot, {
        ownedRunId: "",
    }),
    foreignReportDeferred: stableLiveNegativeDeferral(stableLiveForeignSnapshot),
    manualSnapshotDeferred: stableLiveNegativeDeferral(stableLiveManualSnapshot),
    fetchPostBegin: stableLiveFetchPostBegin,
    holdPostBegin: stableLiveHoldPostBegin,
    wrongOwnedRunPostBegin: resolveStableLivePostBegin(stableLiveFinalSnapshot, {
        ownedRunId: "another-owned-run",
    }).type,
    missingOwnedRunPostBegin: resolveStableLivePostBegin(stableLiveFinalSnapshot, {
        ownedRunId: "",
    }).type,
    manualPostBegin: resolveStableLivePostBegin(stableLiveManualSnapshot).type,
    foreignReportPostBegin: resolveStableLivePostBegin(stableLiveForeignSnapshot).type,
    conflictingConversationPostBegin:
        resolveStableLivePostBegin(stableLiveConflictingConversationSnapshot).type,
    changedRequestPostBegin: resolveStableLivePostBegin(stableLiveChangedRequestSnapshot).type,
    divergentDispatchPostBegin: resolveStableLivePostBegin(stableLiveFinalSnapshot, {
        dispatchFingerprint: `${stableLiveChangedRequestSnapshot.requestFingerprint}::fetch`,
    }).type,
}, {
    exactRequestStable: true,
    materializationMatured: true,
    completeStableTransitionKey: "",
    owned: true,
    maturingReadiness: {
        hostedInitialization: true,
        ready: false,
        deferSupersede: true,
    },
    deferredDuringMaturation: true,
    maturingSupersedeCode: null,
    finalTransition: "retain",
    postAcquireSupersedeCode: null,
    completionEventCaptured: true,
    completionAccepted: true,
    completionCount: 1,
    finalStatus: "completed",
    wrongOwnedRunDeferred: false,
    missingOwnedRunDeferred: false,
    foreignReportDeferred: false,
    manualSnapshotDeferred: false,
    fetchPostBegin: {
        action: "adopt",
        adoptCount: 1,
        dispatchCount: 0,
        selectedCurrentSnapshot: true,
    },
    holdPostBegin: {
        action: "dispatch",
        adoptCount: 0,
        dispatchCount: 1,
        selectedCurrentSnapshot: true,
    },
    wrongOwnedRunPostBegin: "skip",
    missingOwnedRunPostBegin: "skip",
    manualPostBegin: "skip",
    foreignReportPostBegin: "skip",
    conflictingConversationPostBegin: "skip",
    changedRequestPostBegin: "skip",
    divergentDispatchPostBegin: "skip",
}, "the sole locally owned incomplete-identity run must survive stable request materialization maturation and settle before supersede");

const preLoadingErrorReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    hasCompletedRequest: false,
    primaryResultSettled: false,
    datasetResultSettled: false,
    finalArtifactsReady: false,
    error: new Error("runtime initialization failed"),
});
assert.equal(preLoadingErrorReadiness.deferSupersede, false);
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, finalSnapshot, {
    deferSupersede: preLoadingErrorReadiness.deferSupersede,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "an error releases the exact pre-loading transition for deterministic failure");

const firstHostedFreshnessRecovery = resolveReportRuntimePreviewFreshnessRecovery({
    deferred: true,
    requestKey: "inventory::hosted-freshness",
});
const exhaustedHostedFreshnessRecovery = resolveReportRuntimePreviewFreshnessRecovery({
    deferred: true,
    requestKey: "inventory::hosted-freshness",
    recoveryState: firstHostedFreshnessRecovery.recoveryState,
});
assert.equal(exhaustedHostedFreshnessRecovery.action, "fail");
const hostedFreshnessError = buildReportRuntimePreviewFreshnessError({
    requestKey: "inventory::hosted-freshness",
    scope: "runtime preview rows",
});
const hostedFreshnessFailureReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    finalArtifactsReady: false,
    error: hostedFreshnessError,
});
assert.equal(hostedFreshnessFailureReadiness.hostedInitialization, true);
assert.equal(hostedFreshnessFailureReadiness.deferSupersede, false);
const hostedFreshnessFailureHandoffOwned = resolveHostedReportRunInitializationOwnership(earlyDurableRun, {
    hostedInitialization: hostedFreshnessFailureReadiness.hostedInitialization,
    durableAvailable: true,
    ownedRunId: earlyDurableRun.runId,
});
const hostedFreshnessFailureOwned = matchesHostedReportRunInitializationFreshnessFailure(
    earlyDurableRun,
    finalSnapshot,
    {
        error: hostedFreshnessError,
        hostedInitialization: hostedFreshnessFailureReadiness.hostedInitialization,
        hostedHandoffOwned: hostedFreshnessFailureHandoffOwned,
        durableAvailable: true,
        currentFingerprint: finalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
        origin: "prompt",
    },
);
assert.equal(hostedFreshnessFailureOwned, true);
assert.equal(matchesHostedReportRunInitializationFreshnessFailure(earlyDurableRun, finalSnapshot, {
    error: new Error("ordinary runtime failure"),
    hostedInitialization: true,
    hostedHandoffOwned: true,
    durableAvailable: true,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "ordinary errors never receive hosted freshness materialization drift authority");
assert.equal(matchesHostedReportRunInitializationFreshnessFailure(earlyDurableRun, finalSnapshot, {
    error: hostedFreshnessError,
    hostedInitialization: true,
    hostedHandoffOwned: false,
    durableAvailable: true,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "an unowned hosted run never receives freshness failure authority");
assert.equal(matchesHostedReportRunInitializationFreshnessFailure(laterManualRun, buildSnapshot({
    rows: finalRows,
    origin: "manual",
}), {
    error: hostedFreshnessError,
    hostedInitialization: true,
    hostedHandoffOwned: true,
    durableAvailable: true,
    currentFingerprint: laterManualRun.invocation.requestFingerprint,
    currentMaterializationFingerprint: laterManualRun.invocation.materializationFingerprint,
    dispatchFingerprint: `${laterManualRun.invocation.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "manual runs never receive prompt-owned freshness failure authority");
assert.equal(matchesHostedReportRunInitializationFreshnessFailure(earlyDurableRun, buildSnapshot({
    rows: finalRows,
    reportId: "foreign-inventory-brief",
}), {
    error: hostedFreshnessError,
    hostedInitialization: true,
    hostedHandoffOwned: true,
    durableAvailable: true,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: buildSnapshot({
        rows: finalRows,
        reportId: "foreign-inventory-brief",
    }).materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "different stable report identity never receives freshness failure authority");
const differentRequestFreshnessSnapshot = buildSnapshot({
    request: { advertiserId: 990, dateRange: { start: "2026-07-01", end: "2026-07-31" } },
    rows: finalRows,
});
assert.equal(matchesHostedReportRunInitializationFreshnessFailure(
    earlyDurableRun,
    differentRequestFreshnessSnapshot,
    {
        error: hostedFreshnessError,
        hostedInitialization: true,
        hostedHandoffOwned: true,
        durableAvailable: true,
        currentFingerprint: differentRequestFreshnessSnapshot.requestFingerprint,
        currentMaterializationFingerprint: differentRequestFreshnessSnapshot.materializationFingerprint,
        dispatchFingerprint: `${differentRequestFreshnessSnapshot.requestFingerprint}::fetch`,
        origin: "prompt",
    },
), false, "different request fingerprints never receive freshness failure authority");
const hostedFreshnessFailureSettlementReady = resolveAuthoredRuntimeSettlementReadiness({
    authoredRuntimeExecution: true,
    settlementAllowed: true,
    activeRunId: earlyDurableRun.runId,
    durable: true,
    activeRunMatchesCurrentDispatch: false,
    allowDurableFailureWithMaterializationDrift: hostedFreshnessFailureOwned,
    status: "failed",
    datasetLoading: false,
    datasetResultCorrelated: true,
    datasetResultFresh: false,
    primaryRowsLoading: false,
    rowsSourceLoading: false,
    updating: false,
    primaryResultCorrelated: true,
    primaryResultFresh: false,
    canRenderRuntime: false,
});
const hostedFreshnessFailureEventAtFinalA = captureReportRunSettlementEvent(earlyDurableRun, {
    runId: earlyDurableRun.runId,
    requestFingerprint: earlyDurableRun.invocation.requestFingerprint,
    materializationFingerprint: earlyDurableRun.invocation.materializationFingerprint,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    allowDurableFailureWithMaterializationDrift: hostedFreshnessFailureOwned,
    status: "failed",
    error: hostedFreshnessError,
    rowCount: 0,
});
assert.ok(hostedFreshnessFailureEventAtFinalA);
assert.deepEqual(
    hostedFreshnessFailureEventAtFinalA.hostedFreshnessFailureAuthorization,
    { targetMaterializationFingerprint: finalSnapshot.materializationFingerprint },
    "capture must bind freshness failure authority to the exact validated current materialization",
);
const matchesReportRunSettlementCurrency = reportBuilderRunPersistenceModule
    .matchesReportRunSettlementCurrency;
assert.equal(
    typeof matchesReportRunSettlementCurrency,
    "function",
    "the pre-persist settlement currency predicate must be directly testable",
);
const newerFinalSnapshot = buildSnapshot({
    rows: [
        ...finalRows,
        { channel: "Video", spend: 140 },
    ],
});
assert.equal(newerFinalSnapshot.requestFingerprint, finalSnapshot.requestFingerprint);
assert.notEqual(newerFinalSnapshot.materializationFingerprint, finalSnapshot.materializationFingerprint);
const settlementCurrencyOptions = (currentMaterializationFingerprint) => ({
    currentRun: earlyDurableRun,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
});
const hostedFreshnessFailureOwnedAtFinalB = matchesHostedReportRunInitializationFreshnessFailure(
    earlyDurableRun,
    newerFinalSnapshot,
    {
        error: hostedFreshnessError,
        hostedInitialization: hostedFreshnessFailureReadiness.hostedInitialization,
        hostedHandoffOwned: hostedFreshnessFailureHandoffOwned,
        durableAvailable: true,
        currentFingerprint: newerFinalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: newerFinalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${newerFinalSnapshot.requestFingerprint}::fetch`,
        origin: "prompt",
    },
);
assert.equal(hostedFreshnessFailureOwnedAtFinalB, true);
const hostedFreshnessFailureEventAtFinalB = captureReportRunSettlementEvent(earlyDurableRun, {
    runId: earlyDurableRun.runId,
    requestFingerprint: earlyDurableRun.invocation.requestFingerprint,
    materializationFingerprint: earlyDurableRun.invocation.materializationFingerprint,
    currentFingerprint: newerFinalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: newerFinalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${newerFinalSnapshot.requestFingerprint}::fetch`,
    allowDurableFailureWithMaterializationDrift: hostedFreshnessFailureOwnedAtFinalB,
    status: "failed",
    error: hostedFreshnessError,
    rowCount: 0,
});
assert.ok(hostedFreshnessFailureEventAtFinalB);
const oldFinalAEventKey = `${earlyDurableRun.invocation.runId}:${earlyDurableRun.invocation.materializationFingerprint}:failed`;
const oldFinalBEventKey = `${earlyDurableRun.invocation.runId}:${earlyDurableRun.invocation.materializationFingerprint}:failed`;
assert.equal(
    oldFinalAEventKey,
    oldFinalBEventKey,
    "the pre-fix event identity collides because both failures are bound to the old durable materialization",
);
const buildReportRunSettlementEventKey = reportBuilderRunPersistenceModule
    .buildReportRunSettlementEventKey;
const executeReportRunSettlementPromiseLifecycle = reportBuilderRunPersistenceModule
    .executeReportRunSettlementPromiseLifecycle;
assert.equal(typeof buildReportRunSettlementEventKey, "function");
assert.equal(
    typeof executeReportRunSettlementPromiseLifecycle,
    "function",
    "ReportBuilder settlement promise de-duplication must be directly testable",
);
const exactMaterializationRun = bindReportRunInvocation({
    ...earlyDurableRun,
    runId: "report-run-exact-materialization",
    reportRunId: "report-run-exact-materialization",
    revision: 1,
    status: "running",
}, finalSnapshot);
const exactMaterializationHostedOwned = matchesHostedReportRunInitializationFreshnessFailure(
    exactMaterializationRun,
    finalSnapshot,
    {
        error: hostedFreshnessError,
        hostedInitialization: hostedFreshnessFailureReadiness.hostedInitialization,
        hostedHandoffOwned: true,
        durableAvailable: true,
        currentFingerprint: finalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
        origin: "prompt",
    },
);
assert.equal(exactMaterializationHostedOwned, true);
const exactMaterializationOrdinaryEvent = captureReportRunSettlementEvent(exactMaterializationRun, {
    runId: exactMaterializationRun.runId,
    requestFingerprint: exactMaterializationRun.invocation.requestFingerprint,
    materializationFingerprint: exactMaterializationRun.invocation.materializationFingerprint,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    status: "failed",
    error: hostedFreshnessError,
    rowCount: 0,
});
const exactMaterializationHostedEvent = captureReportRunSettlementEvent(exactMaterializationRun, {
    runId: exactMaterializationRun.runId,
    requestFingerprint: exactMaterializationRun.invocation.requestFingerprint,
    materializationFingerprint: exactMaterializationRun.invocation.materializationFingerprint,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    allowDurableFailureWithMaterializationDrift: exactMaterializationHostedOwned,
    allowDurableFailureWithInvocationDrift: exactMaterializationHostedOwned,
    hostedInitializationFailureSnapshot: finalSnapshot,
    status: "failed",
    error: hostedFreshnessError,
    rowCount: 0,
});
assert.ok(exactMaterializationOrdinaryEvent);
assert.ok(exactMaterializationHostedEvent);
assert.equal(
    exactMaterializationHostedEvent.hostedFreshnessFailureAuthorization,
    undefined,
    "hosted freshness authorization is unnecessary and omitted when current already equals durable M",
);
assert.equal(
    exactMaterializationHostedEvent.hostedInitializationFailureAuthorization,
    undefined,
    "exact-M failures must not acquire renderer-expansion settlement identity",
);
assert.equal(
    buildReportRunSettlementEventKey(exactMaterializationRun, exactMaterializationOrdinaryEvent),
    buildReportRunSettlementEventKey(exactMaterializationRun, exactMaterializationHostedEvent),
    "ordinary and hosted observations of the same exact-M failure have one semantic settlement identity",
);
const runExactMaterializationObserverOrder = async (events) => {
    const pendingSettlementRef = { current: null };
    const failureCodes = [];
    const promises = events.map((event) => executeReportRunSettlementPromiseLifecycle({
        eventKey: buildReportRunSettlementEventKey(exactMaterializationRun, event),
        completedEventKey: "",
        pendingSettlementRef,
        completedValue: exactMaterializationRun,
        execute: () => settleReportRunInvocation(exactMaterializationRun, event, {
            shouldSettle: () => matchesReportRunSettlementCurrency(
                exactMaterializationRun,
                event,
                {
                    currentRun: exactMaterializationRun,
                    currentFingerprint: finalSnapshot.requestFingerprint,
                    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
                    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
                },
            ),
            fail: async (run, failure) => {
                failureCodes.push(failure?.code);
                return { ...run, revision: run.revision + 1, status: "failed" };
            },
        }),
    }));
    const settlements = await Promise.all(promises);
    return {
        failureCodes,
        reusedPromise: promises[0] === promises[1],
        accepted: settlements.map((settlement) => settlement.accepted),
        marker: pendingSettlementRef.current,
    };
};
const exactMaterializationOrderResults = await Promise.all([
    runExactMaterializationObserverOrder([
        exactMaterializationOrdinaryEvent,
        exactMaterializationHostedEvent,
    ]),
    runExactMaterializationObserverOrder([
        exactMaterializationHostedEvent,
        exactMaterializationOrdinaryEvent,
    ]),
]);
assert.deepEqual(
    exactMaterializationOrderResults.map((result) => result.failureCodes),
    [
        ["runtimePreviewFreshnessUnavailable"],
        ["runtimePreviewFreshnessUnavailable"],
    ],
    "ordinary and hosted exact-M observations must call durable fail once in either observer ordering",
);
assert.deepEqual(exactMaterializationOrderResults.map((result) => result.reusedPromise), [true, true]);
assert.deepEqual(exactMaterializationOrderResults.map((result) => result.accepted), [
    [true, true],
    [true, true],
]);
assert.deepEqual(exactMaterializationOrderResults.map((result) => result.marker), [null, null]);
const finalAEventKey = buildReportRunSettlementEventKey(
    earlyDurableRun,
    hostedFreshnessFailureEventAtFinalA,
);
const finalBEventKey = buildReportRunSettlementEventKey(
    earlyDurableRun,
    hostedFreshnessFailureEventAtFinalB,
);
assert.notEqual(finalAEventKey, finalBEventKey, "freshness failures for final A and final B need independent promises");

const settlementPromiseRef = { current: null };
let inFlightCurrentMaterialization = finalSnapshot.materializationFingerprint;
const inFlightFailureLabels = [];
const inFlightFailureCodes = [];
let releaseFinalBFailure;
const finalBFailureGate = new Promise((resolve) => {
    releaseFinalBFailure = resolve;
});
const startFreshnessFailureSettlement = (event, eventKey, label) => (
    executeReportRunSettlementPromiseLifecycle({
        eventKey,
        completedEventKey: "",
        pendingSettlementRef: settlementPromiseRef,
        completedValue: earlyDurableRun,
        execute: () => settleReportRunInvocation(earlyDurableRun, event, {
            shouldSettle: () => matchesReportRunSettlementCurrency(
                earlyDurableRun,
                event,
                settlementCurrencyOptions(inFlightCurrentMaterialization),
            ),
            fail: async (run, failure) => {
                inFlightFailureLabels.push(label);
                inFlightFailureCodes.push(failure?.code);
                if (label === "B") {
                    await finalBFailureGate;
                }
                return { ...run, revision: run.revision + 1, status: "failed" };
            },
        }),
    })
);
const finalASettlementPromise = startFreshnessFailureSettlement(
    hostedFreshnessFailureEventAtFinalA,
    finalAEventKey,
    "A",
);
inFlightCurrentMaterialization = newerFinalSnapshot.materializationFingerprint;
const finalBSettlementPromise = startFreshnessFailureSettlement(
    hostedFreshnessFailureEventAtFinalB,
    finalBEventKey,
    "B",
);
const duplicateFinalBSettlementPromise = startFreshnessFailureSettlement(
    hostedFreshnessFailureEventAtFinalB,
    finalBEventKey,
    "B-duplicate",
);
assert.equal(
    duplicateFinalBSettlementPromise,
    finalBSettlementPromise,
    "a duplicate observation for the same target reuses exactly one promise",
);
const finalASettlement = await finalASettlementPromise;
assert.equal(finalASettlement.accepted, false);
assert.equal(finalASettlement.run, earlyDurableRun);
const postFinalACleanupDuplicateFinalBSettlementPromise = startFreshnessFailureSettlement(
    hostedFreshnessFailureEventAtFinalB,
    finalBEventKey,
    "B-post-A-cleanup-duplicate",
);
assert.equal(
    postFinalACleanupDuplicateFinalBSettlementPromise,
    finalBSettlementPromise,
    "final A cleanup cannot remove the still-active final B promise",
);
assert.deepEqual(inFlightFailureLabels, ["B"]);
releaseFinalBFailure();
const [
    finalBSettlement,
    duplicateFinalBSettlement,
    postFinalACleanupDuplicateFinalBSettlement,
] = await Promise.all([
    finalBSettlementPromise,
    duplicateFinalBSettlementPromise,
    postFinalACleanupDuplicateFinalBSettlementPromise,
]);
assert.equal(finalBSettlement.accepted, true);
assert.equal(duplicateFinalBSettlement, finalBSettlement);
assert.equal(postFinalACleanupDuplicateFinalBSettlement, finalBSettlement);
assert.deepEqual(inFlightFailureLabels, ["B"]);
assert.deepEqual(inFlightFailureCodes, ["runtimePreviewFreshnessUnavailable"]);
assert.equal(settlementPromiseRef.current, null);

const reverseSettlementPromiseRef = { current: null };
let releaseReverseFinalBFailure;
const reverseFinalBFailureGate = new Promise((resolve) => {
    releaseReverseFinalBFailure = resolve;
});
let markReverseFinalBFailureStarted;
const reverseFinalBFailureStarted = new Promise((resolve) => {
    markReverseFinalBFailureStarted = resolve;
});
const reverseFailureLabels = [];
const startReverseFreshnessFailureSettlement = (event, eventKey, label) => (
    executeReportRunSettlementPromiseLifecycle({
        eventKey,
        completedEventKey: "",
        pendingSettlementRef: reverseSettlementPromiseRef,
        completedValue: earlyDurableRun,
        execute: () => settleReportRunInvocation(earlyDurableRun, event, {
            shouldSettle: () => matchesReportRunSettlementCurrency(
                earlyDurableRun,
                event,
                settlementCurrencyOptions(newerFinalSnapshot.materializationFingerprint),
            ),
            fail: async (run, failure) => {
                reverseFailureLabels.push(label);
                assert.equal(failure?.code, "runtimePreviewFreshnessUnavailable");
                if (label === "B1") {
                    markReverseFinalBFailureStarted();
                }
                await reverseFinalBFailureGate;
                return { ...run, revision: run.revision + 1, status: "failed" };
            },
        }),
    })
);
const reverseFinalBSettlementPromise = startReverseFreshnessFailureSettlement(
    hostedFreshnessFailureEventAtFinalB,
    finalBEventKey,
    "B1",
);
await reverseFinalBFailureStarted;
const reverseStaleFinalASettlement = await startReverseFreshnessFailureSettlement(
    hostedFreshnessFailureEventAtFinalA,
    finalAEventKey,
    "A-stale",
);
assert.equal(reverseStaleFinalASettlement.accepted, false);
const reverseDuplicateFinalBSettlementPromise = startReverseFreshnessFailureSettlement(
    hostedFreshnessFailureEventAtFinalB,
    finalBEventKey,
    "B2-duplicate",
);
const reverseDuplicateReusedOriginal = reverseDuplicateFinalBSettlementPromise
    === reverseFinalBSettlementPromise;
releaseReverseFinalBFailure();
const [reverseFinalBSettlement, reverseDuplicateFinalBSettlement] = await Promise.all([
    reverseFinalBSettlementPromise,
    reverseDuplicateFinalBSettlementPromise,
]);
assert.equal(
    reverseDuplicateReusedOriginal,
    true,
    "B -> stale A -> duplicate B must retain and reuse the exact original B promise",
);
assert.equal(reverseFinalBSettlement.accepted, true);
assert.equal(reverseDuplicateFinalBSettlement, reverseFinalBSettlement);
assert.deepEqual(
    reverseFailureLabels,
    ["B1"],
    "a stale distinct settlement cannot evict current B and cause a second durable failure",
);
assert.equal(reverseSettlementPromiseRef.current, null);
assert.equal(
    matchesReportRunSettlementCurrency(
        earlyDurableRun,
        hostedFreshnessFailureEventAtFinalA,
        settlementCurrencyOptions(finalSnapshot.materializationFingerprint),
    ),
    true,
    "the exact authorized final A remains current for deterministic freshness failure",
);
assert.equal(
    matchesReportRunSettlementCurrency(
        earlyDurableRun,
        hostedFreshnessFailureEventAtFinalA,
        settlementCurrencyOptions(newerFinalSnapshot.materializationFingerprint),
    ),
    false,
    "a newer same-request final B invalidates failure captured for final A",
);
const booleanOnlyForgedFailureEvent = {
    ...hostedFreshnessFailureEventAtFinalA,
    allowDurableFailureWithMaterializationDrift: true,
};
delete booleanOnlyForgedFailureEvent.hostedFreshnessFailureAuthorization;
assert.equal(
    matchesReportRunSettlementCurrency(
        earlyDurableRun,
        booleanOnlyForgedFailureEvent,
        settlementCurrencyOptions(finalSnapshot.materializationFingerprint),
    ),
    false,
    "a caller cannot forge materialization drift authority by setting only a boolean",
);

let staleFreshnessFailureCurrentMaterialization = finalSnapshot.materializationFingerprint;
let staleFreshnessFailurePersistCount = 0;
const staleFreshnessFailureSettlementPromise = (async () => {
    await Promise.resolve();
    return settleReportRunInvocation(earlyDurableRun, hostedFreshnessFailureEventAtFinalA, {
        shouldSettle: () => matchesReportRunSettlementCurrency(
            earlyDurableRun,
            hostedFreshnessFailureEventAtFinalA,
            settlementCurrencyOptions(staleFreshnessFailureCurrentMaterialization),
        ),
        fail: async (run) => {
            staleFreshnessFailurePersistCount += 1;
            return { ...run, revision: run.revision + 1, status: "failed" };
        },
    });
})();
staleFreshnessFailureCurrentMaterialization = newerFinalSnapshot.materializationFingerprint;
const staleFreshnessFailureSettlement = await staleFreshnessFailureSettlementPromise;
assert.equal(staleFreshnessFailureSettlement.accepted, false);
assert.equal(staleFreshnessFailureSettlement.run, earlyDurableRun);
assert.equal(
    staleFreshnessFailurePersistCount,
    0,
    "final A failure cannot persist after settlement currency advances to final B at the async boundary",
);

let hostedFreshnessFailureRun = earlyDurableRun;
const hostedFreshnessFailureCodes = [];
if (hostedFreshnessFailureSettlementReady) {
    const freshnessFailureEvent = hostedFreshnessFailureEventAtFinalA;
    if (freshnessFailureEvent) {
        hostedFreshnessFailureRun = (await settleReportRunInvocation(
            hostedFreshnessFailureRun,
            freshnessFailureEvent,
            {
                shouldSettle: () => matchesReportRunSettlementCurrency(
                    hostedFreshnessFailureRun,
                    freshnessFailureEvent,
                    settlementCurrencyOptions(finalSnapshot.materializationFingerprint),
                ),
                fail: async (run, failure) => {
                    hostedFreshnessFailureCodes.push(failure?.code);
                    return { ...run, revision: run.revision + 1, status: "failed" };
                },
            },
        )).run;
    }
}
if (hostedFreshnessFailureRun.status === "running") {
    const freshnessSupersedeEvent = classifyReportRunSupersede(hostedFreshnessFailureRun, {
        currentFingerprint: finalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    });
    if (freshnessSupersedeEvent) {
        hostedFreshnessFailureRun = (await settleReportRunInvocation(
            hostedFreshnessFailureRun,
            freshnessSupersedeEvent,
            {
                fail: async (run, failure) => {
                    hostedFreshnessFailureCodes.push(failure?.code);
                    return { ...run, revision: run.revision + 1, status: "failed" };
                },
            },
        )).run;
    }
}
assert.deepEqual(
    hostedFreshnessFailureCodes,
    ["runtimePreviewFreshnessUnavailable"],
    "the owned hosted run must record its exact freshness failure before supersede can misclassify newer materialization",
);
assert.equal(hostedFreshnessFailureRun.status, "failed");

const settledBeforeArtifactHandoffReadiness = resolveHostedReportRunInitializationReadiness({
    ...settledReadinessInput,
    finalArtifactsReady: false,
});
assert.equal(
    settledBeforeArtifactHandoffReadiness.ready,
    false,
    "the hosted final handoff cannot run before the exact terminal artifacts exist",
);
const deferSettledBeforeArtifactHandoff = shouldDeferReportRunSupersedeForInitialization(
    earlyDurableRun,
    finalSnapshot,
    {
        deferSupersede: settledBeforeArtifactHandoffReadiness.deferSupersede,
        currentFingerprint: finalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
        origin: "prompt",
    },
);
const settledBeforeArtifactHandoffSupersede = deferSettledBeforeArtifactHandoff
    ? null
    : classifyReportRunSupersede(earlyDurableRun, {
        currentFingerprint: finalSnapshot.requestFingerprint,
        currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
        dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    });
let settledBeforeArtifactHandoffFailureCount = 0;
const settledBeforeArtifactHandoffRun = settledBeforeArtifactHandoffSupersede
    ? (await settleReportRunInvocation(earlyDurableRun, settledBeforeArtifactHandoffSupersede, {
        fail: async (run) => {
            settledBeforeArtifactHandoffFailureCount += 1;
            return { ...run, revision: run.revision + 1, status: "failed" };
        },
    })).run
    : earlyDurableRun;
assert.equal(
    settledBeforeArtifactHandoffRun.status,
    "running",
    "fresh hosted rows must not fail the sole durable prompt run before the later final-artifact handoff",
);
assert.equal(settledBeforeArtifactHandoffFailureCount, 0);
assert.equal(resolveHostedReportRunInitializationOwnership(settledBeforeArtifactHandoffRun, {
    hostedInitialization: true,
    durableAvailable: true,
    ownedRunId: "",
}), true, "the later final-artifact render must still be able to claim and complete the same run");

const exactZeroRun = bindReportRunInvocation({
    runId: "report-run-zero",
    reportRunId: "report-run-zero",
    revision: 2,
    contextRevision: 9,
    conversationId: "conversation-1",
    turnId: "turn-7",
    origin: "prompt",
    durable: true,
    status: "running",
}, earlySnapshot);
const exactZeroEvent = captureReportRunSettlementEvent(exactZeroRun, {
    runId: exactZeroRun.runId,
    requestFingerprint: earlySnapshot.requestFingerprint,
    materializationFingerprint: earlySnapshot.materializationFingerprint,
    currentFingerprint: earlySnapshot.requestFingerprint,
    currentMaterializationFingerprint: earlySnapshot.materializationFingerprint,
    dispatchFingerprint: `${earlySnapshot.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: earlySnapshot.materializedExportRequest,
    rowCount: 0,
    resultRequestKey: "inventory:zero",
    expectedResultRequestKey: "inventory:zero",
});
assert.ok(exactZeroEvent);
const exactZeroSettlement = await settleReportRunInvocation(exactZeroRun, exactZeroEvent, {
    complete: (run, terminalRequest) => completeAndActivateReportRun({
        complete: async (input) => {
            assert.deepEqual(input.reportFill.rows, []);
            return { reportRunId: input.reportRunId, revision: 3, status: "completed" };
        },
        activate: async (input) => ({ activeReportRunId: input.reportRunId, revision: 10 }),
    }, run, terminalRequest),
});
assert.equal(exactZeroSettlement.accepted, true);
assert.equal(exactZeroSettlement.run.status, "completed", "an exact settled zero-row result completes and activates durably");

const exactErrorRun = bindReportRunInvocation({
    ...earlyDurableRun,
    runId: "report-run-error",
    reportRunId: "report-run-error",
}, finalSnapshot);
const exactRuntimeError = new Error("runtime failed");
const exactErrorEvent = captureReportRunSettlementEvent(exactErrorRun, {
    runId: exactErrorRun.runId,
    requestFingerprint: finalSnapshot.requestFingerprint,
    materializationFingerprint: finalSnapshot.materializationFingerprint,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    status: "failed",
    error: exactRuntimeError,
    rowCount: 0,
});
let exactErrorFailureCount = 0;
const exactErrorSettlement = await settleReportRunInvocation(exactErrorRun, exactErrorEvent, {
    fail: async (run, settledError) => {
        exactErrorFailureCount += 1;
        assert.equal(settledError, exactRuntimeError);
        return { ...run, revision: run.revision + 1, status: "failed" };
    },
});
assert.equal(exactErrorSettlement.accepted, true);
assert.equal(exactErrorSettlement.run.status, "failed");
assert.equal(exactErrorFailureCount, 1, "the exact hosted runtime error terminates once through the authored observer");
assert.equal((await settleReportRunInvocation(exactErrorSettlement.run, exactErrorEvent, {
    fail: async () => {
        exactErrorFailureCount += 1;
    },
})).accepted, false);
assert.equal(exactErrorFailureCount, 1, "a duplicate hosted error observation cannot fail the run twice");

const prematureSupersede = classifyReportRunSupersede(earlyDurableRun, {
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
});
assert.equal(
    prematureSupersede?.error?.code,
    "browser_run_superseded",
    "the pre-fix stale classifier reproduces the legitimate result-materialization transition",
);
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, finalSnapshot, {
    deferSupersede: true,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), true, "the exact same hosted prompt may defer only its in-flight materialization transition");
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, finalSnapshot, {
    deferSupersede: true,
    currentFingerprint: JSON.stringify({ advertiserId: 990 }),
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "request divergence must supersede immediately");
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, finalSnapshot, {
    deferSupersede: true,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${JSON.stringify({ advertiserId: 990 })}::fetch`,
    origin: "prompt",
}), false, "dispatch divergence must supersede immediately");
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, buildSnapshot({
    rows: finalRows,
    reportId: "another-report",
}), {
    deferSupersede: true,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "cross-report materialization must never suppress supersede");
const manualIdentitySnapshot = buildSnapshot({ origin: "manual" });
const manualIdentityRun = bindReportRunInvocation({
    ...earlyDurableRun,
    runId: "report-run-other-origin",
    reportRunId: "report-run-other-origin",
    origin: "manual",
}, manualIdentitySnapshot);
assert.equal(shouldDeferReportRunSupersedeForInitialization(manualIdentityRun, finalSnapshot, {
    deferSupersede: true,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "manual and prompt origins must never share hosted supersede deferral");
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, buildSnapshot({
    rows: finalRows,
    origin: "manual",
}), {
    deferSupersede: true,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "recorded snapshot origin divergence must not be masked by the caller's expected origin");
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, finalSnapshot, {
    deferSupersede: false,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "settled non-final output must no longer defer supersede");

const retainedTransition = resolveReportRunInitializationTransition(earlyDurableRun, finalSnapshot, {
    durableAvailable: true,
    origin: "prompt",
});
assert.equal(retainedTransition.type, "retain");
assert.equal(retainedTransition.run.reportRunId, "report-run-early");
assert.equal(retainedTransition.run.revision, 2);
assert.equal(retainedTransition.run.invocation.requestFingerprint, finalSnapshot.requestFingerprint);
assert.equal(retainedTransition.run.invocation.materializationFingerprint, finalSnapshot.materializationFingerprint);

const otherReportSnapshot = buildSnapshot({ rows: finalRows, reportId: "inventory-brief-v2" });
assert.equal(resolveReportRunInitializationTransition(earlyDurableRun, otherReportSnapshot, {
    durableAvailable: true,
    origin: "prompt",
}).type, "begin", "same parameters must not retain another report's durable run");
assert.equal(resolveReportRunInitializationTransition(earlyDurableRun, buildSnapshot({
    rows: finalRows,
    windowId: "window-replaced-by-host",
}), {
    durableAvailable: true,
    origin: "prompt",
}).type, "retain", "window identity is intentionally excluded from stable run identity");
assert.equal(resolveReportRunInitializationTransition(earlyDurableRun, buildSnapshot({
    rows: finalRows,
    turnId: "turn-8",
}), {
    durableAvailable: true,
    origin: "prompt",
}).type, "begin", "a changed stable turn correlation must begin a new durable run");

const beginKey = buildReportRunBeginDeduplicationKey(finalSnapshot, {
    durable: true,
    origin: "prompt",
});
assert.equal(beginKey, buildReportRunBeginDeduplicationKey(buildSnapshot({
    rows: finalRows,
    windowId: "window-replaced-by-host",
}), {
    durable: true,
    origin: "prompt",
}), "unstable window identity must not fragment begin de-duplication");
assert.notEqual(beginKey, buildReportRunBeginDeduplicationKey(buildSnapshot({
    rows: finalRows,
    origin: "manual",
}), {
    durable: true,
    origin: "manual",
}), "manual and prompt begins must not coalesce");
assert.notEqual(beginKey, buildReportRunBeginDeduplicationKey(otherReportSnapshot, {
    durable: true,
    origin: "prompt",
}), "concurrent same-materialization begins for different reports must not coalesce");
assert.notEqual(beginKey, buildReportRunBeginDeduplicationKey(buildSnapshot({
    rows: finalRows,
    conversationId: "conversation-2",
}), {
    durable: true,
    origin: "prompt",
}), "concurrent begins for different conversations must not coalesce");
const missingTurnSnapshot = buildSnapshot({ rows: finalRows, turnId: "" });
assert.equal(buildReportRunBeginDeduplicationKey(missingTurnSnapshot, {
    durable: true,
    origin: "prompt",
}), "", "missing turn identity makes a durable begin identity incomplete");
const manualMissingTurnSnapshot = buildSnapshot({
    rows: finalRows,
    origin: "manual",
    conversationId: "",
    turnId: "",
});
const manualPendingBeginKey = buildReportRunPendingBeginDeduplicationKey(manualMissingTurnSnapshot, {
    durable: true,
    origin: "manual",
    scopeKey: "report-builder-instance-a",
});
assert.ok(manualPendingBeginKey, "a component-local manual begin can coalesce while conversation and turn are absent");
assert.equal(manualPendingBeginKey, buildReportRunPendingBeginDeduplicationKey(buildSnapshot({
    rows: finalRows,
    origin: "manual",
    conversationId: "",
    turnId: "",
}), {
    durable: true,
    origin: "manual",
    scopeKey: "report-builder-instance-a",
}), "the same local manual invocation receives the same pending key");
assert.notEqual(manualPendingBeginKey, buildReportRunPendingBeginDeduplicationKey(buildSnapshot({
    rows: finalRows,
    origin: "manual",
    reportId: "another-report",
    conversationId: "",
    turnId: "",
}), {
    durable: true,
    origin: "manual",
    scopeKey: "report-builder-instance-a",
}), "unrelated local manual report invocations do not coalesce");
assert.notEqual(manualPendingBeginKey, buildReportRunPendingBeginDeduplicationKey(manualMissingTurnSnapshot, {
    durable: true,
    origin: "manual",
    scopeKey: "report-builder-instance-b",
}), "incomplete manual pending keys cannot cross builder component scopes");
assert.equal(buildReportRunPendingBeginDeduplicationKey(missingTurnSnapshot, {
    durable: true,
    origin: "prompt",
    scopeKey: "report-builder-instance-a",
}), "", "incomplete hosted prompt identities never receive manual-local pending coalescing");
assert.equal(resolveReportRunBeginReuseDecision({
    beginDeduplicationKey: "",
    beginPendingDeduplicationKey: manualPendingBeginKey,
    pendingBeginDeduplicationKey: manualPendingBeginKey,
}), "pending", "a second local manual click joins its exact in-flight begin");
assert.equal(resolveReportRunBeginReuseDecision({
    beginDeduplicationKey: "",
    beginPendingDeduplicationKey: buildReportRunPendingBeginDeduplicationKey(buildSnapshot({
        rows: finalRows,
        origin: "manual",
        reportId: "another-report",
        conversationId: "",
        turnId: "",
    }), { durable: true, origin: "manual", scopeKey: "report-builder-instance-a" }),
    pendingBeginDeduplicationKey: manualPendingBeginKey,
}), "begin", "an unrelated local manual invocation starts independently");
assert.equal(resolveReportRunInitializationTransition(earlyDurableRun, missingTurnSnapshot, {
    durableAvailable: true,
    origin: "prompt",
}).type, "begin", "missing turn identity must begin a distinct durable run without retaining another invocation");
assert.equal(buildReportRunInitializationTransitionKey(missingTurnSnapshot, {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
}), "", "incomplete identity remains ineligible for global transition de-duplication");
const incompleteIdentityAttempt = resolveReportRunInitializationTransitionAttempt(missingTurnSnapshot, {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
    activeRunId: earlyDurableRun.runId,
    previousAttempt: null,
    nextAttemptNumber: 1,
});
assert.equal(incompleteIdentityAttempt.local, true);
assert.ok(incompleteIdentityAttempt.key, "missing turn receives a non-empty local attempt latch and can reach begin");
assert.deepEqual(resolveReportRunInitializationLatch({
    phase: "acquire",
    latchedKey: "",
    transitionKey: incompleteIdentityAttempt.key,
}), { action: "acquire", key: incompleteIdentityAttempt.key });
const repeatedIncompleteIdentityAttempt = resolveReportRunInitializationTransitionAttempt(missingTurnSnapshot, {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
    activeRunId: earlyDurableRun.runId,
    previousAttempt: incompleteIdentityAttempt,
    nextAttemptNumber: 2,
});
assert.equal(repeatedIncompleteIdentityAttempt.key, incompleteIdentityAttempt.key, "the same local React effect attempt is latched");
assert.deepEqual(resolveReportRunInitializationLatch({
    phase: "acquire",
    latchedKey: incompleteIdentityAttempt.key,
    transitionKey: repeatedIncompleteIdentityAttempt.key,
}), { action: "skip", key: incompleteIdentityAttempt.key }, "a repeated effect cannot begin the same local handoff twice");
const begunIncompleteIdentityAttempt = bindReportRunInitializationTransitionAttempt(
    incompleteIdentityAttempt,
    "report-run-final-incomplete",
);
assert.equal(begunIncompleteIdentityAttempt.begunRunId, "report-run-final-incomplete");
assert.equal(resolveReportRunInitializationTransitionAttempt(missingTurnSnapshot, {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
    activeRunId: "report-run-final-incomplete",
    previousAttempt: begunIncompleteIdentityAttempt,
    nextAttemptNumber: 2,
}).key, incompleteIdentityAttempt.key, "the local latch follows only the run begun by its handoff");
assert.notEqual(resolveReportRunInitializationTransitionAttempt(missingTurnSnapshot, {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
    activeRunId: "report-run-unrelated",
    previousAttempt: begunIncompleteIdentityAttempt,
    nextAttemptNumber: 2,
}).key, incompleteIdentityAttempt.key, "a different active invocation cannot reuse the local attempt latch");
const noActiveIncompleteAttempt = resolveReportRunInitializationTransitionAttempt(missingTurnSnapshot, {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
    activeRunId: "",
    previousAttempt: null,
    nextAttemptNumber: 3,
});
assert.ok(noActiveIncompleteAttempt.key, "an incomplete final handoff with no active run still receives a local attempt");
assert.equal(resolveReportRunInitializationTransitionAttempt(missingTurnSnapshot, {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
    activeRunId: "",
    previousAttempt: noActiveIncompleteAttempt,
    nextAttemptNumber: 4,
}).key, noActiveIncompleteAttempt.key, "a repeated no-active effect reuses only its current local attempt");
assert.notEqual(resolveReportRunInitializationTransitionAttempt(buildSnapshot({
    rows: finalRows,
    turnId: "",
    conversationId: "conversation-2",
}), {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
    activeRunId: "",
    previousAttempt: noActiveIncompleteAttempt,
    nextAttemptNumber: 4,
}).key, noActiveIncompleteAttempt.key, "a no-active local attempt never deduplicates across available conversation identity");
assert.equal(shouldDeferReportRunSupersedeForInitialization(earlyDurableRun, missingTurnSnapshot, {
    deferSupersede: true,
    currentFingerprint: missingTurnSnapshot.requestFingerprint,
    currentMaterializationFingerprint: missingTurnSnapshot.materializationFingerprint,
    dispatchFingerprint: `${missingTurnSnapshot.requestFingerprint}::fetch`,
    origin: "prompt",
}), false, "incomplete identity must never defer supersede");
const missingMetadataSnapshot = captureReportRunDispatchSnapshot({
    request: finalSnapshot.request,
    readiness: finalSnapshot.readiness,
    materialization: finalSnapshot.materialization,
    materializedExportRequest: finalSnapshot.materializedExportRequest,
    metadata: null,
});
const missingMetadataManualPendingKey = buildReportRunPendingBeginDeduplicationKey(
    missingMetadataSnapshot,
    { durable: true, origin: "manual", scopeKey: "report-builder-instance-a" },
);
assert.ok(missingMetadataManualPendingKey, "an unsaved manual draft can still coalesce within its component-local pending scope");
assert.notEqual(missingMetadataManualPendingKey, buildReportRunPendingBeginDeduplicationKey(
    missingMetadataSnapshot,
    { durable: true, origin: "manual", scopeKey: "report-builder-instance-b" },
), "an unsaved manual draft cannot coalesce outside its component-local pending scope");
assert.equal(buildReportRunBeginDeduplicationKey(missingMetadataSnapshot, {
    durable: true,
    origin: "prompt",
}), "", "absent invocation metadata must never produce a reusable begin identity");
assert.equal(resolveReportRunInitializationTransition(earlyDurableRun, missingMetadataSnapshot, {
    durableAvailable: true,
    origin: "prompt",
}).type, "begin", "absent metadata safely begins a distinct durable run without re-dispatching data");
assert.equal(resolveReportRunBeginReuseDecision({
    reuseCurrent: true,
    activeRunId: "report-run-incomplete",
    activeStatus: "running",
    activeOrigin: "prompt",
    requestedOrigin: "prompt",
    activeInvocationFingerprint: missingTurnSnapshot.materializationFingerprint,
    requestedInvocationFingerprint: missingTurnSnapshot.materializationFingerprint,
    beginDeduplicationKey: "",
    activeBeginDeduplicationKey: "",
    pendingBeginDeduplicationKey: "",
}), "begin", "two empty identity keys must never reuse or coalesce a begin");
assert.equal(resolveReportRunBeginReuseDecision({
    reuseCurrent: true,
    activeRunId: "report-run-complete",
    activeStatus: "running",
    activeOrigin: "prompt",
    requestedOrigin: "prompt",
    activeInvocationFingerprint: finalSnapshot.materializationFingerprint,
    requestedInvocationFingerprint: finalSnapshot.materializationFingerprint,
    beginDeduplicationKey: beginKey,
    activeBeginDeduplicationKey: beginKey,
}), "active", "complete stable identity may reuse the exact running invocation");
assert.equal(resolveReportRunBeginReuseDecision({
    beginDeduplicationKey: beginKey,
    pendingBeginDeduplicationKey: beginKey,
}), "pending", "complete stable identity may coalesce the exact in-flight begin");

const explicitlyDisabledLegacyRun = bindReportRunInvocation({
    runId: "legacy-disabled-run",
    durable: false,
    durableCapability: "disabled",
    status: "running",
}, finalSnapshot);
assert.equal(resolveReportRunDurableCapability({
    handlerAvailable: true,
    activeRun: explicitlyDisabledLegacyRun,
    capabilitySignal: { runId: explicitlyDisabledLegacyRun.runId, capability: "disabled" },
}), false, "handler enabled:false is authoritative and prevents another final handoff begin");
assert.deepEqual(resolveAuthoredRuntimeSettlementDecision({
    authoredRuntimeExecution: true,
    hostedInitialization: true,
    hostedHandoffOwned: false,
    durableAvailable: resolveReportRunDurableCapability({
        handlerAvailable: true,
        activeRun: explicitlyDisabledLegacyRun,
        capabilitySignal: { runId: explicitlyDisabledLegacyRun.runId, capability: "disabled" },
    }),
    status: "succeeded",
}), {
    owner: "authored-runtime-observer",
    settle: true,
}, "enabled:false keeps hosted success owned by the legacy authored observer");
const earlyUpgradeableLegacyRun = bindReportRunInvocation({
    runId: "legacy-not-yet-persistable",
    durable: false,
    status: "running",
}, earlySnapshot);
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: finalSnapshot,
    origin: "prompt",
}), earlyUpgradeableLegacyRun, "a disabled final upgrade retains the already-running legacy invocation");
assert.equal(resolveReportRunDisabledLegacyFallback({
    ...earlyUpgradeableLegacyRun,
    status: "completed",
}, {
    retainCurrent: true,
    invocationSnapshot: finalSnapshot,
    origin: "prompt",
}), null, "a terminal legacy invocation is never reused as a disabled fallback");
const missingTurnEarlyLegacyRun = bindReportRunInvocation({
    runId: "legacy-missing-turn",
    durable: false,
    status: "running",
}, buildSnapshot({ turnId: "" }));
const missingTurnFinalSnapshot = buildSnapshot({ rows: finalRows, turnId: "" });
assert.equal(resolveReportRunDisabledLegacyFallback(missingTurnEarlyLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: missingTurnFinalSnapshot,
    origin: "prompt",
}), missingTurnEarlyLegacyRun, "the same local legacy invocation may be retained when both turn identities are missing");
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: missingTurnFinalSnapshot,
    origin: "prompt",
}), null, "a present turn must not match a missing final turn");
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: buildSnapshot({ rows: finalRows, reportId: "another-report" }),
    origin: "prompt",
}), null, "cross-report legacy runs are never rebound");
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: buildSnapshot({ rows: finalRows, sourceKind: "report" }),
    origin: "prompt",
}), null, "cross-source-kind legacy runs are never rebound");
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: buildSnapshot({ rows: finalRows, conversationId: "conversation-2" }),
    origin: "prompt",
}), null, "cross-conversation legacy runs are never rebound");
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: buildSnapshot({ rows: finalRows, origin: "manual" }),
    origin: "prompt",
}), null, "cross-origin legacy runs are never rebound");
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: buildSnapshot({
        request: { advertiserId: 990, dateRange: { start: "2026-07-01", end: "2026-07-31" } },
        rows: finalRows,
    }),
    origin: "prompt",
}), null, "changed-request legacy runs are never rebound");
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: buildSnapshot({ rows: finalRows, builderRef: "other-builder" }),
    origin: "prompt",
}), null, "unrelated builder identity is never rebound");
assert.equal(resolveReportRunDisabledLegacyFallback(earlyUpgradeableLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: missingMetadataSnapshot,
    origin: "prompt",
}), null, "insufficient final identity fails closed");
const missingActiveMetadataLegacyRun = bindReportRunInvocation({
    runId: "legacy-missing-active-metadata",
    durable: false,
    status: "running",
}, missingMetadataSnapshot);
assert.equal(resolveReportRunDisabledLegacyFallback(missingActiveMetadataLegacyRun, {
    retainCurrent: true,
    invocationSnapshot: finalSnapshot,
    origin: "prompt",
}), null, "insufficient active identity fails closed");
assert.equal(resolveReportRunDurableCapability({
    handlerAvailable: true,
    activeRun: earlyUpgradeableLegacyRun,
    capabilitySignal: { runId: earlyUpgradeableLegacyRun.runId, capability: "unknown" },
}), true, "an early legacy run remains upgradeable until begin explicitly reports disabled");
assert.equal(resolveReportRunInitializationTransition(earlyUpgradeableLegacyRun, finalSnapshot, {
    durableAvailable: true,
    origin: "prompt",
}).type, "begin", "the exact final artifacts may still upgrade an early non-persistable legacy run");

const hostedLatchKey = buildReportRunInitializationTransitionKey(finalSnapshot, {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
});
assert.equal(hostedLatchKey, buildReportRunInitializationTransitionKey(buildSnapshot({
    rows: finalRows,
    windowId: "window-replaced-by-host",
}), {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
}), "unstable window identity must not fragment hosted completion latching");
assert.notEqual(hostedLatchKey, buildReportRunInitializationTransitionKey(buildSnapshot({
    rows: finalRows,
    conversationId: "conversation-2",
}), {
    executionKey: "inventory-brief::request::1",
    origin: "prompt",
}), "hosted completion latches must never carry across conversations");

const transitionKey = "hosted-transition-final";
const acquiredLatch = resolveReportRunInitializationLatch({
    phase: "acquire",
    latchedKey: "",
    transitionKey,
});
assert.deepEqual(acquiredLatch, { action: "acquire", key: transitionKey });
assert.deepEqual(resolveReportRunInitializationLatch({
    phase: "acquire",
    latchedKey: acquiredLatch.key,
    transitionKey,
}), { action: "skip", key: transitionKey });
const releasedLatch = resolveReportRunInitializationLatch({
    phase: "settle",
    latchedKey: acquiredLatch.key,
    transitionKey,
    settledRun: null,
    requestFingerprint: finalSnapshot.requestFingerprint,
    materializationFingerprint: finalSnapshot.materializationFingerprint,
});
assert.deepEqual(releasedLatch, { action: "release", key: "" });
assert.deepEqual(resolveReportRunInitializationLatch({
    phase: "settle",
    latchedKey: acquiredLatch.key,
    transitionKey,
    settledRun: {
        ...earlyDurableRun,
        status: "failed",
        invocation: finalSnapshot,
    },
    requestFingerprint: finalSnapshot.requestFingerprint,
    materializationFingerprint: finalSnapshot.materializationFingerprint,
}), { action: "release", key: "" }, "an exact terminal error releases the initialization latch for retry");
assert.deepEqual(resolveReportRunInitializationLatch({
    phase: "acquire",
    latchedKey: releasedLatch.key,
    transitionKey,
}), { action: "acquire", key: transitionKey }, "failed begin or settlement must allow an exact retry");

const staleEarlySettlement = captureReportRunSettlementEvent(retainedTransition.run, {
    runId: earlyDurableRun.runId,
    requestFingerprint: earlySnapshot.requestFingerprint,
    materializationFingerprint: earlySnapshot.materializationFingerprint,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: earlySnapshot.materializedExportRequest,
});
assert.equal(staleEarlySettlement, null, "the retained run must reject settlement from its stale materialization");

const finalSettlement = captureReportRunSettlementEvent(retainedTransition.run, {
    runId: retainedTransition.run.runId,
    requestFingerprint: finalSnapshot.requestFingerprint,
    materializationFingerprint: finalSnapshot.materializationFingerprint,
    currentFingerprint: finalSnapshot.requestFingerprint,
    currentMaterializationFingerprint: finalSnapshot.materializationFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    status: "succeeded",
    terminalRequest: finalSnapshot.materializedExportRequest,
    rowCount: finalRows.length,
    resultRequestKey: "inventory:final",
    expectedResultRequestKey: "inventory:final",
});
assert.ok(finalSettlement);

const persistenceCalls = [];
let conversationPointer = null;
const completedSettlement = await settleReportRunInvocation(retainedTransition.run, finalSettlement, {
    complete: (run, terminalRequest) => completeAndActivateReportRun({
        complete: async (input) => {
            persistenceCalls.push(["complete", input]);
            assert.deepEqual(input.reportSpec, finalSnapshot.materializedExportRequest.reportSpec);
            assert.deepEqual(input.reportFill, finalSnapshot.materializedExportRequest.reportFill);
            assert.deepEqual(input.reportPrint, finalSnapshot.materializedExportRequest.reportPrint);
            return { reportRunId: input.reportRunId, revision: 3, status: "completed" };
        },
        activate: async (input) => {
            persistenceCalls.push(["activate", input]);
            conversationPointer = input.reportRunId;
            return { activeReportRunId: input.reportRunId, revision: 10 };
        },
    }, run, terminalRequest),
});
assert.equal(completedSettlement.accepted, true);
assert.equal(completedSettlement.run.status, "completed");
assert.equal(completedSettlement.run.revision, 3);
assert.equal(conversationPointer, "report-run-early");
assert.deepEqual(persistenceCalls.map(([kind]) => kind), ["complete", "activate"]);
assert.deepEqual(resolveReportRunInitializationLatch({
    phase: "settle",
    latchedKey: transitionKey,
    transitionKey,
    settledRun: completedSettlement.run,
    requestFingerprint: finalSnapshot.requestFingerprint,
    materializationFingerprint: finalSnapshot.materializationFingerprint,
}), { action: "retain", key: transitionKey }, "the latch is retained only for exact durable completion");

let duplicateCompletionCalls = 0;
const duplicateSettlement = await settleReportRunInvocation(completedSettlement.run, finalSettlement, {
    complete: async () => {
        duplicateCompletionCalls += 1;
    },
});
assert.equal(duplicateSettlement.accepted, false);
assert.equal(duplicateCompletionCalls, 0, "duplicate terminal observations must not persist twice");

const manualSnapshot = buildSnapshot({ origin: "manual" });
const manualDurableRun = bindReportRunInvocation({
    ...earlyDurableRun,
    runId: "report-run-manual",
    reportRunId: "report-run-manual",
    origin: "manual",
}, manualSnapshot);
assert.equal(
    resolveReportRunInitializationTransition(manualDurableRun, buildSnapshot({ rows: finalRows, origin: "manual" }), {
        durableAvailable: true,
        origin: "manual",
    }).type,
    "retain",
    "an explicit manual run retains its durable invocation for a same-request materialization transition",
);
assert.equal(
    resolveReportRunInitializationTransition(manualDurableRun, finalSnapshot, {
        durableAvailable: true,
        origin: "prompt",
    }).type,
    "begin",
    "the hosted prompt lifecycle must not silently adopt a manual durable run",
);
assert.equal(
    resolveReportRunInitializationTransition(earlyDurableRun, buildSnapshot({
        rows: finalRows,
        origin: "manual",
    }), {
        durableAvailable: true,
        origin: "prompt",
    }).type,
    "begin",
    "the caller's expected origin must not overwrite divergent invocation metadata",
);

const changedRequestSnapshot = buildSnapshot({
    request: { advertiserId: 990, dateRange: { start: "2026-07-01", end: "2026-07-31" } },
    rows: finalRows,
});
assert.equal(
    resolveReportRunInitializationTransition(earlyDurableRun, changedRequestSnapshot, {
        durableAvailable: true,
        origin: "prompt",
    }).type,
    "begin",
    "a changed prefill request must receive a new durable run instead of being rebound",
);

const legacyRun = bindReportRunInvocation({
    runId: "legacy-browser-run",
    durable: false,
    status: "running",
}, finalSnapshot);
const legacyTransition = resolveReportRunInitializationTransition(legacyRun, finalSnapshot, {
    durableAvailable: false,
    origin: "prompt",
});
assert.equal(legacyTransition.type, "legacy");
assert.equal(legacyTransition.run, legacyRun);
const legacySettlement = captureReportRunSettlementEvent(legacyTransition.run, {
    runId: legacyRun.runId,
    requestFingerprint: finalSnapshot.requestFingerprint,
    currentFingerprint: finalSnapshot.requestFingerprint,
    dispatchFingerprint: `${finalSnapshot.requestFingerprint}::fetch`,
    status: "succeeded",
});
assert.ok(legacySettlement, "the non-durable fallback remains request-correlated");
assert.equal(
    resolveReportRunInitializationTransition(legacyRun, finalSnapshot, {
        durableAvailable: true,
        origin: "prompt",
    }).type,
    "begin",
    "a final persistable hosted request upgrades an early legacy invocation when durability is available",
);

console.log("reportBuilderHostedRunInitialization ✓ final hosted materialization retains or receives durability and activates exact output");
