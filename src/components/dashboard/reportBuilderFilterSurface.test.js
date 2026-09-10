import assert from "node:assert/strict";

import {
    buildReportBuilderFilterSurfaceModel,
    normalizeReportBuilderFilterSurfacePlacement,
    shouldRenderInlineReportFilterSurface,
} from "./reportBuilderFilterSurface.js";

assert.equal(normalizeReportBuilderFilterSurfacePlacement(), "left", "left is the default placement");
assert.equal(normalizeReportBuilderFilterSurfacePlacement("rail-left"), "left", "legacy rail-left remains compatible");
assert.equal(normalizeReportBuilderFilterSurfacePlacement("inline"), "top", "legacy inline becomes the toolbar-opened top surface");
assert.equal(normalizeReportBuilderFilterSurfacePlacement("right"), "right");
assert.equal(normalizeReportBuilderFilterSurfacePlacement("top"), "top");

assert.deepEqual(buildReportBuilderFilterSurfaceModel({ available: true, open: false }), {
    available: true,
    open: false,
    placement: "left",
    renderLeft: false,
    renderRight: false,
    renderTop: false,
    renderInline: false,
    surfaceCount: 0,
    reportFullWidth: true,
}, "a closed toolbar surface renders nothing and gives the report its full width");

assert.deepEqual(buildReportBuilderFilterSurfaceModel({ available: true, open: true }), {
    available: true,
    open: true,
    placement: "left",
    renderLeft: true,
    renderRight: false,
    renderTop: false,
    renderInline: false,
    surfaceCount: 1,
    reportFullWidth: false,
}, "opening the default toolbar control renders one left surface");

const rightSurface = buildReportBuilderFilterSurfaceModel({ available: true, open: true, placement: "right" });
assert.equal(rightSurface.renderRight, true);
assert.equal(rightSurface.surfaceCount, 1);
assert.equal(rightSurface.renderInline, false);

const topSurface = buildReportBuilderFilterSurfaceModel({ available: true, open: true, placement: "top" });
assert.equal(topSurface.renderTop, true);
assert.equal(topSurface.reportFullWidth, true);
assert.equal(topSurface.surfaceCount, 1);

const compactSurface = buildReportBuilderFilterSurfaceModel({ available: true, open: true, placement: "right", compact: true });
assert.equal(compactSurface.placement, "top", "responsive filter surfaces stack above the report");
assert.equal(compactSurface.renderTop, true);
assert.equal(compactSurface.renderRight, false);
assert.equal(compactSurface.surfaceCount, 1);

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

console.log("reportBuilderFilterSurface ✓ defaults left and renders one toolbar-activated left, right, or top surface");
