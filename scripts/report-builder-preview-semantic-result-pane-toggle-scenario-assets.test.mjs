import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-result-pane-toggle.scenario.mjs";

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
  expressions.some((expression) => expression.includes("forge-report-builder__left-resizer-dock") && expression.includes("!builder.classList.contains('forge-report-builder--result-left')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Result pane swap control not found.") && expression.includes("button.click()")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("builder.classList.contains('forge-report-builder--result-left')") && expression.includes("Move results to right side")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-result-pane-toggle")),
  true,
);

console.log("report-builder-preview-semantic-result-pane-toggle-scenario-assets ✓ semantic preview defines a visible split control that moves results left and right");
