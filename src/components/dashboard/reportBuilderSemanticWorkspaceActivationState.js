function normalizeString(value = "") {
    return String(value || "").trim();
}

function shouldOfferSemanticActivation(semanticWorkspacePanelState = null) {
    const normalizedTitle = normalizeString(semanticWorkspacePanelState?.title).toLowerCase();
    return new Set([
        "no data model configured",
        "data model unavailable",
        "data model failed to load",
    ]).has(normalizedTitle);
}

function hasSemanticEntryContent(entry = null) {
    return !!(
        Array.isArray(entry?.semanticBindingChips) && entry.semanticBindingChips.length > 0
    ) || !!(
        Array.isArray(entry?.semanticBindingFieldGroups) && entry.semanticBindingFieldGroups.length > 0
    );
}

function normalizeSemanticActivationMetaChips(metaChips = [], reportId = "") {
    const normalizedReportId = normalizeString(reportId);
    const mapped = (Array.isArray(metaChips) ? metaChips : [])
        .map((chip) => normalizeString(chip))
        .filter(Boolean)
        .filter((chip) => !normalizedReportId || chip !== normalizedReportId)
        .map((chip) => {
            const normalizedChip = chip.toLowerCase();
            if (normalizedChip === "local-only") {
                return "Local file";
            }
            if (normalizedChip === "reopen-ready") {
                return "Ready to reopen";
            }
            if (normalizedChip === "export-ready") {
                return "Ready to export";
            }
            return chip;
        });
    return Array.from(new Set(mapped));
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
            metaChips: normalizeSemanticActivationMetaChips(entry.metaChips, entry.reportId).slice(0, 4),
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
        title: "Activate data model",
        description: normalizeString(semanticWorkspacePanelState?.title).toLowerCase() === "no data model configured"
            ? "Load a report file or activate an imported data model to switch this builder from raw mode to data-model mappings."
            : "Load a report file or activate an imported data model to restore data-model mappings in this builder.",
        entries,
    };
}
