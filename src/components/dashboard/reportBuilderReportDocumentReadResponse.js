import {
    buildReportDocumentRef,
    buildGetReportDocumentResponse,
    buildListReportDocumentsResponse,
} from "../../reporting/reportDocumentStore.js";
import { buildReportBuilderExportArtifactKindLabel } from "./reportBuilderExportRequest.js";
import { buildReportBuilderImportedArtifactSourceLabel } from "./reportBuilderImportedArtifactLabels.js";
import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import { buildReportBuilderSavedReportPayloadFromBuilderState } from "./reportBuilderSavedReportPayload.js";
import {
    matchesReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedReportRecord,
    normalizeReportBuilderSavedReportRecords,
    resolveReportBuilderSavedReportRecordByReportId,
    resolveReportBuilderSavedReportRecordBySource,
} from "./reportBuilderSavedReportRecords.js";
import { extractReportDocumentTemplateIdentity } from "../../reporting/reportDocumentModel.js";
import {
    resolveNormalizedReportSpecDocumentContext,
    resolveNormalizedSavedReportRecordContext,
    resolveSavedReportRecordContextByReportId,
    resolveSavedReportRecordContextBySource,
} from "./reportBuilderSavedRecordMetadataContext.js";
import {
    summarizeReportBuilderAuthoredBlocks,
    summarizeReportBuilderAuthoredDrillMetadata,
} from "./reportBuilderAuthoredBlockSummary.js";
import {
    buildReportBuilderTemplateIdentityConflict,
    hasReportBuilderTemplateIdentityConflict,
    resolveReportBuilderTemplateConflictDiagnostic,
    resolveReportBuilderTemplateIdentity,
} from "./reportBuilderTemplateIdentity.js";
import {
    buildShareableArtifactSummary,
    extractShareableArtifactState,
} from "../../reporting/sharing/shareableArtifactModel.js";
import {
    buildSavedViewOverlaySummary,
    extractSavedViewOverlayArtifactState,
} from "../../reporting/views/savedViewOverlayModel.js";
import { resolveReportBuilderSavedViewOverlayReopenSourceResolution } from "./reportBuilderReopenSourceResolution.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function normalizeSemanticBindingViewState(value = null) {
    if (!isPlainObject(value)) {
        return null;
    }
    const title = normalizeString(value?.title);
    const chips = Array.isArray(value?.chips)
        ? value.chips.map((chip) => normalizeString(chip)).filter(Boolean)
        : [];
    const fieldGroups = Array.isArray(value?.fieldGroups)
        ? value.fieldGroups
            .filter((group) => isPlainObject(group))
            .map((group) => {
                const id = normalizeString(group?.id);
                const groupTitle = normalizeString(group?.title);
                const fields = Array.isArray(group?.fields)
                    ? group.fields
                        .filter((field) => isPlainObject(field)
                            && (
                                normalizeString(field?.id)
                                || normalizeString(field?.rawId)
                                || normalizeString(field?.label)
                                || normalizeString(field?.definitionRef)
                            ))
                        .map((field) => cloneValue(field))
                    : [];
                if (!id || !groupTitle || fields.length === 0) {
                    return null;
                }
                return {
                    id,
                    title: groupTitle,
                    fields,
                };
            })
            .filter(Boolean)
        : [];
    if (chips.length === 0 && fieldGroups.length === 0) {
        return null;
    }
    return {
        ...(title ? { title } : { title: "Semantic Binding" }),
        ...(chips.length > 0 ? { chips } : {}),
        ...(fieldGroups.length > 0 ? { fieldGroups } : {}),
    };
}

function cloneSharedArtifactProvenance(value = null) {
    if (!isPlainObject(value)) {
        return null;
    }
    const artifactId = normalizeString(value?.artifactId || value?.id);
    const artifactKind = normalizeString(value?.artifactKind);
    const artifactRef = normalizeString(value?.artifactRef);
    const lifecycle = normalizeString(value?.lifecycle);
    const ownerRef = normalizeString(value?.ownerRef);
    const policyRef = normalizeString(value?.policyRef);
    const shareableVersion = normalizePositiveInteger(value?.shareableVersion);
    const badges = Array.isArray(value?.badges) ? cloneValue(value.badges) : [];
    const capabilities = isPlainObject(value?.capabilities) ? cloneValue(value.capabilities) : null;
    const grants = Array.isArray(value?.grants) ? cloneValue(value.grants) : [];
    if (!artifactId && !artifactKind && !artifactRef && !lifecycle && !ownerRef && !policyRef && shareableVersion < 1 && badges.length === 0 && !capabilities && grants.length === 0) {
        return null;
    }
    return {
        ...(artifactId ? { artifactId } : {}),
        ...(artifactKind ? { artifactKind } : {}),
        ...(artifactRef ? { artifactRef } : {}),
        ...(lifecycle ? { lifecycle } : {}),
        ...(ownerRef ? { ownerRef } : {}),
        ...(policyRef ? { policyRef } : {}),
        ...(shareableVersion > 0 ? { shareableVersion } : {}),
        ...(badges.length > 0 ? { badges } : {}),
        ...(capabilities ? { capabilities } : {}),
        ...(grants.length > 0 ? { grants } : {}),
    };
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function buildListEntryIdentityKey(entry = null) {
    return [
        normalizeString(entry?.reportRef?.reportId),
        normalizeString(entry?.source?.kind),
        normalizeString(entry?.source?.payloadId),
        normalizeString(entry?.source?.sourceArtifactId),
    ].join("::");
}

export function buildReportBuilderListReportDocumentsEntrySelectionKey(entry = null) {
    const hasExplicitSourceIdentity = !!(
        normalizeString(entry?.source?.kind)
        || normalizeString(entry?.source?.payloadId)
        || normalizeString(entry?.source?.sourceArtifactId)
    );
    const identityKey = buildListEntryIdentityKey(entry);
    if (hasExplicitSourceIdentity && normalizeString(identityKey.replace(/:/g, ""))) {
        return identityKey;
    }
    return normalizeString(entry?.reportRef?.reportId || entry?.document?.id);
}

function resolveReportBuilderListEntries(payload = null) {
    return Array.isArray(payload?.entries) ? payload.entries : [];
}

export function resolveReportBuilderListReportDocumentsResponseEntry(payload = null, {
    selectedEntryKey = "",
    selectedReportId = "",
    source = null,
    fallbackToFirst = false,
} = {}) {
    const entries = resolveReportBuilderListEntries(payload);
    if (entries.length === 0) {
        return null;
    }
    const normalizedSelectedEntryKey = normalizeString(selectedEntryKey);
    const normalizedSelectedReportId = normalizeString(selectedReportId);
    for (const candidateKey of [normalizedSelectedEntryKey, normalizedSelectedReportId]) {
        if (!candidateKey) {
            continue;
        }
        const exactEntry = entries.find((entry) => buildReportBuilderListReportDocumentsEntrySelectionKey(entry) === candidateKey);
        if (exactEntry) {
            return exactEntry;
        }
    }
    const normalizedSource = normalizeReportBuilderSavedPayloadSourceIdentity(source);
    if (normalizedSource) {
        const exactEntry = entries.find((entry) => matchesReportBuilderSavedPayloadSourceIdentity(
            normalizedSource,
            normalizeReportBuilderSavedPayloadSourceIdentity(entry?.source || entry),
        ));
        if (exactEntry) {
            return exactEntry;
        }
    }
    if (!normalizedSelectedReportId) {
        return fallbackToFirst ? entries[0] || null : null;
    }
    const reportMatches = entries.filter((entry) => normalizeString(entry?.reportRef?.reportId) === normalizedSelectedReportId);
    if (reportMatches.length === 1) {
        return reportMatches[0];
    }
    if (fallbackToFirst) {
        return reportMatches[0] || entries[0] || null;
    }
    return null;
}

function applyListEntrySemanticBindingViewState(response = null, sourceEntries = []) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
        return response;
    }
    const responseEntries = Array.isArray(response?.entries) ? response.entries : [];
    if (responseEntries.length === 0) {
        return response;
    }
    const semanticBindingViewStateByIdentity = new Map();
    const shareableArtifactStateByIdentity = new Map();
    const artifactIdByIdentity = new Map();
    (Array.isArray(sourceEntries) ? sourceEntries : []).forEach((entry) => {
        const semanticBindingViewState = normalizeSemanticBindingViewState(entry?.semanticBindingViewState);
        const shareableArtifactState = extractShareableArtifactState(entry);
        const artifactId = normalizeString(entry?.artifactId || entry?.id);
        if (!semanticBindingViewState) {
            const identityKey = buildListEntryIdentityKey(entry);
            const reportId = normalizeString(entry?.reportRef?.reportId);
            if (artifactId) {
                if (identityKey.replace(/:/g, "")) {
                    artifactIdByIdentity.set(identityKey, artifactId);
                }
                if (reportId) {
                    artifactIdByIdentity.set(reportId, artifactId);
                }
            }
            if (shareableArtifactState) {
                if (identityKey.replace(/:/g, "")) {
                    shareableArtifactStateByIdentity.set(identityKey, shareableArtifactState);
                }
                if (reportId) {
                    shareableArtifactStateByIdentity.set(reportId, shareableArtifactState);
                }
            }
            return;
        }
        const identityKey = buildListEntryIdentityKey(entry);
        if (identityKey.replace(/:/g, "")) {
            semanticBindingViewStateByIdentity.set(identityKey, semanticBindingViewState);
        }
        const reportId = normalizeString(entry?.reportRef?.reportId);
        if (reportId) {
            semanticBindingViewStateByIdentity.set(reportId, semanticBindingViewState);
        }
        if (artifactId) {
            if (identityKey.replace(/:/g, "")) {
                artifactIdByIdentity.set(identityKey, artifactId);
            }
            if (reportId) {
                artifactIdByIdentity.set(reportId, artifactId);
            }
        }
        if (shareableArtifactState) {
            if (identityKey.replace(/:/g, "")) {
                shareableArtifactStateByIdentity.set(identityKey, shareableArtifactState);
            }
            if (reportId) {
                shareableArtifactStateByIdentity.set(reportId, shareableArtifactState);
            }
        }
    });
    const nextEntries = responseEntries.map((entry) => {
        const semanticBindingViewState = semanticBindingViewStateByIdentity.get(buildListEntryIdentityKey(entry))
            || semanticBindingViewStateByIdentity.get(normalizeString(entry?.reportRef?.reportId));
        const shareableArtifactState = shareableArtifactStateByIdentity.get(buildListEntryIdentityKey(entry))
            || shareableArtifactStateByIdentity.get(normalizeString(entry?.reportRef?.reportId));
        const artifactId = artifactIdByIdentity.get(buildListEntryIdentityKey(entry))
            || artifactIdByIdentity.get(normalizeString(entry?.reportRef?.reportId));
        return {
            ...entry,
            ...(artifactId ? { artifactId } : {}),
            ...(semanticBindingViewState ? { semanticBindingViewState } : {}),
            ...(shareableArtifactState ? shareableArtifactState : {}),
        };
    });
    return {
        ...response,
        entries: nextEntries,
    };
}

