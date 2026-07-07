import {
    matchesReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedReportRecords,
    resolveReportBuilderSavedReportRecordBySource,
    normalizeReportBuilderSavedReportRecord,
} from "./reportBuilderSavedReportRecords.js";
import {
    normalizeReportBuilderSemanticBindingViewState,
    resolvePreferredReportBuilderSemanticBindingViewState,
} from "./reportBuilderSemanticBindingViewPreference.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import {
    resolvePreferredScopeParams,
    resolveNormalizedReportSpecDocumentContext,
    resolveNormalizedSavedReportRecordContext,
    resolveSavedReportRecordContextBySource,
} from "./reportBuilderSavedRecordMetadataContext.js";
import {
    buildReportBuilderTemplateConflictState,
    resolveReportBuilderSourceSessionTemplateIdentity,
    resolveReportBuilderTemplateIdentity,
} from "./reportBuilderTemplateIdentity.js";
import { buildShareableArtifactSummary } from "../../reporting/sharing/shareableArtifactModel.js";
import { buildSavedViewOverlaySummary } from "../../reporting/views/savedViewOverlayModel.js";
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

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveCompanionSavedReportPayloadBySource(source = null, localSavedPayloads = []) {
    const targetIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(source);
    if (!targetIdentity) {
        return null;
    }
    for (const candidate of (Array.isArray(localSavedPayloads) ? localSavedPayloads : [])) {
        const savedReportPayload = isPlainObject(candidate?.savedReportPayload)
            ? candidate.savedReportPayload
            : (normalizeString(candidate?.kind) === "reportBuilder.savedReportPayload" && isPlainObject(candidate) ? candidate : null);
        if (!savedReportPayload) {
            continue;
        }
        if (matchesReportBuilderSavedPayloadSourceIdentity(
            targetIdentity,
            normalizeReportBuilderSavedPayloadSourceIdentity(savedReportPayload),
        )) {
            return savedReportPayload;
        }
    }
    return null;
}

function resolveCompanionImportedArtifactBySource(source = null, localSavedPayloads = []) {
    const targetArtifactKind = normalizeString(source?.artifactKind || source?.kind);
    const targetSourceArtifactId = normalizeString(source?.sourceArtifactId);
    const targetReportId = normalizeString(source?.reportId);
    if (!targetArtifactKind || !targetSourceArtifactId || !targetReportId) {
        return null;
    }
    for (const candidate of (Array.isArray(localSavedPayloads) ? localSavedPayloads : [])) {
        const candidateSource = isPlainObject(candidate?.source)
            ? candidate.source
            : (isPlainObject(candidate?.savedReportPayload?.source) ? candidate.savedReportPayload.source : null);
        const candidateArtifactKind = normalizeString(candidate?.importedArtifactKind || candidateSource?.kind);
        const candidateSourceArtifactId = normalizeString(candidateSource?.sourceArtifactId || candidate?.sourceArtifactId);
        const candidateReportId = normalizeString(
            candidateSource?.reportId
            || candidate?.reportId
            || candidate?.document?.id
            || candidate?.savedReportPayload?.reportDocument?.id,
        );
        if (
            candidateArtifactKind === targetArtifactKind
            && candidateSourceArtifactId === targetSourceArtifactId
            && candidateReportId === targetReportId
        ) {
            return candidate;
        }
    }
    return null;
}

function resolveExpectedArtifactKind(source = null) {
    const explicitArtifactKind = normalizeString(source?.artifactKind || source?.kind);
    if (explicitArtifactKind) {
        return explicitArtifactKind;
    }
    const artifactRef = normalizeString(source?.artifactRef);
    if (artifactRef.startsWith("reportBuilder.savedView://")) {
        return "reportBuilder.savedView";
    }
    if (artifactRef.startsWith("reportBuilder.publishedSnapshot://")) {
        return "reportBuilder.publishedSnapshot";
    }
    if (artifactRef.startsWith("reportBuilder.savedReportPayload://")) {
        return "reportBuilder.savedReportPayload";
    }
    const from = normalizeString(source?.from);
    if (from === "savedView") {
        return "reportBuilder.savedView";
    }
    if (from === "publishedSnapshot") {
        return "reportBuilder.publishedSnapshot";
    }
    if (from === "savedPayload") {
        return "reportBuilder.savedReportPayload";
    }
    return "";
}

