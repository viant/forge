import { buildDraftReportExportRequest } from "../../reporting/reportExportRequestModel.js";
import { buildReportFillHash, buildReportSpecHash } from "../../reporting/reportFillModel.js";
import { buildReportPrintFromReportFill } from "../../reporting/reportPrintModel.js";
import { buildDashboardReportRuntimeBlock } from "../../reporting/reportRuntimeBlock.js";
import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function summarizeImportedArtifactHash(value = "") {
    const normalized = normalizeString(value);
    if (!normalized) {
        return "";
    }
    const suffix = normalized.includes(":") ? normalized.split(":").pop() : normalized;
    return suffix.slice(0, 8);
}

export function buildImportedStandaloneReportFillSummary(importedStandaloneReportFill = null) {
    if (!importedStandaloneReportFill || normalizeString(importedStandaloneReportFill?.kind) !== "reportFill") {
        return null;
    }
    return {
        title: normalizeString(importedStandaloneReportFill?.title || "Report"),
        datasetCount: Array.isArray(importedStandaloneReportFill?.datasets) ? importedStandaloneReportFill.datasets.length : 0,
        blockCount: Array.isArray(importedStandaloneReportFill?.blocks) ? importedStandaloneReportFill.blocks.length : 0,
        rowCount: (Array.isArray(importedStandaloneReportFill?.datasets) ? importedStandaloneReportFill.datasets : [])
            .reduce((total, dataset) => total + (Array.isArray(dataset?.rows) ? dataset.rows.length : 0), 0),
        diagnosticCount: Array.isArray(importedStandaloneReportFill?.diagnostics) ? importedStandaloneReportFill.diagnostics.length : 0,
        specVersion: Number(importedStandaloneReportFill?.specVersion || 0) || 0,
        specHash: normalizeString(importedStandaloneReportFill?.specHash),
    };
}

export function buildImportedStandaloneReportPrintSummary(importedStandaloneReportPrint = null) {
    if (!importedStandaloneReportPrint || normalizeString(importedStandaloneReportPrint?.kind) !== "reportPrint") {
        return null;
    }
    return {
        title: normalizeString(importedStandaloneReportPrint?.title || "Report"),
        pageCount: Array.isArray(importedStandaloneReportPrint?.pages) ? importedStandaloneReportPrint.pages.length : 0,
        bookmarkCount: Array.isArray(importedStandaloneReportPrint?.bookmarks) ? importedStandaloneReportPrint.bookmarks.length : 0,
        diagnosticCount: Array.isArray(importedStandaloneReportPrint?.diagnostics) ? importedStandaloneReportPrint.diagnostics.length : 0,
        pageWidth: Number(importedStandaloneReportPrint?.pageGeometry?.width || 0) || 0,
        pageHeight: Number(importedStandaloneReportPrint?.pageGeometry?.height || 0) || 0,
        specVersion: Number(importedStandaloneReportPrint?.specVersion || 0) || 0,
        specHash: normalizeString(importedStandaloneReportPrint?.specHash),
    };
}

export function buildImportedPipelineSummary(importedPipelinePreview = null) {
    if (!importedPipelinePreview || normalizeString(importedPipelinePreview?.kind) !== "reportSpec") {
        return null;
    }
    const reportSpec = importedPipelinePreview?.payload && typeof importedPipelinePreview.payload === "object" && !Array.isArray(importedPipelinePreview.payload)
        ? importedPipelinePreview.payload
        : null;
    return {
        kind: normalizeString(importedPipelinePreview.kind),
        title: normalizeString(importedPipelinePreview.title || importedPipelinePreview?.payload?.title || "Report"),
        fileName: normalizeString(importedPipelinePreview.fileName),
        blockCount: Number(importedPipelinePreview.blockCount || 0) || 0,
        datasetCount: Number(importedPipelinePreview.datasetCount || 0) || 0,
        specVersion: Number(reportSpec?.version || 0) || 0,
        specHash: reportSpec ? normalizeString(buildReportSpecHash(reportSpec)) : "",
    };
}