export function resolveReportBuilderReportDocumentResponseSeed(savedReportPayload = null, {
    hydratedReportDocumentSession = null,
    getReportDocumentResponse = null,
} = {}) {
    if (hydratedReportDocumentSession && getReportDocumentResponse && typeof getReportDocumentResponse === "object" && !Array.isArray(getReportDocumentResponse)) {
        return cloneValue(getReportDocumentResponse);
    }
    const reportId = normalizeString(hydratedReportDocumentSession?.reportId);
    const title = normalizeString(hydratedReportDocumentSession?.title || reportId || "Report") || "Report";
    const documentVersion = normalizePositiveInteger(hydratedReportDocumentSession?.documentVersion);
    const savedSource = hydratedReportDocumentSession?.savedSource && typeof hydratedReportDocumentSession.savedSource === "object" && !Array.isArray(hydratedReportDocumentSession.savedSource)
        ? cloneValue(hydratedReportDocumentSession.savedSource)
        : (hydratedReportDocumentSession?.source && typeof hydratedReportDocumentSession.source === "object" && !Array.isArray(hydratedReportDocumentSession.source)
            ? cloneValue(hydratedReportDocumentSession.source)
            : null);
    const sharedArtifactProvenance = cloneSharedArtifactProvenance(hydratedReportDocumentSession);
    if (reportId || savedSource) {
        return {
            version: 1,
            kind: "getReportDocumentResponse",
            ...(reportId ? { reportRef: { reportId } } : {}),
            ...(documentVersion > 0 ? { documentVersion } : {}),
            document: {
                version: 1,
                kind: "reportDocument",
                ...(reportId ? { id: reportId } : {}),
                title,
            },
            ...(savedSource ? { source: savedSource } : {}),
            ...(sharedArtifactProvenance ? sharedArtifactProvenance : {}),
        };
    }
    return savedReportPayload;
}

