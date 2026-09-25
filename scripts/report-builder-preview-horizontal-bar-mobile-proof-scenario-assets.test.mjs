import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-horizontal-bar-mobile-proof.scenario.mjs";

const steps = scenario.steps || [];
const source = JSON.stringify(steps);
assert.match(source, /horizontal_bar/);
assert.match(source, /replaceCollectionRows/);
assert.match(source, /Negative Adjustment and Reconciliation/);
assert.match(source, /ticksDoNotOverlap/);
assert.match(source, /twoLineLabels/);
assert.match(source, /spansBothSides/);
assert.equal(steps.some((step) => step.type === "setViewport" && step.width === 390), true);
assert.equal(steps.some((step) => step.type === "screenshot" && step.file === "horizontal-bar-mobile-proof.png"), true);

console.log("report-builder-preview-horizontal-bar-mobile-proof-scenario-assets ✓ covers signed bars, label clamps, ticks, and phone geometry");
