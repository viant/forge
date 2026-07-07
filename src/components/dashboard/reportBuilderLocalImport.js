import {
    buildReportBuilderSavedReportPayload,
    buildReportBuilderSavedReportPayloadSummary,
} from "./reportBuilderSavedReportPayload.js";
import {
    buildReportBuilderExplorationArtifactSummary,
} from "./reportBuilderExplorationArtifact.js";
import {
    buildReportBuilderGetReportDocumentResponseSummary,
    buildReportBuilderListReportDocumentsResponseSummary,
    buildReportBuilderListReportDocumentsEntrySelectionKey,
} from "./reportBuilderReportDocumentReadResponse.js";
import { buildReportBuilderExportRequestSummary } from "./reportBuilderExportRequest.js";
import { buildReportBuilderCreateReportDocumentPayloadSummary } from "./reportBuilderCreateReportDocumentPayload.js";
import { buildReportBuilderUpdateReportDocumentPayloadSummary } from "./reportBuilderUpdateReportDocumentPayload.js";
import { buildReportBuilderGetReportDocumentRequestSummary } from "./reportBuilderGetReportDocumentRequest.js";
import { normalizeReportBuilderSavedReportRecord } from "./reportBuilderSavedReportRecords.js";
import { normalizeImportedLocalGetReportDocumentResponse } from "./reportBuilderImportedArtifactState.js";
import {
    resolveEmbeddedReportDocumentCompileState,
} from "./reportBuilderImportedDocumentMetadata.js";
import {
    resolveNormalizedReportSpecDocumentContext,
} from "./reportBuilderSavedRecordMetadataContext.js";
import { buildReportBuilderRuntimePreview } from "./reportBuilderRuntimePreview.js";
import { buildGetReportDocumentResponse } from "../../reporting/reportDocumentStore.js";
import {
    buildPublishedSnapshotReportExportRequest,
    buildSavedViewReportExportRequest,
} from "../../reporting/reportExportRequestModel.js";
import { validateReportExportRequest, validateReportFill, validateReportPrint, validateReportSpec } from "../../reporting/schema/reportSchemas.js";
import {
    buildSavedViewOverlaySummary,
    extractSavedViewOverlayArtifactState,
} from "../../reporting/views/savedViewOverlayModel.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function stripJsonExtension(value = "") {
    return normalizeString(value).replace(/\.json$/i, "");
}