function hasReportSpecSemanticSummary(reportSpec = null) {
    return !!reportSpec
        && typeof reportSpec === "object"
        && !Array.isArray(reportSpec)
        && !!reportSpec.semanticSummary
        && typeof reportSpec.semanticSummary === "object"
        && !Array.isArray(reportSpec.semanticSummary);
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveSourceSemanticReportSpec(value = null) {
    if (isPlainObject(value?.savedReportPayload?.reportSpec)) {
        return value.savedReportPayload.reportSpec;
    }
    return isPlainObject(value?.reportSpec) ? value.reportSpec : null;
}

export function buildListEntryFromSavedReportPayloadRecord(record = null) {
    if (!record || record.documentVersion < 1) {
        return null;
    }
    const recordContext = resolveNormalizedSavedReportRecordContext(record);
    const subtitle = normalizeString(recordContext?.document?.subtitle || record?.document?.subtitle);
    const description = normalizeString(recordContext?.document?.description || record?.document?.description);
    const semanticSummary = recordContext?.semanticSummary || null;
    const binding = recordContext?.binding || null;
    const scope = recordContext?.scope || null;
    const semanticBindingViewState = normalizeSemanticBindingViewState(record?.semanticBindingViewState)
        || normalizeSemanticBindingViewState(record?.savedReportPayload?.semanticBindingViewState);
    const shareableArtifactState = extractShareableArtifactState(record?.savedReportPayload || record);
    const savedViewOverlay = extractSavedViewOverlayArtifactState(record);
    return {
        reportRef: {
            reportId: record.reportId,
        },
        ...(normalizeString(record?.artifactId || record?.id) ? { artifactId: normalizeString(record?.artifactId || record?.id) } : {}),
        documentVersion: record.documentVersion,
        title: record.title,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        savedAt: record.savedAt,
        ...(record.source ? { source: record.source } : {}),
        ...(record.compileState ? { compileState: record.compileState } : {}),
        ...(normalizeString(record?.templateId) ? { templateId: normalizeString(record.templateId) } : {}),
        ...(normalizeString(record?.templateLabel) ? { templateLabel: normalizeString(record.templateLabel) } : {}),
        ...(semanticSummary ? { semanticSummary: cloneValue(semanticSummary) } : {}),
        ...(binding ? { binding: cloneValue(binding) } : {}),
        ...(scope ? { scope: cloneValue(scope) } : {}),
        ...(semanticBindingViewState ? { semanticBindingViewState } : {}),
        ...(shareableArtifactState ? shareableArtifactState : {}),
        ...(savedViewOverlay ? { savedViewOverlay } : {}),
    };
}

function buildReportDocumentResponseScopeSummary(reportContext = null) {
    const summary = buildReportBuilderScopeSummaryFromParams(
        Array.isArray(reportContext?.scopeParams)
            ? reportContext.scopeParams
            : (Array.isArray(reportContext?.scope?.params) ? reportContext.scope.params : []),
    );
    return Array.isArray(summary?.items) && summary.items.length > 0 ? summary : null;
}

function buildReportDocumentResponseAuthoredSummary(reportContext = null) {
    const documentBlocks = Array.isArray(reportContext?.document?.blocks) ? reportContext.document.blocks : [];
    const authoredBlocks = documentBlocks.filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock");
    const authoredSummary = summarizeReportBuilderAuthoredBlocks(authoredBlocks);
    return authoredSummary?.totalCount > 0 ? authoredSummary : null;
}

function buildReportDocumentResponseDrillSummary(reportContext = null) {
    const drillSummary = summarizeReportBuilderAuthoredDrillMetadata(reportContext?.reportSpec || {});
    return Number(drillSummary?.hierarchyCount || 0) > 0
        || Number(drillSummary?.detailTargetCount || 0) > 0
        || Number(drillSummary?.fieldActionCount || 0) > 0
        ? drillSummary
        : null;
}

function buildListEntryAuthoredSummary(localSavedRecord = null) {
    const documentBlocks = Array.isArray(localSavedRecord?.document?.blocks) ? localSavedRecord.document.blocks : [];
    const authoredBlocks = documentBlocks.filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock");
    const authoredSummary = summarizeReportBuilderAuthoredBlocks(authoredBlocks);
    return authoredSummary?.totalCount > 0 ? authoredSummary : null;
}

function buildListEntryDrillSummary(localSavedRecord = null) {
    const drillSummary = summarizeReportBuilderAuthoredDrillMetadata(localSavedRecord?.reportSpec || {});
    return Number(drillSummary?.hierarchyCount || 0) > 0
        || Number(drillSummary?.detailTargetCount || 0) > 0
        || Number(drillSummary?.fieldActionCount || 0) > 0
        ? drillSummary
        : null;
}

function resolveListReportDocumentsEntrySemanticContext(entry = null, {
    localSavedPayloads = [],
} = {}) {
    const reportId = normalizeString(entry?.reportRef?.reportId);
    const entryHasExplicitSource = !!entry?.source && typeof entry.source === "object" && !Array.isArray(entry.source);
    const sourceMatchedLocalSavedRecord = resolveReportBuilderSavedReportRecordBySource(localSavedPayloads, entry?.source || entry);
    const sourceMatchedLocalRecordContext = resolveSavedReportRecordContextBySource(entry?.source || entry, localSavedPayloads);
    const localSavedRecord = sourceMatchedLocalSavedRecord
        || (!entryHasExplicitSource && reportId ? resolveReportBuilderSavedReportRecordByReportId(localSavedPayloads, reportId) : null);
    const localSavedRecordContext = localSavedRecord
        ? resolveNormalizedSavedReportRecordContext(localSavedRecord)
        : null;
    const entryInlineReportSpec = isPlainObject(entry?.reportSpec)
        ? entry.reportSpec
        : (
            isPlainObject(entry?.semanticSummary) || isPlainObject(entry?.binding) || isPlainObject(entry?.scope)
                ? {
                    version: 1,
                    kind: "reportSpec",
                    title: entry?.title || entry?.reportRef?.reportId || "",
                    ...(isPlainObject(entry?.semanticSummary) ? { semanticSummary: entry.semanticSummary } : {}),
                    ...(isPlainObject(entry?.binding) ? { binding: entry.binding } : {}),
                    ...(isPlainObject(entry?.scope) ? { scope: entry.scope } : {}),
                }
                : null
        );
    const directEntryContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: entryInlineReportSpec,
        document: entry?.document || null,
        title: entry?.title || entry?.reportRef?.reportId || "",
    });
    const effectiveDocument = directEntryContext?.document || sourceMatchedLocalRecordContext?.document || localSavedRecordContext?.document || localSavedRecord?.document || null;
    const effectiveReportSpec = directEntryContext?.reportSpec || sourceMatchedLocalRecordContext?.reportSpec || localSavedRecordContext?.reportSpec || localSavedRecord?.reportSpec || null;
    const carriedSemanticBindingViewState = normalizeSemanticBindingViewState(entry?.semanticBindingViewState)
        || normalizeSemanticBindingViewState(localSavedRecord?.semanticBindingViewState)
        || normalizeSemanticBindingViewState(sourceMatchedLocalSavedRecord?.semanticBindingViewState)
        || normalizeSemanticBindingViewState(localSavedRecord?.savedReportPayload?.semanticBindingViewState)
        || normalizeSemanticBindingViewState(sourceMatchedLocalSavedRecord?.savedReportPayload?.semanticBindingViewState);
    const savedViewOverlay = entry?.savedViewOverlay
        || sourceMatchedLocalSavedRecord?.savedViewOverlay
        || localSavedRecord?.savedViewOverlay
        || null;
    const savedViewOverlaySummary = buildSavedViewOverlaySummary(
        savedViewOverlay
            ? { kind: "reportBuilder.savedView", savedViewOverlay }
            : null,
        {
            document: effectiveDocument,
            reportSpec: effectiveReportSpec,
        },
    );
    const reopenSourceResolutionState = savedViewOverlay
        ? resolveReportBuilderSavedViewOverlayReopenSourceResolution(savedViewOverlay, localSavedPayloads)?.state
        : null;
    const effectiveSemanticBindingViewState = carriedSemanticBindingViewState
        || buildReportBuilderSemanticBindingViewState({
            semanticSummary: directEntryContext?.semanticSummary || null,
            binding: directEntryContext?.binding || null,
        })
        || buildReportBuilderSemanticBindingViewState({
            semanticSummary: sourceMatchedLocalRecordContext?.semanticSummary || null,
            binding: sourceMatchedLocalRecordContext?.binding || null,
        })
        || buildReportBuilderSemanticBindingViewState({
            semanticSummary: localSavedRecordContext?.semanticSummary || null,
            binding: localSavedRecordContext?.binding || null,
        });
    const scopeSummary = buildReportDocumentResponseScopeSummary(directEntryContext)
        || buildReportDocumentResponseScopeSummary(sourceMatchedLocalRecordContext)
        || buildReportDocumentResponseScopeSummary(localSavedRecordContext);
    return {
        localSavedRecord,
        sourceMatchedLocalSavedRecord,
        semanticBindingViewState: effectiveSemanticBindingViewState,
        scopeSummary,
        savedViewOverlaySummary,
        reopenSourceResolutionState,
    };
}

