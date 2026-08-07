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

export function buildHostedReportLifecycleContextKey({
    conversationId = "",
    windowId = "",
    windowKey = "",
} = {}) {
    const normalizedConversationId = normalizeString(conversationId);
    const normalizedWindowIdentity = normalizeString(windowKey) || normalizeString(windowId);
    return JSON.stringify([
        "hosted-report-context-v1",
        normalizedConversationId ? "conversation" : (normalizedWindowIdentity ? "window" : "anonymous"),
        normalizedConversationId || normalizedWindowIdentity,
    ]);
}

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
    currentContextKey = "",
} = {}) {
    const normalizedRunKey = normalizeString(runKey);
    if (!normalizedRunKey || normalizeString(submittedRunKey) === normalizedRunKey) {
        return null;
    }
    const normalizedCurrentContextKey = normalizeString(currentContextKey);
    const activeRunContextKey = buildHostedReportLifecycleContextKey(
        activeRun?.invocation?.metadata?.event?.context,
    );
    const activeRunId = normalizeString(activeRun?.runId || activeRun?.reportRunId);
    const activeFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(activeRun?.invocation?.materializationFingerprint);
    const normalizedCurrentMaterializationFingerprint = normalizeString(currentMaterializationFingerprint);
    const requiresRunReference = normalizeString(format).toLowerCase() === "pdf"
        && activeRun?.durable === true;
    if (!normalizedCurrentContextKey
        || activeRunContextKey !== normalizedCurrentContextKey
        || normalizeString(activeRun?.status).toLowerCase() !== "completed"
        || !activeRunId
        || !activeFingerprint
        || !activeMaterializationFingerprint
        || normalizeString(currentFingerprint) !== activeFingerprint
        || (requiresRunReference
            && (!normalizedCurrentMaterializationFingerprint
                || normalizedCurrentMaterializationFingerprint !== activeMaterializationFingerprint))) {
        return null;
    }
    if (activeRun?.durable !== true) {
        return Object.freeze({
            runKey: normalizedRunKey,
            requireRunReference: requiresRunReference,
            runReference: null,
        });
    }
    const runReference = resolveCompletedReportRunReference(activeRun, {
        materializationFingerprint: normalizedCurrentMaterializationFingerprint,
    });
    if (normalizeString(completedRunSignal?.contextKey) !== normalizedCurrentContextKey
        || normalizeString(completedRunSignal?.runId) !== activeRunId
        || (requiresRunReference
            && (!runReference
                || normalizeString(completedRunSignal?.reportRunId) !== runReference.reportRunId))
        || normalizeString(
            completedRunSignal?.requestFingerprint
            || completedRunSignal?.fingerprint,
        ) !== activeFingerprint
        || normalizeString(completedRunSignal?.materializationFingerprint) !== activeMaterializationFingerprint) {
        return null;
    }
    return Object.freeze({
        runKey: normalizedRunKey,
        requireRunReference: requiresRunReference,
        runReference: requiresRunReference ? runReference : null,
    });
}

