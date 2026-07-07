function normalizeString(value = "") {
    return String(value || "").trim();
}

export function buildReportBuilderSemanticResultSurfaceState({
    designWorkspaceMode = false,
    semanticWorkspacePanelState = null,
} = {}) {
    if (designWorkspaceMode) {
        return null;
    }
    const semanticBindingChips = Array.isArray(semanticWorkspacePanelState?.semanticBindingChips)
        ? semanticWorkspacePanelState.semanticBindingChips.filter(Boolean)
        : [];
    const semanticBindingFieldGroups = Array.isArray(semanticWorkspacePanelState?.semanticBindingFieldGroups)
        ? semanticWorkspacePanelState.semanticBindingFieldGroups.filter((group) => group && typeof group === "object" && !Array.isArray(group))
        : [];
    if (semanticBindingChips.length === 0 && semanticBindingFieldGroups.length === 0) {
        return null;
    }
    const metaChips = (Array.isArray(semanticWorkspacePanelState?.metaChips) ? semanticWorkspacePanelState.metaChips : [])
        .map((chip) => normalizeString(chip))
        .filter((chip) => chip && chip.toLowerCase() !== "binding ready");
    return {
        level: normalizeString(semanticWorkspacePanelState?.tone || "info").toLowerCase() || "info",
        label: "Semantic context",
        value: normalizeString(semanticWorkspacePanelState?.title || "Semantic Binding") || "Semantic Binding",
        description: normalizeString(semanticWorkspacePanelState?.description),
        metaChips,
        semanticBindingChips,
        semanticBindingFieldGroups,
    };
}
