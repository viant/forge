export function normalizeReportBuilderFilterSurfacePlacement(value = "", {
    defaultPlacement = "left",
} = {}) {
    const normalizedDefault = ["left", "right", "top"].includes(String(defaultPlacement || "").trim().toLowerCase())
        ? String(defaultPlacement).trim().toLowerCase()
        : "left";
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "rail-left" || normalized === "drawer-left") {
        return "left";
    }
    if (normalized === "inline") {
        return "top";
    }
    if (["left", "right", "top", "hidden"].includes(normalized)) {
        return normalized;
    }
    return normalizedDefault;
}

export function buildReportBuilderFilterSurfaceModel({
    available = false,
    open = false,
    placement = "",
    compact = false,
} = {}) {
    const normalizedPlacement = normalizeReportBuilderFilterSurfacePlacement(placement);
    const visible = available === true && open === true && normalizedPlacement !== "hidden";
    return {
        available: available === true && normalizedPlacement !== "hidden",
        open: visible,
        placement: compact === true ? "top" : normalizedPlacement,
        renderLeft: visible && compact !== true && normalizedPlacement === "left",
        renderRight: visible && compact !== true && normalizedPlacement === "right",
        renderTop: visible && (compact === true || normalizedPlacement === "top"),
        renderInline: false,
        surfaceCount: visible ? 1 : 0,
        reportFullWidth: !visible || compact === true || normalizedPlacement === "top",
    };
}

// Retained for callers compiled against the earlier helper. Report activation
// is toolbar-owned now, so an authored inline duplicate is never rendered when
// a dedicated control exists.
export function shouldRenderInlineReportFilterSurface({
    showInlineReportBaselineControls = false,
    showLeftRail = false,
    hasDedicatedFilterControl = false,
} = {}) {
    return showInlineReportBaselineControls === true
        && showLeftRail !== true
        && hasDedicatedFilterControl !== true;
}
