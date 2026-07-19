import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/reportBuilderResultFrame.js"),
  "utf8",
);

assert.equal(
  source.includes('"Updating results…"'),
  true,
  "Authored runtime preview state should keep the lightweight updating notice for preview-mode retained rows.",
);

assert.equal(
  source.includes('"Updating this report with the latest results…"'),
  true,
  "Authored runtime preview state should also expose the report-mode retained-row updating notice.",
);

assert.equal(
  source.includes("updatingNotice: isLoadingWithRetainedRuntimeRows"),
  true,
  "Retained-row updating notices should stay enabled for both preview and report presentation modes.",
);

console.log("reportBuilderPreviewAuthoredRuntimeUpdatingNotice ✓ authored runtime retained-row notice copy stays wired for preview and report modes");
