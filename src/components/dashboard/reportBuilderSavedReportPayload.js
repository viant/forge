import {
    buildReportBuilderReportDocument,
    lowerReportDocumentToReportSpec,
} from "../../reporting/reportDocumentModel.js";
import { buildSavedReportExportRequest } from "../../reporting/reportExportRequestModel.js";
import { buildReportDocumentCompileState } from "../../reporting/reportDocumentStore.js";
import { buildReportBuilderDocumentCompileDiagnostics } from "./reportBuilderDocumentBlocks.js";
import { resolveReportBuilderSemanticRuntimeState } from "./useReportBuilderSemanticRuntimeState.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

const REPORT_DOCUMENT_REOPEN_SESSION_KEY = "reportDocumentReopenSession";

function extractReportDocumentTemplateIdentity(reportDocument = null) {
    const blocks = Array.isArray(reportDocument?.blocks) ? reportDocument.blocks : [];
    const reportBuilderBlock = blocks.find((block) => normalizeString(block?.kind) === "reportBuilderBlock") || null;
    const templateId = normalizeString(reportBuilderBlock?.state?.reportDocumentTemplateId);
    const templateLabel = normalizeString(reportBuilderBlock?.state?.reportDocumentTemplateLabel);
    if (!templateId && !templateLabel) {
        return null;
    }
    return {
        ...(templateId ? { templateId } : {}),
        ...(templateLabel ? { templateLabel } : {}),
    };
}

function extractSavedReportPayloadTemplateIdentity(payload = null) {
    const sourceTemplateId = normalizeString(payload?.sourceSession?.sourceRef?.templateId);
    const sourceTemplateLabel = normalizeString(payload?.sourceSession?.sourceRef?.templateLabel);
    if (sourceTemplateId || sourceTemplateLabel) {
        return {
            ...(sourceTemplateId ? { templateId: sourceTemplateId } : {}),
            ...(sourceTemplateLabel ? { templateLabel: sourceTemplateLabel } : {}),
        };
    }
    return extractReportDocumentTemplateIdentity(payload?.reportDocument || null);
}

function stripBuilderOnlyState(state = {}) {
    const next = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    delete next.explorationSession;
    delete next[REPORT_DOCUMENT_REOPEN_SESSION_KEY];
    return next;
}

function applyReportDocumentIdentity(reportDocument = {}, reportSpec = {}, {
    reportId = "",
    title = "",
} = {}) {
    const normalizedReportId = normalizeString(reportId);
    const normalizedTitle = normalizeString(title || reportId || "Report") || "Report";
    const nextDocument = cloneValue(reportDocument || {});
    const nextSpec = cloneValue(reportSpec || {});
    if (normalizedReportId) {
        nextDocument.id = normalizedReportId;
    }
    nextDocument.title = normalizedTitle;
    if (Array.isArray(nextDocument.blocks)) {
        nextDocument.blocks = nextDocument.blocks.map((block) => (
            normalizeString(block?.kind) === "reportBuilderBlock"
                ? {
                    ...block,
                    title: normalizedTitle,
                }
                : block
        ));
    }
    nextSpec.title = normalizedTitle;
    return {
        reportDocument: nextDocument,
        reportSpec: nextSpec,
    };
}

function buildSavedReportPayloadCompileState(payload = null) {
    const reportDocument = payload?.reportDocument && typeof payload.reportDocument === "object" && !Array.isArray(payload.reportDocument)
        ? payload.reportDocument
        : null;
    const reportSpec = payload?.reportSpec && typeof payload.reportSpec === "object" && !Array.isArray(payload.reportSpec)
        ? payload.reportSpec
        : null;
    const structuralDiagnostics = buildReportBuilderDocumentCompileDiagnostics({
        document: reportDocument,
    });
    const storedDiagnostics = Array.isArray(payload?.compileState?.diagnostics)
        ? cloneValue(payload.compileState.diagnostics)
        : [];
    const diagnostics = [...structuralDiagnostics, ...storedDiagnostics];
    const seen = new Set();
    return buildReportDocumentCompileState(reportSpec, {
        diagnostics: diagnostics.filter((diagnostic) => {
            const key = [
                normalizeString(diagnostic?.code),
                normalizeString(diagnostic?.severity),
                normalizeString(diagnostic?.path),
                normalizeString(diagnostic?.message),
            ].join("::");
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }),
    });
}

