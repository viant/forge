import { extractReportDocumentTemplateIdentity } from "../../reporting/reportDocumentModel.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function resolveReportBuilderTemplateIdentity(value = null, document = null) {
    const templateId = normalizeString(value?.templateId);
    const templateLabel = normalizeString(value?.templateLabel);
    if (!templateId && !templateLabel) {
        return extractReportDocumentTemplateIdentity(document);
    }
    return {
        ...(templateId ? { templateId } : {}),
        ...(templateLabel ? { templateLabel } : {}),
    };
}

export function resolveReportBuilderSourceSessionTemplateIdentity(sourceSession = null) {
    const sourceRef = sourceSession?.sourceRef && typeof sourceSession.sourceRef === "object" && !Array.isArray(sourceSession.sourceRef)
        ? sourceSession.sourceRef
        : sourceSession;
    const templateId = normalizeString(sourceRef?.templateId);
    const templateLabel = normalizeString(sourceRef?.templateLabel);
    if (!templateId && !templateLabel) {
        return null;
    }
    return {
        ...(templateId ? { templateId } : {}),
        ...(templateLabel ? { templateLabel } : {}),
    };
}

export function resolveEmbeddedReportBuilderTemplateIdentity(document = null) {
    const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
    const reportBuilderBlock = blocks.find((block) => String(block?.kind || "").trim() === "reportBuilderBlock") || null;
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

export function hasReportBuilderTemplateIdentityConflict(primary = null, secondary = null) {
    const primaryTemplateId = normalizeString(primary?.templateId);
    const primaryTemplateLabel = normalizeString(primary?.templateLabel);
    const secondaryTemplateId = normalizeString(secondary?.templateId);
    const secondaryTemplateLabel = normalizeString(secondary?.templateLabel);
    return (
        (primaryTemplateId && secondaryTemplateId && primaryTemplateId !== secondaryTemplateId)
        || (primaryTemplateLabel && secondaryTemplateLabel && primaryTemplateLabel !== secondaryTemplateLabel)
    );
}

export function buildReportBuilderTemplateIdentityConflict(primary = null, secondary = null, {
    primaryRole = "Primary",
    secondaryRole = "Secondary",
    label = "template mismatch",
} = {}) {
    if (!hasReportBuilderTemplateIdentityConflict(primary, secondary)) {
        return null;
    }
    const primaryTemplateId = normalizeString(primary?.templateId);
    const primaryTemplateLabel = normalizeString(primary?.templateLabel || primaryTemplateId);
    const secondaryTemplateId = normalizeString(secondary?.templateId);
    const secondaryTemplateLabel = normalizeString(secondary?.templateLabel || secondaryTemplateId);
    return {
        label: normalizeString(label || "template mismatch") || "template mismatch",
        message: `${normalizeString(primaryRole || "Primary") || "Primary"} template ${primaryTemplateLabel || primaryTemplateId} does not match the ${normalizeString(secondaryRole || "Secondary").toLowerCase() || "secondary"} template ${secondaryTemplateLabel || secondaryTemplateId}.`,
        ...(primaryTemplateId ? { primaryTemplateId } : {}),
        ...(primaryTemplateLabel ? { primaryTemplateLabel } : {}),
        ...(secondaryTemplateId ? { secondaryTemplateId } : {}),
        ...(secondaryTemplateLabel ? { secondaryTemplateLabel } : {}),
    };
}

export function buildReportBuilderTemplateConflictState(primary = null, secondary = null, options = {}) {
    const conflict = buildReportBuilderTemplateIdentityConflict(primary, secondary, options);
    return conflict
        ? {
            templateConflict: true,
            templateConflictLabel: conflict.label,
            templateConflictMessage: conflict.message,
        }
        : null;
}

export function resolveReportBuilderTemplateConflictDiagnostic(diagnostics = [], code = "selectedGetTemplateIdentityConflict") {
    const normalizedCode = normalizeString(code);
    return (Array.isArray(diagnostics) ? diagnostics : []).find((entry) => (
        normalizeString(entry?.code) === normalizedCode
    )) || null;
}
