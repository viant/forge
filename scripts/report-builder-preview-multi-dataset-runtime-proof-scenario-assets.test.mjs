import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-multi-dataset-runtime-proof.scenario.mjs";

const steps = scenario.steps || [];
const source = JSON.stringify(scenario);
assert.match(source, /replaceRuntimeDatasetPayloads/);
assert.match(source, /forecast_country_snapshot/);
assert.match(source, /audit_notes/);
assert.match(source, /tabGroupBlock/);
assert.match(source, /defaultCollapsed/);
assert.equal(steps.filter((step) => step.type === "setViewport").length, 3);
assert.equal(steps.some((step) => step.type === "clickRole" && step.role === "tab"), true);
assert.equal(steps.some((step) => step.type === "clickRole" && String(step.name).startsWith("Expand ")), true);
assert.equal(steps.some((step) => step.type === "clickRole" && step.role === "tab" && step.name === "Filters"), true);
assert.equal(steps.some((step) => step.type === "clickRole" && step.name === "Export"), true);

console.log("report-builder-preview-multi-dataset-runtime-proof-scenario-assets ✓ covers seeded datasets, tabs, collapsed table, filters, responsive viewports, and export controls");
