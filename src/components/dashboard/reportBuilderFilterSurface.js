// The report toolbar/rail and an authored inline filter bar operate on the same
// canonical report state. Render exactly one full control surface: prefer the
// explicitly opened live-filter rail, and keep the inline surface as the
// responsive fallback when that rail is not present.
export function shouldRenderInlineReportFilterSurface({
    showInlineReportBaselineControls = false,
    showLeftRail = false,
    hasDedicatedFilterControl = false,
} = {}) {
    return showInlineReportBaselineControls === true
        && showLeftRail !== true
        && hasDedicatedFilterControl !== true;
}
