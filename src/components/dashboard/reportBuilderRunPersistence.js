function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function freezeValue(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
        return value;
    }
    Object.values(value).forEach(freezeValue);
    return Object.freeze(value);
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function buildReportRunCorrelation({
    conversationId = "",
    turnId = "",
    windowId = "",
} = {}) {
    const normalizedConversationId = normalizeString(conversationId);
    const normalizedTurnId = normalizeString(turnId);
    const normalizedWindowId = normalizeString(windowId);
    return {
        ...(normalizedConversationId ? { conversationId: normalizedConversationId } : {}),
        ...(normalizedTurnId ? { turnId: normalizedTurnId } : {}),
        ...(normalizedWindowId ? { windowId: normalizedWindowId } : {}),
    };
}

export const REPORT_RUN_SUPERSEDED_CODE = "browser_run_superseded";
export const REPORT_RUN_SUPERSEDED_MESSAGE = "Durable browser report run was superseded by a newer builder request or report materialization before terminal settlement.";

export function resolveReportBuilderRunHandler(builderContext = {}) {
    const candidate = builderContext?.handlers?.reportRuns || null;
    return candidate && typeof candidate.begin === "function" ? candidate : null;
}

export function resolveCompletedReportRunReference(activeRun = null, {
    materializationFingerprint = "",
} = {}) {
    const reportRunId = normalizeString(activeRun?.reportRunId || activeRun?.runId);
    const expectedMaterializationFingerprint = normalizeString(materializationFingerprint);
    const runMaterializationFingerprint = normalizeString(activeRun?.invocation?.materializationFingerprint);
    if (activeRun?.durable !== true
        || normalizeString(activeRun?.status).toLowerCase() !== "completed"
        || !reportRunId
        || (expectedMaterializationFingerprint
            && runMaterializationFingerprint !== expectedMaterializationFingerprint)) {
        return null;
    }
    return Object.freeze({ reportRunId });
}

export function resolveHostedReportAutoExportDecision({
    format = "",
    runKey = "",
    submittedRunKey = "",
    activeRun = null,
    completedRunSignal = null,
    currentFingerprint = "",
    currentMaterializationFingerprint = "",
} = {}) {
    const normalizedRunKey = normalizeString(runKey);
    if (!normalizedRunKey || normalizeString(submittedRunKey) === normalizedRunKey) {
        return null;
    }
    const requiresRunReference = normalizeString(format).toLowerCase() === "pdf"
        && activeRun?.durable === true;
    if (!requiresRunReference) {
        return Object.freeze({
            runKey: normalizedRunKey,
            requireRunReference: false,
            runReference: null,
        });
    }
    const normalizedCurrentMaterializationFingerprint = normalizeString(currentMaterializationFingerprint);
    const runReference = resolveCompletedReportRunReference(activeRun, {
        materializationFingerprint: normalizedCurrentMaterializationFingerprint,
    });
    const activeRunId = normalizeString(activeRun?.runId || activeRun?.reportRunId);
    const activeFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(activeRun?.invocation?.materializationFingerprint);
    if (!runReference
        || !activeRunId
        || !activeFingerprint
        || !activeMaterializationFingerprint
        || !normalizedCurrentMaterializationFingerprint
        || normalizeString(currentFingerprint) !== activeFingerprint
        || normalizedCurrentMaterializationFingerprint !== activeMaterializationFingerprint
        || normalizeString(completedRunSignal?.runId) !== activeRunId
        || normalizeString(completedRunSignal?.reportRunId) !== runReference.reportRunId
        || normalizeString(
            completedRunSignal?.requestFingerprint
            || completedRunSignal?.fingerprint,
        ) !== activeFingerprint
        || normalizeString(completedRunSignal?.materializationFingerprint) !== activeMaterializationFingerprint) {
        return null;
    }
    return Object.freeze({
        runKey: normalizedRunKey,
        requireRunReference: true,
        runReference,
    });
}

