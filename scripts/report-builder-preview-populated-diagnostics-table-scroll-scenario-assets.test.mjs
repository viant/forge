import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-populated-diagnostics-table-scroll.scenario.mjs";

const steps = scenario.steps || [];
const source = JSON.stringify(steps);
assert.match(source, /Saved KPI/);
assert.match(source, /Report refresh unavailable/);
assert.match(source, /scrollWidth > scroller.clientWidth/);
assert.match(source, /Scrollable data table/);
assert.match(source, /lineGeometryValid/);
assert.match(source, /donutGeometryValid/);
assert.match(source, /geoLayout/);
assert.equal(steps.some((step) => step.type === "setViewport" && step.width === 390), true);
assert.equal(steps.some((step) => step.type === "screenshot" && step.file === "populated-diagnostics-desktop.png"), true);
assert.equal(steps.some((step) => step.type === "screenshot" && step.file === "populated-table-scroll-390.png"), true);

console.log("report-builder-preview-populated-diagnostics-table-scroll-scenario-assets ✓ covers populated diagnostics and mobile table/chart geometry");
