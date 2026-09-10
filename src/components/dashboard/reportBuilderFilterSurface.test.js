import assert from "node:assert/strict";

import { shouldRenderInlineReportFilterSurface } from "./reportBuilderFilterSurface.js";

assert.equal(shouldRenderInlineReportFilterSurface({
    showInlineReportBaselineControls: true,
    showLeftRail: false,
}), true, "the authored inline filter surface remains available without a live-filter rail");

assert.equal(shouldRenderInlineReportFilterSurface({
    showInlineReportBaselineControls: true,
    showLeftRail: false,
    hasDedicatedFilterControl: true,
}), false, "a closed toolbar filter control keeps the report full width until the user opens it");

assert.equal(shouldRenderInlineReportFilterSurface({
    showInlineReportBaselineControls: true,
    showLeftRail: true,
}), false, "opening the live-filter rail must not duplicate the same report controls inline");

assert.equal(shouldRenderInlineReportFilterSurface({
    showInlineReportBaselineControls: false,
    showLeftRail: false,
}), false, "reports without authored baseline controls render neither duplicate surface");

console.log("reportBuilderFilterSurface ✓ exactly one report-filter surface renders");
