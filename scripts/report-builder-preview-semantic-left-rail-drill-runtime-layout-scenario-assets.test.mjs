import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-left-rail-drill-runtime-layout.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 12);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("selectedDimensions: ['eventDate', 'channelV2']")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("state?.binding?.mode === 'semantic'") && expression.includes("state.selectedDimensions.join(',') === 'eventDate,channelV2'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Current path:") && expression.includes("Breakdown field") && expression.includes("Route preset") && expression.includes("Target reference")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Capture current path button not found.") && expression.includes("Capture current path") && expression.includes("Update current path")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Detail target apply button not found.") && expression.includes("Add detail action") && expression.includes("Update detail action")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail") && expression.includes("detailTarget.parameters?.campaign === '$row.campaign'") && expression.includes("fieldRef === 'channelV2'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Left rail move-left control not found.") && expression.includes("__REPORT_BUILDER_DRILL_RAIL_WIDTH_BEFORE__") && expression.includes("moveLeft.click()")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railWidth <= before - 24") && expression.includes("moveLeft.disabled === true") && expression.includes("drillPanel.scrollWidth <= drillPanel.clientWidth + 1") && expression.includes("insideBounds") && expression.includes("Show Channel details") && expression.includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("left-rail-drill-runtime-layout")),
  true,
);

console.log("report-builder-preview-semantic-left-rail-drill-runtime-layout-scenario-assets ✓ semantic preview keeps drill authoring and runtime actions visible after narrowing the setup rail");
