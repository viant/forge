function normalizeString(value = "") {
    return String(value || "").trim();
}

function shouldOfferSemanticActivation(semanticWorkspacePanelState = null) {
    const normalizedTitle = normalizeString(semanticWorkspacePanelState?.title).toLowerCase();
    return new Set([
        "semantic modeling inactive",
        "semantic model unavailable",
        "semantic model error",
    ]).has(normalizedTitle);
}

function hasSemanticEntryContent(entry = null) {
    return !!(
        Array.isArray(entry?.semanticBindingChips) && entry.semanticBindingChips.length > 0
    ) || !!(
        Array.isArray(entry?.semanticBindingFieldGroups) && entry.semanticBindingFieldGroups.length > 0
    );
}

function buildActivationEntries(entries = [], kind = "") {
    return (Array.isArray(entries) ? entries : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .filter((entry) => hasSemanticEntryContent(entry))
        .map((entry) => {
            const targetIdentity = normalizeString(entry.id);
            return {
            id: [normalizeString(kind), targetIdentity].filter(Boolean).join("::"),
            targetIdentity,
            kind: normalizeString(kind),
            title: normalizeString(entry.title || entry.reportId),
            description: normalizeString(entry.scopeSummaryText || entry.authoredBlockSummaryText || entry.reopenSourceResolutionText),
            metaChips: (Array.isArray(entry.metaChips) ? entry.metaChips : []).filter(Boolean).slice(0, 4),
            semanticBindingChips: (Array.isArray(entry.semanticBindingChips) ? entry.semanticBindingChips : []).filter(Boolean),
            semanticBindingFieldGroups: Array.isArray(entry.semanticBindingFieldGroups) ? entry.semanticBindingFieldGroups : [],
            activateLabel: normalizeString(entry.activateLabel || "Use"),
            removeLabel: normalizeString(entry.removeLabel || ""),
        };
        })
        .filter((entry) => entry.id && entry.targetIdentity && entry.title);
}

export function buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState = null,
    importedLocalReopenablePanelState = null,
    importedLocalSavedRecordPanelState = null,
} = {}) {
    if (!shouldOfferSemanticActivation(semanticWorkspacePanelState)) {
        return null;
    }
    const reopenableEntries = buildActivationEntries(importedLocalReopenablePanelState?.entries, "reopenable");
    const savedRecordEntries = buildActivationEntries(importedLocalSavedRecordPanelState?.entries, "savedRecord");
    const entries = [...reopenableEntries, ...savedRecordEntries];
    return {
        title: "Activate semantic mode",
        description: normalizeString(semanticWorkspacePanelState?.title).toLowerCase() === "semantic modeling inactive"
            ? "Load a semantic report file or activate an imported semantic report to switch this builder from raw mode to model-backed mappings."
            : "Load a semantic report file or activate an imported semantic report to restore model-backed mappings in this builder.",
        entries,
    };
}