export function resolveReportBuilderDocumentVersion(value = "") {
    const normalized = normalizeString(value);
    if (!/^[1-9]\d*$/.test(normalized)) {
        return 0;
    }
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function buildReportBuilderDocumentVersionState(draft = "") {
    const normalizedDraft = normalizeString(draft);
    const documentVersion = resolveReportBuilderDocumentVersion(normalizedDraft);
    return {
        draft: normalizedDraft,
        documentVersion,
        valid: documentVersion > 0,
        helperText: documentVersion > 0
            ? `Using document version ${documentVersion}.`
            : normalizedDraft
                ? "Document version must be a positive integer."
                : "Enter a document version to prepare the read response.",
    };
}

export function buildReportBuilderGetReportDocumentResponse(savedReportPayload = null, {
    documentVersion = 0,
    savedAt = Date.now(),
} = {}) {
    const base = normalizeReportBuilderSavedReportRecord(savedReportPayload, {
        documentVersion,
        savedAt,
    });
    const normalizedVersion = resolveReportBuilderDocumentVersion(documentVersion);
    if (!base || normalizedVersion < 1) {
        return null;
    }
    const response = buildGetReportDocumentResponse({
        reportRef: { reportId: base.reportId },
        version: normalizedVersion,
        savedAt,
        document: base.document,
        ...(base.compileState ? { compileState: base.compileState } : {}),
        source: base.source,
    });
    if (!response) {
        return null;
    }
    const withSemanticBindingViewState = normalizeSemanticBindingViewState(base?.savedReportPayload?.semanticBindingViewState)
        ? {
            ...response,
            semanticBindingViewState: normalizeSemanticBindingViewState(base.savedReportPayload.semanticBindingViewState),
        }
        : response;
    const withShareableArtifactState = extractShareableArtifactState(base?.savedReportPayload)
        ? {
            ...withSemanticBindingViewState,
            ...extractShareableArtifactState(base.savedReportPayload),
        }
        : withSemanticBindingViewState;
    const withSavedViewOverlay = extractSavedViewOverlayArtifactState(base)
        ? {
            ...withShareableArtifactState,
            savedViewOverlay: extractSavedViewOverlayArtifactState(base),
        }
        : withShareableArtifactState;
    return hasReportSpecSemanticSummary(resolveSourceSemanticReportSpec(savedReportPayload))
        ? {
            ...withSavedViewOverlay,
            reportSpec: cloneValue(base.reportSpec),
        }
        : withSavedViewOverlay;
}

export function buildReportBuilderGetReportDocumentResponseFromBuilderState(savedReportPayload = null, {
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
    documentVersion = 0,
} = {}) {
    const rebuiltSavedReportPayload = buildReportBuilderSavedReportPayloadFromBuilderState(savedReportPayload, {
        container,
        config,
        state,
        savedAt,
        semanticSummary,
        semanticModel,
        semanticRuntimeDiagnostics,
    });
    if (!rebuiltSavedReportPayload) {
        return null;
    }
    return buildReportBuilderGetReportDocumentResponse(rebuiltSavedReportPayload, {
        documentVersion,
        savedAt,
    });
}

export function buildReportBuilderSelectedGetReportDocumentResponse(listResponse = null, savedReportPayload = null, {
    request = null,
    savedAt = Date.now(),
} = {}) {
    const targetReportId = normalizeString(request?.reportRef?.reportId);
    if (!targetReportId) {
        return null;
    }
    const entry = resolveReportBuilderListReportDocumentsResponseEntry(listResponse, {
        selectedEntryKey: request?.listEntrySelectionKey || request?.selectionKey || "",
        selectedReportId: targetReportId,
        source: request?.source || null,
    });
    if (!entry) {
        return null;
    }
    const base = resolveReportBuilderSavedReportRecordBySource(savedReportPayload, entry?.source || entry)
        || resolveReportBuilderSavedReportRecordByReportId(savedReportPayload, targetReportId);
    if (!base) {
        return null;
    }
    const entryHasExplicitSource = isPlainObject(entry?.source);
    if (entryHasExplicitSource && (
        normalizeString(entry?.source?.kind) !== normalizeString(base?.source?.kind)
        || normalizeString(entry?.source?.payloadId) !== normalizeString(base?.source?.payloadId)
        || normalizeString(entry?.source?.sourceArtifactId) !== normalizeString(base?.source?.sourceArtifactId)
    )) {
        return null;
    }
    const normalizedVersion = resolveReportBuilderDocumentVersion(entry?.documentVersion);
    if (normalizedVersion < 1) {
        return null;
    }
    const response = buildGetReportDocumentResponse({
        reportRef: { reportId: base.reportId },
        version: normalizedVersion,
        savedAt: entry?.savedAt ?? (
            base?.savedReportPayload
                ? savedAt
                : (base?.savedAt ?? savedAt)
        ),
        document: base.document,
        ...(base.compileState ? { compileState: base.compileState } : {}),
        source: base.source,
    });
    if (!response) {
        return null;
    }
    const alignedResponse = alignSelectedGetResponseTemplateIdentity(response, entry);
    const withSemanticBindingViewState = normalizeSemanticBindingViewState(entry?.semanticBindingViewState)
        || normalizeSemanticBindingViewState(base?.semanticBindingViewState)
        || normalizeSemanticBindingViewState(base?.savedReportPayload?.semanticBindingViewState)
        ? {
            ...alignedResponse,
            semanticBindingViewState: normalizeSemanticBindingViewState(entry?.semanticBindingViewState)
                || normalizeSemanticBindingViewState(base?.semanticBindingViewState)
                || normalizeSemanticBindingViewState(base?.savedReportPayload?.semanticBindingViewState),
        }
        : alignedResponse;
    const withShareableArtifactState = extractShareableArtifactState(entry)
        || extractShareableArtifactState(base?.savedReportPayload)
        ? {
            ...withSemanticBindingViewState,
            ...(extractShareableArtifactState(entry) || extractShareableArtifactState(base?.savedReportPayload) || {}),
        }
        : withSemanticBindingViewState;
    const withSavedViewOverlay = extractSavedViewOverlayArtifactState(entry)
        || extractSavedViewOverlayArtifactState(base)
        ? {
            ...withShareableArtifactState,
            savedViewOverlay: extractSavedViewOverlayArtifactState(entry)
                || extractSavedViewOverlayArtifactState(base),
        }
        : withShareableArtifactState;
    return hasReportSpecSemanticSummary(resolveSourceSemanticReportSpec(base))
        ? {
            ...withSavedViewOverlay,
            reportSpec: cloneValue(base.reportSpec),
        }
        : withSavedViewOverlay;
}

export function buildReportBuilderSelectedGetReportDocumentResponseFromSharedArtifact(listResponse = null, sharedArtifactRecords = null, {
    request = null,
    savedAt = Date.now(),
} = {}) {
    const targetReportId = normalizeString(request?.reportRef?.reportId);
    if (!targetReportId) {
        return null;
    }
    const entry = resolveReportBuilderListReportDocumentsResponseEntry(listResponse, {
        selectedEntryKey: request?.listEntrySelectionKey || request?.selectionKey || "",
        selectedReportId: targetReportId,
        source: request?.source || null,
    });
    if (!entry) {
        return null;
    }
    const base = resolveReportBuilderSavedReportRecordBySource(sharedArtifactRecords, entry?.source || entry)
        || resolveReportBuilderSavedReportRecordByReportId(sharedArtifactRecords, targetReportId);
    const sourceKind = normalizeString(base?.source?.kind);
    if (
        !base
        || (sourceKind !== "reportBuilder.savedView" && sourceKind !== "reportBuilder.publishedSnapshot")
    ) {
        return null;
    }
    const response = buildReportBuilderSelectedGetReportDocumentResponse(
        listResponse,
        [base],
        {
            request,
            savedAt,
        },
    );
    if (!response) {
        return null;
    }
    const artifactId = normalizeString(base?.artifactId || base?.id);
    return {
        ...response,
        ...(artifactId ? { artifactId } : {}),
        ...(normalizeString(base?.artifactKind || sourceKind) ? { artifactKind: normalizeString(base?.artifactKind || sourceKind) } : {}),
        ...(normalizeString(base?.artifactRef) ? { artifactRef: normalizeString(base.artifactRef) } : {}),
        ...(normalizeString(base?.lifecycle) ? { lifecycle: normalizeString(base.lifecycle) } : {}),
        ...(normalizeString(base?.ownerRef) ? { ownerRef: normalizeString(base.ownerRef) } : {}),
        ...(normalizeString(base?.policyRef) ? { policyRef: normalizeString(base.policyRef) } : {}),
        ...(normalizePositiveInteger(base?.shareableVersion) > 0 ? { shareableVersion: normalizePositiveInteger(base.shareableVersion) } : {}),
        ...(Array.isArray(base?.badges) ? { badges: cloneValue(base.badges) } : {}),
        ...(isPlainObject(base?.capabilities) ? { capabilities: cloneValue(base.capabilities) } : {}),
        ...(Array.isArray(base?.grants) ? { grants: cloneValue(base.grants) } : {}),
        ...(isPlainObject(base?.reportSpec) && !isPlainObject(response?.reportSpec)
            ? { reportSpec: cloneValue(base.reportSpec) }
            : {}),
    };
}

export function buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(listResponse = null, savedReportPayload = null, {
    request = null,
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
} = {}) {
    const targetReportId = normalizeString(request?.reportRef?.reportId);
    if (!targetReportId) {
        return null;
    }
    const entry = resolveReportBuilderListReportDocumentsResponseEntry(listResponse, {
        selectedEntryKey: request?.listEntrySelectionKey || request?.selectionKey || "",
        selectedReportId: targetReportId,
        source: request?.source || null,
    });
    if (!entry) {
        return null;
    }
    const normalizedVersion = resolveReportBuilderDocumentVersion(entry?.documentVersion);
    if (normalizedVersion < 1) {
        return null;
    }
    const response = buildReportBuilderGetReportDocumentResponseFromBuilderState(savedReportPayload, {
        container,
        config,
        state,
        savedAt: entry?.savedAt ?? savedAt,
        semanticSummary,
        semanticModel,
        semanticRuntimeDiagnostics,
        documentVersion: normalizedVersion,
    });
    if (!response || normalizeString(response?.reportRef?.reportId) !== targetReportId) {
        return null;
    }
    if (normalizeString(entry?.source?.kind) !== normalizeString(response?.source?.kind)
        || normalizeString(entry?.source?.payloadId) !== normalizeString(response?.source?.payloadId)
        || normalizeString(entry?.source?.sourceArtifactId) !== normalizeString(response?.source?.sourceArtifactId)) {
        return null;
    }
    return alignSelectedGetResponseTemplateIdentity(response, entry);
}

export function mergeReportBuilderGetReportDocumentResponseSharedArtifact(response = null, value = null) {
    if (!isPlainObject(response) || normalizeString(response?.kind) !== "getReportDocumentResponse") {
        return response;
    }
    const provenance = cloneSharedArtifactProvenance(value);
    if (!provenance) {
        return cloneValue(response);
    }
    const responseSourceIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(response?.source || response);
    const candidateSourceIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(value?.source || value);
    const sourceMatch = responseSourceIdentity
        && candidateSourceIdentity
        && matchesReportBuilderSavedPayloadSourceIdentity(responseSourceIdentity, candidateSourceIdentity);
    const reportMatch = normalizeString(response?.reportRef?.reportId || response?.document?.id)
        && normalizeString(response?.reportRef?.reportId || response?.document?.id)
            === normalizeString(value?.reportId || value?.reportRef?.reportId || value?.document?.id);
    if (!sourceMatch && !reportMatch) {
        return cloneValue(response);
    }
    const nextSource = normalizeReportBuilderSavedPayloadSourceIdentity(value?.source || value);
    const nextDocumentVersion = normalizePositiveInteger(value?.documentVersion);
    return {
        ...cloneValue(response),
        ...provenance,
        ...(nextSource ? { source: cloneValue(value?.source || nextSource) } : {}),
        ...(nextDocumentVersion > 0 ? { documentVersion: nextDocumentVersion } : {}),
    };
}

export function buildReportBuilderListReportDocumentsResponse(savedReportPayload = null, {
    documentVersion = 0,
    cursor = "",
    hasMore = false,
    localSavedPayloads = [],
    additionalEntries = [],
    savedAt = Date.now(),
} = {}) {
    const primaryRecord = normalizeReportBuilderSavedReportRecord(savedReportPayload, {
        documentVersion,
        savedAt,
    });
    const localRecords = normalizeReportBuilderSavedReportRecords(localSavedPayloads)
        .filter((record) => record.documentVersion > 0);
    const seenEntryKeys = new Set();
    const entries = [];
    [primaryRecord, ...localRecords].forEach((record) => {
        if (!record) {
            return;
        }
        const entry = buildListEntryFromSavedReportPayloadRecord(record);
        if (!entry) {
            return;
        }
        const entryKey = buildListEntryIdentityKey(entry) || normalizeString(entry?.reportRef?.reportId);
        if (!entryKey || seenEntryKeys.has(entryKey)) {
            return;
        }
        seenEntryKeys.add(entryKey);
        entries.push(entry);
    });
    (Array.isArray(additionalEntries) ? additionalEntries : []).forEach((entry) => {
        const reportId = normalizeString(entry?.reportRef?.reportId || entry?.document?.id);
        const entryKey = buildListEntryIdentityKey(entry) || reportId;
        if (!reportId || !entryKey || seenEntryKeys.has(entryKey)) {
            return;
        }
        seenEntryKeys.add(entryKey);
        entries.push(cloneValue(entry));
    });
    if (entries.length === 0) {
        return null;
    }
    return applyListEntrySemanticBindingViewState(buildListReportDocumentsResponse({
        entries,
        cursor,
        hasMore,
    }), entries);
}

export function buildReportBuilderListReportDocumentsResponseFromSavedRecords(records = [], {
    cursor = "",
    hasMore = false,
    additionalEntries = [],
} = {}) {
    const localRecords = normalizeReportBuilderSavedReportRecords(records)
        .filter((record) => record.documentVersion > 0);
    const seenEntryKeys = new Set();
    const entries = [];
    localRecords.forEach((record) => {
        const entry = buildListEntryFromSavedReportPayloadRecord(record);
        if (!entry) {
            return;
        }
        const entryKey = buildListEntryIdentityKey(entry) || normalizeString(entry?.reportRef?.reportId);
        if (!entryKey || seenEntryKeys.has(entryKey)) {
            return;
        }
        seenEntryKeys.add(entryKey);
        entries.push(entry);
    });
    (Array.isArray(additionalEntries) ? additionalEntries : []).forEach((entry) => {
        const reportId = normalizeString(entry?.reportRef?.reportId || entry?.document?.id);
        const entryKey = buildListEntryIdentityKey(entry) || reportId;
        if (!reportId || !entryKey || seenEntryKeys.has(entryKey)) {
            return;
        }
        seenEntryKeys.add(entryKey);
        entries.push(cloneValue(entry));
    });
    if (entries.length === 0) {
        return null;
    }
    return applyListEntrySemanticBindingViewState(buildListReportDocumentsResponse({
        entries,
        cursor,
        hasMore,
    }), entries);
}

export function buildReportBuilderListReportDocumentsResponseFromBuilderState(savedReportPayload = null, {
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
    documentVersion = 0,
    cursor = "",
    hasMore = false,
    localSavedPayloads = [],
    additionalEntries = [],
} = {}) {
    const rebuiltSavedReportPayload = buildReportBuilderSavedReportPayloadFromBuilderState(savedReportPayload, {
        container,
        config,
        state,
        savedAt,
        semanticSummary,
        semanticModel,
        semanticRuntimeDiagnostics,
    });
    if (!rebuiltSavedReportPayload) {
        return null;
    }
    return buildReportBuilderListReportDocumentsResponse(rebuiltSavedReportPayload, {
        documentVersion,
        cursor,
        hasMore,
        localSavedPayloads,
        additionalEntries,
        savedAt,
    });
}

function resolveTemplateIdentity(value = null, document = null) {
    return resolveReportBuilderTemplateIdentity(value, document);
}

function applyTemplateIdentityToDocument(document = null, templateIdentity = null) {
    if (!document || typeof document !== "object" || Array.isArray(document) || !templateIdentity) {
        return document;
    }
    return {
        ...cloneValue(document),
        ...(normalizeString(templateIdentity?.templateId) ? { templateId: normalizeString(templateIdentity.templateId) } : {}),
        ...(normalizeString(templateIdentity?.templateLabel) ? { templateLabel: normalizeString(templateIdentity.templateLabel) } : {}),
    };
}

function buildSelectedGetTemplateIdentityConflictDiagnostic(entryTemplateIdentity = null, localTemplateIdentity = null) {
    const conflict = buildReportBuilderTemplateIdentityConflict(entryTemplateIdentity, localTemplateIdentity, {
        primaryRole: "Selected catalog entry",
        secondaryRole: "local reopen artifact",
    });
    if (!conflict) {
        return null;
    }
    return {
        code: "selectedGetTemplateIdentityConflict",
        severity: "warning",
        path: "document.templateId",
        message: conflict.message,
        suggestedFix: "Refresh or replace the local reopen artifact so it matches the selected catalog entry metadata.",
    };
}

function appendCompileDiagnostic(compileState = null, diagnostic = null) {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
        return compileState && typeof compileState === "object" && !Array.isArray(compileState)
            ? cloneValue(compileState)
            : compileState;
    }
    const nextCompileState = compileState && typeof compileState === "object" && !Array.isArray(compileState)
        ? cloneValue(compileState)
        : { status: "clean" };
    const diagnostics = Array.isArray(nextCompileState.diagnostics)
        ? cloneValue(nextCompileState.diagnostics)
        : [];
    const diagnosticKey = [
        normalizeString(diagnostic?.code),
        normalizeString(diagnostic?.severity),
        normalizeString(diagnostic?.path),
        normalizeString(diagnostic?.message),
    ].join("::");
    const alreadyPresent = diagnostics.some((entry) => (
        [
            normalizeString(entry?.code),
            normalizeString(entry?.severity),
            normalizeString(entry?.path),
            normalizeString(entry?.message),
        ].join("::") === diagnosticKey
    ));
    if (!alreadyPresent) {
        diagnostics.push(cloneValue(diagnostic));
    }
    return {
        ...nextCompileState,
        ...(normalizeString(nextCompileState?.status) ? {} : { status: "clean" }),
        diagnostics,
    };
}

