import {
    buildReportBuilderListReportDocumentsEntrySelectionKey,
    mergeReportBuilderGetReportDocumentResponseSharedArtifact,
    resolveReportBuilderListReportDocumentsResponseEntry,
} from "./reportBuilderReportDocumentReadResponse.js";
import {
    mergeReportBuilderHydratedReportDocumentDiagnosticSharedArtifact,
} from "./reportBuilderHydratedReportDocumentDiagnostic.js";
import {
    mergeReportBuilderCreateReportDocumentPayloadSharedArtifact,
} from "./reportBuilderCreateReportDocumentPayload.js";
import {
    mergeReportBuilderUpdateReportDocumentPayloadSharedArtifact,
} from "./reportBuilderUpdateReportDocumentPayload.js";
import {
    applyReportBuilderLifecycleSharedArtifactToListResponse,
    resolveReportBuilderLifecycleResultEnvelope,
    upsertReportBuilderLifecycleSharedArtifactRecord,
} from "./reportBuilderLifecycleResult.js";
import {
    mergeReportBuilderSharedArtifactInventoryRecord,
} from "./reportBuilderSharedArtifactInventory.js";
import {
    setReportBuilderHydratedDocumentSessionSharedArtifact,
} from "./reportBuilderHydratedReportDocument.js";
import {
    matchesReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedPayloadSourceIdentity,
} from "./reportBuilderSavedReportRecords.js";

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function hasSourceAnchorChanged(currentPayload = null, nextPayload = null) {
    if (!isPlainObject(currentPayload) || !isPlainObject(nextPayload)) {
        return false;
    }
    const currentSource = normalizeReportBuilderSavedPayloadSourceIdentity(currentPayload?.source || currentPayload);
    const nextSource = normalizeReportBuilderSavedPayloadSourceIdentity(nextPayload?.source || nextPayload);
    if (!currentSource || !nextSource) {
        return false;
    }
    if (!matchesReportBuilderSavedPayloadSourceIdentity(currentSource, nextSource)) {
        return true;
    }
    return normalizePositiveInteger(currentPayload?.expectedVersion) !== normalizePositiveInteger(nextPayload?.expectedVersion);
}

export function shouldReconcileReportBuilderHydratedSession(session = null, targetSource = null) {
    const sessionSource = normalizeReportBuilderSavedPayloadSourceIdentity(
        session?.savedSource || session,
    );
    const candidateSource = normalizeReportBuilderSavedPayloadSourceIdentity(targetSource);
    return !!sessionSource
        && !!candidateSource
        && matchesReportBuilderSavedPayloadSourceIdentity(sessionSource, candidateSource);
}

export function reconcileReportBuilderLifecycleSharedArtifactState({
    record = null,
    localLifecycleSharedArtifactRecords = [],
    getReportDocumentResponse = null,
    reopenReportDocumentDiagnostic = null,
    createReportDocumentPayload = null,
    updateReportDocumentPayload = null,
    backendSharedArtifactRecords = [],
    hydratedSession = null,
    hydratedSessionTargetSource = null,
    forceHydratedSession = false,
    listReportDocumentsResponse = null,
    listResponseTargetSource = null,
} = {}) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        return null;
    }
    const nextLocalLifecycleSharedArtifactRecords = upsertReportBuilderLifecycleSharedArtifactRecord(
        localLifecycleSharedArtifactRecords,
        record,
    );
    const normalizedRecord = nextLocalLifecycleSharedArtifactRecords[0] || null;
    if (!normalizedRecord) {
        return null;
    }
    const nextGetReportDocumentResponse = mergeReportBuilderGetReportDocumentResponseSharedArtifact(
        getReportDocumentResponse,
        normalizedRecord,
    );
    const nextReopenReportDocumentDiagnostic = mergeReportBuilderHydratedReportDocumentDiagnosticSharedArtifact(
        reopenReportDocumentDiagnostic,
        normalizedRecord,
    );
    const nextCreateReportDocumentPayload = mergeReportBuilderCreateReportDocumentPayloadSharedArtifact(
        createReportDocumentPayload,
        normalizedRecord,
    );
    const nextUpdateReportDocumentPayload = mergeReportBuilderUpdateReportDocumentPayloadSharedArtifact(
        updateReportDocumentPayload,
        normalizedRecord,
    );
    const nextBackendSharedArtifactRecords = mergeReportBuilderSharedArtifactInventoryRecord(
        backendSharedArtifactRecords,
        normalizedRecord,
    );
    const nextHydratedSession = (forceHydratedSession || shouldReconcileReportBuilderHydratedSession(hydratedSession, hydratedSessionTargetSource))
        ? setReportBuilderHydratedDocumentSessionSharedArtifact(
            hydratedSession,
            normalizedRecord,
        )
        : hydratedSession;
    const nextListReportDocumentsResponse = listReportDocumentsResponse && listResponseTargetSource
        ? applyReportBuilderLifecycleSharedArtifactToListResponse(
            listReportDocumentsResponse,
            normalizedRecord,
            { targetSource: listResponseTargetSource },
        )
        : listReportDocumentsResponse;
    return {
        record: normalizedRecord,
        localLifecycleSharedArtifactRecords: nextLocalLifecycleSharedArtifactRecords,
        getReportDocumentResponse: nextGetReportDocumentResponse,
        reopenReportDocumentDiagnostic: nextReopenReportDocumentDiagnostic,
        createReportDocumentPayload: nextCreateReportDocumentPayload,
        updateReportDocumentPayload: nextUpdateReportDocumentPayload,
        clearUpdateReportDocumentConflictDiagnostic: hasSourceAnchorChanged(
            updateReportDocumentPayload,
            nextUpdateReportDocumentPayload,
        ),
        backendSharedArtifactRecords: nextBackendSharedArtifactRecords,
        hydratedSession: nextHydratedSession,
        listReportDocumentsResponse: nextListReportDocumentsResponse,
    };
}

