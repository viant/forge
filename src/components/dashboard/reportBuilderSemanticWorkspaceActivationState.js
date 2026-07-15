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

function buildActivationEntries(entries = [], kind = "", {
    activeReportId = "",
    useExplicitActivationState = false,
} = {}) {
    return (Array.isArray(entries) ? entries : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .filter((entry) => hasSemanticEntryContent(entry))
        .map((entry) => {
            const targetIdentity = normalizeString(entry.id);
            const active = useExplicitActivationState
                ? normalizeString(entry.reportId) === normalizeString(activeReportId)
                : entry.active === true;
            return {
                id: [normalizeString(kind), targetIdentity].filter(Boolean).join("::"),
                targetIdentity,
                kind: normalizeString(kind),
                reportId: normalizeString(entry.reportId),
                title: normalizeString(entry.title || entry.reportId),
                description: normalizeString(entry.scopeSummaryText || entry.authoredBlockSummaryText || entry.reopenSourceResolutionText),
                active,
                metaChips: active ? ["In use"] : [],
                semanticBindingChips: (Array.isArray(entry.semanticBindingChips) ? entry.semanticBindingChips : []).filter(Boolean),
                semanticBindingFieldGroups: Array.isArray(entry.semanticBindingFieldGroups) ? entry.semanticBindingFieldGroups : [],
                activateLabel: active ? "" : "Use",
                removeLabel: normalizeString(entry.removeLabel) ? "Remove" : "",
            };
        })
        .filter((entry) => entry.id && entry.targetIdentity && entry.title);
}

function dedupeActivationEntries(entries = []) {
    const byReport = new Map();
    for (const entry of entries) {
        const identity = normalizeString(entry.reportId || entry.title).toLowerCase();
        const existing = byReport.get(identity);
        if (!existing) {
            byReport.set(identity, entry);
            continue;
        }
        // Saved records are the canonical local artifact when both tracking views describe one report.
        const shouldReplace = (!existing.active && entry.active)
            || (existing.active === entry.active && entry.kind === "savedRecord" && existing.kind !== "savedRecord");
        if (shouldReplace) {
            byReport.set(identity, entry);
        }
    }
    return Array.from(byReport.values());
}

export function buildReportBuilderSemanticWorkspaceActivationState({
    semanticWorkspacePanelState = null,
    importedLocalReopenablePanelState = null,
    importedLocalSavedRecordPanelState = null,
    activeReportId = "",
    useExplicitActivationState = false,
} = {}) {
    if (!shouldOfferSemanticActivation(semanticWorkspacePanelState)) {
        return null;
    }
    const activationState = { activeReportId, useExplicitActivationState };
    const reopenableEntries = buildActivationEntries(importedLocalReopenablePanelState?.entries, "reopenable", activationState);
    const savedRecordEntries = buildActivationEntries(importedLocalSavedRecordPanelState?.entries, "savedRecord", activationState);
    const entries = dedupeActivationEntries([...reopenableEntries, ...savedRecordEntries]);
    return {
        title: "Activate data model",
        description: normalizeString(semanticWorkspacePanelState?.title).toLowerCase() === "no data model configured"
            ? "Load a report file or use an imported report to connect this report to a data model."
            : "Load a report file or use an imported report to restore data-model mappings.",
        entries,
    };
}
