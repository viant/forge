export const REPORT_BUILDER_DESKTOP_WORKSPACE_MODES = ["report", "design"];
export const REPORT_BUILDER_COMPACT_WORKSPACE_MODES = ["report", "design"];
export const DEFAULT_REPORT_BUILDER_DESKTOP_WORKSPACE_MODE = "report";
export const DEFAULT_REPORT_BUILDER_COMPACT_WORKSPACE_MODE = "report";

export function resolveReportBuilderCompactBreakpoint(config = {}) {
    const raw = Number(config?.layout?.compactBreakpoint || config?.compactBreakpoint || 820);
    return Number.isFinite(raw) && raw > 0 ? raw : 820;
}

export function resolveReportBuilderCompactMode({
    viewportWidth = 0,
    builderWidth = 0,
    compactBreakpoint = 820,
} = {}) {
    const normalizedBreakpoint = Number.isFinite(Number(compactBreakpoint)) && Number(compactBreakpoint) > 0
        ? Number(compactBreakpoint)
        : 820;
    const normalizedViewportWidth = Number(viewportWidth);
    if (Number.isFinite(normalizedViewportWidth) && normalizedViewportWidth > 0) {
        return normalizedViewportWidth <= normalizedBreakpoint;
    }
    const normalizedBuilderWidth = Number(builderWidth);
    if (Number.isFinite(normalizedBuilderWidth) && normalizedBuilderWidth > 0) {
        return normalizedBuilderWidth <= normalizedBreakpoint;
    }
    return false;
}

export function resolveReportBuilderWorkspaceModes({
    compactMode = false,
} = {}) {
    return compactMode
        ? [...REPORT_BUILDER_COMPACT_WORKSPACE_MODES]
        : [...REPORT_BUILDER_DESKTOP_WORKSPACE_MODES];
}

export function normalizeReportBuilderWorkspaceMode(value = "", {
    compactMode = false,
} = {}) {
    let normalized = String(value || "").trim().toLowerCase();
    if (normalized === "preview") {
        // Legacy persisted mode: Preview merged into the primary Report surface.
        normalized = "report";
    }
    const available = resolveReportBuilderWorkspaceModes({ compactMode });
    if (available.includes(normalized)) {
        return normalized;
    }
    return compactMode
        ? DEFAULT_REPORT_BUILDER_COMPACT_WORKSPACE_MODE
        : DEFAULT_REPORT_BUILDER_DESKTOP_WORKSPACE_MODE;
}

export function resolveReportBuilderWorkspaceModeLabel(mode = "") {
    return {
        design: "Design",
        report: "Report",
    }[normalizeReportBuilderWorkspaceMode(mode)] || "Report";
}

export function resolveReportBuilderWorkspaceModeDescription(mode = "") {
    return {
        design: "Compose authored blocks and shape the report.",
        report: "Run the report and review the live result.",
    }[normalizeReportBuilderWorkspaceMode(mode)] || "Run the report and review the live result.";
}

export function isReportBuilderDesignWorkspaceMode(mode = "", {
    compactMode = false,
} = {}) {
    return normalizeReportBuilderWorkspaceMode(mode, { compactMode }) === "design";
}