function alignSelectedGetResponseTemplateIdentity(response = null, entry = null) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
        return response;
    }
    const entryTemplateIdentity = resolveTemplateIdentity(entry, entry?.document || null);
    if (!entryTemplateIdentity) {
        return response;
    }
    const localTemplateIdentity = extractReportDocumentTemplateIdentity(response?.document || null);
    const missingLocalTemplateIdentity = !normalizeString(localTemplateIdentity?.templateId)
        && !normalizeString(localTemplateIdentity?.templateLabel);
    const conflictDiagnostic = hasReportBuilderTemplateIdentityConflict(entryTemplateIdentity, localTemplateIdentity)
        ? buildSelectedGetTemplateIdentityConflictDiagnostic(entryTemplateIdentity, localTemplateIdentity)
        : null;
    if (!missingLocalTemplateIdentity && !conflictDiagnostic) {
        return {
            ...cloneValue(response),
            ...entryTemplateIdentity,
        };
    }
    const nextDocument = applyTemplateIdentityToDocument(response?.document || null, entryTemplateIdentity);
    return {
        ...cloneValue(response),
        document: nextDocument,
        ...resolveTemplateIdentity(entryTemplateIdentity, nextDocument),
        ...(conflictDiagnostic
            ? { compileState: appendCompileDiagnostic(response?.compileState || null, conflictDiagnostic) }
            : (response?.compileState ? { compileState: cloneValue(response.compileState) } : {})),
    };
}