function buildSavedReportPayloadCompileStateFromBuilderState(reportSpec = null, reportDocument = null, semanticRuntimeDiagnostics = []) {
    const diagnostics = [
        ...buildReportBuilderDocumentCompileDiagnostics({
            document: reportDocument,
        }),
        ...(Array.isArray(semanticRuntimeDiagnostics) ? semanticRuntimeDiagnostics : []),
    ];
    const seen = new Set();
    return buildReportDocumentCompileState(reportSpec, {
        diagnostics: diagnostics.filter((diagnostic) => {
            const key = [
                normalizeString(diagnostic?.code),
                normalizeString(diagnostic?.severity),
                normalizeString(diagnostic?.path),
                normalizeString(diagnostic?.message),
            ].join("::");
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }),
    });
}

function resolveSavedReportPayloadSeed(seed = null) {
    if (!seed || typeof seed !== "object" || Array.isArray(seed)) {
        return null;
    }
    const source = seed?.source && typeof seed.source === "object" && !Array.isArray(seed.source)
        ? seed.source
        : {};
    const reportDocument = seed?.reportDocument && typeof seed.reportDocument === "object" && !Array.isArray(seed.reportDocument)
        ? seed.reportDocument
        : (seed?.document && typeof seed.document === "object" && !Array.isArray(seed.document) ? seed.document : null);
    const reportId = normalizeString(seed?.reportRef?.reportId || reportDocument?.id);
    const title = normalizeString(seed?.title || reportDocument?.title || reportId || "Report") || "Report";
    return {
        kind: "reportBuilder.savedReportPayload",
        payloadId: normalizeString(seed?.payloadId || source?.payloadId),
        sourceArtifactId: normalizeString(seed?.sourceArtifactId || source?.sourceArtifactId),
        sourceSession: seed?.sourceSession && typeof seed.sourceSession === "object" && !Array.isArray(seed.sourceSession)
            ? cloneValue(seed.sourceSession)
            : (source?.sourceSession && typeof source.sourceSession === "object" && !Array.isArray(source.sourceSession)
                ? cloneValue(source.sourceSession)
                : null),
        reportId,
        title,
        savedAt: Number(seed?.savedAt || 0) || 0,
    };
}

export function buildReportBuilderSavedReportPayload(explorationArtifact = null, {
    savedAt = Date.now(),
} = {}) {
    if (!explorationArtifact || typeof explorationArtifact !== "object" || Array.isArray(explorationArtifact)) {
        return null;
    }
    const artifactId = normalizeString(explorationArtifact?.artifactId);
    const reportDocument = explorationArtifact?.document && typeof explorationArtifact.document === "object" && !Array.isArray(explorationArtifact.document)
        ? cloneValue(explorationArtifact.document)
        : null;
    const reportSpec = explorationArtifact?.reportSpec && typeof explorationArtifact.reportSpec === "object" && !Array.isArray(explorationArtifact.reportSpec)
        ? cloneValue(explorationArtifact.reportSpec)
        : null;
    const compileState = explorationArtifact?.compileState && typeof explorationArtifact.compileState === "object" && !Array.isArray(explorationArtifact.compileState)
        ? cloneValue(explorationArtifact.compileState)
        : null;
    if (!artifactId || !reportDocument || !reportSpec) {
        return null;
    }
    const savedTimestamp = Number(savedAt || Date.now()) || Date.now();
    return {
        version: 1,
        kind: "reportBuilder.savedReportPayload",
        payloadId: `rbreport_${artifactId}`,
        savedAt: savedTimestamp,
        title: normalizeString(explorationArtifact?.title || reportDocument?.title || "Report"),
        sourceArtifactId: artifactId,
        sourceSession: cloneValue(explorationArtifact?.sourceSession || null),
        reportDocument,
        reportSpec,
        ...(compileState ? { compileState } : {}),
    };
}

export function buildReportBuilderSavedReportPayloadRecord(savedReportPayload = null, {
    runtimeArtifact = null,
    documentVersion = 0,
    savedAt = 0,
    format = "pdf",
} = {}) {
    const payload = savedReportPayload && typeof savedReportPayload === "object" && !Array.isArray(savedReportPayload)
        ? cloneValue(savedReportPayload)
        : null;
    if (!payload) {
        return null;
    }
    const reportFill = runtimeArtifact?.reportFill && typeof runtimeArtifact.reportFill === "object" && !Array.isArray(runtimeArtifact.reportFill)
        ? cloneValue(runtimeArtifact.reportFill)
        : null;
    const reportPrint = runtimeArtifact?.reportPrint && typeof runtimeArtifact.reportPrint === "object" && !Array.isArray(runtimeArtifact.reportPrint)
        ? cloneValue(runtimeArtifact.reportPrint)
        : null;
    const exportRequest = buildSavedReportExportRequest({
        savedReportPayload: payload,
        reportFill,
        reportPrint,
        documentVersion: Number(documentVersion || 0) || 0,
        format,
    });
    if (!exportRequest) {
        return null;
    }
    return {
        documentVersion: Number(documentVersion || 0) || 0,
        savedAt: Number(savedAt || payload?.savedAt || Date.now()) || Date.now(),
        savedReportPayload: payload,
        exportRequest,
    };
}

