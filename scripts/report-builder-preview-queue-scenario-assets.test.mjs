import assert from "node:assert/strict";

import queueScenario from "../tests/report-builder-preview-semantic-queue.scenario.mjs";
import queueReloadScenario from "../tests/report-builder-preview-semantic-queue-reload.scenario.mjs";

for (const scenario of [queueScenario, queueReloadScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 720,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length >= 13);
}

const queueExpressions = queueScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  queueExpressions.some((expression) => expression.includes("queueSemanticValidationBehavior") && expression.includes("country_code") && expression.includes("Queued semantic provider unavailable.")),
  true,
);
assert.equal(
  queueExpressions.some((expression) => expression.includes("semanticValidationBehaviors.length === 2")),
  true,
);
assert.equal(
  queueScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Validating the semantic selection against the provider.")),
  true,
);
assert.equal(
  queueScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic validation: Queued semantic provider unavailable.")),
  true,
);
assert.equal(
  queueScenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Resolve semantic selection issues")),
  true,
);
assert.equal(
  queueExpressions.some((expression) => expression.includes("remaining === 1") && expression.includes("runButtons[0].disabled === false")),
  true,
);
assert.equal(
  queueExpressions.some((expression) => expression.includes("remaining === 0") && expression.includes("runButtons[0].disabled === true")),
  true,
);
assert.equal(
  queueScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-queue-proof")),
  true,
);

const queueReloadExpressions = queueReloadScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  queueReloadScenario.steps.some((step) => step?.type === "eval" && String(step.expression || "").includes("sessionStorage.clear")),
  true,
);
assert.equal(
  queueReloadExpressions.some((expression) => expression.includes("queueSemanticValidationBehavior") && expression.includes("Reloaded queued semantic provider unavailable.")),
  true,
);
assert.equal(
  queueReloadExpressions.filter((expression) => expression.includes("semanticValidationBehaviors.length === 1")).length >= 2,
  true,
);
assert.equal(
  queueReloadScenario.steps.some((step) => step?.type === "reload"),
  true,
);
assert.equal(
  queueReloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic validation: Reloaded queued semantic provider unavailable.")),
  true,
);
assert.equal(
  queueReloadScenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Resolve semantic selection issues")),
  true,
);
assert.equal(
  queueReloadExpressions.some((expression) => expression.includes("remaining === 0") && expression.includes("runButtons[0].disabled === true")),
  true,
);
assert.equal(
  queueReloadScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-queue-reload-proof")),
  true,
);

const queueInjectionIndex = queueScenario.steps.findIndex((step) => step?.type === "eval" && String(step.expression || "").includes("queueSemanticValidationBehavior"));
const queueLengthIndex = queueScenario.steps.findIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("semanticValidationBehaviors.length === 2"));
const queueSettingsIndex = queueScenario.steps.findIndex((step) => step?.type === "clickRole" && step?.name === "Performance metrics settings");
const queueFirstSelectIndex = queueScenario.steps.findIndex((step) => step?.type === "selectSelector" && step?.value === "country");
const queueFirstSettledIndex = queueScenario.steps.findIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("remaining === 1"));
const queueSecondSelectIndex = queueScenario.steps.findIndex((step) => step?.type === "selectSelector" && step?.value === "agegroupId");
const queueErrorIndex = queueScenario.steps.findIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Queued semantic provider unavailable."));
const queueDisabledIndex = queueScenario.steps.findIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("remaining === 0") && String(step.expression || "").includes("runButtons[0].disabled === true"));

assert.notEqual(queueInjectionIndex, -1);
assert.notEqual(queueLengthIndex, -1);
assert.notEqual(queueSettingsIndex, -1);
assert.notEqual(queueFirstSelectIndex, -1);
assert.notEqual(queueFirstSettledIndex, -1);
assert.notEqual(queueSecondSelectIndex, -1);
assert.notEqual(queueErrorIndex, -1);
assert.notEqual(queueDisabledIndex, -1);
assert.equal(queueInjectionIndex < queueLengthIndex, true);
assert.equal(queueLengthIndex < queueSettingsIndex, true);
assert.equal(queueSettingsIndex < queueFirstSelectIndex, true);
assert.equal(queueFirstSelectIndex < queueFirstSettledIndex, true);
assert.equal(queueFirstSettledIndex < queueSecondSelectIndex, true);
assert.equal(queueSecondSelectIndex < queueErrorIndex, true);
assert.equal(queueErrorIndex < queueDisabledIndex, true);

const queueReloadClearStorageIndex = queueReloadScenario.steps.findIndex((step) => step?.type === "eval" && String(step.expression || "").includes("sessionStorage.clear"));
const queueReloadInjectionIndex = queueReloadScenario.steps.findIndex((step) => step?.type === "eval" && String(step.expression || "").includes("queueSemanticValidationBehavior"));
const queueReloadInitialLengthIndex = queueReloadScenario.steps.findIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("semanticValidationBehaviors.length === 1"));
const queueReloadReloadIndex = queueReloadScenario.steps.findIndex((step, index) => index > queueReloadInitialLengthIndex && step?.type === "reload");
const queueReloadPersistedLengthIndex = queueReloadScenario.steps.findIndex((step, index) => index > queueReloadReloadIndex && step?.type === "waitForEval" && String(step.expression || "").includes("semanticValidationBehaviors.length === 1"));
const queueReloadErrorIndex = queueReloadScenario.steps.findIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reloaded queued semantic provider unavailable."));
const queueReloadDisabledIndex = queueReloadScenario.steps.findIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("remaining === 0") && String(step.expression || "").includes("runButtons[0].disabled === true"));

assert.notEqual(queueReloadClearStorageIndex, -1);
assert.notEqual(queueReloadInjectionIndex, -1);
assert.notEqual(queueReloadInitialLengthIndex, -1);
assert.notEqual(queueReloadReloadIndex, -1);
assert.notEqual(queueReloadPersistedLengthIndex, -1);
assert.notEqual(queueReloadErrorIndex, -1);
assert.notEqual(queueReloadDisabledIndex, -1);
assert.equal(queueReloadClearStorageIndex < queueReloadInjectionIndex, true);
assert.equal(queueReloadInjectionIndex < queueReloadInitialLengthIndex, true);
assert.equal(queueReloadInitialLengthIndex < queueReloadReloadIndex, true);
assert.equal(queueReloadReloadIndex < queueReloadPersistedLengthIndex, true);
assert.equal(queueReloadPersistedLengthIndex < queueReloadErrorIndex, true);
assert.equal(queueReloadErrorIndex < queueReloadDisabledIndex, true);

console.log("report-builder-preview-queue-scenario-assets ✓ queued semantic validation behaviors settle in order and survive reload until the matching selection consumes them");