export function newUIRunRequestId() {
    return globalThis.crypto?.randomUUID?.() || `ui-report-run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildReportRunMaterializationFingerprint({
    request = null,
    materialization = null,
} = {}) {
    return JSON.stringify({
        request: cloneValue(request),
        materialization: cloneValue(materialization),
    });
}

export function canPersistReportRunInvocation(snapshot = null) {
    const materialization = isPlainObject(snapshot?.materialization)
        ? snapshot.materialization
        : null;
    const exportRequest = isPlainObject(snapshot?.materializedExportRequest)
        ? snapshot.materializedExportRequest
        : null;
    const reportDocument = isPlainObject(materialization?.reportDocument)
        ? materialization.reportDocument
        : null;
    const reportSpec = isPlainObject(materialization?.reportSpec)
        ? materialization.reportSpec
        : null;
    const reportPrintDefinition = isPlainObject(materialization?.reportPrintDefinition)
        ? materialization.reportPrintDefinition
        : null;
    const exportReportSpec = isPlainObject(exportRequest?.reportSpec)
        ? exportRequest.reportSpec
        : null;
    const exportReportFill = isPlainObject(exportRequest?.reportFill)
        ? exportRequest.reportFill
        : null;
    const exportReportPrint = isPlainObject(exportRequest?.reportPrint)
        ? exportRequest.reportPrint
        : null;
    if (!exportRequest
        || !reportDocument
        || !reportSpec
        || !reportPrintDefinition
        || !exportReportSpec
        || !exportReportFill
        || !exportReportPrint
        || normalizeString(exportRequest.kind) !== "reportExportRequest"
        || normalizeString(exportRequest?.target?.format).toLowerCase() !== "pdf"
        || normalizeString(reportDocument.kind) !== "reportDocument"
        || normalizeString(reportSpec.kind) !== "reportSpec"
        || normalizeString(reportPrintDefinition.kind) !== "reportPrint"
        || normalizeString(exportReportSpec.kind) !== "reportSpec"
        || normalizeString(exportReportFill.kind) !== "reportFill"
        || normalizeString(exportReportPrint.kind) !== "reportPrint"
        || !normalizeString(reportPrintDefinition.specHash)
        || !normalizeString(exportReportPrint.specHash)) {
        return false;
    }
    const exportPrintDefinition = {
        kind: exportReportPrint.kind,
        version: exportReportPrint.version,
        specVersion: exportReportPrint.specVersion,
        specHash: exportReportPrint.specHash,
        title: exportReportPrint.title,
        source: exportReportPrint.source,
        pageGeometry: exportReportPrint.pageGeometry,
    };
    return JSON.stringify(reportSpec) === JSON.stringify(exportReportSpec)
        && JSON.stringify(reportPrintDefinition) === JSON.stringify(exportPrintDefinition);
}

export function captureReportRunDispatchSnapshot({
    request = null,
    readiness = null,
    materialization = null,
    materializedExportRequest = null,
    metadata = null,
} = {}) {
    const requestSnapshot = freezeValue(cloneValue(request));
    const materializationSnapshot = freezeValue(cloneValue(materialization));
    const requestFingerprint = JSON.stringify(requestSnapshot);
    const materializationFingerprint = buildReportRunMaterializationFingerprint({
        request: requestSnapshot,
        materialization: materializationSnapshot,
    });
    return Object.freeze({
        request: requestSnapshot,
        readiness: freezeValue(cloneValue(readiness)),
        materialization: materializationSnapshot,
        materializedExportRequest: freezeValue(cloneValue(materializedExportRequest)),
        metadata: freezeValue(cloneValue(metadata)),
        // Keep the historical alias request-only so datasource dispatch remains unchanged.
        fingerprint: requestFingerprint,
        requestFingerprint,
        materializationFingerprint,
    });
}

export function bindReportRunInvocation(run = null, snapshot = null) {
    const runId = normalizeString(run?.runId || run?.reportRunId);
    const requestFingerprint = normalizeString(snapshot?.requestFingerprint || snapshot?.fingerprint);
    const materializationFingerprint = normalizeString(snapshot?.materializationFingerprint);
    if (!run || !runId || !snapshot || !requestFingerprint || !materializationFingerprint) {
        throw new Error("A report run and immutable invocation snapshot are required.");
    }
    return {
        ...run,
        fingerprint: requestFingerprint,
        materializationFingerprint,
        invocation: freezeValue({
            runId,
            // Keep fingerprint as a request-only compatibility alias.
            fingerprint: requestFingerprint,
            requestFingerprint,
            materializationFingerprint,
            metadata: cloneValue(snapshot.metadata),
        }),
    };
}

export function matchesReportRunDispatch(dispatchFingerprint = "", invocationFingerprint = "") {
    const dispatch = normalizeString(dispatchFingerprint);
    const fingerprint = normalizeString(invocationFingerprint);
    return !!fingerprint && (dispatch === `${fingerprint}::fetch` || dispatch === `${fingerprint}::hold`);
}

export function matchesReportRunSettlement(activeRun = null, event = null) {
    if (!activeRun?.invocation || activeRun.status !== "running") {
        return false;
    }
    const eventRequestFingerprint = normalizeString(event?.requestFingerprint || event?.fingerprint);
    const invocationRequestFingerprint = normalizeString(
        activeRun.invocation.requestFingerprint
        || activeRun.invocation.fingerprint,
    );
    return normalizeString(event?.runId) === normalizeString(activeRun.invocation.runId)
        && eventRequestFingerprint === invocationRequestFingerprint
        && (activeRun.durable !== true
            || normalizeString(event?.materializationFingerprint)
                === normalizeString(activeRun.invocation.materializationFingerprint));
}

export function captureReportRunSettlementEvent(activeRun = null, {
    runId = "",
    fingerprint = "",
    requestFingerprint: explicitRequestFingerprint = "",
    currentFingerprint = "",
    materializationFingerprint = "",
    currentMaterializationFingerprint = "",
    dispatchFingerprint = "",
    status = "succeeded",
    terminalRequest = null,
    error = null,
    rowCount = 0,
    resultRequestKey = "",
    expectedResultRequestKey = "",
} = {}) {
    const requestFingerprint = normalizeString(explicitRequestFingerprint || fingerprint);
    const identity = { runId, requestFingerprint, materializationFingerprint };
    if (!matchesReportRunSettlement(activeRun, identity)) {
        return null;
    }
    if (activeRun.durable) {
        const activeFingerprint = normalizeString(
            activeRun.invocation.requestFingerprint
            || activeRun.invocation.fingerprint,
        );
        const activeMaterializationFingerprint = normalizeString(activeRun.invocation.materializationFingerprint);
        if (normalizeString(currentFingerprint) !== activeFingerprint
            || normalizeString(currentMaterializationFingerprint) !== activeMaterializationFingerprint
            || !matchesReportRunDispatch(dispatchFingerprint, activeFingerprint)) {
            return null;
        }
        const expectedKey = normalizeString(expectedResultRequestKey);
        if (expectedKey && normalizeString(resultRequestKey) !== expectedKey) {
            return null;
        }
    }
    const normalizedStatus = normalizeString(status).toLowerCase() || "succeeded";
    return Object.freeze({
        runId: normalizeString(runId),
        fingerprint: requestFingerprint,
        requestFingerprint,
        materializationFingerprint: normalizeString(materializationFingerprint),
        status: normalizedStatus,
        error: normalizedStatus === "failed" ? error : null,
        rowCount: Number.isFinite(Number(rowCount)) ? Math.max(0, Number(rowCount)) : 0,
        terminalRequest: normalizedStatus === "failed"
            ? null
            : freezeValue(cloneValue(terminalRequest)),
    });
}

export function classifyReportRunSupersede(activeRun = null, {
    currentFingerprint = "",
    currentMaterializationFingerprint = "",
    dispatchFingerprint = "",
} = {}) {
    if (!activeRun?.durable || activeRun.status !== "running" || !activeRun.invocation) {
        return null;
    }
    const activeFingerprint = normalizeString(
        activeRun.invocation.requestFingerprint
        || activeRun.invocation.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(activeRun.invocation.materializationFingerprint);
    const current = normalizeString(currentFingerprint);
    const currentMaterialization = normalizeString(currentMaterializationFingerprint);
    const dispatch = normalizeString(dispatchFingerprint);
    const currentDiverged = !!current && current !== activeFingerprint;
    const materializationDiverged = !!currentMaterialization
        && currentMaterialization !== activeMaterializationFingerprint;
    const dispatchDiverged = !!dispatch && !matchesReportRunDispatch(dispatch, activeFingerprint);
    if (!currentDiverged && !materializationDiverged && !dispatchDiverged) {
        return null;
    }
    return Object.freeze({
        runId: normalizeString(activeRun.invocation.runId),
        fingerprint: activeFingerprint,
        requestFingerprint: activeFingerprint,
        materializationFingerprint: activeMaterializationFingerprint,
        status: "failed",
        error: Object.freeze({
            code: REPORT_RUN_SUPERSEDED_CODE,
            message: REPORT_RUN_SUPERSEDED_MESSAGE,
        }),
        rowCount: 0,
        terminalRequest: null,
        superseded: true,
    });
}

export async function settleReportRunInvocation(activeRun = null, event = null, {
    complete,
    fail,
} = {}) {
    if (!matchesReportRunSettlement(activeRun, event)) {
        return { accepted: false, run: activeRun };
    }
    const failed = normalizeString(event?.status).toLowerCase() === "failed";
    const settle = failed ? fail : complete;
    if (typeof settle !== "function") {
        throw new Error(`A report run ${failed ? "failure" : "completion"} callback is required.`);
    }
    const run = failed
        ? await settle(activeRun, event?.error || null)
        : await settle(activeRun, event?.terminalRequest || null);
    return { accepted: true, run };
}

export async function beginAndDispatchReportRun(snapshot, {
    begin,
    dispatch,
} = {}) {
    if (!snapshot || typeof begin !== "function" || typeof dispatch !== "function") {
        throw new Error("An immutable run snapshot, begin callback, and dispatch callback are required.");
    }
    const begun = await begin(snapshot);
    if (!begun?.ok) {
        return begun;
    }
    return { ...begun, dispatchResult: dispatch(snapshot) };
}

export async function beginAndPromoteReportRun(snapshot, {
    begin,
    dispatch,
    promote,
} = {}) {
    if (!snapshot || typeof begin !== "function" || typeof dispatch !== "function" || typeof promote !== "function") {
        throw new Error("An immutable run snapshot, begin, dispatch, and promote callbacks are required.");
    }
    const begun = await begin(snapshot);
    if (!begun?.ok) {
        return begun;
    }
    if (begun.durable === true) {
        return { ...begun, dispatchResult: dispatch(snapshot) };
    }
    return { ...begun, promoteResult: promote(snapshot) };
}

export function resolveReportRunBuilderRef({
    activeBuilderVariant = null,
    config = null,
    container = null,
} = {}) {
    const candidates = [
        activeBuilderVariant?.builderRef,
        container?.dashboard?.reportBuilderRef,
        config?.id,
        config?.reportBuilderRef,
        container?.reportBuilderRef,
    ];
    return candidates.map(normalizeString).find(Boolean) || "";
}

export function buildReportRunBeginInput({
    uiRunRequestId = "",
    conversationId = "",
    turnId = "",
    windowId = "",
    origin = "manual",
    builderRef = "",
    sourceKind = "",
    sourceId = "",
    presetId = "",
    requestedParams = null,
    effectiveParams = null,
} = {}) {
    return {
        uiRunRequestId: normalizeString(uiRunRequestId),
        ...buildReportRunCorrelation({ conversationId, turnId, windowId }),
        origin: normalizeString(origin).toLowerCase() || "manual",
        ...(normalizeString(builderRef) ? { builderRef: normalizeString(builderRef) } : {}),
        ...(normalizeString(sourceKind) ? { sourceKind: normalizeString(sourceKind) } : {}),
        ...(normalizeString(sourceId) ? { sourceId: normalizeString(sourceId) } : {}),
        ...(normalizeString(presetId) ? { presetId: normalizeString(presetId) } : {}),
        ...(requestedParams != null ? { requestedParams: cloneValue(requestedParams) } : {}),
        ...(effectiveParams != null ? { effectiveParams: cloneValue(effectiveParams) } : {}),
    };
}

export function normalizeReportRunBeginResult(result = null) {
    if (result?.enabled === false) {
        return { enabled: false };
    }
    const run = result?.run && typeof result.run === "object" ? result.run : null;
    const reportRunId = normalizeString(run?.reportRunId);
    const revision = Number(run?.revision || 0);
    if (!run || !reportRunId || normalizeString(run?.status).toLowerCase() !== "running"
        || !Number.isInteger(revision) || revision <= 0) {
        throw new Error("The report-run service did not return a server-generated reportRunId and revision.");
    }
    return {
        enabled: true,
        reportRun: cloneValue(run),
        reportRunId,
        revision,
        contextRevision: Number(result?.context?.revision || 0) || 0,
    };
}

export function buildReportRunCompleteInput(activeRun = null, reportExportRequest = null) {
    const reportRunId = normalizeString(activeRun?.reportRunId);
    const expectedRevision = Number(activeRun?.revision || 0);
    const reportSpec = reportExportRequest?.reportSpec;
    const reportFill = reportExportRequest?.reportFill;
    const reportPrint = reportExportRequest?.reportPrint;
    if (!reportRunId || !Number.isInteger(expectedRevision) || expectedRevision <= 0) {
        throw new Error("A durable reportRunId and revision are required.");
    }
    if (!reportSpec || !reportFill || !reportPrint) {
        throw new Error("Completed report run requires ReportSpec, ReportFill, and ReportPrint.");
    }
    return {
        reportRunId,
        expectedRevision,
        ...buildReportRunCorrelation(activeRun),
        reportSpec: cloneValue(reportSpec),
        reportFill: cloneValue(reportFill),
        reportPrint: cloneValue(reportPrint),
    };
}

export async function completeAndActivateReportRun(handler, activeRun, reportExportRequest, {
    shouldActivate = () => true,
} = {}) {
    if (!activeRun?.durable) {
        return activeRun;
    }
    if (typeof handler?.complete !== "function") {
        throw new Error("Report-run completion is unavailable.");
    }
    const completed = await handler.complete(buildReportRunCompleteInput(activeRun, reportExportRequest));
    const completedRevision = Number(completed?.revision || 0);
    if (normalizeString(completed?.reportRunId) !== normalizeString(activeRun.reportRunId)
        || normalizeString(completed?.status).toLowerCase() !== "completed"
        || completedRevision <= 0) {
        throw new Error("Report-run completion returned an invalid identity.");
    }
    const next = { ...activeRun, revision: completedRevision, status: "completed" };
    const conversationId = normalizeString(activeRun.conversationId);
    if (!conversationId || shouldActivate(next) !== true) {
        return next;
    }
    if (typeof handler?.activate !== "function") {
        throw new Error("Report-run activation is unavailable.");
    }
    const context = await handler.activate({
        reportRunId: next.reportRunId,
        ...buildReportRunCorrelation(activeRun),
        expectedRunRevision: next.revision,
        expectedContextRevision: Number(activeRun.contextRevision || 0) || 0,
        source: normalizeString(activeRun.origin) || "manual",
    });
    if (normalizeString(context?.activeReportRunId) !== next.reportRunId) {
        throw new Error("Report-run activation returned a different active reportRunId.");
    }
    return { ...next, contextRevision: Number(context?.revision || 0) || 0 };
}

export async function failDurableReportRun(handler, activeRun, error = null) {
    if (!activeRun?.durable || typeof handler?.fail !== "function") {
        return activeRun;
    }
    const failed = await handler.fail({
        reportRunId: activeRun.reportRunId,
        ...buildReportRunCorrelation(activeRun),
        expectedRevision: Number(activeRun.revision || 0),
        failureCode: normalizeString(error?.code) || "browser_run_failed",
        failureText: normalizeString(error?.message || error) || "Browser report run failed.",
    });
    if (normalizeString(failed?.reportRunId) !== normalizeString(activeRun.reportRunId)
        || normalizeString(failed?.status).toLowerCase() !== "failed") {
        throw new Error("Report-run failure returned a different or non-terminal identity.");
    }
    return {
        ...activeRun,
        revision: Number(failed?.revision || activeRun.revision),
        status: "failed",
    };
}
