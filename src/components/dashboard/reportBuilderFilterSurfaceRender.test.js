import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./ReportBuilder.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("./Dashboard.css", import.meta.url), "utf8");

assert.equal(
    (source.match(/setReportFilterRailOpen/g) || []).length,
    4,
    "the standard and hosted toolbars plus the rail's single close affordance are the only desktop filter-surface state controls",
);
assert.match(source, /buildReportBuilderFilterSurfaceModel\(\{/);
assert.match(source, /reportFilterSurfaceModel\.renderLeft \|\| reportFilterSurfaceModel\.renderRight/);
assert.match(source, /reportFilterSurfaceModel\.renderLeft \? "forge-report-builder--filters-left"/);
assert.match(source, /reportFilterSurfaceModel\.renderRight \? "forge-report-builder--filters-right"/);
assert.match(source, /reportFilterSurfaceModel\.renderTop \? \(/);
assert.match(source, /data-report-filter-placement="top"/);
assert.match(source, /data-report-filter-surface=\{!designWorkspaceMode \? "true" : undefined\}/);
assert.match(source, /data-report-filter-surface=\{compactSheetTab === "filters" \? "true" : undefined\}/);
assert.match(source, /className="forge-report-builder__filter-rail-close"/);
assert.match(source, /!designWorkspaceMode \? \(/);
assert.match(source, /workspaceMode === "report" \|\| showAuthoredReportSurface/);
assert.match(
    source,
    /hostedExecuteOnOpen && reportWorkspaceMode \? renderCompactHostedReportToolbar\(\) : renderCompactHeader\(\)/,
    "compact hosted reports must retain their runtime toolbar",
);
assert.match(
    source,
    /hostedExecuteOnOpen && reportWorkspaceMode \? \(\s*renderCompactHostedReportToolbar\(\)/,
    "wide hosted reports must render the same invocation-only controls instead of builder chrome",
);
assert.match(source, /"Close report filters and options" : "Open report filters and options"/);
assert.match(source, /aria-label="Refresh report"/);
assert.match(source, /aria-label="Export report"/);
assert.match(
    source,
    /authoredRuntimePreviewState\.canRenderRuntime && !reportWorkspaceMode && desktopResultHeaderState\.quickActions\.enabled/,
    "an invoked report must not leak chart-authoring actions",
);
assert.match(
    source,
    /if \(reportWorkspaceMode\) \{\s*persistState\(nextState, \{ skipExplorationHistory: true \}\);\s*return;/,
    "runtime filter changes must not turn an invoked report into a local design draft",
);
assert.equal(source.includes("const unifiedFilterPanel"), false, "the report body must not render a duplicate inline filter surface");
assert.match(styles, /\.forge-report-builder--filters-right\s*\{/);
assert.match(styles, /\.forge-report-builder--filters-left\s*\{/);
assert.match(styles, /clamp\(240px, 20vw, 320px\)/);
assert.match(styles, /\.forge-report-builder__filter-rail-close\s*\{/);
assert.match(styles, /\.forge-report-builder__compact-report-toolbar\s*\{/);
assert.match(styles, /\[data-report-filter-surface="true"\] \.forge-report-builder-dynamic-row__controls/);
assert.match(styles, /\[data-report-filter-surface="true"\] \.forge-report-builder__date-range/);
assert.match(styles, /"center left"/);
assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.forge-report-builder\s*\{[\s\S]*"left"[\s\S]*"center"/);

console.log("reportBuilderFilterSurfaceRender ✓ toolbar activation renders one left, right, or top surface and closed reports reclaim width");