export function newUIRunRequestId() {
    return globalThis.crypto?.randomUUID?.() || `ui-report-run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const REPORT_RUN_CANCELLED_CODE = "browser_run_cancelled";
export const REPORT_RUN_CANCELLED_MESSAGE = "Report run was cancelled because the report builder was closed.";

export function buildCancelledReportRunResult({
    message = REPORT_RUN_CANCELLED_MESSAGE,
} = {}) {
    return Object.freeze({
        ok: false,
        superseded: true,
        cancelled: true,
        code: REPORT_RUN_CANCELLED_CODE,
        error: normalizeString(message) || REPORT_RUN_CANCELLED_MESSAGE,
    });
}

export function createPendingReportRunExecution({
    origin = "manual",
    requestFingerprint = "",
    materializationFingerprint = "",
} = {}) {
    let resolvePendingRun;
    const promise = new Promise((resolve) => {
        resolvePendingRun = resolve;
    });
    return {
        origin: normalizeString(origin).toLowerCase() || "manual",
        requestFingerprint: normalizeString(requestFingerprint),
        materializationFingerprint: normalizeString(materializationFingerprint),
        promise,
        resolve: resolvePendingRun,
        started: false,
        settled: false,
    };
}

export function resolvePendingReportRunExecutionAction(pendingRun = null, {
    origin = "manual",
    requestFingerprint = "",
    materializationFingerprint = "",
} = {}) {
    if (!pendingRun?.promise || pendingRun.settled === true) {
        return "none";
    }
    const pendingOrigin = normalizeString(pendingRun.origin).toLowerCase() || "manual";
    const requestedOrigin = normalizeString(origin).toLowerCase() || "manual";
    if (pendingOrigin !== requestedOrigin) {
        return "supersede";
    }
    const pendingFingerprint = normalizeString(pendingRun.requestFingerprint);
    if (!pendingFingerprint) {
        return "reuse";
    }
    if (pendingFingerprint !== normalizeString(requestFingerprint)) {
        return "supersede";
    }
    const pendingMaterializationFingerprint = normalizeString(
        pendingRun.materializationFingerprint,
    );
    return !pendingMaterializationFingerprint
        || pendingMaterializationFingerprint === normalizeString(materializationFingerprint)
        ? "reuse"
        : "supersede";
}

export function settlePendingReportRunExecution(pendingRunRef = null, pendingRun = null, result = null) {
    if (!pendingRun || typeof pendingRun.resolve !== "function" || pendingRun.settled === true) {
        return false;
    }
    pendingRun.settled = true;
    if (pendingRunRef?.current === pendingRun) {
        pendingRunRef.current = null;
    }
    pendingRun.resolve(result);
    return true;
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

export function resolveReportRunDispatchMaterialization(request = null, candidate = null) {
    if (!candidate
        || typeof candidate !== "object"
        || Array.isArray(candidate)
        || candidate.dispatchReady !== true) {
        return null;
    }
    const requestFingerprint = JSON.stringify(cloneValue(request));
    const materialization = candidate.materialization ?? null;
    const materializationFingerprint = buildReportRunMaterializationFingerprint({
        request,
        materialization,
    });
    if (normalizeString(candidate.requestFingerprint) !== requestFingerprint
        || normalizeString(candidate.materializationFingerprint) !== materializationFingerprint) {
        return null;
    }
    return Object.freeze({
        requestFingerprint,
        materializationFingerprint,
        materialization,
        materializedExportRequest: candidate.materializedExportRequest ?? null,
        terminalMaterializationFresh: candidate.terminalMaterializationFresh === true,
    });
}

export function matchesReportRunDispatchMaterializationSnapshot(snapshot = null, candidate = null) {
    const selected = resolveReportRunDispatchMaterialization(snapshot?.request, candidate);
    if (!selected) {
        return false;
    }
    return normalizeString(snapshot?.requestFingerprint || snapshot?.fingerprint)
            === selected.requestFingerprint
        && normalizeString(snapshot?.materializationFingerprint)
            === selected.materializationFingerprint
        && normalizeString(snapshot?.terminalMaterializationFingerprint)
            === buildReportRunTerminalMaterializationFingerprint(
                selected.materializedExportRequest,
                { materializationFingerprint: selected.materializationFingerprint },
            )
        && (snapshot?.terminalMaterializationFresh === true)
            === selected.terminalMaterializationFresh;
}

export function buildReportRunTerminalMaterializationFingerprint(terminalRequest = null, {
    materializationFingerprint = "",
} = {}) {
    const reportSpec = terminalRequest?.reportSpec;
    const reportFill = terminalRequest?.reportFill;
    const reportPrint = terminalRequest?.reportPrint;
    if (!isPlainObject(reportSpec)
        || !isPlainObject(reportFill)
        || !isPlainObject(reportPrint)
        || !normalizeString(materializationFingerprint)
        || normalizeString(reportSpec.kind) !== "reportSpec"
        || normalizeString(reportFill.kind) !== "reportFill"
        || normalizeString(reportPrint.kind) !== "reportPrint") {
        return "";
    }
    return JSON.stringify({
        materializationFingerprint: normalizeString(materializationFingerprint),
        terminalRequest: {
            reportSpec: cloneValue(reportSpec),
            reportFill: cloneValue(reportFill),
            reportPrint: cloneValue(reportPrint),
        },
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

function resolveReportRunStableIdentity(candidate = null, {
    origin = "",
} = {}) {
    const metadata = candidate?.invocation?.metadata || candidate?.metadata || {};
    const source = metadata?.source || {};
    const eventContext = metadata?.event?.context || {};
    return Object.freeze({
        origin: normalizeString(metadata?.origin || candidate?.origin || origin).toLowerCase(),
        builderRef: normalizeString(metadata?.builderRef || candidate?.builderRef),
        sourceKind: normalizeString(source?.sourceKind || candidate?.sourceKind).toLowerCase(),
        sourceId: normalizeString(
            source?.reportId
            || source?.sourceId
            || candidate?.sourceId
            || candidate?.presetId,
        ),
        conversationId: normalizeString(eventContext?.conversationId || candidate?.conversationId),
        turnId: normalizeString(eventContext?.turnId || candidate?.turnId),
    });
}

function hasCompleteReportRunStableIdentity(identity = null) {
    return !!(
        identity?.origin
        && identity?.builderRef
        && identity?.sourceKind
        && identity?.sourceId
        && identity?.conversationId
        && identity?.turnId
    );
}

function matchesReportRunStableIdentity(activeRun = null, snapshot = null, {
    origin = "",
} = {}) {
    const activeIdentity = resolveReportRunStableIdentity(activeRun);
    const snapshotIdentity = resolveReportRunStableIdentity(snapshot, { origin });
    if (!hasCompleteReportRunStableIdentity(activeIdentity)
        || !hasCompleteReportRunStableIdentity(snapshotIdentity)) {
        return false;
    }
    return activeIdentity.origin === snapshotIdentity.origin
        && activeIdentity.builderRef === snapshotIdentity.builderRef
        && activeIdentity.sourceKind === snapshotIdentity.sourceKind
        && activeIdentity.sourceId === snapshotIdentity.sourceId
        && activeIdentity.conversationId === snapshotIdentity.conversationId
        && activeIdentity.turnId === snapshotIdentity.turnId;
}

function hasCompatibleReportRunStableIdentity(activeRun = null, snapshot = null, {
    origin = "",
} = {}) {
    const activeIdentity = resolveReportRunStableIdentity(activeRun);
    const snapshotIdentity = resolveReportRunStableIdentity(snapshot, { origin });
    return [
        "origin",
        "builderRef",
        "sourceKind",
        "sourceId",
        "conversationId",
        "turnId",
    ].every((field) => (
        !activeIdentity[field]
        || !snapshotIdentity[field]
        || activeIdentity[field] === snapshotIdentity[field]
    ));
}

function matchesExactPromptReportRunSnapshot(activeRun = null, snapshot = null, {
    origin = "prompt",
} = {}) {
    const requiredOrigin = normalizeString(origin).toLowerCase();
    const activeOrigin = normalizeString(activeRun?.invocation?.metadata?.origin).toLowerCase();
    const snapshotOrigin = normalizeString(snapshot?.metadata?.origin).toLowerCase();
    const activeRequestFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(
        activeRun?.invocation?.materializationFingerprint,
    );
    const snapshotRequestFingerprint = normalizeString(
        snapshot?.requestFingerprint
        || snapshot?.fingerprint,
    );
    const snapshotMaterializationFingerprint = normalizeString(
        snapshot?.materializationFingerprint,
    );
    return requiredOrigin === "prompt"
        && activeOrigin === requiredOrigin
        && snapshotOrigin === requiredOrigin
        && !!activeRequestFingerprint
        && !!activeMaterializationFingerprint
        && activeRequestFingerprint === snapshotRequestFingerprint
        && activeMaterializationFingerprint === snapshotMaterializationFingerprint
        && hasCompatibleReportRunStableIdentity(activeRun, snapshot, {
            origin: requiredOrigin,
        });
}

function reportRunValuesEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((entry, index) => reportRunValuesEqual(entry, right[index]));
    }
    if (!isPlainObject(left) || !isPlainObject(right)) {
        return false;
    }
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key, index) => (
            key === rightKeys[index]
            && reportRunValuesEqual(left[key], right[key])
        ));
}

function parseReportRunRequestFingerprint(fingerprint = "") {
    try {
        const request = JSON.parse(normalizeString(fingerprint));
        return isPlainObject(request) ? request : null;
    } catch (_) {
        return null;
    }
}

function matchesCapturedReportRunRendererMeasureExpansion(activeRun = null, snapshot = null) {
    const activeRequestFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const activeRequest = activeRun?.invocation?.metadata?.event?.runtimeRequest;
    const currentRequest = snapshot?.request;
    const parsedActiveRequest = parseReportRunRequestFingerprint(activeRequestFingerprint);
    if (normalizeString(snapshot?.metadata?.origin).toLowerCase() !== "prompt"
        || !isPlainObject(activeRequest)
        || !isPlainObject(currentRequest)
        || !parsedActiveRequest
        || !reportRunValuesEqual(activeRequest, parsedActiveRequest)) {
        return false;
    }
    const activeMeasures = isPlainObject(activeRequest.measures) ? activeRequest.measures : {};
    const currentMeasures = isPlainObject(currentRequest.measures) ? currentRequest.measures : {};
    const activeRequestWithoutMeasures = { ...activeRequest };
    const currentRequestWithoutMeasures = { ...currentRequest };
    delete activeRequestWithoutMeasures.measures;
    delete currentRequestWithoutMeasures.measures;
    if (!reportRunValuesEqual(activeRequestWithoutMeasures, currentRequestWithoutMeasures)
        || !Object.keys(activeMeasures).every((key) => (
            Object.prototype.hasOwnProperty.call(currentMeasures, key)
            && reportRunValuesEqual(activeMeasures[key], currentMeasures[key])
        ))) {
        return false;
    }
    const addedMeasureKeys = Object.keys(currentMeasures)
        .filter((key) => !Object.prototype.hasOwnProperty.call(activeMeasures, key));
    if (addedMeasureKeys.length === 0) {
        return false;
    }
    const capturedReportSpec = activeRun?.invocation?.metadata?.event?.request?.reportSpec;
    const capturedDatasetRequests = Array.isArray(capturedReportSpec?.datasets)
        ? capturedReportSpec.datasets
            .map((dataset) => dataset?.request)
            .filter(isPlainObject)
        : [];
    return capturedDatasetRequests.length > 0
        && capturedDatasetRequests.some((request) => {
            const rendererMeasures = isPlainObject(request.measures) ? request.measures : {};
            const rendererRequestWithoutMeasures = { ...request };
            delete rendererRequestWithoutMeasures.measures;
            return reportRunValuesEqual(activeRequestWithoutMeasures, rendererRequestWithoutMeasures)
                && Object.keys(activeMeasures).every((key) => (
                    Object.prototype.hasOwnProperty.call(rendererMeasures, key)
                    && reportRunValuesEqual(activeMeasures[key], rendererMeasures[key])
                ))
                && addedMeasureKeys.every((key) => (
                    Object.prototype.hasOwnProperty.call(rendererMeasures, key)
                    && reportRunValuesEqual(rendererMeasures[key], currentMeasures[key])
                ));
        });
}

function matchesLocallyOwnedReportRunRendererMeasureMaturation(
    activeRun = null,
    snapshot = null,
    {
        ownedRunId = "",
        origin = "prompt",
    } = {},
) {
    const requiredOrigin = normalizeString(origin).toLowerCase();
    const activeRunId = normalizeString(activeRun?.runId || activeRun?.reportRunId);
    const claimedRunId = normalizeString(ownedRunId);
    const activeOrigin = normalizeString(activeRun?.invocation?.metadata?.origin).toLowerCase();
    const snapshotOrigin = normalizeString(snapshot?.metadata?.origin).toLowerCase();
    const activeRequestFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const activeRequest = activeRun?.invocation?.metadata?.event?.runtimeRequest;
    const currentRequest = snapshot?.request;
    const parsedActiveRequest = parseReportRunRequestFingerprint(activeRequestFingerprint);
    if (requiredOrigin !== "prompt"
        || !activeRunId
        || activeRunId !== claimedRunId
        || activeOrigin !== requiredOrigin
        || snapshotOrigin !== requiredOrigin
        || !isPlainObject(activeRequest)
        || !isPlainObject(currentRequest)
        || !parsedActiveRequest
        || !reportRunValuesEqual(activeRequest, parsedActiveRequest)
        || !hasCompatibleReportRunStableIdentity(activeRun, snapshot, {
            origin: requiredOrigin,
        })) {
        return false;
    }
    const activeMeasures = isPlainObject(activeRequest.measures) ? activeRequest.measures : {};
    const currentMeasures = isPlainObject(currentRequest.measures) ? currentRequest.measures : {};
    const activeRequestWithoutMeasures = { ...activeRequest };
    const currentRequestWithoutMeasures = { ...currentRequest };
    delete activeRequestWithoutMeasures.measures;
    delete currentRequestWithoutMeasures.measures;
    if (!reportRunValuesEqual(activeRequestWithoutMeasures, currentRequestWithoutMeasures)
        || !Object.keys(activeMeasures).every((key) => (
            Object.prototype.hasOwnProperty.call(currentMeasures, key)
            && reportRunValuesEqual(activeMeasures[key], currentMeasures[key])
        ))) {
        return false;
    }
    const addedMeasureKeys = Object.keys(currentMeasures)
        .filter((key) => !Object.prototype.hasOwnProperty.call(activeMeasures, key));
    if (addedMeasureKeys.length === 0) {
        return false;
    }
    const currentReportSpec = snapshot?.materializedExportRequest?.reportSpec
        || snapshot?.materialization?.reportSpec
        || snapshot?.metadata?.event?.request?.reportSpec
        || null;
    const calculatedFields = Array.isArray(currentReportSpec?.calculatedFields)
        ? currentReportSpec.calculatedFields
        : [];
    const calculatedDependencyKeys = new Set(
        calculatedFields.flatMap((field) => (
            Array.isArray(field?.dependencies) ? field.dependencies : []
        )).map((dependency) => normalizeString(dependency)).filter(Boolean),
    );
    return addedMeasureKeys.every((key) => calculatedDependencyKeys.has(key));
}

function matchesLocallyOwnedReportRunStableRequestMaturation(
    activeRun = null,
    snapshot = null,
    {
        ownedRunId = "",
        origin = "prompt",
    } = {},
) {
    const requiredOrigin = normalizeString(origin).toLowerCase();
    const activeRunId = normalizeString(activeRun?.runId || activeRun?.reportRunId);
    const claimedRunId = normalizeString(ownedRunId);
    const activeOrigin = normalizeString(activeRun?.invocation?.metadata?.origin).toLowerCase();
    const snapshotOrigin = normalizeString(snapshot?.metadata?.origin).toLowerCase();
    const activeRequestFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const snapshotRequestFingerprint = normalizeString(
        snapshot?.requestFingerprint
        || snapshot?.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(
        activeRun?.invocation?.materializationFingerprint,
    );
    const snapshotMaterializationFingerprint = normalizeString(snapshot?.materializationFingerprint);
    const activeRequest = activeRun?.invocation?.metadata?.event?.runtimeRequest;
    const snapshotRequest = snapshot?.request;
    const snapshotRuntimeRequest = snapshot?.metadata?.event?.runtimeRequest;
    const parsedActiveRequest = parseReportRunRequestFingerprint(activeRequestFingerprint);
    return requiredOrigin === "prompt"
        && activeRun?.durable === true
        && normalizeString(activeRun?.status).toLowerCase() === "running"
        && !!activeRunId
        && activeRunId === claimedRunId
        && activeOrigin === requiredOrigin
        && snapshotOrigin === requiredOrigin
        && !!activeRequestFingerprint
        && activeRequestFingerprint === snapshotRequestFingerprint
        && !!activeMaterializationFingerprint
        && !!snapshotMaterializationFingerprint
        && activeMaterializationFingerprint !== snapshotMaterializationFingerprint
        && isPlainObject(activeRequest)
        && isPlainObject(snapshotRequest)
        && isPlainObject(snapshotRuntimeRequest)
        && !!parsedActiveRequest
        && reportRunValuesEqual(activeRequest, parsedActiveRequest)
        && reportRunValuesEqual(snapshotRequest, parsedActiveRequest)
        && reportRunValuesEqual(snapshotRuntimeRequest, parsedActiveRequest)
        && hasCompatibleReportRunStableIdentity(activeRun, snapshot, {
            origin: requiredOrigin,
        });
}

export function buildReportRunBeginDeduplicationKey(snapshot = null, {
    durable = false,
    origin = "",
} = {}) {
    const requestFingerprint = normalizeString(
        snapshot?.requestFingerprint
        || snapshot?.fingerprint
        || snapshot?.invocation?.requestFingerprint
        || snapshot?.invocation?.fingerprint,
    );
    const materializationFingerprint = normalizeString(
        snapshot?.materializationFingerprint
        || snapshot?.invocation?.materializationFingerprint,
    );
    const identity = resolveReportRunStableIdentity(snapshot, { origin });
    const invocationFingerprint = durable === true
        ? materializationFingerprint
        : requestFingerprint;
    if (!invocationFingerprint || !hasCompleteReportRunStableIdentity(identity)) {
        return "";
    }
    return JSON.stringify({
        identity,
        invocationFingerprint,
    });
}

export function buildReportRunPendingBeginDeduplicationKey(snapshot = null, {
    durable = false,
    origin = "",
    scopeKey = "",
} = {}) {
    const stableKey = buildReportRunBeginDeduplicationKey(snapshot, { durable, origin });
    if (stableKey) {
        return stableKey;
    }
    const identity = resolveReportRunStableIdentity(snapshot, { origin });
    const requestFingerprint = normalizeString(
        snapshot?.requestFingerprint
        || snapshot?.fingerprint
        || snapshot?.invocation?.requestFingerprint
        || snapshot?.invocation?.fingerprint,
    );
    const materializationFingerprint = normalizeString(
        snapshot?.materializationFingerprint
        || snapshot?.invocation?.materializationFingerprint,
    );
    const invocationFingerprint = durable === true
        ? materializationFingerprint
        : requestFingerprint;
    const normalizedScopeKey = normalizeString(scopeKey);
    // This incomplete-identity key is intentionally only safe inside the
    // component-local pending-begin ref. It restores double-click coalescing
    // for manual runs while complete stable identity remains mandatory for
    // active-run reuse and hosted/cross-context coalescing.
    if (identity.origin !== "manual"
        || !normalizedScopeKey
        || !invocationFingerprint) {
        return "";
    }
    return JSON.stringify({
        scope: "local-manual-pending-begin",
        scopeKey: normalizedScopeKey,
        identity,
        invocationFingerprint,
    });
}

export function buildReportRunInitializationTransitionKey(snapshot = null, {
    executionKey = "",
    origin = "prompt",
} = {}) {
    const stableInvocationKey = buildReportRunBeginDeduplicationKey(snapshot, {
        durable: true,
        origin,
    });
    const normalizedExecutionKey = normalizeString(executionKey);
    if (!stableInvocationKey || !normalizedExecutionKey) {
        return "";
    }
    return JSON.stringify([normalizedExecutionKey, stableInvocationKey]);
}

export function resolveReportRunInitializationTransitionAttempt(snapshot = null, {
    executionKey = "",
    origin = "prompt",
    activeRunId = "",
    previousAttempt = null,
    nextAttemptNumber = 1,
} = {}) {
    const stableTransitionKey = buildReportRunInitializationTransitionKey(snapshot, {
        executionKey,
        origin,
    });
    if (stableTransitionKey) {
        return Object.freeze({
            key: stableTransitionKey,
            local: false,
            signature: stableTransitionKey,
            sourceRunId: "",
            begunRunId: "",
            attemptNumber: 0,
        });
    }
    const normalizedExecutionKey = normalizeString(executionKey);
    const requestFingerprint = normalizeString(snapshot?.requestFingerprint || snapshot?.fingerprint);
    const materializationFingerprint = normalizeString(snapshot?.materializationFingerprint);
    if (!normalizedExecutionKey || !requestFingerprint || !materializationFingerprint) {
        return Object.freeze({
            key: "",
            local: true,
            signature: "",
            sourceRunId: "",
            begunRunId: "",
            attemptNumber: 0,
        });
    }
    const identity = resolveReportRunStableIdentity(snapshot, { origin });
    const signature = JSON.stringify({
        executionKey: normalizedExecutionKey,
        requestFingerprint,
        materializationFingerprint,
        identity,
    });
    const currentRunId = normalizeString(activeRunId);
    const previousSourceRunId = normalizeString(previousAttempt?.sourceRunId);
    const previousBegunRunId = normalizeString(previousAttempt?.begunRunId);
    const sameLocalAttempt = previousAttempt?.local === true
        && normalizeString(previousAttempt?.key)
        && previousAttempt?.signature === signature
        && (
            currentRunId
                ? currentRunId === previousSourceRunId || currentRunId === previousBegunRunId
                : !previousSourceRunId && !previousBegunRunId
        );
    if (sameLocalAttempt) {
        return previousAttempt;
    }
    const attemptNumber = Math.max(1, Number(nextAttemptNumber) || 1);
    const sourceRunId = currentRunId;
    return Object.freeze({
        key: JSON.stringify([
            "local-report-run-initialization",
            signature,
            sourceRunId || "no-active-run",
            attemptNumber,
        ]),
        local: true,
        signature,
        sourceRunId,
        begunRunId: "",
        attemptNumber,
    });
}

export function bindReportRunInitializationTransitionAttempt(attempt = null, runId = "") {
    const normalizedRunId = normalizeString(runId);
    const existingRunId = normalizeString(attempt?.begunRunId);
    if (attempt?.local !== true
        || !normalizeString(attempt?.key)
        || !normalizedRunId
        || (existingRunId && existingRunId !== normalizedRunId)) {
        return attempt;
    }
    if (existingRunId === normalizedRunId) {
        return attempt;
    }
    return Object.freeze({
        ...attempt,
        begunRunId: normalizedRunId,
    });
}

export function resolveReportRunDurableCapability({
    handlerAvailable = false,
    activeRun = null,
    capabilitySignal = null,
} = {}) {
    if (handlerAvailable !== true) {
        return false;
    }
    const activeRunId = normalizeString(activeRun?.runId || activeRun?.reportRunId);
    const signaledCapability = activeRunId
        && normalizeString(capabilitySignal?.runId) === activeRunId
        ? normalizeString(capabilitySignal?.capability).toLowerCase()
        : "";
    const runCapability = normalizeString(activeRun?.durableCapability).toLowerCase();
    return runCapability !== "disabled" && signaledCapability !== "disabled";
}

export function resolveReportRunDisabledLegacyFallback(activeRun = null, {
    retainCurrent = false,
    invocationSnapshot = null,
    origin = "",
} = {}) {
    const activeRequestFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const finalRequestFingerprint = normalizeString(
        invocationSnapshot?.requestFingerprint
        || invocationSnapshot?.fingerprint,
    );
    const requiredOrigin = normalizeString(origin).toLowerCase();
    const activeIdentity = resolveReportRunStableIdentity(activeRun);
    const finalIdentity = resolveReportRunStableIdentity(invocationSnapshot, { origin: requiredOrigin });
    const hasFallbackIdentity = (identity) => !!(
        identity?.origin
        && identity?.builderRef
        && identity?.sourceKind
        && identity?.sourceId
        && identity?.conversationId
    );
    if (retainCurrent !== true
        || !normalizeString(activeRun?.runId)
        || activeRun?.durable === true
        || normalizeString(activeRun?.status).toLowerCase() !== "running"
        || !activeRequestFingerprint
        || activeRequestFingerprint !== finalRequestFingerprint
        || !requiredOrigin
        || !hasFallbackIdentity(activeIdentity)
        || !hasFallbackIdentity(finalIdentity)
        || activeIdentity.origin !== requiredOrigin
        || finalIdentity.origin !== requiredOrigin
        || activeIdentity.builderRef !== finalIdentity.builderRef
        || activeIdentity.sourceKind !== finalIdentity.sourceKind
        || activeIdentity.sourceId !== finalIdentity.sourceId
        || activeIdentity.conversationId !== finalIdentity.conversationId
        || activeIdentity.turnId !== finalIdentity.turnId) {
        return null;
    }
    return activeRun;
}

export function resolveReportRunBeginReuseDecision({
    reuseCurrent = false,
    activeRunId = "",
    activeStatus = "",
    activeOrigin = "",
    requestedOrigin = "",
    activeInvocationFingerprint = "",
    requestedInvocationFingerprint = "",
    beginDeduplicationKey = "",
    beginPendingDeduplicationKey = "",
    activeBeginDeduplicationKey = "",
    pendingBeginDeduplicationKey = "",
} = {}) {
    const requestedKey = normalizeString(beginDeduplicationKey);
    const requestedPendingKey = normalizeString(beginPendingDeduplicationKey || beginDeduplicationKey);
    const activeKey = normalizeString(activeBeginDeduplicationKey);
    const pendingKey = normalizeString(pendingBeginDeduplicationKey);
    if (reuseCurrent === true
        && !!normalizeString(activeRunId)
        && normalizeString(activeStatus).toLowerCase() === "running"
        && normalizeString(activeOrigin).toLowerCase() === normalizeString(requestedOrigin).toLowerCase()
        && normalizeString(activeInvocationFingerprint) === normalizeString(requestedInvocationFingerprint)
        && !!requestedKey
        && !!activeKey
        && activeKey === requestedKey) {
        return "active";
    }
    if (requestedPendingKey && pendingKey && pendingKey === requestedPendingKey) {
        return "pending";
    }
    return "begin";
}

export function resolveHostedReportRunInitializationReadiness({
    executeOnOpen = false,
    hasExecutionIdentity = false,
    hasBlocks = false,
    prefillReady = false,
    activationReady = false,
    definitionReady = false,
    designWorkspaceMode = false,
    collectionLoading = false,
    hasCompletedRequest = false,
    authoredRuntimeExecution = false,
    datasetLoading = false,
    primaryRowsLoading = false,
    rowsSourceLoading = false,
    updating = false,
    primaryResultSettled = false,
    datasetResultSettled = false,
    canRenderRuntime = false,
    finalArtifactsReady = false,
    error = null,
} = {}) {
    const identifiedHostedExecution = executeOnOpen === true
        && hasExecutionIdentity === true
        && hasBlocks === true
        && authoredRuntimeExecution === true
        && designWorkspaceMode !== true;
    const prerequisitesReady = prefillReady === true
        && activationReady === true
        && definitionReady === true;
    const relevantLoading = collectionLoading === true
        || datasetLoading === true
        || primaryRowsLoading === true
        || rowsSourceLoading === true
        || updating === true;
    const resultsSettled = hasCompletedRequest === true
        && primaryResultSettled === true
        && datasetResultSettled === true;
    const hasError = !!error;
    const finalHandoffReady = prerequisitesReady
        && !relevantLoading
        && resultsSettled
        && canRenderRuntime === true
        && finalArtifactsReady === true;
    return Object.freeze({
        hostedInitialization: identifiedHostedExecution,
        ready: identifiedHostedExecution
            && !hasError
            && finalHandoffReady,
        deferSupersede: identifiedHostedExecution
            && !hasError
            && !finalHandoffReady,
    });
}

export function resolveHostedReportRunInitializationOwnership(activeRun = null, {
    hostedInitialization = false,
    durableAvailable = false,
    ownedRunId = "",
} = {}) {
    if (hostedInitialization !== true || durableAvailable !== true) {
        return false;
    }
    const activeRunId = normalizeString(activeRun?.runId || activeRun?.reportRunId);
    const claimedRunId = normalizeString(ownedRunId);
    if (!activeRunId) {
        return !claimedRunId;
    }
    if (normalizeString(activeRun?.status).toLowerCase() !== "running") {
        return false;
    }
    if (claimedRunId) {
        return activeRunId === claimedRunId;
    }
    return normalizeString(
        activeRun?.invocation?.metadata?.origin
        || activeRun?.origin,
    ).toLowerCase() === "prompt";
}

export function matchesHostedReportRunInitializationFreshnessFailure(activeRun = null, snapshot = null, {
    error = null,
    hostedInitialization = false,
    hostedHandoffOwned = false,
    durableAvailable = false,
    currentFingerprint = "",
    currentMaterializationFingerprint = "",
    dispatchFingerprint = "",
    origin = "prompt",
} = {}) {
    if (normalizeString(error?.code) !== "runtimePreviewFreshnessUnavailable") {
        return false;
    }
    return matchesHostedReportRunInitializationFailure(activeRun, snapshot, {
        error,
        hostedInitialization,
        hostedHandoffOwned,
        durableAvailable,
        currentFingerprint,
        currentMaterializationFingerprint,
        dispatchFingerprint,
        origin,
    });
}

function resolveHostedReportRunInitializationFailureAuthorization(activeRun = null, snapshot = null, {
    error = null,
    hostedInitialization = false,
    hostedHandoffOwned = false,
    durableAvailable = false,
    currentFingerprint = "",
    currentMaterializationFingerprint = "",
    dispatchFingerprint = "",
    origin = "prompt",
} = {}) {
    if (!error
        || hostedInitialization !== true
        || hostedHandoffOwned !== true
        || durableAvailable !== true
        || activeRun?.durable !== true
        || normalizeString(activeRun?.status).toLowerCase() !== "running"
        || !activeRun?.invocation) {
        return null;
    }
    const requiredOrigin = normalizeString(origin).toLowerCase();
    const activeRequestFingerprint = normalizeString(
        activeRun.invocation.requestFingerprint
        || activeRun.invocation.fingerprint,
    );
    const snapshotRequestFingerprint = normalizeString(snapshot?.requestFingerprint || snapshot?.fingerprint);
    const snapshotMaterializationFingerprint = normalizeString(snapshot?.materializationFingerprint);
    const currentRequest = normalizeString(currentFingerprint);
    const currentMaterialization = normalizeString(currentMaterializationFingerprint);
    const activeOrigin = normalizeString(activeRun.invocation?.metadata?.origin).toLowerCase();
    const snapshotOrigin = normalizeString(snapshot?.metadata?.origin).toLowerCase();
    const rendererMeasureExpansion = activeRequestFingerprint !== snapshotRequestFingerprint
        && matchesCapturedReportRunRendererMeasureExpansion(activeRun, snapshot);
    const sameRequestFreshnessFailure = normalizeString(error?.code) === "runtimePreviewFreshnessUnavailable"
        && activeRequestFingerprint === snapshotRequestFingerprint;
    const authorized = !!requiredOrigin
        && activeOrigin === requiredOrigin
        && snapshotOrigin === requiredOrigin
        && !!activeRequestFingerprint
        && !!snapshotRequestFingerprint
        && !!snapshotMaterializationFingerprint
        && (sameRequestFreshnessFailure || rendererMeasureExpansion)
        && snapshotRequestFingerprint === currentRequest
        && snapshotMaterializationFingerprint === currentMaterialization
        && matchesReportRunDispatch(dispatchFingerprint, snapshotRequestFingerprint)
        && matchesReportRunStableIdentity(activeRun, snapshot, { origin: requiredOrigin });
    if (!authorized) {
        return null;
    }
    return Object.freeze({
        targetRequestFingerprint: snapshotRequestFingerprint,
        targetMaterializationFingerprint: snapshotMaterializationFingerprint,
        rendererMeasureExpansion,
    });
}

export function matchesHostedReportRunInitializationFailure(activeRun = null, snapshot = null, options = {}) {
    return !!resolveHostedReportRunInitializationFailureAuthorization(activeRun, snapshot, options);
}

export function resolveAuthoredRuntimeSettlementDecision({
    authoredRuntimeExecution = false,
    hostedInitialization = false,
    hostedHandoffOwned = false,
    durableAvailable = false,
    status = "succeeded",
} = {}) {
    if (authoredRuntimeExecution !== true) {
        return Object.freeze({ owner: "none", settle: false });
    }
    const failed = normalizeString(status).toLowerCase() === "failed";
    if (hostedInitialization === true
        && hostedHandoffOwned === true
        && durableAvailable === true
        && !failed) {
        return Object.freeze({ owner: "hosted-final-handoff", settle: false });
    }
    return Object.freeze({
        owner: failed
            && hostedInitialization === true
            && hostedHandoffOwned === true
            && durableAvailable === true
            ? "authored-runtime-error"
            : "authored-runtime-observer",
        settle: true,
    });
}

export function resolveAuthoredRuntimeSettlementReadiness({
    authoredRuntimeExecution = false,
    settlementAllowed = false,
    activeRunId = "",
    durable = false,
    activeRunMatchesCurrentDispatch = false,
    allowDurableFailureWithMaterializationDrift = false,
    status = "succeeded",
    datasetLoading = false,
    datasetResultCorrelated = false,
    datasetResultFresh = false,
    primaryRowsLoading = false,
    rowsSourceLoading = false,
    updating = false,
    primaryResultCorrelated = false,
    primaryResultFresh = false,
    canRenderRuntime = false,
} = {}) {
    if (authoredRuntimeExecution !== true
        || settlementAllowed !== true
        || !normalizeString(activeRunId)
        || datasetLoading === true
        || datasetResultCorrelated !== true) {
        return false;
    }
    const failed = normalizeString(status).toLowerCase() === "failed";
    if (failed) {
        return durable !== true
            || (
                primaryResultCorrelated === true
                && (
                    activeRunMatchesCurrentDispatch === true
                    || allowDurableFailureWithMaterializationDrift === true
                )
            );
    }
    if (durable === true
        && (activeRunMatchesCurrentDispatch !== true || primaryResultCorrelated !== true)) {
        return false;
    }
    if (canRenderRuntime !== true) {
        return false;
    }
    if (durable !== true) {
        return true;
    }
    return datasetResultFresh === true
        && primaryResultFresh === true
        && primaryRowsLoading !== true
        && rowsSourceLoading !== true
        && updating !== true;
}

export function captureReportRunDispatchSnapshot({
    request = null,
    readiness = null,
    materialization = null,
    materializedExportRequest = null,
    terminalMaterializationFresh = false,
    metadata = null,
} = {}) {
    const requestSnapshot = freezeValue(cloneValue(request));
    const materializationSnapshot = freezeValue(cloneValue(materialization));
    const requestFingerprint = JSON.stringify(requestSnapshot);
    const materializationFingerprint = buildReportRunMaterializationFingerprint({
        request: requestSnapshot,
        materialization: materializationSnapshot,
    });
    const materializedExportRequestSnapshot = freezeValue(cloneValue(materializedExportRequest));
    const terminalMaterializationFingerprint = buildReportRunTerminalMaterializationFingerprint(
        materializedExportRequestSnapshot,
        { materializationFingerprint },
    );
    return Object.freeze({
        request: requestSnapshot,
        readiness: freezeValue(cloneValue(readiness)),
        materialization: materializationSnapshot,
        materializedExportRequest: materializedExportRequestSnapshot,
        metadata: freezeValue(cloneValue(metadata)),
        // Keep the historical alias request-only so datasource dispatch remains unchanged.
        fingerprint: requestFingerprint,
        requestFingerprint,
        materializationFingerprint,
        terminalMaterializationFingerprint,
        terminalMaterializationFresh: terminalMaterializationFresh === true,
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
            terminalMaterializationFingerprint: normalizeString(
                snapshot?.terminalMaterializationFingerprint,
            ),
            metadata: cloneValue(snapshot.metadata),
        }),
    };
}

export function bindReportRunTerminalMaterialization(activeRun = null, snapshot = null, {
    trustedConversationId = "",
} = {}) {
    const activeRequestFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(
        activeRun?.invocation?.materializationFingerprint,
    );
    const snapshotRequestFingerprint = normalizeString(
        snapshot?.requestFingerprint
        || snapshot?.fingerprint,
    );
    const snapshotMaterializationFingerprint = normalizeString(snapshot?.materializationFingerprint);
    const terminalMaterializationFingerprint = normalizeString(
        snapshot?.terminalMaterializationFingerprint,
    );
    const activeContext = activeRun?.invocation?.metadata?.event?.context || {};
    const snapshotContext = snapshot?.metadata?.event?.context || {};
    const activeMetadata = activeRun?.invocation?.metadata || {};
    const snapshotMetadata = snapshot?.metadata || {};
    const activeSource = activeMetadata?.source || {};
    const snapshotSource = snapshotMetadata?.source || {};
    const trustedConversation = normalizeString(trustedConversationId);
    const activeOrigin = normalizeString(activeMetadata?.origin).toLowerCase();
    const snapshotOrigin = normalizeString(snapshotMetadata?.origin).toLowerCase();
    const exactInvocationIdentity = [
        [normalizeString(activeMetadata?.builderRef), normalizeString(snapshotMetadata?.builderRef)],
        [normalizeString(activeSource?.reportId), normalizeString(snapshotSource?.reportId)],
        [normalizeString(activeSource?.sourceKind).toLowerCase(), normalizeString(snapshotSource?.sourceKind).toLowerCase()],
        [normalizeString(activeContext?.conversationId), normalizeString(snapshotContext?.conversationId)],
        [normalizeString(activeContext?.turnId), normalizeString(snapshotContext?.turnId)],
        [normalizeString(activeContext?.windowId), normalizeString(snapshotContext?.windowId)],
        [normalizeString(activeContext?.windowKey), normalizeString(snapshotContext?.windowKey)],
    ].every(([activeValue, snapshotValue]) => activeValue === snapshotValue);
    if (activeRun?.durable !== true
        || normalizeString(activeRun?.status).toLowerCase() !== "running"
        || normalizeString(activeRun?.runId) !== normalizeString(activeRun?.invocation?.runId)
        || !activeRequestFingerprint
        || !activeMaterializationFingerprint
        || activeRequestFingerprint !== snapshotRequestFingerprint
        || activeMaterializationFingerprint !== snapshotMaterializationFingerprint
        || !terminalMaterializationFingerprint
        || snapshot?.terminalMaterializationFresh !== true
        || !canPersistReportRunInvocation(snapshot)
        || !["manual", "prompt"].includes(activeOrigin)
        || activeOrigin !== snapshotOrigin
        || exactInvocationIdentity !== true
        || !reportRunValuesEqual(activeMetadata?.event?.runtimeRequest, snapshot?.request)
        || normalizeString(activeRun?.conversationId) !== trustedConversation
        || normalizeString(activeRun?.turnId) !== normalizeString(activeContext?.turnId)
        || normalizeString(activeRun?.windowId) !== normalizeString(activeContext?.windowId)
        || normalizeString(activeContext?.conversationId) !== trustedConversation
        || normalizeString(snapshotContext?.conversationId) !== trustedConversation
    ) {
        return null;
    }
    if (normalizeString(activeRun.invocation.terminalMaterializationFingerprint)
        === terminalMaterializationFingerprint) {
        return activeRun;
    }
    return {
        ...activeRun,
        invocation: freezeValue({
            ...cloneValue(activeRun.invocation),
            terminalMaterializationFingerprint,
        }),
    };
}

export function resolveReportRunInitializationTransition(activeRun = null, snapshot = null, {
    durableAvailable = false,
    ownedRunId = "",
    origin = "",
} = {}) {
    const requestFingerprint = normalizeString(snapshot?.requestFingerprint || snapshot?.fingerprint);
    const materializationFingerprint = normalizeString(snapshot?.materializationFingerprint);
    if (!snapshot || !requestFingerprint || !materializationFingerprint || !canPersistReportRunInvocation(snapshot)) {
        return Object.freeze({ type: "wait", run: activeRun });
    }
    if (!durableAvailable) {
        return Object.freeze({ type: "legacy", run: activeRun });
    }
    const requiredOrigin = normalizeString(origin).toLowerCase();
    const activeOrigin = normalizeString(activeRun?.invocation?.metadata?.origin).toLowerCase();
    const snapshotOrigin = normalizeString(snapshot?.metadata?.origin).toLowerCase();
    const activeRequestFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(activeRun?.invocation?.materializationFingerprint);
    const explicitOriginMatches = !requiredOrigin
        || (activeOrigin === requiredOrigin && snapshotOrigin === requiredOrigin);
    const exactNoDriftPromptInvocation = matchesExactPromptReportRunSnapshot(
        activeRun,
        snapshot,
        { origin: requiredOrigin },
    );
    const capturedRendererMeasureExpansion = requiredOrigin === "prompt"
        && matchesCapturedReportRunRendererMeasureExpansion(activeRun, snapshot);
    const locallyOwnedRendererMeasureMaturation =
        matchesLocallyOwnedReportRunRendererMeasureMaturation(activeRun, snapshot, {
            ownedRunId,
            origin: requiredOrigin,
        });
    const locallyOwnedStableRequestMaturation =
        matchesLocallyOwnedReportRunStableRequestMaturation(activeRun, snapshot, {
            ownedRunId,
            origin: requiredOrigin,
        });
    const completeStableIdentityRetain = (
        activeRequestFingerprint === requestFingerprint
        || capturedRendererMeasureExpansion
    )
        && explicitOriginMatches
        && matchesReportRunStableIdentity(activeRun, snapshot, { origin: requiredOrigin });
    const canRetain = activeRun?.durable === true
        && normalizeString(activeRun?.status).toLowerCase() === "running"
        && (
            exactNoDriftPromptInvocation
            || locallyOwnedRendererMeasureMaturation
            || locallyOwnedStableRequestMaturation
            || completeStableIdentityRetain
        );
    if (!canRetain) {
        return Object.freeze({ type: "begin", run: activeRun });
    }
    if (activeMaterializationFingerprint === materializationFingerprint) {
        return Object.freeze({ type: "retain", run: activeRun });
    }
    return Object.freeze({
        type: "retain",
        run: bindReportRunInvocation(activeRun, snapshot),
    });
}

export function matchesReportRunDispatch(dispatchFingerprint = "", invocationFingerprint = "") {
    const dispatch = normalizeString(dispatchFingerprint);
    const fingerprint = normalizeString(invocationFingerprint);
    return !!fingerprint && (dispatch === `${fingerprint}::fetch` || dispatch === `${fingerprint}::hold`);
}

export function shouldDeferReportRunSupersedeForInitialization(activeRun = null, snapshot = null, {
    deferSupersede = false,
    currentFingerprint = "",
    currentMaterializationFingerprint = "",
    dispatchFingerprint = "",
    ownedRunId = "",
    origin = "prompt",
} = {}) {
    if (deferSupersede !== true
        || activeRun?.durable !== true
        || normalizeString(activeRun?.status).toLowerCase() !== "running"
        || !activeRun?.invocation) {
        return false;
    }
    const activeRequestFingerprint = normalizeString(
        activeRun.invocation.requestFingerprint
        || activeRun.invocation.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(activeRun.invocation.materializationFingerprint);
    const snapshotRequestFingerprint = normalizeString(snapshot?.requestFingerprint || snapshot?.fingerprint);
    const snapshotMaterializationFingerprint = normalizeString(snapshot?.materializationFingerprint);
    const currentRequest = normalizeString(currentFingerprint);
    const currentMaterialization = normalizeString(currentMaterializationFingerprint);
    const requiredOrigin = normalizeString(origin).toLowerCase();
    const capturedRendererMeasureExpansion = requiredOrigin === "prompt"
        && activeRequestFingerprint !== snapshotRequestFingerprint
        && matchesCapturedReportRunRendererMeasureExpansion(activeRun, snapshot);
    const locallyOwnedRendererMeasureMaturation = activeRequestFingerprint
        !== snapshotRequestFingerprint
        && matchesLocallyOwnedReportRunRendererMeasureMaturation(activeRun, snapshot, {
            ownedRunId,
            origin: requiredOrigin,
        });
    const locallyOwnedStableRequestMaturation = activeRequestFingerprint
        === snapshotRequestFingerprint
        && matchesLocallyOwnedReportRunStableRequestMaturation(activeRun, snapshot, {
            ownedRunId,
            origin: requiredOrigin,
        });
    const rendererMeasureExpansion = capturedRendererMeasureExpansion
        || locallyOwnedRendererMeasureMaturation;
    const requestTransitionMatches = (
        activeRequestFingerprint === snapshotRequestFingerprint
        && activeRequestFingerprint === currentRequest
    ) || (
        rendererMeasureExpansion
        && snapshotRequestFingerprint === currentRequest
    );
    const dispatchMatchesTransition = rendererMeasureExpansion
        ? matchesReportRunDispatch(dispatchFingerprint, snapshotRequestFingerprint)
        : matchesReportRunDispatch(dispatchFingerprint, activeRequestFingerprint);
    const stableTransitionAuthorized = locallyOwnedRendererMeasureMaturation
        || locallyOwnedStableRequestMaturation
        || matchesReportRunStableIdentity(activeRun, snapshot, { origin: requiredOrigin });
    return !!activeRequestFingerprint
        && !!activeMaterializationFingerprint
        && requestTransitionMatches
        && snapshotMaterializationFingerprint === currentMaterialization
        && currentMaterialization !== activeMaterializationFingerprint
        && dispatchMatchesTransition
        && stableTransitionAuthorized;
}

export function resolveReportRunInitializationLatch({
    phase = "acquire",
    latchedKey = "",
    transitionKey = "",
    settledRun = null,
    requestFingerprint = "",
    materializationFingerprint = "",
} = {}) {
    const currentKey = normalizeString(latchedKey);
    const requestedKey = normalizeString(transitionKey);
    if (normalizeString(phase).toLowerCase() !== "settle") {
        if (!requestedKey) {
            return Object.freeze({ action: "wait", key: currentKey });
        }
        if (currentKey === requestedKey) {
            return Object.freeze({ action: "skip", key: currentKey });
        }
        return Object.freeze({ action: "acquire", key: requestedKey });
    }
    if (!requestedKey || currentKey !== requestedKey) {
        return Object.freeze({ action: "skip", key: currentKey });
    }
    const settledRequestFingerprint = normalizeString(
        settledRun?.invocation?.requestFingerprint
        || settledRun?.invocation?.fingerprint,
    );
    const settledMaterializationFingerprint = normalizeString(settledRun?.invocation?.materializationFingerprint);
    const exactDurableCompletion = settledRun?.durable === true
        && normalizeString(settledRun?.status).toLowerCase() === "completed"
        && !!normalizeString(settledRun?.reportRunId || settledRun?.runId)
        && settledRequestFingerprint === normalizeString(requestFingerprint)
        && settledMaterializationFingerprint === normalizeString(materializationFingerprint);
    return exactDurableCompletion
        ? Object.freeze({ action: "retain", key: requestedKey })
        : Object.freeze({ action: "release", key: "" });
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

export function matchesReportRunSettlementCurrency(activeRun = null, event = null, {
    currentRun = null,
    currentFingerprint = "",
    currentMaterializationFingerprint = "",
    dispatchFingerprint = "",
} = {}) {
    if (!matchesReportRunSettlement(activeRun, event)) {
        return false;
    }
    const eventRunId = normalizeString(event?.runId);
    const eventRequestFingerprint = normalizeString(event?.requestFingerprint || event?.fingerprint);
    const eventMaterializationFingerprint = normalizeString(event?.materializationFingerprint);
    const hostedFailureAuthorization = event?.hostedInitializationFailureAuthorization;
    const hostedFailureTargetRequest = normalizeString(
        hostedFailureAuthorization?.targetRequestFingerprint,
    );
    const hostedFailureTargetMaterialization = normalizeString(
        hostedFailureAuthorization?.targetMaterializationFingerprint,
    );
    const authorizedHostedFailure = normalizeString(event?.status).toLowerCase() === "failed"
        && !!hostedFailureTargetRequest
        && !!hostedFailureTargetMaterialization
        && normalizeString(hostedFailureAuthorization?.errorCode) === normalizeString(event?.error?.code);
    const requiredCurrentRequest = authorizedHostedFailure
        ? hostedFailureTargetRequest
        : eventRequestFingerprint;
    if (normalizeString(currentRun?.runId) !== normalizeString(activeRun?.runId)
        || normalizeString(currentRun?.status).toLowerCase() !== "running"
        || normalizeString(currentRun?.invocation?.runId) !== eventRunId
        || normalizeString(
            currentRun?.invocation?.requestFingerprint
            || currentRun?.invocation?.fingerprint,
        ) !== eventRequestFingerprint
        || normalizeString(currentFingerprint) !== requiredCurrentRequest
        || !matchesReportRunDispatch(dispatchFingerprint, requiredCurrentRequest)) {
        return false;
    }
    if (activeRun?.durable !== true) {
        return true;
    }
    if (normalizeString(currentRun?.invocation?.materializationFingerprint)
        !== eventMaterializationFingerprint) {
        return false;
    }
    if (normalizeString(currentRun?.invocation?.terminalMaterializationFingerprint)
        !== normalizeString(activeRun?.invocation?.terminalMaterializationFingerprint)) {
        return false;
    }
    const currentMaterialization = normalizeString(currentMaterializationFingerprint);
    if (authorizedHostedFailure) {
        return currentMaterialization === hostedFailureTargetMaterialization;
    }
    if (currentMaterialization === eventMaterializationFingerprint) {
        return true;
    }
    const targetMaterialization = normalizeString(
        event?.hostedFreshnessFailureAuthorization?.targetMaterializationFingerprint,
    );
    return normalizeString(event?.status).toLowerCase() === "failed"
        && normalizeString(event?.error?.code) === "runtimePreviewFreshnessUnavailable"
        && !!targetMaterialization
        && currentMaterialization === targetMaterialization;
}

export function matchesReportRunSettlementApplicationCurrency(activeRun = null, event = null, {
    trustedConversationId = "",
    currentTrustedConversationId = "",
    ...settlementCurrency
} = {}) {
    return normalizeString(currentTrustedConversationId) === normalizeString(trustedConversationId)
        && matchesReportRunSettlementCurrency(activeRun, event, settlementCurrency);
}

export function buildReportRunSettlementEventKey(activeRun = null, event = null) {
    const runId = normalizeString(activeRun?.invocation?.runId || event?.runId);
    const requestFingerprint = normalizeString(event?.requestFingerprint || event?.fingerprint);
    const settlementFingerprint = activeRun?.durable === true
        ? normalizeString(activeRun?.invocation?.materializationFingerprint)
        : requestFingerprint;
    const status = normalizeString(event?.status).toLowerCase() || "succeeded";
    if (!runId || !settlementFingerprint) {
        return "";
    }
    const existingKey = `${runId}:${settlementFingerprint}:${status}`;
    const hostedFailureAuthorization = event?.hostedInitializationFailureAuthorization;
    const hostedFailureTargetRequest = normalizeString(
        hostedFailureAuthorization?.targetRequestFingerprint,
    );
    const hostedFailureTargetMaterialization = normalizeString(
        hostedFailureAuthorization?.targetMaterializationFingerprint,
    );
    if (status === "failed"
        && hostedFailureTargetRequest
        && hostedFailureTargetMaterialization
        && normalizeString(hostedFailureAuthorization?.errorCode) === normalizeString(event?.error?.code)) {
        return `${existingKey}:${hostedFailureTargetRequest}:${hostedFailureTargetMaterialization}`;
    }
    const targetMaterializationFingerprint = normalizeString(
        event?.hostedFreshnessFailureAuthorization?.targetMaterializationFingerprint,
    );
    if (status !== "failed"
        || normalizeString(event?.error?.code) !== "runtimePreviewFreshnessUnavailable"
        || !targetMaterializationFingerprint
        || targetMaterializationFingerprint === settlementFingerprint) {
        return existingKey;
    }
    return `${existingKey}:${targetMaterializationFingerprint}`;
}

export function executeReportRunSettlementPromiseLifecycle({
    eventKey = "",
    completedEventKey = "",
    pendingSettlementRef = null,
    completedValue = null,
    execute = null,
} = {}) {
    const normalizedEventKey = normalizeString(eventKey);
    if (!normalizedEventKey
        || !pendingSettlementRef
        || typeof pendingSettlementRef !== "object"
        || typeof execute !== "function") {
        throw new Error("A settlement event key, pending-settlement ref, and executor are required.");
    }
    if (normalizeString(completedEventKey) === normalizedEventKey) {
        return Promise.resolve(completedValue);
    }
    let registry = pendingSettlementRef.current;
    if (!(registry?.pendingByEventKey instanceof Map)) {
        registry = {
            pendingByEventKey: new Map(),
        };
        pendingSettlementRef.current = registry;
    }
    const pendingEntry = registry.pendingByEventKey.get(normalizedEventKey);
    if (pendingEntry?.promise) {
        return pendingEntry.promise;
    }
    const marker = {};
    const promise = Promise.resolve()
        .then(() => execute())
        .finally(() => {
            if (pendingSettlementRef.current !== registry
                || registry.pendingByEventKey.get(normalizedEventKey)?.marker !== marker) {
                return;
            }
            registry.pendingByEventKey.delete(normalizedEventKey);
            if (registry.pendingByEventKey.size === 0) {
                pendingSettlementRef.current = null;
            }
        });
    registry.pendingByEventKey.set(normalizedEventKey, {
        marker,
        promise,
    });
    return promise;
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
    allowDurableFailureWithMaterializationDrift = false,
    allowDurableFailureWithInvocationDrift = false,
    hostedInitializationFailureSnapshot = null,
} = {}) {
    const requestFingerprint = normalizeString(explicitRequestFingerprint || fingerprint);
    const identity = { runId, requestFingerprint, materializationFingerprint };
    if (!matchesReportRunSettlement(activeRun, identity)) {
        return null;
    }
    const normalizedStatus = normalizeString(status).toLowerCase() || "succeeded";
    const targetMaterializationFingerprint = normalizeString(currentMaterializationFingerprint);
    const activeMaterializationFingerprint = normalizeString(activeRun?.invocation?.materializationFingerprint);
    const materializationDrift = activeRun?.durable === true
        && !!targetMaterializationFingerprint
        && targetMaterializationFingerprint !== activeMaterializationFingerprint;
    const allowedHostedFreshnessFailure = normalizedStatus === "failed"
        && allowDurableFailureWithMaterializationDrift === true
        && normalizeString(error?.code) === "runtimePreviewFreshnessUnavailable"
        && materializationDrift;
    const hostedInitializationFailureAuthorizationCandidate = normalizedStatus === "failed"
        && allowDurableFailureWithMaterializationDrift === true
        && allowDurableFailureWithInvocationDrift === true
        ? resolveHostedReportRunInitializationFailureAuthorization(
            activeRun,
            hostedInitializationFailureSnapshot,
            {
                error,
                hostedInitialization: true,
                hostedHandoffOwned: true,
                durableAvailable: true,
                currentFingerprint,
                currentMaterializationFingerprint,
                dispatchFingerprint,
                origin: "prompt",
            },
        )
        : null;
    const hostedInitializationFailureAuthorization =
        hostedInitializationFailureAuthorizationCandidate?.rendererMeasureExpansion === true
            ? hostedInitializationFailureAuthorizationCandidate
            : null;
    if (activeRun.durable) {
        const activeFingerprint = normalizeString(
            activeRun.invocation.requestFingerprint
            || activeRun.invocation.fingerprint,
        );
        const authorizedTargetRequest = normalizeString(
            hostedInitializationFailureAuthorization?.targetRequestFingerprint,
        );
        const requiredCurrentRequest = authorizedTargetRequest || activeFingerprint;
        if (normalizeString(currentFingerprint) !== requiredCurrentRequest
            || (
                normalizeString(currentMaterializationFingerprint) !== activeMaterializationFingerprint
                && !allowedHostedFreshnessFailure
                && !hostedInitializationFailureAuthorization
            )
            || !matchesReportRunDispatch(dispatchFingerprint, requiredCurrentRequest)) {
            return null;
        }
        const expectedKey = normalizeString(expectedResultRequestKey);
        if (expectedKey && normalizeString(resultRequestKey) !== expectedKey) {
            return null;
        }
        if (normalizedStatus !== "failed") {
            const terminalMaterializationFingerprint = buildReportRunTerminalMaterializationFingerprint(
                terminalRequest,
                { materializationFingerprint: activeMaterializationFingerprint },
            );
            if (!terminalMaterializationFingerprint
                || terminalMaterializationFingerprint !== normalizeString(
                    activeRun?.invocation?.terminalMaterializationFingerprint,
                )) {
                return null;
            }
        }
    }
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
        ...(allowedHostedFreshnessFailure ? {
            hostedFreshnessFailureAuthorization: Object.freeze({
                targetMaterializationFingerprint,
            }),
        } : {}),
        ...(hostedInitializationFailureAuthorization ? {
            hostedInitializationFailureAuthorization: Object.freeze({
                targetRequestFingerprint:
                    hostedInitializationFailureAuthorization.targetRequestFingerprint,
                targetMaterializationFingerprint:
                    hostedInitializationFailureAuthorization.targetMaterializationFingerprint,
                errorCode: normalizeString(error?.code),
            }),
        } : {}),
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
    shouldSettle = null,
} = {}) {
    if (!matchesReportRunSettlement(activeRun, event)) {
        return { accepted: false, run: activeRun };
    }
    const failed = normalizeString(event?.status).toLowerCase() === "failed";
    const settle = failed ? fail : complete;
    if (typeof settle !== "function") {
        throw new Error(`A report run ${failed ? "failure" : "completion"} callback is required.`);
    }
    if (typeof shouldSettle === "function" && shouldSettle() !== true) {
        return { accepted: false, run: activeRun };
    }
    const run = failed
        ? await settle(activeRun, event?.error || null)
        : await settle(activeRun, event?.terminalRequest || null);
    return { accepted: true, run };
}

export function adoptHostedReportRunCurrentDispatch(snapshot = null, {
    markCompletedFingerprint = null,
} = {}) {
    const requestFingerprint = normalizeString(
        snapshot?.requestFingerprint
        || snapshot?.fingerprint,
    );
    if (!snapshot || !requestFingerprint || typeof markCompletedFingerprint !== "function") {
        throw new Error("A current hosted run snapshot and completion marker are required.");
    }
    markCompletedFingerprint(requestFingerprint);
    return {
        request: snapshot.request,
        fingerprint: requestFingerprint,
        readiness: snapshot.readiness,
        shouldFetch: true,
        adoptedCurrentDispatch: true,
    };
}

export function resolveHostedReportRunPostBeginDispatch(
    activeRun = null,
    capturedSnapshot = null,
    currentSnapshot = null,
    {
        currentFingerprint = "",
        currentMaterializationFingerprint = "",
        dispatchFingerprint = "",
        ownedRunId = "",
        origin = "prompt",
    } = {},
) {
    const requiredOrigin = normalizeString(origin).toLowerCase();
    const capturedRequestFingerprint = normalizeString(
        capturedSnapshot?.requestFingerprint
        || capturedSnapshot?.fingerprint,
    );
    const capturedMaterializationFingerprint = normalizeString(
        capturedSnapshot?.materializationFingerprint,
    );
    const currentRequestFingerprint = normalizeString(
        currentSnapshot?.requestFingerprint
        || currentSnapshot?.fingerprint,
    );
    const currentMaterializationFingerprintValue = normalizeString(
        currentSnapshot?.materializationFingerprint,
    );
    const activeRequestFingerprint = normalizeString(
        activeRun?.invocation?.requestFingerprint
        || activeRun?.invocation?.fingerprint,
    );
    const activeMaterializationFingerprint = normalizeString(
        activeRun?.invocation?.materializationFingerprint,
    );
    const activeOrigin = normalizeString(activeRun?.invocation?.metadata?.origin).toLowerCase();
    const capturedOrigin = normalizeString(capturedSnapshot?.metadata?.origin).toLowerCase();
    const currentOrigin = normalizeString(currentSnapshot?.metadata?.origin).toLowerCase();
    const activeMatchesCaptured = activeRun?.durable === true
        && normalizeString(activeRun?.status).toLowerCase() === "running"
        && !!activeRun?.invocation
        && activeRequestFingerprint === capturedRequestFingerprint
        && activeMaterializationFingerprint === capturedMaterializationFingerprint;
    const currentCurrencyMatches = !!currentRequestFingerprint
        && !!currentMaterializationFingerprintValue
        && currentRequestFingerprint === normalizeString(currentFingerprint)
        && currentMaterializationFingerprintValue
            === normalizeString(currentMaterializationFingerprint);
    const explicitPromptOwnership = requiredOrigin === "prompt"
        && activeOrigin === requiredOrigin
        && capturedOrigin === requiredOrigin
        && currentOrigin === requiredOrigin;
    const completeStablePromptOwnership = explicitPromptOwnership
        && matchesReportRunStableIdentity(activeRun, capturedSnapshot, {
            origin: requiredOrigin,
        })
        && matchesReportRunStableIdentity(activeRun, currentSnapshot, {
            origin: requiredOrigin,
        });
    const locallyOwnedRendererMeasureMaturation =
        matchesLocallyOwnedReportRunRendererMeasureMaturation(
            activeRun,
            currentSnapshot,
            {
                ownedRunId,
                origin: requiredOrigin,
            },
        );
    const locallyOwnedStableRequestMaturation =
        matchesLocallyOwnedReportRunStableRequestMaturation(
            activeRun,
            currentSnapshot,
            {
                ownedRunId,
                origin: requiredOrigin,
            },
        );
    const currentDispatchMatches = matchesReportRunDispatch(
        dispatchFingerprint,
        currentRequestFingerprint,
    );
    if (!activeMatchesCaptured
        || !currentCurrencyMatches
        || !explicitPromptOwnership
        || !currentDispatchMatches) {
        return Object.freeze({ type: "skip", snapshot: null });
    }
    const sameRequest = capturedRequestFingerprint === currentRequestFingerprint;
    const sameMaterialization = capturedMaterializationFingerprint
        === currentMaterializationFingerprintValue;
    const exactNoDrift = sameRequest && sameMaterialization;
    const compatibleExactIdentity = exactNoDrift
        && matchesExactPromptReportRunSnapshot(activeRun, capturedSnapshot, {
            origin: requiredOrigin,
        })
        && matchesExactPromptReportRunSnapshot(activeRun, currentSnapshot, {
            origin: requiredOrigin,
        });
    if ((exactNoDrift && !compatibleExactIdentity)
        || (!exactNoDrift
            && !completeStablePromptOwnership
            && !locallyOwnedRendererMeasureMaturation
            && !locallyOwnedStableRequestMaturation)) {
        return Object.freeze({ type: "skip", snapshot: null });
    }
    const changedRequestAuthorized = !sameRequest
        && shouldDeferReportRunSupersedeForInitialization(activeRun, currentSnapshot, {
            deferSupersede: true,
            currentFingerprint,
            currentMaterializationFingerprint,
            dispatchFingerprint,
            ownedRunId,
            origin: requiredOrigin,
        });
    if (!sameRequest && !changedRequestAuthorized) {
        return Object.freeze({ type: "skip", snapshot: null });
    }
    if (normalizeString(dispatchFingerprint) === `${currentRequestFingerprint}::fetch`) {
        return Object.freeze({ type: "adopt", snapshot: currentSnapshot });
    }
    return Object.freeze({ type: "dispatch", snapshot: currentSnapshot });
}

export async function beginAndDispatchReportRun(snapshot, {
    begin,
    dispatch,
    resolvePostBeginDispatch = null,
    adopt = null,
} = {}) {
    if (!snapshot || typeof begin !== "function" || typeof dispatch !== "function") {
        throw new Error("An immutable run snapshot, begin callback, and dispatch callback are required.");
    }
    const begun = await begin(snapshot);
    if (!begun?.ok) {
        return begun;
    }
    if (typeof resolvePostBeginDispatch !== "function") {
        return { ...begun, dispatchResult: dispatch(snapshot) };
    }
    const resolution = resolvePostBeginDispatch(snapshot, begun) || {};
    const dispatchAction = normalizeString(resolution.type).toLowerCase() || "dispatch";
    if (dispatchAction === "skip") {
        return { ...begun, dispatchAction, dispatchResult: null };
    }
    const selectedSnapshot = resolution.snapshot || snapshot;
    if (dispatchAction === "adopt") {
        if (typeof adopt !== "function") {
            throw new Error("A report run current-dispatch adoption callback is required.");
        }
        return {
            ...begun,
            dispatchAction,
            dispatchResult: adopt(selectedSnapshot, begun),
        };
    }
    if (dispatchAction !== "dispatch") {
        throw new Error(`Unsupported post-Begin report run dispatch action: ${dispatchAction}.`);
    }
    return {
        ...begun,
        dispatchAction,
        dispatchResult: dispatch(selectedSnapshot),
    };
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

export function bindDurableReportRunBeginResult(beginResult = null, snapshot = null, {
    uiRunRequestId = "",
} = {}) {
    if (beginResult?.enabled !== true) {
        throw new Error("An enabled durable report-run Begin result is required.");
    }
    const invocationContext = snapshot?.metadata?.event?.context || {};
    const invocationOrigin = normalizeString(snapshot?.metadata?.origin).toLowerCase() || "manual";
    return bindReportRunInvocation({
        runId: beginResult.reportRunId,
        reportRunId: beginResult.reportRunId,
        revision: beginResult.revision,
        contextRevision: beginResult.contextRevision,
        conversationId: normalizeString(invocationContext.conversationId),
        turnId: normalizeString(invocationContext.turnId),
        windowId: normalizeString(invocationContext.windowId),
        origin: invocationOrigin,
        uiRunRequestId: normalizeString(uiRunRequestId),
        durable: true,
        durableCapability: "enabled",
        status: "running",
    }, snapshot);
}

export async function cancelUnmountedReportRunBegin(
    handler,
    beginResult = null,
    snapshot = null,
    { uiRunRequestId = "" } = {},
) {
    const cancellationResult = buildCancelledReportRunResult();
    if (beginResult?.enabled !== true) {
        return cancellationResult;
    }
    const begunRun = bindDurableReportRunBeginResult(beginResult, snapshot, {
        uiRunRequestId,
    });
    try {
        await failDurableReportRun(handler, begunRun, {
            code: cancellationResult.code,
            message: cancellationResult.error,
        });
    } catch (_) {
        // The component is gone; cleanup is best-effort and cancellation remains deterministic.
    }
    return cancellationResult;
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

export function classifyCompletedReportRunConversationAction(activeRun = null, {
    trustedConversationId = "",
} = {}) {
    const reportRunId = normalizeString(activeRun?.reportRunId);
    const runId = normalizeString(activeRun?.runId);
    const trustedConversation = normalizeString(trustedConversationId);
    const storedConversation = normalizeString(activeRun?.conversationId);
    const runOrigin = normalizeString(activeRun?.origin).toLowerCase();
    const invocationOrigin = normalizeString(activeRun?.invocation?.metadata?.origin).toLowerCase();
    const origin = runOrigin || invocationOrigin;
    const revision = Number(activeRun?.revision || 0);
    const contextRevision = Number(activeRun?.contextRevision || 0);
    const valid = activeRun?.durable === true
        && normalizeString(activeRun?.status).toLowerCase() === "completed"
        && !!reportRunId
        && (!runId || runId === reportRunId)
        && Number.isInteger(revision)
        && revision > 0
        && Number.isInteger(contextRevision)
        && contextRevision >= 0
        && !!trustedConversation
        && ["manual", "prompt"].includes(origin)
        && (!runOrigin || !invocationOrigin || runOrigin === invocationOrigin);
    if (!valid || (storedConversation && storedConversation !== trustedConversation)) {
        return Object.freeze({ type: "reject" });
    }
    if (storedConversation === trustedConversation) {
        return Object.freeze({
            type: "activate",
            request: Object.freeze({
                reportRunId,
                conversationId: trustedConversation,
                ...(normalizeString(activeRun?.turnId) ? { turnId: normalizeString(activeRun.turnId) } : {}),
                ...(normalizeString(activeRun?.windowId) ? { windowId: normalizeString(activeRun.windowId) } : {}),
                expectedRunRevision: revision,
                expectedContextRevision: contextRevision,
                source: origin,
            }),
        });
    }
    if (origin === "manual") {
        return Object.freeze({
            type: "adopt",
            request: Object.freeze({
                reportRunId,
                conversationId: trustedConversation,
                expectedRunRevision: revision,
                source: origin,
            }),
        });
    }
    return Object.freeze({ type: "reject" });
}

function bindReportRunTrustedConversation(activeRun = null, conversationId = "") {
    const trustedConversationId = normalizeString(conversationId);
    const invocation = activeRun?.invocation;
    if (!invocation || !trustedConversationId) {
        return activeRun;
    }
    return {
        ...activeRun,
        invocation: {
            ...invocation,
            metadata: {
                ...invocation.metadata,
                event: {
                    ...invocation.metadata?.event,
                    context: {
                        ...invocation.metadata?.event?.context,
                        conversationId: trustedConversationId,
                    },
                },
            },
        },
    };
}

export function buildCompletedReportRunConversationSelectionKey(activeRun = null, {
    trustedConversationId = "",
} = {}) {
    const classification = classifyCompletedReportRunConversationAction(activeRun, {
        trustedConversationId,
    });
    if (classification.type === "reject") {
        return "";
    }
    return JSON.stringify([
        "completed-report-run-conversation-v1",
        classification.type,
        normalizeString(activeRun?.runId),
        normalizeString(activeRun?.reportRunId),
        Number(activeRun?.revision || 0),
        Number(activeRun?.contextRevision || 0),
        normalizeString(activeRun?.conversationId),
        normalizeString(trustedConversationId),
        normalizeString(activeRun?.invocation?.requestFingerprint || activeRun?.invocation?.fingerprint),
        normalizeString(activeRun?.invocation?.materializationFingerprint),
    ]);
}

async function callReportRunHostAction(action, request, {
    isCurrent = () => true,
} = {}) {
    if (isCurrent() !== true) {
        return { stale: true };
    }
    try {
        const result = await action(request);
        if (isCurrent() !== true) {
            return { stale: true };
        }
        return { result };
    } catch (error) {
        if (isCurrent() !== true) {
            return { stale: true };
        }
        throw error;
    }
}

export async function reconcileCompletedReportRunConversation(handler, activeRun, {
    trustedConversationId = "",
    isCurrent = () => true,
} = {}) {
    const classification = classifyCompletedReportRunConversationAction(activeRun, {
        trustedConversationId,
    });
    if (classification.type === "reject" || isCurrent() !== true) {
        return { applied: false, run: activeRun, classification };
    }
    const action = handler?.[classification.type];
    if (typeof action !== "function") {
        if (classification.type === "activate") {
            throw new Error("Report-run activation is unavailable.");
        }
        return { applied: false, unavailable: true, run: activeRun, classification };
    }
    let request = classification.request;
    if (classification.type === "adopt") {
        if (typeof handler?.getContext !== "function") {
            return { applied: false, unavailable: true, run: activeRun, classification };
        }
        const contextCall = await callReportRunHostAction(handler.getContext, {
            conversationId: classification.request.conversationId,
        }, {
            isCurrent,
        });
        if (contextCall.stale) {
            return { applied: false, stale: true, run: activeRun, classification };
        }
        const contextResult = contextCall.result;
        if (contextResult?.enabled === false) {
            return { applied: false, enabled: false, run: activeRun, classification };
        }
        if (contextResult?.enabled !== true
            || !Object.prototype.hasOwnProperty.call(contextResult, "context")
            || (contextResult.context !== null
                && (typeof contextResult.context !== "object" || Array.isArray(contextResult.context)))) {
            throw new Error("Report-run context lookup returned an invalid response.");
        }
        const targetContext = contextResult.context;
        const targetContextRevision = targetContext ? Number(targetContext.revision || 0) : 0;
        if (targetContext && (
            normalizeString(targetContext.conversationId) !== classification.request.conversationId
            || !Number.isInteger(targetContextRevision)
            || targetContextRevision <= 0
        )) {
            throw new Error("Report-run context lookup returned an invalid conversation context.");
        }
        request = Object.freeze({
            ...classification.request,
            expectedContextRevision: targetContextRevision,
        });
    }
    const actionCall = await callReportRunHostAction(action, request, {
        isCurrent,
    });
    if (actionCall.stale) {
        return { applied: false, stale: true, run: activeRun, classification };
    }
    const result = actionCall.result;
    if (classification.type === "adopt" && result?.enabled === false) {
        return { applied: false, enabled: false, run: activeRun, classification };
    }
    const context = classification.type === "adopt" ? result?.context : result;
    const contextRevision = Number(context?.revision || 0);
    const contextConversationId = normalizeString(context?.conversationId);
    if (normalizeString(context?.activeReportRunId) !== request.reportRunId
        || (classification.type === "adopt"
            ? contextConversationId !== request.conversationId
            : (contextConversationId && contextConversationId !== request.conversationId))
        || !Number.isInteger(contextRevision)
        || contextRevision <= 0) {
        throw new Error(`Report-run ${classification.type} returned an invalid active context.`);
    }
    let next = activeRun;
    if (classification.type === "adopt") {
        const adoptedRun = result?.run;
        const adoptedRevision = Number(adoptedRun?.revision || 0);
        if (normalizeString(adoptedRun?.reportRunId) !== request.reportRunId
            || normalizeString(adoptedRun?.conversationId) !== request.conversationId
            || normalizeString(adoptedRun?.origin).toLowerCase() !== "manual"
            || normalizeString(adoptedRun?.status).toLowerCase() !== "completed"
            || !Number.isInteger(adoptedRevision)
            || adoptedRevision < request.expectedRunRevision) {
            throw new Error("Report-run adopt returned an invalid completed run identity.");
        }
        next = bindReportRunTrustedConversation({
            ...activeRun,
            conversationId: request.conversationId,
            revision: adoptedRevision,
        }, request.conversationId);
    }
    return {
        applied: true,
        run: { ...next, contextRevision },
        classification,
    };
}

function resolveReportRunConversationReconciliationState(stateRef = null) {
    if (!stateRef || typeof stateRef !== "object") {
        return {
            completedKeys: new Set(),
            pendingByKey: new Map(),
        };
    }
    if (!(stateRef.current?.completedKeys instanceof Set)
        || !(stateRef.current?.pendingByKey instanceof Map)) {
        stateRef.current = {
            completedKeys: new Set(),
            pendingByKey: new Map(),
        };
    }
    return stateRef.current;
}

function rememberReportRunConversationReconciliationKey(state, key = "") {
    const normalizedKey = normalizeString(key);
    if (!normalizedKey) {
        return;
    }
    state.completedKeys.add(normalizedKey);
    while (state.completedKeys.size > 32) {
        state.completedKeys.delete(state.completedKeys.values().next().value);
    }
}

export function coordinateCompletedReportRunConversation({
    handler = null,
    activeRun = null,
    trustedConversationId = "",
    stateRef = null,
    isCurrent = () => true,
    applyRun = null,
} = {}) {
    const selectionKey = buildCompletedReportRunConversationSelectionKey(activeRun, {
        trustedConversationId,
    });
    if (!selectionKey) {
        return Promise.resolve({
            applied: false,
            run: activeRun,
            classification: Object.freeze({ type: "reject" }),
        });
    }
    const state = resolveReportRunConversationReconciliationState(stateRef);
    if (state.completedKeys.has(selectionKey)) {
        return Promise.resolve({ applied: false, duplicate: true, run: activeRun });
    }
    const pending = state.pendingByKey.get(selectionKey);
    if (pending) {
        return pending;
    }
    const promise = reconcileCompletedReportRunConversation(handler, activeRun, {
        trustedConversationId,
        isCurrent,
    }).then((reconciliation) => {
        if (reconciliation.stale || isCurrent() !== true) {
            return reconciliation.stale
                ? reconciliation
                : { ...reconciliation, applied: false, stale: true, run: activeRun };
        }
        if (reconciliation.applied && typeof applyRun === "function") {
            applyRun(reconciliation.run);
        }
        if (reconciliation.applied
            || reconciliation.enabled === false
            || reconciliation.unavailable === true) {
            rememberReportRunConversationReconciliationKey(state, selectionKey);
            rememberReportRunConversationReconciliationKey(
                state,
                buildCompletedReportRunConversationSelectionKey(reconciliation.run, {
                    trustedConversationId,
                }),
            );
        }
        return reconciliation;
    }).finally(() => {
        if (state.pendingByKey.get(selectionKey) === promise) {
            state.pendingByKey.delete(selectionKey);
        }
    });
    state.pendingByKey.set(selectionKey, promise);
    return promise;
}

export async function completeAndActivateReportRun(handler, activeRun, reportExportRequest, {
    shouldActivate = () => true,
    trustedConversationId = activeRun?.conversationId,
    reconciliationStateRef = null,
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
    const reconciliation = await coordinateCompletedReportRunConversation({
        handler,
        activeRun: next,
        trustedConversationId,
        stateRef: reconciliationStateRef,
        isCurrent: () => shouldActivate(next) === true,
    });
    return reconciliation.run;
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