export function resolveImportedPipelineCompanionFillCompatibility({
    importedPipelinePreview = null,
    importedStandaloneReportFill = null,
} = {}) {
    const fillSummary = buildImportedStandaloneReportFillSummary(importedStandaloneReportFill);
    const pipelineSummary = buildImportedPipelineSummary(importedPipelinePreview);
    if (!pipelineSummary || !fillSummary) {
        return {
            available: false,
            compatible: false,
            message: "",
            tone: "neutral",
        };
    }
    const specVersion = Number(pipelineSummary.specVersion || 0) || 0;
    const specHash = normalizeString(pipelineSummary.specHash);
    const fillSpecVersion = Number(fillSummary.specVersion || 0) || 0;
    const fillSpecHash = normalizeString(fillSummary.specHash);
    if (specVersion < 1 || !specHash || fillSpecVersion < 1 || !fillSpecHash) {
        return {
            available: true,
            compatible: false,
            tone: "warning",
            message: "Imported ReportFill cannot attach because the required specVersion/specHash contract is incomplete.",
        };
    }
    if (specVersion !== fillSpecVersion || specHash !== fillSpecHash) {
        const mismatchReason = specVersion !== fillSpecVersion
            ? `spec v${fillSpecVersion} vs v${specVersion}`
            : `hash mismatch (${summarizeImportedArtifactHash(fillSpecHash)} vs ${summarizeImportedArtifactHash(specHash)})`;
        return {
            available: true,
            compatible: false,
            tone: "warning",
            message: `Imported ReportFill does not match the current imported ReportSpec (${mismatchReason}).`,
        };
    }
    return {
        available: true,
        compatible: true,
        tone: "info",
        message: "Imported ReportFill matches the imported ReportSpec by specVersion and specHash. Attach it explicitly to use real filled rows.",
    };
}

export function resolveImportedPipelineCompanionPrintCompatibility({
    importedPipelinePreview = null,
    importedStandaloneReportPrint = null,
} = {}) {
    const printSummary = buildImportedStandaloneReportPrintSummary(importedStandaloneReportPrint);
    const pipelineSummary = buildImportedPipelineSummary(importedPipelinePreview);
    if (!pipelineSummary || !printSummary) {
        return {
            available: false,
            compatible: false,
            message: "",
            tone: "neutral",
        };
    }
    const specVersion = Number(pipelineSummary.specVersion || 0) || 0;
    const specHash = normalizeString(pipelineSummary.specHash);
    const printSpecVersion = Number(printSummary.specVersion || 0) || 0;
    const printSpecHash = normalizeString(printSummary.specHash);
    if (specVersion < 1 || !specHash || printSpecVersion < 1 || !printSpecHash) {
        return {
            available: true,
            compatible: false,
            tone: "warning",
            message: "Imported ReportPrint cannot attach companion ReportSpec context because the required specVersion/specHash contract is incomplete.",
        };
    }
    if (specVersion !== printSpecVersion || specHash !== printSpecHash) {
        const mismatchReason = specVersion !== printSpecVersion
            ? `spec v${printSpecVersion} vs v${specVersion}`
            : `hash mismatch (${summarizeImportedArtifactHash(printSpecHash)} vs ${summarizeImportedArtifactHash(specHash)})`;
        return {
            available: true,
            compatible: false,
            tone: "warning",
            message: `Imported ReportPrint does not match the current imported ReportSpec (${mismatchReason}).`,
        };
    }
    return {
        available: true,
        compatible: true,
        tone: "info",
        message: "Imported ReportPrint matches the imported ReportSpec by specVersion and specHash.",
    };
}

export function buildImportedRuntimeFillSummary(reportFill = null, {
    attached = false,
} = {}) {
    if (!reportFill || typeof reportFill !== "object" || Array.isArray(reportFill)) {
        return null;
    }
    return {
        rowCount: (Array.isArray(reportFill?.datasets) ? reportFill.datasets : [])
            .reduce((total, dataset) => total + (Array.isArray(dataset?.rows) ? dataset.rows.length : 0), 0),
        datasetCount: Array.isArray(reportFill?.datasets) ? reportFill.datasets.length : 0,
        attached: attached === true,
    };
}