function resolveListEntryTemplateIdentity(entry = null, localSavedRecord = null) {
    return resolveTemplateIdentity(entry, entry?.document || null)
        || resolveTemplateIdentity(localSavedRecord, localSavedRecord?.document || null)
        || null;
}

function buildListEntryTemplateConflictState(entry = null, localSavedRecord = null) {
    if (!localSavedRecord) {
        return null;
    }
    const entryTemplateIdentity = resolveTemplateIdentity(entry, entry?.document || null);
    const localTemplateIdentity = resolveTemplateIdentity(localSavedRecord, localSavedRecord?.document || null);
    const conflict = buildReportBuilderTemplateIdentityConflict(entryTemplateIdentity, localTemplateIdentity, {
        primaryRole: "Catalog entry",
        secondaryRole: "local backing report file",
    });
    if (!conflict) {
        return null;
    }
    return {
        templateConflict: true,
        templateConflictLabel: conflict.label,
        templateConflictMessage: conflict.message,
    };
}

export function buildReportBuilderGetReportDocumentResponseSummary(response = null, {
    localSavedPayloads = [],
} = {}) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
        return null;
    }
    const responseContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: response?.reportSpec || null,
        document: response?.document || null,
        title: response?.document?.title || response?.reportRef?.reportId || "",
    });
    const templateIdentity = extractReportDocumentTemplateIdentity(responseContext?.document || null);
    const effectiveSemanticBindingViewState = normalizeSemanticBindingViewState(response?.semanticBindingViewState)
        || buildReportBuilderSemanticBindingViewState({
            semanticSummary: responseContext?.semanticSummary || null,
            binding: responseContext?.binding || null,
        });
    const scopeSummary = buildReportDocumentResponseScopeSummary(
        responseContext?.scope ? { scope: responseContext.scope } : null,
    );
    const authoredSummary = buildReportDocumentResponseAuthoredSummary(responseContext);
    const drillSummary = buildReportDocumentResponseDrillSummary(responseContext);
    const subtitle = normalizeString(responseContext?.document?.subtitle);
    const description = normalizeString(responseContext?.document?.description);
    const templateConflictDiagnostic = resolveReportBuilderTemplateConflictDiagnostic(response?.compileState?.diagnostics || []);
    const shareableSummary = buildShareableArtifactSummary(response, {
        fallbackVersion: response?.documentVersion,
    });
    const savedViewOverlay = extractSavedViewOverlayArtifactState(response);
    const savedViewOverlaySummary = buildSavedViewOverlaySummary(response, {
        document: responseContext?.document || null,
        reportSpec: responseContext?.reportSpec || null,
    });
    const reopenSourceResolutionState = savedViewOverlay
        ? resolveReportBuilderSavedViewOverlayReopenSourceResolution(savedViewOverlay, localSavedPayloads)?.state
        : null;
    const artifactId = normalizeString(response?.artifactId || response?.id);
    return {
        title: normalizeString(responseContext?.document?.title || response?.reportRef?.reportId || "Report"),
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        kind: normalizeString(response?.kind),
        reportId: normalizeString(response?.reportRef?.reportId),
        documentVersion: Number(response?.documentVersion || 0) || 0,
        compileStatus: normalizeString(response?.compileState?.status),
        ...(artifactId ? { artifactId } : {}),
        ...(artifactId && normalizeString(response?.source?.sourceArtifactId) ? {
            sourceArtifactId: normalizeString(response.source.sourceArtifactId),
        } : {}),
        ...(artifactId && normalizeString(response?.lifecycle) ? { lifecycle: normalizeString(response.lifecycle) } : {}),
        ...(effectiveSemanticBindingViewState ? {
            semanticBindingTitle: effectiveSemanticBindingViewState.title,
            semanticBindingChips: effectiveSemanticBindingViewState.chips,
            ...(Array.isArray(effectiveSemanticBindingViewState.fieldGroups) && effectiveSemanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: effectiveSemanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(scopeSummary ? {
            scopeSummaryTitle: "Report Scope",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
        ...(authoredSummary ? {
            authoredBlockCount: authoredSummary.totalCount,
            authoredBlockSummaryText: authoredSummary.summary,
        } : {}),
        ...(drillSummary ? {
            drillHierarchyCount: drillSummary.hierarchyCount,
            detailTargetCount: drillSummary.detailTargetCount,
            drillSummaryText: drillSummary.summary,
        } : {}),
        ...(savedViewOverlaySummary ? {
            savedViewOverlayTitle: savedViewOverlaySummary.title,
            savedViewOverlayText: savedViewOverlaySummary.text,
            savedViewOverlayChips: savedViewOverlaySummary.chips,
            ...(Array.isArray(savedViewOverlaySummary.diagnostics) && savedViewOverlaySummary.diagnostics.length > 0
                ? { savedViewOverlayDiagnostics: savedViewOverlaySummary.diagnostics }
                : {}),
        } : {}),
        ...(reopenSourceResolutionState ? reopenSourceResolutionState : {}),
        ...(shareableSummary ? shareableSummary : {}),
        ...(templateConflictDiagnostic ? {
            templateConflict: true,
            templateConflictLabel: "template mismatch",
            templateConflictMessage: normalizeString(templateConflictDiagnostic?.message),
        } : {}),
        ...(templateIdentity ? templateIdentity : {}),
    };
}

export function buildReportBuilderListReportDocumentsEntrySummary(entry = null, {
    localSavedPayloads = [],
} = {}) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
    }
    const reportId = normalizeString(entry?.reportRef?.reportId);
    const title = normalizeString(entry?.title || reportId || "Report");
    if (!reportId || !title) {
        return null;
    }
    const subtitle = normalizeString(entry?.subtitle);
    const description = normalizeString(entry?.description);
    const {
        localSavedRecord,
        sourceMatchedLocalSavedRecord,
        semanticBindingViewState,
        scopeSummary,
        savedViewOverlaySummary,
        reopenSourceResolutionState,
    } = resolveListReportDocumentsEntrySemanticContext(entry, {
        localSavedPayloads,
    });
    const importedArtifactKind = normalizeString(localSavedRecord?.importedArtifactKind);
    const backingArtifactKindLabel = localSavedRecord?.exportRequest?.source?.artifactKind
        ? buildReportBuilderExportArtifactKindLabel(localSavedRecord.exportRequest.source.artifactKind)
        : buildReportBuilderExportArtifactKindLabel(importedArtifactKind);
    const backingSource = buildReportBuilderImportedArtifactSourceLabel(importedArtifactKind);
    const authoredSummary = buildListEntryAuthoredSummary(localSavedRecord);
    const drillSummary = buildListEntryDrillSummary(localSavedRecord);
    const templateIdentity = resolveListEntryTemplateIdentity(entry, localSavedRecord);
    const templateConflictState = buildListEntryTemplateConflictState(entry, localSavedRecord);
    const shareableSummaryFallbackSource = sourceMatchedLocalSavedRecord?.savedReportPayload
        || sourceMatchedLocalSavedRecord
        || localSavedRecord?.savedReportPayload
        || localSavedRecord
        || null;
    const shareableSummary = buildShareableArtifactSummary(entry, {
        fallbackVersion: entry?.documentVersion,
    }) || buildShareableArtifactSummary(shareableSummaryFallbackSource, {
        fallbackVersion: entry?.documentVersion
            || sourceMatchedLocalSavedRecord?.documentVersion
            || localSavedRecord?.documentVersion,
    });
    return {
        reportId,
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        documentVersion: Number(entry?.documentVersion || 0) || 0,
        compileStatus: normalizeString(entry?.compileState?.status),
        ...(localSavedRecord ? { reopenable: true } : {}),
        ...(localSavedRecord ? { backingState: localSavedRecord.exportable ? "export-ready" : "reopen-ready" } : {}),
        ...(backingSource ? { backingSource } : {}),
        ...(backingArtifactKindLabel ? { backingArtifactKindLabel } : {}),
        ...(localSavedRecord?.exportable ? { exportable: true } : {}),
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(scopeSummary ? {
            scopeSummaryTitle: "Report Scope",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
        ...(authoredSummary ? {
            authoredBlockCount: authoredSummary.totalCount,
            authoredBlockSummaryText: authoredSummary.summary,
        } : {}),
        ...(drillSummary ? {
            drillHierarchyCount: drillSummary.hierarchyCount,
            detailTargetCount: drillSummary.detailTargetCount,
            drillSummaryText: drillSummary.summary,
        } : {}),
        ...(savedViewOverlaySummary ? {
            savedViewOverlayTitle: savedViewOverlaySummary.title,
            savedViewOverlayText: savedViewOverlaySummary.text,
            savedViewOverlayChips: savedViewOverlaySummary.chips,
            ...(Array.isArray(savedViewOverlaySummary.diagnostics) && savedViewOverlaySummary.diagnostics.length > 0
                ? { savedViewOverlayDiagnostics: savedViewOverlaySummary.diagnostics }
                : {}),
        } : {}),
        ...(reopenSourceResolutionState ? reopenSourceResolutionState : {}),
        ...(shareableSummary ? shareableSummary : {}),
        ...(templateConflictState ? templateConflictState : {}),
        ...(templateIdentity ? templateIdentity : {}),
    };
}

export function buildReportBuilderListReportDocumentsEntryOptions(response = null, {
    localSavedPayloads = [],
} = {}) {
    const entries = Array.isArray(response?.entries) ? response.entries : [];
    return entries
        .map((entry) => {
            const summary = buildReportBuilderListReportDocumentsEntrySummary(entry, {
                localSavedPayloads,
            });
            if (!summary?.reportId) {
                return null;
            }
            return {
                reportId: summary.reportId,
                selectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(entry),
                title: summary.title,
                subtitle: summary.subtitle || "",
                description: summary.description || "",
                compileStatus: summary.compileStatus || "",
                backingState: summary.backingState || "",
                backingSource: summary.backingSource || "",
                backingArtifactKindLabel: summary.backingArtifactKindLabel || "",
            };
        })
        .filter(Boolean);
}

export function buildReportBuilderListReportDocumentsEntryOptionLabel(entry = null) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return "";
    }
    const title = normalizeString(entry?.title || entry?.reportId);
    if (!title) {
        return "";
    }
    const suffixes = [
        normalizeString(entry?.backingState),
        normalizeString(entry?.backingSource),
        normalizeString(entry?.backingArtifactKindLabel),
    ].filter(Boolean);
    const status = normalizeString(entry?.compileStatus);
    return `${title}${suffixes.length > 0 ? ` • ${suffixes.join(" • ")}` : ""}${status && status !== "clean" ? ` (${status})` : ""}`;
}

export function buildReportBuilderListReportDocumentsEntryMetaChips(entry = null) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
    }
    return [
        normalizeString(entry?.templateLabel),
        normalizeString(entry?.templateConflictLabel),
        normalizeString(entry?.backingState),
        normalizeString(entry?.backingSource),
        normalizeString(entry?.backingArtifactKindLabel),
    ].filter(Boolean);
}