function resolveUniqueSavedReportRecordByReportId(records = [], reportId = "", artifactKind = "") {
    const normalizedReportId = normalizeString(reportId);
    const normalizedArtifactKind = normalizeString(artifactKind);
    if (!normalizedReportId) {
        return null;
    }
    const matches = normalizeReportBuilderSavedReportRecords(records)
        .filter((record) => normalizeString(record?.reportId) === normalizedReportId)
        .filter((record) => !normalizedArtifactKind || (
            normalizeString(record?.source?.kind) === normalizedArtifactKind
            || normalizeString(record?.importedArtifactKind) === normalizedArtifactKind
        ));
    return matches.length === 1 ? matches[0] : null;
}

function resolveExportRequestTemplateConflictState(companionRecord = null, companionSavedReportPayload = null) {
    const embeddedDocument = companionRecord?.document || companionSavedReportPayload?.reportDocument || null;
    const importedArtifactConflict = buildReportBuilderTemplateConflictState(
        resolveReportBuilderTemplateIdentity(companionRecord, null),
        resolveReportBuilderTemplateIdentity(null, embeddedDocument),
        {
            primaryRole: "Imported artifact",
            secondaryRole: "embedded report document",
        },
    );
    if (importedArtifactConflict) {
        return importedArtifactConflict;
    }
    return buildReportBuilderTemplateConflictState(
        resolveReportBuilderTemplateIdentity(
            companionRecord || companionSavedReportPayload,
            embeddedDocument,
        ),
        resolveReportBuilderSourceSessionTemplateIdentity(companionSavedReportPayload?.sourceSession || null),
        {
            primaryRole: "Saved report file",
            secondaryRole: "source-session seed",
        },
    );
}

function resolveExportRequestSemanticContext(request = null, {
    localSavedPayloads = [],
} = {}) {
    const requestReportSpec = isPlainObject(request?.reportSpec)
        ? request.reportSpec
        : null;
    const requestedIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(request?.source || request);
    const uniqueCompanionRecord = requestedIdentity
        && !normalizeString(requestedIdentity?.payloadId)
        && !normalizeString(requestedIdentity?.sourceArtifactId)
            ? resolveUniqueSavedReportRecordByReportId(
                localSavedPayloads,
                request?.source?.reportId || request?.reportDocument?.id || "",
                resolveExpectedArtifactKind(request?.source || null),
            )
            : null;
    const companionRecord = resolveReportBuilderSavedReportRecordBySource(
        localSavedPayloads,
        request?.source || request,
    ) || uniqueCompanionRecord;
    const companionContext = resolveSavedReportRecordContextBySource(
        request?.source || request,
        localSavedPayloads,
    ) || (uniqueCompanionRecord ? resolveNormalizedSavedReportRecordContext(uniqueCompanionRecord) : null);
    const companionImportedArtifact = resolveCompanionImportedArtifactBySource(
        request?.source || request,
        localSavedPayloads,
    );
    const companionSavedReportPayload = companionRecord?.savedReportPayload
        || resolveCompanionSavedReportPayloadBySource(request?.source || request, localSavedPayloads);
    const metadataContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: requestReportSpec,
        document: isPlainObject(request?.reportDocument)
            ? request.reportDocument
            : (companionContext?.document || null),
        title: normalizeString(request?.source?.title || requestReportSpec?.title || companionContext?.title || "Report"),
    });
    const semanticBindingViewState = resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [metadataContext, companionContext],
        candidates: [
            request?.semanticBindingViewState,
            companionRecord?.savedReportPayload?.semanticBindingViewState,
            companionSavedReportPayload?.semanticBindingViewState,
            companionImportedArtifact?.semanticBindingViewState,
        ],
    });
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(
        resolvePreferredScopeParams(
            metadataContext?.scopeParams,
            companionContext?.scopeParams,
        ),
    );
    const savedViewOverlaySummary = buildSavedViewOverlaySummary(
        companionRecord?.savedViewOverlay
            ? { kind: "reportBuilder.savedView", savedViewOverlay: companionRecord.savedViewOverlay }
            : companionImportedArtifact,
        {
            document: metadataContext?.document || companionContext?.document || companionImportedArtifact?.document || companionRecord?.document || companionSavedReportPayload?.reportDocument || null,
            reportSpec: requestReportSpec || companionContext?.reportSpec || companionImportedArtifact?.reportSpec || companionRecord?.reportSpec || companionSavedReportPayload?.reportSpec || null,
        },
    );
    const reopenSourceResolutionState = companionRecord?.savedViewOverlay
        ? resolveReportBuilderSavedViewOverlayReopenSourceResolution(
            companionRecord.savedViewOverlay,
            localSavedPayloads,
        )?.state
        : null;
    return {
        title: normalizeString(metadataContext?.title || request?.source?.title || requestReportSpec?.title || companionContext?.title || "Report") || "Report",
        companionRecord,
        companionImportedArtifact,
        companionSavedReportPayload,
        semanticBindingViewState,
        scopeSummary,
        savedViewOverlaySummary,
        reopenSourceResolutionState,
        templateIdentity: resolveReportBuilderTemplateIdentity(
            companionRecord || companionImportedArtifact || companionSavedReportPayload,
            companionRecord?.document || companionImportedArtifact?.document || companionSavedReportPayload?.reportDocument || null,
        ),
        templateConflictState: resolveExportRequestTemplateConflictState(
            companionRecord || companionImportedArtifact,
            companionSavedReportPayload,
        ),
    };
}

