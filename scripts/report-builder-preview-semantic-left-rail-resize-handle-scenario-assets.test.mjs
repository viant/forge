import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-left-rail-resize-handle.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 4);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("forge-report-builder__left-resizer") && expression.includes("Move divider left") && expression.includes("Move divider right")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Left rail move-right control not found.") && expression.includes("moveRight.click()")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("dispatchEvent(new PointerEvent('pointerdown'") && expression.includes("Left rail resizer not found.") && expression.includes("__REPORT_BUILDER_LEFT_RAIL_WIDTH_BEFORE_DRAG__")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_LEFT_RAIL_WIDTH_BEFORE_MOVE__") && expression.includes("before + 8") && expression.includes("valueNow >= 25")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_LEFT_RAIL_WIDTH_BEFORE_DRAG__") && expression.includes("before + 24") && expression.includes("valueNow >= 26")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-left-rail-resize-handle")),
  true,
);

console.log("report-builder-preview-semantic-left-rail-resize-handle-scenario-assets ✓ semantic preview exposes a draggable setup rail handle that updates width state");