export function buildReportBuilderSavedReportPayloadFromBuilderState(savedReportPayload = null, {
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
} = {}) {
    const seed = resolveSavedReportPayloadSeed(savedReportPayload);
    if (!seed) {
        return null;
    }
    const authoredState = stripBuilderOnlyState(state);
    const semanticRuntimeState = resolveReportBuilderSemanticRuntimeState({
        config,
        state: authoredState,
        binding: authoredState?.binding || config?.binding || null,
        model: semanticModel,
    });
    const nextDocument = buildReportBuilderReportDocument({
        container,
        config: semanticRuntimeState.semanticDisplayConfig,
        state: authoredState,
        semanticSummary: semanticSummary || semanticRuntimeState.semanticSummary,
    });
    const nextSpec = lowerReportDocumentToReportSpec(nextDocument);
    const withIdentity = applyReportDocumentIdentity(nextDocument, nextSpec, {
        reportId: seed.reportId || normalizeString(nextDocument?.id),
        title: seed.title || normalizeString(nextDocument?.title || seed.reportId || "Report"),
    });
    const sourceArtifactId = seed.sourceArtifactId || seed.reportId || "report";
    const payloadId = seed.payloadId || `rbreport_${sourceArtifactId}`;
    const persistedTitle = seed.title || normalizeString(withIdentity.reportDocument?.title || seed.reportId || "Report");
    const compileState = buildSavedReportPayloadCompileStateFromBuilderState(
        withIdentity.reportSpec,
        withIdentity.reportDocument,
        semanticRuntimeDiagnostics,
    );
    return {
        version: 1,
        kind: seed.kind,
        payloadId,
        savedAt: Number(savedAt || Date.now()) || Date.now(),
        title: persistedTitle,
        sourceArtifactId,
        sourceSession: seed.sourceSession,
        reportDocument: withIdentity.reportDocument,
        reportSpec: withIdentity.reportSpec,
        ...(compileState ? { compileState } : {}),
    };
}

export function buildReportBuilderSavedReportPayloadSummary(payload = null) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }
    const compileState = buildSavedReportPayloadCompileState(payload);
    const storedCompileStatus = normalizeString(payload?.compileState?.status);
    const templateIdentity = extractSavedReportPayloadTemplateIdentity(payload);
    const subtitle = normalizeString(payload?.reportDocument?.subtitle);
    const description = normalizeString(payload?.reportDocument?.description);
    const blockCount = Array.isArray(payload?.reportSpec?.blocks) ? payload.reportSpec.blocks.length : 0;
    const datasetCount = Array.isArray(payload?.reportSpec?.datasets) ? payload.reportSpec.datasets.length : 0;
    return {
        title: normalizeString(payload?.title || payload?.reportDocument?.title || "Report"),
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        payloadId: normalizeString(payload?.payloadId),
        kind: normalizeString(payload?.kind),
        sourceArtifactId: normalizeString(payload?.sourceArtifactId),
        sourceLabel: normalizeString(
            payload?.sourceSession?.sourceRef?.contextLabel
            || payload?.sourceSession?.sourceRef?.chartTitle
            || payload?.sourceSession?.sourceRef?.primaryMeasure,
        ),
        compileStatus: storedCompileStatus || normalizeString(compileState?.status),
        blockCount,
        datasetCount,
        ...(templateIdentity ? templateIdentity : {}),
    };
}

export function serializeReportBuilderSavedReportPayload(payload = null, {
    pretty = true,
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
}

export function buildReportBuilderSavedReportPayloadInspectorState(payload = null) {
    const summary = buildReportBuilderSavedReportPayloadSummary(payload);
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
        content: serializeReportBuilderSavedReportPayload(payload),
    };
}

export function buildReportBuilderSavedReportPayloadDownload(payload = null) {
    const summary = buildReportBuilderSavedReportPayloadSummary(payload);
    if (!summary) {
        return null;
    }
    const content = serializeReportBuilderSavedReportPayload(payload);
    if (!content) {
        return null;
    }
    const normalizedName = sanitizeFilenameSegment(summary.title || summary.payloadId || "saved-report-payload")
        || "saved-report-payload";
    return {
        filename: `${normalizedName}-saved-report-payload.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}
