import assert from "node:assert/strict";

import {
  buildSavedPayloadPreparationSteps,
} from "../tests/report-builder-preview-scenario-builders.mjs";

assert.throws(
  () => buildSavedPayloadPreparationSteps(),
  /requires draftTriggerText/i,
);

const steps = buildSavedPayloadPreparationSteps({
  documentVersion: "17",
  draftTriggerText: "CTR",
});

assert.equal(steps.length, 12);

assert.deepEqual(steps.slice(0, 5), [
  {
    type: "waitForEval",
    expression: "(() => Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim() === \"CTR\")) )()",
    timeoutMs: 60000,
  },
  {
    type: "clickSelectorContains",
    selector: ".forge-report-builder__measure-pill",
    text: "CTR",
    index: 0,
  },
  {
    type: "waitForDomContains",
    text: "Local Draft",
    timeoutMs: 60000,
  },
  {
    type: "waitForEval",
    expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Save artifact')); return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'; })()",
    timeoutMs: 60000,
  },
  {
    type: "clickRole",
    role: "button",
    name: "Save artifact",
  },
]);

assert.deepEqual(steps.slice(5), [
  {
    type: "waitForDomContains",
    text: "Saved exploration artifact: Report Builder Demo",
    timeoutMs: 60000,
  },
  {
    type: "clickRole",
    role: "button",
    name: "Prepare report payload",
  },
  {
    type: "waitForDomContains",
    text: "Saved report payload: Report Builder Demo",
    timeoutMs: 60000,
  },
  {
    type: "fillSelector",
    selector: "input[aria-label=\"Document version\"]",
    value: "17",
  },
  {
    type: "waitForDomContains",
    text: "Using document version 17.",
    timeoutMs: 60000,
  },
  {
    type: "clickRole",
    role: "button",
    name: "Prepare list response",
  },
  {
    type: "waitForDomContains",
    text: "List ReportDocuments response:",
    timeoutMs: 60000,
  },
]);

const trimmedSteps = buildSavedPayloadPreparationSteps({
  draftTriggerText: " CTR ",
});

assert.match(trimmedSteps[0].expression, /"CTR"/);
assert.equal(trimmedSteps[1].text, "CTR");

assert.deepEqual(steps[8], {
  type: "fillSelector",
  selector: "input[aria-label=\"Document version\"]",
  value: "17",
});

console.log("report-builder-preview-scenario-builders ✓ requires explicit draft trigger text and emits the implicit-draft saved-payload flow");
