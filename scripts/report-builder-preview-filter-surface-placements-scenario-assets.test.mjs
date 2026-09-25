import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-filter-surface-placements.scenario.mjs";

const steps = scenario.steps || [];
const source = JSON.stringify(steps);
for (const placement of ["left", "right", "top"]) {
  assert.match(source, new RegExp(`filterPresentation.*${placement}`));
  assert.equal(steps.some((step) => step.type === "screenshot" && step.file === `filter-surface-${placement}.png`), true);
}
assert.match(source, /data-report-filter-surface-placement/);
assert.match(source, /surfacesDoNotOverlap/);
assert.match(source, /reportFullWidth|workspace-report/);
assert.equal(steps.some((step) => step.type === "setViewport" && step.width === 390), true);
assert.equal(steps.some((step) => step.type === "screenshot" && step.file === "filter-surface-compact-open.png"), true);
assert.equal(steps.some((step) => step.type === "screenshot" && step.file === "filter-surface-placements-compact-closed.png"), true);

console.log("report-builder-preview-filter-surface-placements-scenario-assets ✓ covers placement, no-overlap, and compact close states");