function normalizePositiveInteger(value = 0, fallback = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeTimestamp(value = 0, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function summarizeValidationFailure(validation = null, fallbackMessage = "The artifact failed validation.") {
    const firstError = Array.isArray(validation?.errors) ? validation.errors[0] : null;
    if (!firstError) {
        return fallbackMessage;
    }
    const path = normalizeString(firstError?.path);
    const message = normalizeString(firstError?.message) || fallbackMessage;
    return path ? `${fallbackMessage} ${message} (${path})` : `${fallbackMessage} ${message}`;
}

function buildImportFailure(message = "", code = "invalidImport", {
    fileName = "",
} = {}) {
    return {
        valid: false,
        code,
        fileName: normalizeString(fileName),
        message: normalizeString(message) || "Could not import this local report file.",
    };
}

function buildImportedLocalReopenSource(payload = null) {
    const kind = normalizeString(payload?.kind);
    const source = {
        kind: kind || "localImport",
    };
    const payloadId = normalizeString(payload?.payloadId);
    const sourceArtifactId = normalizeString(payload?.sourceArtifactId);
    if (payloadId) {
        source.payloadId = payloadId;
    }
    if (sourceArtifactId) {
        source.sourceArtifactId = sourceArtifactId;
    }
    return source;
}

function buildImportedLocalNormalizedGetReportDocumentResponse({
    importedArtifactKind = "",
    reportSpec = null,
    document = null,
    reportRef = null,
    documentVersion = 0,
    savedAt = 0,
    compileState = null,
    source = null,
    title = "",
    savedViewOverlay = null,
    sourceSession = null,
} = {}) {
    const context = resolveNormalizedReportSpecDocumentContext({
        reportSpec,
        document,
        title: normalizeString(title || document?.title || reportRef?.reportId || ""),
    });
    const normalizedDocument = isPlainObject(context?.document)
        ? cloneValue(context.document)
        : null;
    const normalizedReportSpec = isPlainObject(context?.reportSpec)
        ? cloneValue(context.reportSpec)
        : null;
    const rawResponse = buildGetReportDocumentResponse({
        reportRef,
        version: normalizePositiveInteger(documentVersion || normalizedDocument?.version, 0),
        document: normalizedDocument,
        savedAt: normalizeTimestamp(savedAt, 0),
        ...(isPlainObject(compileState) ? { compileState: cloneValue(compileState) } : {}),
        ...(isPlainObject(source) ? { source: cloneValue(source) } : {}),
    });
    if (!rawResponse) {
        return null;
    }
    const normalizedResponse = normalizeImportedLocalGetReportDocumentResponse({
        ...rawResponse,
        ...(normalizedReportSpec ? { reportSpec: normalizedReportSpec } : {}),
        ...(savedViewOverlay ? { savedViewOverlay: cloneValue(savedViewOverlay) } : {}),
    });
    return normalizedResponse
        ? {
            ...normalizedResponse,
            ...(sourceSession && typeof sourceSession === "object" && !Array.isArray(sourceSession)
                ? { sourceSession: cloneValue(sourceSession) }
                : {}),
            ...(normalizeString(importedArtifactKind) ? { importedArtifactKind: normalizeString(importedArtifactKind) } : {}),
        }
        : null;
}

function buildImportedLocalGetReportDocumentResponse(payload = null) {
    if (!isPlainObject(payload)) {
        return null;
    }
    const kind = normalizeString(payload?.kind);
    let document = null;
    let reportSpec = null;
    let reportRef = null;
    let documentVersion = 0;
    let savedAt = 0;
    let compileState = null;
    let source = null;

    if (kind === "reportBuilder.savedReportPayload") {
        document = isPlainObject(payload?.reportDocument)
            ? cloneValue(payload.reportDocument)
            : (isPlainObject(payload?.document) ? cloneValue(payload.document) : null);
        reportSpec = isPlainObject(payload?.reportSpec) ? cloneValue(payload.reportSpec) : null;
        reportRef = normalizeString(document?.id) ? { reportId: normalizeString(document.id) } : null;
        documentVersion = normalizePositiveInteger(document?.version, 0);
        savedAt = normalizeTimestamp(payload?.savedAt, 0);
        compileState = isPlainObject(payload?.compileState) ? cloneValue(payload.compileState) : null;
        source = buildImportedLocalReopenSource(payload);
    } else if (kind === "createReportDocumentPayload" || kind === "updateReportDocumentPayload") {
        document = isPlainObject(payload?.document) ? cloneValue(payload.document) : null;
        reportSpec = isPlainObject(payload?.reportSpec) ? cloneValue(payload.reportSpec) : null;
        reportRef = normalizeString(payload?.reportRef?.reportId)
            ? { reportId: normalizeString(payload.reportRef.reportId) }
            : (normalizeString(document?.id) ? { reportId: normalizeString(document.id) } : null);
        documentVersion = normalizePositiveInteger(document?.version, 0);
        savedAt = normalizeTimestamp(payload?.updatedAt ?? payload?.createdAt, 0);
        compileState = isPlainObject(payload?.compileState) ? cloneValue(payload.compileState) : null;
        source = isPlainObject(payload?.source) ? cloneValue(payload.source) : buildImportedLocalReopenSource(payload);
    } else {
        return null;
    }

    if (
        !reportRef
        || !document
        || normalizeString(document?.kind) !== "reportDocument"
        || documentVersion < 1
    ) {
        return null;
    }
    return buildImportedLocalNormalizedGetReportDocumentResponse({
        importedArtifactKind: kind,
        reportSpec,
        document,
        reportRef,
        documentVersion,
        savedAt,
        compileState,
        source,
        title: document?.title || reportRef?.reportId || "",
        sourceSession: isPlainObject(payload?.sourceSession) ? cloneValue(payload.sourceSession) : null,
    });
}

function resolveImportedSharedArtifactIdentity(payload = null) {
    const kind = normalizeString(payload?.kind);
    if (kind === "reportBuilder.savedView") {
        return normalizeString(payload?.viewId || payload?.savedViewId || payload?.id);
    }
    if (kind === "reportBuilder.publishedSnapshot") {
        return normalizeString(payload?.snapshotId || payload?.publishedSnapshotId || payload?.id);
    }
    return "";
}

function buildImportedSharedArtifactSavedRecord(payload = null) {
    if (!isPlainObject(payload)) {
        return null;
    }
    const kind = normalizeString(payload?.kind);
    if (kind !== "reportBuilder.savedView" && kind !== "reportBuilder.publishedSnapshot") {
        return null;
    }
    const sourceArtifactId = resolveImportedSharedArtifactIdentity(payload);
    const payloadContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: payload?.reportSpec || null,
        document: payload?.document || payload?.reportDocument || null,
        title: payload?.title || payload?.reportId || payload?.reportRef?.reportId || "",
    });
    const document = isPlainObject(payloadContext?.document) ? cloneValue(payloadContext.document) : null;
    const reportSpec = isPlainObject(payloadContext?.reportSpec) ? cloneValue(payloadContext.reportSpec) : null;
    const reportFill = isPlainObject(payload?.reportFill) ? cloneValue(payload.reportFill) : null;
    const reportPrint = isPlainObject(payload?.reportPrint) ? cloneValue(payload.reportPrint) : null;
    const savedViewOverlay = kind === "reportBuilder.savedView"
        ? extractSavedViewOverlayArtifactState(payload)
        : null;
    const savedViewOverlaySummary = kind === "reportBuilder.savedView"
        ? buildSavedViewOverlaySummary(payload, {
            document,
            reportSpec,
        })
        : null;
    const reportId = normalizeString(payload?.reportId || payload?.reportRef?.reportId || document?.id);
    const documentVersion = normalizePositiveInteger(payload?.documentVersion || payload?.version || document?.version, 0);
    const savedAt = normalizeTimestamp(payload?.savedAt || payload?.updatedAt || payload?.createdAt, 0);
    const compileState = isPlainObject(payload?.compileState)
        ? cloneValue(payload.compileState)
        : resolveEmbeddedReportDocumentCompileState(document, reportSpec);
    const normalizedCompileState = Array.isArray(savedViewOverlaySummary?.diagnostics) && savedViewOverlaySummary.diagnostics.length > 0
        ? {
            ...(isPlainObject(compileState) ? cloneValue(compileState) : { status: "clean" }),
            status: normalizeString(compileState?.status) || "clean",
            diagnostics: [
                ...(Array.isArray(compileState?.diagnostics) ? cloneValue(compileState.diagnostics) : []),
                ...savedViewOverlaySummary.diagnostics,
            ],
        }
        : compileState;
    if (
        !sourceArtifactId
        || !document
        || normalizeString(document?.kind) !== "reportDocument"
        || !reportId
        || documentVersion < 1
    ) {
        return null;
    }
    const exportRequest = reportSpec
        && normalizeString(reportSpec?.kind) === "reportSpec"
        && reportFill
        && normalizeString(reportFill?.kind) === "reportFill"
        ? (
            kind === "reportBuilder.savedView"
                ? buildSavedViewReportExportRequest({
                    savedView: payload,
                    reportSpec,
                    reportFill,
                    reportPrint,
                    documentVersion,
                })
                : buildPublishedSnapshotReportExportRequest({
                    publishedSnapshot: payload,
                    reportSpec,
                    reportFill,
                    reportPrint,
                    documentVersion,
                })
        )
        : null;
    return normalizeReportBuilderSavedReportRecord({
        reportId,
        title: normalizeString(document?.title || payload?.title || reportId) || reportId,
        documentVersion,
        savedAt,
        document,
        ...(reportSpec ? { reportSpec } : {}),
        ...(normalizedCompileState ? { compileState: normalizedCompileState } : {}),
        source: {
            kind,
            reportId,
            sourceArtifactId,
        },
        ...(exportRequest ? { exportRequest } : {}),
        importedArtifactKind: kind,
        ...(savedViewOverlay ? { savedViewOverlay } : {}),
    });
}

