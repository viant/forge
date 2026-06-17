import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

import {
  buildPreviewScenarioRunSummary,
  buildPreviewScenarioGroups,
  expandPreviewScenarioArgs,
  isSemanticPreviewScenario,
  normalizeScenarioArg,
  parsePreviewScenarioRunnerArgs,
  previewScenarioDisplayName,
  REPORT_BUILDER_PREVIEW_SCENARIO_FILE_RE,
} from "./report-builder-preview-scenarios.js";

const availableFiles = readdirSync(new URL("../tests/", import.meta.url))
  .filter((file) => REPORT_BUILDER_PREVIEW_SCENARIO_FILE_RE.test(file))
  .sort();

const sortedAvailableFiles = availableFiles.slice().sort();
const semanticAvailableFiles = sortedAvailableFiles.filter((file) => isSemanticPreviewScenario(file));
const legacyAvailableFiles = sortedAvailableFiles.filter((file) => !isSemanticPreviewScenario(file));

assert.equal(sortedAvailableFiles.length > 0, true);
assert.equal(semanticAvailableFiles.length > 0, true);
assert.equal(legacyAvailableFiles.length > 0, true);

assert.equal(
  normalizeScenarioArg("semantic-error"),
  "report-builder-preview-semantic-error.scenario.json",
);
assert.equal(
  normalizeScenarioArg("report-builder-preview-semantic-reopen-report-document-location-chart-detail-error-recovery-export-request.scenario.mjs"),
  "report-builder-preview-semantic-reopen-report-document-location-chart-detail-error-recovery-export-request.scenario.mjs",
);
assert.equal(
  normalizeScenarioArg("report-builder-preview-proof"),
  "report-builder-preview-proof.scenario.json",
);
assert.equal(
  previewScenarioDisplayName("report-builder-preview-proof.scenario.json"),
  "report-builder-preview-proof",
);
assert.equal(isSemanticPreviewScenario("report-builder-preview-semantic-stale.scenario.json"), true);
assert.equal(isSemanticPreviewScenario("report-builder-preview-proof.scenario.json"), false);

assert.deepEqual(parsePreviewScenarioRunnerArgs([
  "--list",
  "--continue-on-error",
  "--output-root",
  "output/playwright/custom",
  "--base-url=http://127.0.0.1:5190",
  "--summary-file=output/playwright/custom/summary.json",
  "semantic",
  "proof",
]), {
  list: true,
  continueOnError: true,
  outputRoot: "output/playwright/custom",
  baseUrl: "http://127.0.0.1:5190",
  summaryFile: "output/playwright/custom/summary.json",
  help: false,
  scenarioArgs: ["semantic", "proof"],
});

assert.deepEqual(parsePreviewScenarioRunnerArgs(["--help"]), {
  list: false,
  continueOnError: false,
  outputRoot: "",
  baseUrl: "",
  summaryFile: "",
  help: true,
  scenarioArgs: [],
});

assert.deepEqual(buildPreviewScenarioGroups(availableFiles), {
  all: sortedAvailableFiles,
  semantic: semanticAvailableFiles,
  legacy: legacyAvailableFiles,
});

assert.deepEqual(expandPreviewScenarioArgs([], availableFiles), sortedAvailableFiles);
assert.deepEqual(expandPreviewScenarioArgs(["semantic"], availableFiles), semanticAvailableFiles);
assert.deepEqual(expandPreviewScenarioArgs(["all"], availableFiles), sortedAvailableFiles);
assert.deepEqual(expandPreviewScenarioArgs(["legacy"], availableFiles), legacyAvailableFiles);
assert.deepEqual(expandPreviewScenarioArgs(["semantic", "proof", "semantic-error"], availableFiles), [
  ...semanticAvailableFiles,
  "report-builder-preview-proof.scenario.json",
]);
assert.deepEqual(
  expandPreviewScenarioArgs(
    ["semantic-reopen-report-document-location-chart-detail-error-recovery-export-request"],
    availableFiles,
  ),
  ["report-builder-preview-semantic-reopen-report-document-location-chart-detail-error-recovery-export-request.scenario.mjs"],
);

assert.throws(
  () => expandPreviewScenarioArgs(["missing"], availableFiles),
  /Unknown preview scenarios: report-builder-preview-missing\.scenario\.json/,
);

assert.deepEqual(buildPreviewScenarioRunSummary({
  generatedAt: "2026-06-12T00:00:00.000Z",
  outputRoot: "/tmp/report-builder-preview-suite",
  baseUrl: "http://127.0.0.1:5175",
  total: 3,
  results: [
    { slug: "one", status: "passed" },
    { slug: "two", status: "failed" },
    { slug: "three", status: "passed" },
  ],
}), {
  generatedAt: "2026-06-12T00:00:00.000Z",
  outputRoot: "/tmp/report-builder-preview-suite",
  baseUrl: "http://127.0.0.1:5175",
  total: 3,
  passed: 2,
  failed: 1,
  results: [
    { slug: "one", status: "passed" },
    { slug: "two", status: "failed" },
    { slug: "three", status: "passed" },
  ],
});

console.log("report-builder-preview-scenarios ✓ normalize, group, and expand scenario arguments");