export function buildReportBuilderListReportDocumentsEntryNotice(entry = null) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
    }
    if (entry.templateConflict) {
        return {
            tone: "warning",
            message: normalizeString(entry?.templateConflictMessage) || "This imported catalog entry does not match the template identity of its local backing report file.",
        };
    }
    if (!entry.reopenable) {
        return {
            tone: "warning",
            message: "This imported catalog entry can prepare a get request and reopen diagnostic, but it cannot expand into a local reopen bundle until a matching local reopen artifact is available.",
        };
    }
    if (entry.reopenable && !entry.exportable) {
        return {
            tone: "info",
            message: "This imported catalog entry is backed by a local reopen artifact, but no local export-ready artifact is available yet.",
        };
    }
    return null;
}

export function buildReportBuilderListReportDocumentsResponseSummary(response = null) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
        return null;
    }
    return {
        kind: normalizeString(response?.kind),
        entryCount: Array.isArray(response?.entries) ? response.entries.length : 0,
        cursor: normalizeString(response?.cursor),
        hasMore: response?.hasMore === true,
    };
}

export function buildReportBuilderReportDocumentReadResponseInspectorState(payload = null, {
    selectedReportId = "",
    selectedEntryKey = "",
    localSavedPayloads = [],
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }
    const content = serializeReportBuilderReportDocumentReadResponse(payload);
    if (!content) {
        return null;
    }
    if (normalizeString(payload?.kind) === "getReportDocumentResponse") {
        const summary = buildReportBuilderGetReportDocumentResponseSummary(payload, {
            localSavedPayloads,
        });
        return summary ? {
            ...summary,
            ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
            ...(summary.description ? { headerDescription: summary.description } : {}),
            ...(Array.isArray(summary.semanticBindingFieldGroups) && summary.semanticBindingFieldGroups.length > 0
                ? { semanticBindingFieldGroups: summary.semanticBindingFieldGroups }
                : {}),
            content,
        } : null;
    }
    if (normalizeString(payload?.kind) === "listReportDocumentsResponse") {
        const summary = buildReportBuilderListReportDocumentsResponseSummary(payload);
        if (!summary) {
            return null;
        }
        const rawSelectedEntry = resolveReportBuilderListReportDocumentsResponseEntry(payload, {
            selectedEntryKey,
            selectedReportId,
            fallbackToFirst: true,
        });
        const selectedArtifactId = normalizeString(rawSelectedEntry?.artifactId);
        const selectedEntry = buildReportBuilderListReportDocumentsEntrySummary(
            rawSelectedEntry,
            { localSavedPayloads },
        );
        const selectedEntryFieldGroups = Array.isArray(selectedEntry?.semanticBindingFieldGroups) && selectedEntry.semanticBindingFieldGroups.length > 0
            ? selectedEntry.semanticBindingFieldGroups
            : resolveListReportDocumentsEntrySemanticContext(rawSelectedEntry || null, {
                localSavedPayloads,
            })?.semanticBindingViewState?.fieldGroups;
        return {
            ...summary,
            ...(selectedEntry ? { selectedEntry } : {}),
            ...(selectedEntry?.subtitle ? { headerSubtitle: selectedEntry.subtitle } : {}),
            ...(selectedEntry?.description ? { headerDescription: selectedEntry.description } : {}),
            ...(selectedEntry?.templateId ? { templateId: selectedEntry.templateId } : {}),
            ...(selectedEntry?.templateLabel ? { templateLabel: selectedEntry.templateLabel } : {}),
            ...(selectedEntry?.templateConflict ? {
                templateConflict: true,
                templateConflictLabel: normalizeString(selectedEntry?.templateConflictLabel),
                templateConflictMessage: normalizeString(selectedEntry?.templateConflictMessage),
            } : {}),
            ...(selectedEntry?.semanticBindingTitle ? { semanticBindingTitle: selectedEntry.semanticBindingTitle } : {}),
            ...(Array.isArray(selectedEntry?.semanticBindingChips) ? { semanticBindingChips: selectedEntry.semanticBindingChips } : {}),
            ...(selectedEntry?.scopeSummaryTitle ? { scopeSummaryTitle: selectedEntry.scopeSummaryTitle } : {}),
            ...(selectedEntry?.scopeSummaryText ? { scopeSummaryText: selectedEntry.scopeSummaryText } : {}),
            ...(Array.isArray(selectedEntry?.scopeSummaryItems) ? { scopeSummaryItems: selectedEntry.scopeSummaryItems } : {}),
            ...(selectedArtifactId ? { artifactId: selectedArtifactId } : {}),
            ...(selectedArtifactId && normalizeString(rawSelectedEntry?.source?.sourceArtifactId) ? {
                sourceArtifactId: normalizeString(rawSelectedEntry.source.sourceArtifactId),
            } : {}),
            ...(selectedArtifactId && normalizeString(rawSelectedEntry?.artifactRef || selectedEntry?.artifactRef) ? {
                artifactRef: normalizeString(rawSelectedEntry?.artifactRef || selectedEntry?.artifactRef),
            } : {}),
            ...(selectedArtifactId && normalizeString(rawSelectedEntry?.lifecycle || selectedEntry?.lifecycle) ? {
                lifecycle: normalizeString(rawSelectedEntry?.lifecycle || selectedEntry?.lifecycle),
            } : {}),
            ...(Array.isArray(selectedEntryFieldGroups) && selectedEntryFieldGroups.length > 0
                ? { semanticBindingFieldGroups: selectedEntryFieldGroups }
                : {}),
            content,
        };
    }
    return {
        kind: normalizeString(payload?.kind),
        content,
    };
}