export function parseReportBuilderLocalImport(rawContent = "", {
    fileName = "",
} = {}) {
    const normalizedFileName = normalizeString(fileName);
    const rawText = typeof rawContent === "string" ? rawContent : "";
    if (!rawText.trim()) {
        return buildImportFailure(
            normalizedFileName
                ? `Could not import ${normalizedFileName}. The selected file is empty.`
                : "Could not import this local report file. The selected file is empty.",
            "emptyFile",
            { fileName: normalizedFileName },
        );
    }
    let payload = null;
    try {
        payload = JSON.parse(rawText);
    } catch (error) {
        return buildImportFailure(
            normalizedFileName
                ? `Could not import ${normalizedFileName}. The file does not contain valid JSON.`
                : "Could not import this local report file. The file does not contain valid JSON.",
            "invalidJson",
            { fileName: normalizedFileName },
        );
    }
    if (!isPlainObject(payload)) {
        return buildImportFailure(
            normalizedFileName
                ? `Could not import ${normalizedFileName}. The file must contain a JSON object.`
                : "Could not import this local report file. The file must contain a JSON object.",
            "invalidShape",
            { fileName: normalizedFileName },
        );
    }
    const kind = normalizeString(payload?.kind);
    const normalizedSavedRecord = normalizeReportBuilderSavedReportRecord(payload);
    if ((kind === "reportBuilder.savedReportRecord" || (!kind && normalizedSavedRecord && isPlainObject(payload?.savedReportPayload)))) {
        const title = normalizeString(normalizedSavedRecord?.title || stripJsonExtension(normalizedFileName) || "Report");
        const getReportDocumentResponse = normalizedSavedRecord?.document && normalizedSavedRecord?.source
            ? buildImportedLocalNormalizedGetReportDocumentResponse({
                importedArtifactKind: "reportBuilder.savedReportRecord",
                reportSpec: normalizedSavedRecord.reportSpec || null,
                document: normalizedSavedRecord.document,
                reportRef: { reportId: normalizedSavedRecord.reportId },
                documentVersion: normalizePositiveInteger(normalizedSavedRecord.documentVersion, 1),
                savedAt: normalizeTimestamp(normalizedSavedRecord.savedAt, 0),
                compileState: normalizedSavedRecord.compileState || null,
                source: normalizedSavedRecord.source,
                title,
                savedViewOverlay: normalizedSavedRecord.savedViewOverlay || null,
            })
            : null;
        if (!normalizedSavedRecord || !getReportDocumentResponse) {
            return buildImportFailure(
                normalizedFileName
                    ? `Could not import ${normalizedFileName}. The report file is incomplete or unsupported.`
                    : "Could not import this report file. The artifact is incomplete or unsupported.",
                "invalidSavedReportRecord",
                { fileName: normalizedFileName },
            );
        }
        return {
            valid: true,
            kind: "reportBuilder.savedReportRecord",
            payload: cloneValue(payload),
            savedRecord: cloneValue(normalizedSavedRecord),
            fileName: normalizedFileName,
            title,
            documentVersion: Number(normalizedSavedRecord.documentVersion || 0) || 0,
            exportable: normalizedSavedRecord.exportable === true,
            getReportDocumentResponse,
            message: normalizedSavedRecord.exportable === true
                ? `Imported report file ${title}. Reopen and export are ready.`
                : `Imported report file ${title}. Reopen in builder is ready.`,
        };
    }
    switch (kind) {
        case "reportFill": {
            const reportFillValidation = validateReportFill(payload);
            if (!reportFillValidation.valid) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. ${summarizeValidationFailure(reportFillValidation, "The ReportFill failed validation.")}`
                        : `Could not import this ReportFill. ${summarizeValidationFailure(reportFillValidation, "The ReportFill failed validation.")}`,
                    "invalidReportFill",
                    { fileName: normalizedFileName },
                );
            }
            const title = normalizeString(payload?.title || stripJsonExtension(normalizedFileName) || "Report");
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                title,
                datasetCount: Array.isArray(payload?.datasets) ? payload.datasets.length : 0,
                blockCount: Array.isArray(payload?.blocks) ? payload.blocks.length : 0,
                rowCount: (Array.isArray(payload?.datasets) ? payload.datasets : [])
                    .reduce((total, dataset) => total + (Array.isArray(dataset?.rows) ? dataset.rows.length : 0), 0),
                diagnosticCount: Array.isArray(payload?.diagnostics) ? payload.diagnostics.length : 0,
                message: `Imported ReportFill ${title}. Inspect or download is ready.`,
            };
        }
        case "reportPrint": {
            const reportPrintValidation = validateReportPrint(payload);
            if (!reportPrintValidation.valid) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. ${summarizeValidationFailure(reportPrintValidation, "The ReportPrint failed validation.")}`
                        : `Could not import this ReportPrint. ${summarizeValidationFailure(reportPrintValidation, "The ReportPrint failed validation.")}`,
                    "invalidReportPrint",
                    { fileName: normalizedFileName },
                );
            }
            const title = normalizeString(payload?.title || stripJsonExtension(normalizedFileName) || "Report");
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                title,
                pageCount: Array.isArray(payload?.pages) ? payload.pages.length : 0,
                bookmarkCount: Array.isArray(payload?.bookmarks) ? payload.bookmarks.length : 0,
                pageWidth: Number(payload?.pageGeometry?.width || 0) || 0,
                pageHeight: Number(payload?.pageGeometry?.height || 0) || 0,
                message: `Imported ReportPrint ${title}. Inspect or download is ready.`,
            };
        }
        case "reportExportRequest": {
            const exportRequestValidation = validateReportExportRequest(payload);
            if (!exportRequestValidation.valid) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. ${summarizeValidationFailure(exportRequestValidation, "The report export request failed validation.")}`
                        : `Could not import this report export request. ${summarizeValidationFailure(exportRequestValidation, "The report export request failed validation.")}`,
                    "invalidReportExportRequest",
                    { fileName: normalizedFileName },
                );
            }
            const summary = buildReportBuilderExportRequestSummary(payload);
            if (!summary) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The report export request is incomplete or unsupported.`
                        : "Could not import this report export request. The request is incomplete or unsupported.",
                    "invalidReportExportRequest",
                    { fileName: normalizedFileName },
                );
            }
            return {
                valid: true,
                kind,
                payload: {
                    ...cloneValue(payload),
                    __validationErrors: cloneValue(exportRequestValidation.errors || []),
                },
                fileName: normalizedFileName,
                title: normalizeString(summary.title || stripJsonExtension(normalizedFileName) || "Report"),
                format: normalizeString(summary.format),
                from: normalizeString(summary.from),
                message: `Imported report export request ${normalizeString(summary.title || "Report")}. Review or export is ready.`,
            };
        }
        case "reportSpec": {
            const title = normalizeString(payload?.title || stripJsonExtension(normalizedFileName) || "Report");
            const reportSpecValidation = validateReportSpec(payload);
            if (!reportSpecValidation.valid) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. ${summarizeValidationFailure(reportSpecValidation, "The ReportSpec failed validation.")}`
                        : `Could not import this ReportSpec. ${summarizeValidationFailure(reportSpecValidation, "The ReportSpec failed validation.")}`,
                    "invalidReportSpec",
                    { fileName: normalizedFileName },
                );
            }
            let runtimeArtifact = null;
            try {
                runtimeArtifact = buildReportBuilderRuntimePreview({
                    model: {
                        reportSpec: cloneValue(payload),
                    },
                    rows: [],
                    hasMore: false,
                    runtimeBlockId: "importedReportSpecRuntime",
                    runtimeTitle: title,
                    runtimeSubtitle: "Local runtime preview compiled directly from the imported ReportSpec file.",
                });
            } catch (error) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. ${normalizeString(error?.message) || "The ReportSpec could not be compiled into a local runtime preview."}`
                        : `Could not import this ReportSpec. ${normalizeString(error?.message) || "The ReportSpec could not be compiled into a local runtime preview."}`,
                    "reportSpecRuntimeCompileError",
                    { fileName: normalizedFileName },
                );
            }
            if (!runtimeArtifact?.reportFill || !runtimeArtifact?.reportPrint || !runtimeArtifact?.runtimeBlock) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The ReportSpec did not compile into a complete local runtime preview.`
                        : "Could not import this ReportSpec. The ReportSpec did not compile into a complete local runtime preview.",
                    "reportSpecRuntimeIncomplete",
                    { fileName: normalizedFileName },
                );
            }
            const reportFillValidation = validateReportFill(runtimeArtifact.reportFill);
            if (!reportFillValidation.valid) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. ${summarizeValidationFailure(reportFillValidation, "The compiled ReportFill failed validation.")}`
                        : `Could not import this ReportSpec. ${summarizeValidationFailure(reportFillValidation, "The compiled ReportFill failed validation.")}`,
                    "invalidImportedReportFill",
                    { fileName: normalizedFileName },
                );
            }
            const reportPrintValidation = validateReportPrint(runtimeArtifact.reportPrint);
            if (!reportPrintValidation.valid) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. ${summarizeValidationFailure(reportPrintValidation, "The compiled ReportPrint failed validation.")}`
                        : `Could not import this ReportSpec. ${summarizeValidationFailure(reportPrintValidation, "The compiled ReportPrint failed validation.")}`,
                    "invalidImportedReportPrint",
                    { fileName: normalizedFileName },
                );
            }
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                title,
                blockCount: Array.isArray(payload?.blocks) ? payload.blocks.length : 0,
                datasetCount: Array.isArray(payload?.datasets) ? payload.datasets.length : 0,
                runtimeArtifact: cloneValue(runtimeArtifact),
                message: `Imported ReportSpec ${title}. Compiled local runtime preview is ready.`,
            };
        }
        case "reportDocument": {
            const title = normalizeString(payload?.title || payload?.id || stripJsonExtension(normalizedFileName) || "Report");
            const documentVersion = normalizePositiveInteger(
                payload?.documentVersion || payload?.savedVersion || payload?.persistedVersion || payload?.version,
                1,
            );
            const getReportDocumentResponse = buildImportedLocalNormalizedGetReportDocumentResponse({
                importedArtifactKind: "reportDocument",
                document: payload,
                documentVersion,
                savedAt: normalizeTimestamp(payload?.savedAt || payload?.updatedAt || payload?.createdAt, 0),
                title,
            });
            if (!getReportDocumentResponse) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The ReportDocument is incomplete or unsupported.`
                        : "Could not import this ReportDocument. The document is incomplete or unsupported.",
                    "invalidReportDocument",
                    { fileName: normalizedFileName },
                );
            }
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                title,
                documentVersion,
                getReportDocumentResponse: cloneValue(getReportDocumentResponse),
                message: `Imported ReportDocument ${title}. Reopen in builder is ready.`,
            };
        }
        case "reportBuilder.explorationArtifact": {
            const summary = buildReportBuilderExplorationArtifactSummary(payload);
            const savedReportPayload = buildReportBuilderSavedReportPayload(payload, {
                savedAt: normalizeTimestamp(payload?.savedAt, Date.now()),
            });
            if (!summary || !savedReportPayload) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The draft snapshot is incomplete or unsupported.`
                        : "Could not import this draft snapshot. The artifact is incomplete or unsupported.",
                    "invalidExplorationArtifact",
                    { fileName: normalizedFileName },
                );
            }
            const title = normalizeString(summary.title || savedReportPayload?.title || stripJsonExtension(normalizedFileName) || "Report");
            const getReportDocumentResponse = buildImportedLocalGetReportDocumentResponse(savedReportPayload);
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                savedReportPayload,
                fileName: normalizedFileName,
                title,
                ...(getReportDocumentResponse
                    ? {
                        getReportDocumentResponse: {
                            ...getReportDocumentResponse,
                            importedArtifactKind: kind,
                        },
                    }
                    : {}),
                message: getReportDocumentResponse
                    ? `Imported draft snapshot ${title}. Reusable report file and builder reopen are ready.`
                    : `Imported draft snapshot ${title}. Reusable report file is ready.`,
            };
        }
        case "reportBuilder.savedReportPayload": {
            const normalizedRecord = normalizeReportBuilderSavedReportRecord(payload);
            const summary = buildReportBuilderSavedReportPayloadSummary(payload);
            if (!normalizedRecord || !summary) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The saved report payload is incomplete or unsupported.`
                        : "Could not import this saved report payload. The payload is incomplete or unsupported.",
                    "invalidSavedReportPayload",
                    { fileName: normalizedFileName },
                );
            }
            const title = normalizeString(summary.title || normalizedRecord.title || stripJsonExtension(normalizedFileName) || "Report");
            const getReportDocumentResponse = buildImportedLocalGetReportDocumentResponse(payload);
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                title,
                ...(getReportDocumentResponse ? { getReportDocumentResponse } : {}),
                message: getReportDocumentResponse
                    ? `Imported saved report payload ${title}. Reopen in builder is ready.`
                    : `Imported saved report payload ${title}.`,
            };
        }
        case "reportBuilder.savedView":
        case "reportBuilder.publishedSnapshot": {
            const normalizedRecord = buildImportedSharedArtifactSavedRecord(payload);
            const artifactLabel = kind === "reportBuilder.savedView" ? "saved view" : "published snapshot";
            if (!normalizedRecord) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The ${artifactLabel} is incomplete or unsupported.`
                        : `Could not import this ${artifactLabel}. The artifact is incomplete or unsupported.`,
                    kind === "reportBuilder.savedView" ? "invalidSavedView" : "invalidPublishedSnapshot",
                    { fileName: normalizedFileName },
                );
            }
            const title = normalizeString(normalizedRecord.title || stripJsonExtension(normalizedFileName) || "Report");
            const getReportDocumentResponse = buildImportedLocalNormalizedGetReportDocumentResponse({
                importedArtifactKind: kind,
                reportSpec: normalizedRecord.reportSpec || null,
                document: normalizedRecord.document,
                reportRef: { reportId: normalizedRecord.reportId },
                documentVersion: normalizePositiveInteger(normalizedRecord.documentVersion, 0),
                savedAt: normalizeTimestamp(normalizedRecord.savedAt, 0),
                compileState: normalizedRecord.compileState || null,
                source: normalizedRecord.source,
                title,
                savedViewOverlay: normalizedRecord.savedViewOverlay || null,
            });
            if (!getReportDocumentResponse) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The ${artifactLabel} could not be reopened locally.`
                        : `Could not import this ${artifactLabel}. The artifact could not be reopened locally.`,
                    kind === "reportBuilder.savedView" ? "invalidSavedView" : "invalidPublishedSnapshot",
                    { fileName: normalizedFileName },
                );
            }
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                savedRecord: cloneValue(normalizedRecord),
                fileName: normalizedFileName,
                title,
                documentVersion: Number(normalizedRecord.documentVersion || 0) || 0,
                exportable: normalizedRecord.exportable === true,
                getReportDocumentResponse,
                message: normalizedRecord.exportable === true
                    ? `Imported ${artifactLabel} ${title}. Reopen and export are ready.`
                    : `Imported ${artifactLabel} ${title}. Reopen is ready; export needs a local export-ready artifact.`,
            };
        }
        case "getReportDocumentResponse": {
            const normalizedGetResponse = normalizeImportedLocalGetReportDocumentResponse(payload);
            const summary = buildReportBuilderGetReportDocumentResponseSummary(normalizedGetResponse);
            if (!summary || normalizeString(normalizedGetResponse?.document?.kind) !== "reportDocument") {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The reopen bundle is incomplete or unsupported.`
                        : "Could not import this reopen bundle. The payload is incomplete or unsupported.",
                    "invalidGetReportDocumentResponse",
                    { fileName: normalizedFileName },
                );
            }
            const title = normalizeString(summary.title || stripJsonExtension(normalizedFileName) || "Report");
            return {
                valid: true,
                kind,
                payload: {
                    ...cloneValue(normalizedGetResponse),
                    importedArtifactKind: "getReportDocumentResponse",
                },
                fileName: normalizedFileName,
                title,
                documentVersion: Number(summary.documentVersion || normalizedGetResponse?.documentVersion || 0) || 0,
                message: `Imported reopen bundle ${title}.`,
            };
        }
        case "listReportDocumentsResponse": {
            const summary = buildReportBuilderListReportDocumentsResponseSummary(payload);
            if (!summary || !Array.isArray(payload?.entries)) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The catalog response is incomplete or unsupported.`
                        : "Could not import this catalog response. The payload is incomplete or unsupported.",
                    "invalidListReportDocumentsResponse",
                    { fileName: normalizedFileName },
                );
            }
            const firstSelectionKey = buildReportBuilderListReportDocumentsEntrySelectionKey(payload.entries?.[0] || null);
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                entryCount: summary.entryCount,
                selectedEntryKey: firstSelectionKey,
                selectedReportId: firstSelectionKey,
                message: summary.entryCount === 1
                    ? "Imported catalog response with 1 entry."
                    : `Imported catalog response with ${summary.entryCount} entries.`,
            };
        }
        case "createReportDocumentPayload": {
            const summary = buildReportBuilderCreateReportDocumentPayloadSummary(payload);
            if (!summary || !normalizeString(payload?.reportRef?.reportId)) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The create request is incomplete or unsupported.`
                        : "Could not import this create request. The payload is incomplete or unsupported.",
                    "invalidCreateReportDocumentPayload",
                    { fileName: normalizedFileName },
                );
            }
            const getReportDocumentResponse = buildImportedLocalGetReportDocumentResponse(payload);
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                title: normalizeString(summary.title || stripJsonExtension(normalizedFileName) || "Report"),
                ...(getReportDocumentResponse ? { getReportDocumentResponse } : {}),
                message: getReportDocumentResponse
                    ? `Imported create request ${normalizeString(summary.title || "Report")}. Reopen in builder is ready.`
                    : `Imported create request ${normalizeString(summary.title || "Report")}.`,
            };
        }
        case "updateReportDocumentPayload": {
            const summary = buildReportBuilderUpdateReportDocumentPayloadSummary(payload);
            if (!summary || !normalizeString(payload?.reportRef?.reportId)) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The update request is incomplete or unsupported.`
                        : "Could not import this update request. The payload is incomplete or unsupported.",
                    "invalidUpdateReportDocumentPayload",
                    { fileName: normalizedFileName },
                );
            }
            const getReportDocumentResponse = buildImportedLocalGetReportDocumentResponse(payload);
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                title: normalizeString(summary.title || stripJsonExtension(normalizedFileName) || "Report"),
                expectedVersion: Number(summary.expectedVersion || payload?.expectedVersion || 0) || 0,
                ...(getReportDocumentResponse ? { getReportDocumentResponse } : {}),
                message: getReportDocumentResponse
                    ? `Imported update request ${normalizeString(summary.title || "Report")}. Reopen in builder is ready.`
                    : `Imported update request ${normalizeString(summary.title || "Report")}.`,
            };
        }
        case "getReportDocumentRequest": {
            const summary = buildReportBuilderGetReportDocumentRequestSummary(payload);
            if (!summary || !normalizeString(payload?.reportRef?.reportId)) {
                return buildImportFailure(
                    normalizedFileName
                        ? `Could not import ${normalizedFileName}. The get request is incomplete or unsupported.`
                        : "Could not import this get request. The request is incomplete or unsupported.",
                    "invalidGetReportDocumentRequest",
                    { fileName: normalizedFileName },
                );
            }
            return {
                valid: true,
                kind,
                payload: cloneValue(payload),
                fileName: normalizedFileName,
                title: normalizeString(summary.title || summary.reportId || stripJsonExtension(normalizedFileName) || "Report"),
                message: `Imported get request ${normalizeString(summary.title || summary.reportId || "Report")}.`,
            };
        }
        default:
            return buildImportFailure(
                normalizedFileName
                    ? `Could not import ${normalizedFileName}. Supported local report files are reportFill, reportPrint, reportExportRequest, reportSpec, reportDocument, reportBuilder.explorationArtifact, reportBuilder.savedReportPayload, reportBuilder.savedReportRecord, reportBuilder.savedView, reportBuilder.publishedSnapshot, getReportDocumentResponse, listReportDocumentsResponse, createReportDocumentPayload, updateReportDocumentPayload, and getReportDocumentRequest JSON artifacts.`
                    : "Could not import this local report file. Supported local report files are reportFill, reportPrint, reportExportRequest, reportSpec, reportDocument, reportBuilder.explorationArtifact, reportBuilder.savedReportPayload, reportBuilder.savedReportRecord, reportBuilder.savedView, reportBuilder.publishedSnapshot, getReportDocumentResponse, listReportDocumentsResponse, createReportDocumentPayload, updateReportDocumentPayload, and getReportDocumentRequest JSON artifacts.",
                "unsupportedKind",
                { fileName: normalizedFileName },
            );
    }
}
