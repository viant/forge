import assert from "node:assert/strict";
import fs from "node:fs/promises";

const dashboardCss = await fs.readFile(
  "/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/Dashboard.css",
  "utf8",
);
const reportBuilderJsx = await fs.readFile(
  "/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/ReportBuilder.jsx",
  "utf8",
);

assert.match(dashboardCss, /container-type:\s*inline-size;/);
assert.match(dashboardCss, /container-name:\s*report-builder-left-rail;/);
assert.match(dashboardCss, /@container report-builder-left-rail \(max-width: 320px\)/);
assert.match(dashboardCss, /\.forge-report-builder__left-jump\s*\{/);
assert.match(dashboardCss, /\.forge-report-builder__left-jump\s*\{[\s\S]*left:\s*50%;/);
assert.match(dashboardCss, /\.forge-report-builder__left-jump\s*\{[\s\S]*transform:\s*translateX\(-50%\);/);
assert.match(dashboardCss, /\.forge-report-builder__left-jump\s*\{[\s\S]*width:\s*36px;[\s\S]*min-height:\s*36px;[\s\S]*font-size:\s*0;/);
assert.match(dashboardCss, /\.forge-report-builder__drill-card-actions/);
assert.match(dashboardCss, /\.forge-report-builder__drill-inline-note--warning/);
assert.match(reportBuilderJsx, /forge-report-builder__chart-inline-notice--drill/);
assert.match(reportBuilderJsx, /forge-report-builder__drill-card-actions/);
assert.match(reportBuilderJsx, /forge-report-builder__left-resizer-shell[\s\S]*forge-report-builder__left-jump/);

console.log("report-builder-left-rail-drill-layout-css ✓ left-rail drill authoring uses container-aware narrow layout and keeps the bottom jump control outside the content stack");