export function serializeReportBuilderReportDocumentReadResponse(payload = null, {
    pretty = true,
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
}

export function buildReportBuilderReportDocumentReadResponseDownload(payload = null, {
    fallbackName = "report-document-read-response",
    selectedReportId = "",
    selectedEntryKey = "",
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }
    const content = serializeReportBuilderReportDocumentReadResponse(payload);
    if (!content) {
        return null;
    }
    const title = normalizeString(payload?.document?.title);
    const hasExplicitListSelection = !!(normalizeString(selectedEntryKey) || normalizeString(selectedReportId));
    const selectedEntry = normalizeString(payload?.kind) === "listReportDocumentsResponse"
        && hasExplicitListSelection
        ? resolveReportBuilderListReportDocumentsResponseEntry(payload, {
            selectedEntryKey,
            selectedReportId,
            fallbackToFirst: true,
        })
        : null;
    const selectedTitle = normalizeString(selectedEntry?.title);
    const reportId = normalizeString(payload?.reportRef?.reportId || payload?.entries?.[0]?.reportRef?.reportId || fallbackName);
    const normalizedName = sanitizeFilenameSegment(selectedTitle || title || reportId || fallbackName) || fallbackName;
    return {
        filename: `${normalizedName}-${normalizeString(payload?.kind || fallbackName)}.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}
