import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-exploration-table-row.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 8);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("preview.beginStandaloneDraft") && expression.includes("sourceKind: 'reportBuilder.tableRow'") && expression.includes("label: '2026-05-01 • Display'") && expression.includes("rowIndex: 0") && expression.includes("channelV2: 'Display'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Draft started from 2026-05-01 • Display.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parsed?.explorationSession?.sourceRef?.kind === 'reportBuilder.tableRow'") && expression.includes("parsed?.explorationSession?.sourceRef?.contextLabel === '2026-05-01 • Display'") && expression.includes("parsed?.explorationSession?.sourceRef?.context?.dimensionValues?.channelV2 === 'Display'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Discard draft"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("keys.every((key)") && expression.includes("return !parsed?.explorationSession")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("exploration-table-row")),
  true,
);

const beginDraftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("preview.beginStandaloneDraft"));
const draftStartedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Draft started from 2026-05-01 • Display."));
const persistedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("reportBuilder.tableRow") && String(step.expression || "").includes("contextLabel === '2026-05-01 • Display'"));
const discardDraftIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Discard draft");
const clearedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("keys.every((key)") && String(step.expression || "").includes("return !parsed?.explorationSession"));

assert.notEqual(beginDraftIndex, -1);
assert.notEqual(draftStartedIndex, -1);
assert.notEqual(persistedSessionIndex, -1);
assert.notEqual(discardDraftIndex, -1);
assert.notEqual(clearedSessionIndex, -1);

assert.equal(beginDraftIndex < draftStartedIndex, true);
assert.equal(draftStartedIndex < persistedSessionIndex, true);
assert.equal(persistedSessionIndex < discardDraftIndex, true);
assert.equal(discardDraftIndex < clearedSessionIndex, true);

console.log("report-builder-preview-exploration-table-row-scenario-assets ✓ table-row exploration drafts persist the expected source context and clear session state on discard");