function resolveLifecycleProjectionSelectedReportId(result = null, envelope = null, record = null, {
    listResponseTargetSource = null,
    listReportDocumentsResponse = null,
} = {}) {
    const effectiveListResponse = listReportDocumentsResponse || envelope?.listReportDocumentsResponse || null;
    const explicitSelection = String(
        result?.selectedReportId
        || envelope?.listReportDocumentsResponse?.selectedReportId
        || "",
    ).trim();
    if (explicitSelection) {
        const explicitEntry = resolveReportBuilderListReportDocumentsResponseEntry(effectiveListResponse, {
            selectedEntryKey: explicitSelection,
            selectedReportId: explicitSelection,
            fallbackToFirst: false,
        });
        const explicitEntryKey = buildReportBuilderListReportDocumentsEntrySelectionKey(explicitEntry);
        if (explicitEntryKey) {
            return explicitEntryKey;
        }
    }
    const preferredReportId = String(
        envelope?.sharedArtifact?.reportId
        || envelope?.getReportDocumentResponse?.reportRef?.reportId
        || record?.reportId
        || "",
    ).trim();
    const selectedEntry = resolveReportBuilderListReportDocumentsResponseEntry(effectiveListResponse, {
        source: record?.source || listResponseTargetSource || envelope?.sharedArtifact?.source || envelope?.getReportDocumentResponse?.source || null,
        selectedReportId: preferredReportId,
        fallbackToFirst: false,
    });
    const selectedEntryKey = buildReportBuilderListReportDocumentsEntrySelectionKey(selectedEntry);
    if (selectedEntryKey) {
        return selectedEntryKey;
    }
    const sourceBackedSelectionKey = buildReportBuilderListReportDocumentsEntrySelectionKey({
        reportRef: preferredReportId ? { reportId: preferredReportId } : null,
        source: record?.source || envelope?.sharedArtifact?.source || envelope?.getReportDocumentResponse?.source || null,
        document: preferredReportId ? { id: preferredReportId } : null,
    });
    if (sourceBackedSelectionKey) {
        return sourceBackedSelectionKey;
    }
    return String(
        preferredReportId
        || effectiveListResponse?.entries?.[0]?.reportRef?.reportId
        || "",
    ).trim();
}