export function buildReportBuilderExportArtifactKindLabel(artifactKind = "") {
    const normalized = normalizeString(artifactKind);
    switch (normalized) {
        case "reportBuilder.savedReportPayload":
            return "report-file artifact";
        case "reportBuilder.explorationArtifact":
            return "draft-snapshot artifact";
        case "dashboard.reportBuilder":
            return "draft builder";
        case "getReportDocumentResponse":
            return "reopen-bundle artifact";
        case "createReportDocumentPayload":
            return "create-request artifact";
        case "updateReportDocumentPayload":
            return "update-request artifact";
        case "reportBuilder.savedReportRecord":
            return "report-record artifact";
        case "reportBuilder.savedView":
            return "saved-view artifact";
        case "reportBuilder.publishedSnapshot":
            return "published-snapshot artifact";
        case "reportDocument":
            return "report-document artifact";
        default:
            return normalized;
    }
}

export function resolveReportBuilderExportHandler(builderContext = {}) {
    const candidate = builderContext?.handlers?.reportExport || null;
    const supportedMethods = [
        "submitRequest",
        "getStatus",
        "getArtifact",
        "listJobs",
        "listArtifacts",
    ];
    return supportedMethods.some((method) => typeof candidate?.[method] === "function")
        ? candidate
        : null;
}

export function resolveReportBuilderReportStoreHandler(builderContext = {}) {
    const candidate = builderContext?.handlers?.reportStore || null;
    const supportedMethods = [
        "saveReport",
        "getReport",
        "listReports",
        "updateReport",
    ];
    return supportedMethods.some((method) => typeof candidate?.[method] === "function")
        ? candidate
        : null;
}

export function resolveReportBuilderSavedPayloadExportRequest(savedReportPayload = null, localSavedPayloads = []) {
    const directRecord = normalizeReportBuilderSavedReportRecord(savedReportPayload);
    if (directRecord?.exportRequest) {
        return cloneValue(directRecord.exportRequest);
    }
    const requestedIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(savedReportPayload?.source || savedReportPayload);
    const matchingRecord = resolveReportBuilderSavedReportRecordBySource(localSavedPayloads, savedReportPayload)
        || (
            requestedIdentity
            && !normalizeString(requestedIdentity?.payloadId)
            && !normalizeString(requestedIdentity?.sourceArtifactId)
                ? resolveUniqueSavedReportRecordByReportId(
                    localSavedPayloads,
                    savedReportPayload?.reportRef?.reportId || savedReportPayload?.reportDocument?.id || savedReportPayload?.document?.id || "",
                    resolveExpectedArtifactKind(savedReportPayload?.source || savedReportPayload || null),
                )
                : null
        );
    return matchingRecord?.exportRequest ? cloneValue(matchingRecord.exportRequest) : null;
}

