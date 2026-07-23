function normalizeString(value = "") {
    return String(value || "").trim();
}

const PORTABLE_REPORT_FILE_KIND = "forge.reporting.reportFile";

export function hasSemanticWorkspaceImportActivation(feedback = null) {
    if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) {
        return false;
    }
    return (
        Array.isArray(feedback.semanticBindingChips) && feedback.semanticBindingChips.length > 0
    ) || (
        Array.isArray(feedback.semanticBindingFieldGroups) && feedback.semanticBindingFieldGroups.length > 0
    );
}

export function shouldAutoActivateReportBuilderImport({
    imported = null,
    feedback = null,
    semanticWorkspaceTitle = "",
    activationResponse = null,
} = {}) {
    if (!activationResponse) {
        return false;
    }
    if (normalizeString(imported?.importedArtifactKind) === PORTABLE_REPORT_FILE_KIND) {
        return true;
    }
    return normalizeString(semanticWorkspaceTitle).toLowerCase() === "no data model configured"
        && hasSemanticWorkspaceImportActivation(feedback);
}

export function buildReportBuilderSemanticWorkspaceImportFeedback(feedback = null, {
    compactMode = false,
} = {}) {
    if (!feedback || typeof feedback !== "object" || Array.isArray(feedback)) {
        return feedback;
    }
    if (!hasSemanticWorkspaceImportActivation(feedback)) {
        return feedback;
    }
    const baseMessage = normalizeString(feedback.message);
    const suffix = compactMode
        ? "Semantic activation is now available from Raw mode."
        : "Semantic activation is now available from the Model panel.";
    return {
        ...feedback,
        message: [baseMessage, suffix].filter(Boolean).join(" ").trim(),
        hideWhenHydratedSessionActive: true,
    };
}

export function resolveReportBuilderSemanticWorkspaceImportRevealState({
    compactMode = false,
} = {}) {
    return {
        settingsOpen: false,
        reportMetadataPanelOpen: false,
        semanticPanelOpen: compactMode !== true,
        compactSheetOpen: false,
        compactChartSheetOpen: false,
        compactSemanticSheetOpen: compactMode === true,
    };
}