export function projectReportBuilderLifecycleEnvelopeState({
    result = null,
    replaceSelectedListEntrySource = null,
    hydratedSessionTargetSource = null,
    forceHydratedSession = false,
    localLifecycleSharedArtifactRecords = [],
    getReportDocumentResponse = null,
    reopenReportDocumentDiagnostic = null,
    createReportDocumentPayload = null,
    updateReportDocumentPayload = null,
    updateReportDocumentConflictDiagnostic = null,
    backendSharedArtifactRecords = [],
    hydratedSession = null,
    listReportDocumentsResponse = null,
} = {}) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
        return null;
    }
    const envelope = resolveReportBuilderLifecycleResultEnvelope(result);
    const hasArtifacts = !!(
        envelope.sharedArtifact
        || envelope.getReportDocumentResponse
        || envelope.listReportDocumentsResponse
        || envelope.getReportDocumentRequest
        || envelope.reopenReportDocumentDiagnostic
        || envelope.createReportDocumentPayload
        || envelope.updateReportDocumentPayload
        || envelope.updateReportDocumentConflictDiagnostic
    );
    if (!hasArtifacts) {
        return {
            record: null,
            envelope,
        };
    }
    const reconciliation = envelope.sharedArtifact
        ? reconcileReportBuilderLifecycleSharedArtifactState({
            record: envelope.sharedArtifact,
            localLifecycleSharedArtifactRecords,
            getReportDocumentResponse: envelope.getReportDocumentResponse || getReportDocumentResponse,
            reopenReportDocumentDiagnostic: envelope.reopenReportDocumentDiagnostic || reopenReportDocumentDiagnostic,
            createReportDocumentPayload: envelope.createReportDocumentPayload || createReportDocumentPayload,
            updateReportDocumentPayload: envelope.updateReportDocumentPayload || updateReportDocumentPayload,
            backendSharedArtifactRecords,
            hydratedSession,
            hydratedSessionTargetSource,
            forceHydratedSession,
            listReportDocumentsResponse: envelope.listReportDocumentsResponse || listReportDocumentsResponse,
            listResponseTargetSource: replaceSelectedListEntrySource,
        })
        : null;
    const nextRecord = reconciliation?.record || null;
    const clearUpdateConflict = !envelope.updateReportDocumentConflictDiagnostic
        && !!reconciliation?.clearUpdateReportDocumentConflictDiagnostic;
    const resolvedSelectionKey = resolveLifecycleProjectionSelectedReportId(result, envelope, nextRecord, {
        listResponseTargetSource: replaceSelectedListEntrySource,
        listReportDocumentsResponse: reconciliation?.listReportDocumentsResponse
            || envelope.listReportDocumentsResponse
            || listReportDocumentsResponse,
    });
    return {
        record: nextRecord,
        envelope,
        selectedEntryKey: resolvedSelectionKey,
        selectedReportId: resolvedSelectionKey,
        localLifecycleSharedArtifactRecords: reconciliation?.localLifecycleSharedArtifactRecords || localLifecycleSharedArtifactRecords,
        backendSharedArtifactRecords: reconciliation?.backendSharedArtifactRecords || backendSharedArtifactRecords,
        hydratedSession: reconciliation?.hydratedSession || hydratedSession,
        getReportDocumentResponse: envelope.getReportDocumentResponse
            ? (reconciliation?.getReportDocumentResponse || envelope.getReportDocumentResponse)
            : (reconciliation?.getReportDocumentResponse || getReportDocumentResponse),
        getReportDocumentRequest: envelope.getReportDocumentRequest || null,
        reopenReportDocumentDiagnostic: envelope.reopenReportDocumentDiagnostic
            ? (reconciliation?.reopenReportDocumentDiagnostic || envelope.reopenReportDocumentDiagnostic)
            : (reconciliation?.reopenReportDocumentDiagnostic || reopenReportDocumentDiagnostic),
        createReportDocumentPayload: envelope.createReportDocumentPayload
            ? (reconciliation?.createReportDocumentPayload || envelope.createReportDocumentPayload)
            : (reconciliation?.createReportDocumentPayload || createReportDocumentPayload),
        updateReportDocumentPayload: envelope.updateReportDocumentPayload
            ? (reconciliation?.updateReportDocumentPayload || envelope.updateReportDocumentPayload)
            : (reconciliation?.updateReportDocumentPayload || updateReportDocumentPayload),
        updateReportDocumentConflictDiagnostic: envelope.updateReportDocumentConflictDiagnostic
            || (clearUpdateConflict ? null : updateReportDocumentConflictDiagnostic),
        clearUpdateReportDocumentConflictDiagnostic: clearUpdateConflict,
        listReportDocumentsResponse: envelope.listReportDocumentsResponse
            ? (reconciliation?.listReportDocumentsResponse || envelope.listReportDocumentsResponse)
            : (reconciliation?.listReportDocumentsResponse || listReportDocumentsResponse),
    };
}
