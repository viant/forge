import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildPreviewScenarioGroups,
  REPORT_BUILDER_PREVIEW_SCENARIO_FILE_RE,
} from "./report-builder-preview-scenarios.js";

const repoRoot = process.cwd();
const testsDir = path.join(repoRoot, "tests");
const packageJsonPath = path.join(repoRoot, "package.json");
const authoredRuntimeRunnerPath = path.join(repoRoot, "scripts", "run-authored-runtime-unit-tests.mjs");

const availableFiles = fs.readdirSync(testsDir)
  .filter((file) => REPORT_BUILDER_PREVIEW_SCENARIO_FILE_RE.test(file))
  .sort();

const groups = buildPreviewScenarioGroups(availableFiles);
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const authoredRuntimeRunner = fs.readFileSync(authoredRuntimeRunnerPath, "utf8");

assert.equal(Array.isArray(groups["semantic-left-rail"]), true);
assert.equal(groups["semantic-left-rail"].length > 0, true);

const requiredScenarioFiles = [
  "report-builder-preview-semantic-left-rail-resize-handle.scenario.mjs",
  "report-builder-preview-semantic-left-rail-drill-runtime-layout.scenario.mjs",
  "report-builder-preview-semantic-detail-target-provider-preset-save-reopen-left-rail-layout.scenario.mjs",
  "report-builder-preview-semantic-reopen-report-document-validation-retry-left-rail-layout.scenario.mjs",
  "report-builder-preview-semantic-reopen-report-document-provider-unavailable-runtime-preview-left-rail-layout.scenario.mjs",
  "report-builder-preview-semantic-reopen-report-document-chart-detail-response-left-rail-layout.scenario.mjs",
];

for (const file of requiredScenarioFiles) {
  assert.equal(
    groups["semantic-left-rail"].includes(file),
    true,
    `semantic-left-rail group should include ${file}`,
  );
}

assert.equal(
  packageJson.scripts["test:report-builder-preview:semantic-left-rail"],
  "node --no-warnings scripts/run-report-builder-preview-scenarios.mjs semantic-left-rail",
);
assert.equal(
  packageJson.scripts["test:report-builder-preview:static:semantic-left-rail"],
  "node --no-warnings scripts/run-report-builder-preview-scenarios-static.mjs semantic-left-rail",
);
assert.equal(
  packageJson.scripts["smoke:report-builder-preview:semantic-left-rail"],
  "node --no-warnings scripts/smoke-report-builder-preview.mjs semantic-left-rail",
);
assert.equal(
  packageJson.scripts["smoke:report-builder-preview:static:semantic-left-rail"],
  "node --no-warnings scripts/run-report-builder-preview-scenarios-static.mjs semantic-left-rail",
);

assert.equal(
  authoredRuntimeRunner.includes('"scripts/report-builder-preview-scenarios.test.mjs"'),
  true,
  "authored-runtime runner should execute preview scenario grouping tests",
);
assert.equal(
  authoredRuntimeRunner.includes('"scripts/run-report-builder-preview-scenarios-static.test.mjs"'),
  true,
  "authored-runtime runner should execute static preview scenario runner tests",
);

console.log("report-builder-preview-execution-surface-integration ✓ semantic-left-rail grouping and static/smoke execution entrypoints stay wired into the default Forge verification path");
