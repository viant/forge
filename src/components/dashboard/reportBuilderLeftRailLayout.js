export const DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT = 24;
export const MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT = 14;
export const MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT = 50;
export const REPORT_BUILDER_LEFT_RAIL_RESIZE_STEP_PERCENT = 1;
export const DEFAULT_REPORT_BUILDER_RESULT_PANE_POSITION = "right";

export function clampReportBuilderLeftRailWidthPercent(value = DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT;
    }
    return Math.min(
        MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT,
        Math.max(MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT, numeric),
    );
}

export function resolveReportBuilderLeftRailResizeDelta(key = "", resultPanePosition = "right") {
    const normalizedKey = String(key || "").trim();
    const resizeStep = REPORT_BUILDER_LEFT_RAIL_RESIZE_STEP_PERCENT;
    if (normalizedKey === "ArrowLeft") {
        return resultPanePosition === "left" ? resizeStep : -resizeStep;
    }
    if (normalizedKey === "ArrowRight") {
        return resultPanePosition === "left" ? -resizeStep : resizeStep;
    }
    return 0;
}

export function resolveReportBuilderLeftRailWidthPercentForKey(
    key = "",
    currentPercent = DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT,
    resultPanePosition = "right",
) {
    const normalizedKey = String(key || "").trim();
    if (normalizedKey === "Home") {
        return MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT;
    }
    if (normalizedKey === "End") {
        return MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT;
    }
    if (normalizedKey === "Enter" || normalizedKey === " ") {
        return DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT;
    }
    const delta = resolveReportBuilderLeftRailResizeDelta(normalizedKey, resultPanePosition);
    return clampReportBuilderLeftRailWidthPercent(Number(currentPercent || 0) + delta);
}

export function resolveReportBuilderLeftRailWidthPercentForMove(
    direction = "",
    currentPercent = DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT,
    resultPanePosition = "right",
) {
    const normalizedDirection = String(direction || "").trim().toLowerCase();
    if (normalizedDirection === "left") {
        return resolveReportBuilderLeftRailWidthPercentForKey("ArrowLeft", currentPercent, resultPanePosition);
    }
    if (normalizedDirection === "right") {
        return resolveReportBuilderLeftRailWidthPercentForKey("ArrowRight", currentPercent, resultPanePosition);
    }
    return clampReportBuilderLeftRailWidthPercent(currentPercent);
}

export function resolveReportBuilderLeftRailWidthLabel(percent = DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT) {
    return `${Math.round(clampReportBuilderLeftRailWidthPercent(percent))}%`;
}

export function resolveReportBuilderLeftRailWidthAriaValueText(percent = DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT) {
    return `Setup panel width ${resolveReportBuilderLeftRailWidthLabel(percent)}`;
}

export function resolveReportBuilderLeftRailMoveActionLabel(direction = "") {
    return String(direction || "").trim().toLowerCase() === "right"
        ? "Move divider right"
        : "Move divider left";
}

export function resolveReportBuilderConfiguredLeftRailWidthPercent(config = {}) {
    const explicitValue = config?.layout?.leftRailWidthPercent;
    if (explicitValue == null || explicitValue === "") {
        return null;
    }
    const numeric = Number(explicitValue);
    if (!Number.isFinite(numeric)) {
        return null;
    }
    return clampReportBuilderLeftRailWidthPercent(numeric);
}

export function normalizeReportBuilderResultPanePosition(value = "") {
    return String(value || "").trim().toLowerCase() === "left"
        ? "left"
        : DEFAULT_REPORT_BUILDER_RESULT_PANE_POSITION;
}

export function resolveReportBuilderNextResultPanePosition(currentPosition = DEFAULT_REPORT_BUILDER_RESULT_PANE_POSITION) {
    return normalizeReportBuilderResultPanePosition(currentPosition) === "left" ? "right" : "left";
}

export function resolveReportBuilderResultPanePositionLabel(currentPosition = DEFAULT_REPORT_BUILDER_RESULT_PANE_POSITION) {
    return normalizeReportBuilderResultPanePosition(currentPosition) === "left" ? "Results left" : "Results right";
}

export function resolveReportBuilderResultPanePositionActionLabel(currentPosition = DEFAULT_REPORT_BUILDER_RESULT_PANE_POSITION) {
    return normalizeReportBuilderResultPanePosition(currentPosition) === "left"
        ? "Move results to right side"
        : "Move results to left side";
}