export function resolveReportBuilderSavedPayloadExportRequestBySource(source = null, localSavedPayloads = []) {
    const requestedIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(source);
    const matchingRecord = resolveReportBuilderSavedReportRecordBySource(localSavedPayloads, source)
        || (
            requestedIdentity
            && !normalizeString(requestedIdentity?.payloadId)
            && !normalizeString(requestedIdentity?.sourceArtifactId)
                ? resolveUniqueSavedReportRecordByReportId(
                    localSavedPayloads,
                    source?.reportId || source?.reportRef?.reportId || source?.document?.id || "",
                    resolveExpectedArtifactKind(source),
                )
                : null
        );
    return matchingRecord?.exportRequest ? cloneValue(matchingRecord.exportRequest) : null;
}

export function buildReportBuilderExportRequestSummary(request = null, {
    localSavedPayloads = [],
} = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return null;
    }
    const {
        title,
        companionRecord,
        companionImportedArtifact,
        companionSavedReportPayload,
        semanticBindingViewState,
        scopeSummary,
        savedViewOverlaySummary,
        reopenSourceResolutionState,
        templateIdentity,
        templateConflictState,
    } = resolveExportRequestSemanticContext(request, {
        localSavedPayloads,
    });
    const resolvedTemplateIdentity = templateIdentity
        || resolveReportBuilderTemplateIdentity(
            companionRecord || companionImportedArtifact || companionSavedReportPayload,
            companionRecord?.document || companionImportedArtifact?.document || companionSavedReportPayload?.reportDocument || null,
        );
    const resolvedTemplateConflictState = templateConflictState
        || resolveExportRequestTemplateConflictState(
            companionRecord || companionImportedArtifact,
            companionSavedReportPayload,
        );
    const format = normalizeString(request?.target?.format).toUpperCase();
    const artifactRef = normalizeString(request?.source?.artifactRef);
    const from = normalizeString(request?.source?.from);
    const artifactKind = resolveExpectedArtifactKind(request?.source || null);
    if (!format || !title || !artifactRef || !from) {
        return null;
    }
    const shareableSummary = buildShareableArtifactSummary(request, {
        fallbackArtifactRef: artifactRef,
        fallbackVersion: request?.source?.documentVersion,
    }) || buildShareableArtifactSummary(companionRecord, {
        fallbackArtifactRef: artifactRef,
        fallbackVersion: request?.source?.documentVersion,
    }) || buildShareableArtifactSummary(companionImportedArtifact, {
        fallbackArtifactRef: artifactRef,
        fallbackVersion: request?.source?.documentVersion,
    }) || buildShareableArtifactSummary(companionSavedReportPayload, {
        fallbackArtifactRef: artifactRef,
        fallbackVersion: request?.source?.documentVersion,
    });
    return {
        title,
        format,
        from,
        artifactRef,
        artifactKind,
        artifactKindLabel: buildReportBuilderExportArtifactKindLabel(artifactKind),
        payloadId: normalizeString(request?.source?.payloadId),
        reportId: normalizeString(request?.source?.reportId),
        documentVersion: Number(request?.source?.documentVersion || 0) || 0,
        hasReportPrint: !!request?.reportPrint,
        ...(resolvedTemplateConflictState ? resolvedTemplateConflictState : {}),
        ...(resolvedTemplateIdentity ? resolvedTemplateIdentity : {}),
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: "Filters",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
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
    };
}

export function serializeReportBuilderExportRequest(request = null, {
    pretty = true,
} = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(request)
        : JSON.stringify(request, null, 2);
}

export function buildReportBuilderExportRequestInspectorState(request = null, {
    localSavedPayloads = [],
} = {}) {
    const summary = buildReportBuilderExportRequestSummary(request, {
        localSavedPayloads,
    });
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(Array.isArray(summary.semanticBindingFieldGroups) && summary.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: summary.semanticBindingFieldGroups }
            : {}),
        content: serializeReportBuilderExportRequest(request),
    };
}

export function buildReportBuilderExportRequestDownload(request = null, {
    localSavedPayloads = [],
} = {}) {
    const summary = buildReportBuilderExportRequestSummary(request, {
        localSavedPayloads,
    });
    if (!summary) {
        return null;
    }
    const baseTitle = sanitizeFilenameSegment(summary.title || "report");
    const from = sanitizeFilenameSegment(summary.from || "export");
    const format = sanitizeFilenameSegment(String(summary.format || "").toLowerCase() || "export");
    return {
        filename: `${baseTitle}-${from}-${format}-export-request.json`,
        mimeType: "application/json;charset=utf-8",
        payload: serializeReportBuilderExportRequest(request),
    };
}