export function resolveImportedPipelineRuntimeState({
    importedPipelinePreview = null,
    importedStandaloneReportFill = null,
    attachedRequested = false,
} = {}) {
    const pipelineSummary = buildImportedPipelineSummary(importedPipelinePreview);
    const standaloneReportFillSummary = buildImportedStandaloneReportFillSummary(importedStandaloneReportFill);
    const compatibility = resolveImportedPipelineCompanionFillCompatibility({
        importedPipelinePreview,
        importedStandaloneReportFill,
    });
    const baseArtifact = importedPipelinePreview?.runtimeArtifact && typeof importedPipelinePreview.runtimeArtifact === "object" && !Array.isArray(importedPipelinePreview.runtimeArtifact)
        ? cloneValue(importedPipelinePreview.runtimeArtifact)
        : null;
    let runtimeArtifact = baseArtifact;
    let attachFailureMessage = "";
    if (baseArtifact && compatibility.compatible && attachedRequested) {
        const reportSpec = importedPipelinePreview?.payload && typeof importedPipelinePreview.payload === "object" && !Array.isArray(importedPipelinePreview.payload)
            ? cloneValue(importedPipelinePreview.payload)
            : null;
        const reportFill = importedStandaloneReportFill && typeof importedStandaloneReportFill === "object" && !Array.isArray(importedStandaloneReportFill)
            ? cloneValue(importedStandaloneReportFill)
            : null;
        if (reportSpec && reportFill) {
            const reportPrint = buildReportPrintFromReportFill({
                reportSpec,
                reportFill: cloneValue(reportFill),
            });
            const semanticBindingViewState = buildReportBuilderSemanticBindingViewState({
                semanticSummary: reportSpec?.semanticSummary || null,
                binding: reportSpec?.binding || null,
            }) || cloneValue(baseArtifact?.runtimeBlock?.dashboard?.reportRuntime?.semanticBindingViewState || null);
            const exportRequest = reportPrint
                ? buildDraftReportExportRequest({
                    reportSpec,
                    reportFill: cloneValue(reportFill),
                    reportPrint: cloneValue(reportPrint),
                    format: "pdf",
                })
                : null;
            if (reportPrint && exportRequest) {
                runtimeArtifact = {
                    ...cloneValue(baseArtifact),
                    reportSpec,
                    reportFill,
                    reportPrint,
                    exportRequest,
                    runtimeBlock: buildDashboardReportRuntimeBlock({
                        id: normalizeString(baseArtifact?.runtimeBlock?.id || "importedReportSpecRuntime"),
                        title: normalizeString(baseArtifact?.runtimeBlock?.title || pipelineSummary?.title || reportSpec?.title || "Imported Runtime Preview"),
                        subtitle: "Local runtime preview compiled from the imported ReportSpec and attached ReportFill artifacts.",
                        reportSpec,
                        reportFill,
                        reportPrint,
                        semanticBindingViewState,
                    }),
                };
            } else {
                attachFailureMessage = "Could not attach the imported ReportFill to the imported ReportSpec runtime preview. The preview/export stayed on the compiled preview fill.";
            }
        }
    }
    const standaloneReportFillHash = importedStandaloneReportFill && typeof importedStandaloneReportFill === "object" && !Array.isArray(importedStandaloneReportFill)
        ? normalizeString(buildReportFillHash(importedStandaloneReportFill))
        : "";
    const runtimeFillHash = runtimeArtifact?.reportFill && typeof runtimeArtifact.reportFill === "object" && !Array.isArray(runtimeArtifact.reportFill)
        ? normalizeString(buildReportFillHash(runtimeArtifact.reportFill))
        : "";
    const attachedApplied = compatibility.compatible
        && attachedRequested === true
        && !!standaloneReportFillHash
        && standaloneReportFillHash === runtimeFillHash;
    const runtimeFillSummary = buildImportedRuntimeFillSummary(runtimeArtifact?.reportFill || null, {
        attached: attachedApplied,
    });
    const compatibilityState = {
        ...compatibility,
        attached: attachedApplied,
    };
    const compatibilityMessage = attachedApplied
        ? "Imported ReportFill is attached to the imported ReportSpec runtime preview."
        : compatibility.message;
    return {
        pipelineSummary,
        standaloneReportFillSummary,
        compatibility: {
            ...compatibilityState,
            message: compatibilityMessage,
        },
        runtimeArtifact,
        runtimeConfig: runtimeArtifact?.runtimeBlock?.dashboard?.reportRuntime || null,
        runtimeFillSummary,
        attachedApplied,
        attachFailureMessage,
    };
}
