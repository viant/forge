import {resolveScopeParamId} from '../../reporting/scopeStateModel.js';
import {buildRuntimeSections, resolveRuntimeSectionFilterBars} from '../../reporting/reportSections.js';

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

// Presentation only: hidden controls retain their stored values and bindings.
export function resolveReportBuilderSectionFilters(filters = [], blocks = [], selectedSectionId = null) {
    const sections = buildRuntimeSections(blocks);
    const tabs = blocks.find(block => block?.kind === "tabGroupBlock");
    // An explicit empty notification means every section is hidden. Do not
    // fall back to an authored default that the Runtime has already rejected.
    const activeId = selectedSectionId === "" ? "" : [selectedSectionId, tabs?.content?.defaultSectionId ?? tabs?.defaultSectionId, sections[0]?.id]
        .find(id => sections.some(section => section.id === id)) || "";
    const visibleBars = resolveRuntimeSectionFilterBars(blocks, activeId);
    const ids = bars => new Set(bars.flatMap(bar => bar.content?.paramIds ?? bar.paramIds ?? []));
    const allIds = ids(blocks.filter(block => block?.kind === "filterBarBlock"));
    const visibleIds = ids(visibleBars);
    return filters.filter(filter => {
        const id = resolveScopeParamId(filter);
        return !allIds.has(id) || visibleIds.has(id);
    });
}
