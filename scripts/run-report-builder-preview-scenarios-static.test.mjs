import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildStaticPreviewScenarioRunnerArgs,
  resolveStaticPreviewBaseUrl,
  resolveStaticPreviewOutputDir,
} from "./run-report-builder-preview-scenarios-static.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

assert.equal(
  resolveStaticPreviewOutputDir(),
  path.join(repoRoot, "output", "report-builder-preview-static"),
);

assert.equal(
  resolveStaticPreviewBaseUrl(path.join(repoRoot, "output", "report-builder-preview-static")),
  `file://${path.join(repoRoot, "output", "report-builder-preview-static")}`,
);

assert.deepEqual(buildStaticPreviewScenarioRunnerArgs([
  "--continue-on-error",
  "--summary-file",
  "output/playwright/custom/summary.json",
  "--base-url",
  "http://127.0.0.1:5175",
  "semantic",
], {
  outputRoot: path.join(repoRoot, "output", "playwright", "report-builder-preview-static"),
  baseUrl: "file:///tmp/report-builder-preview-static",
}), [
  "--continue-on-error",
  "--base-url",
  "file:///tmp/report-builder-preview-static",
  "--output-root",
  path.join(repoRoot, "output", "playwright", "report-builder-preview-static"),
  "--summary-file",
  "output/playwright/custom/summary.json",
  "semantic",
]);

assert.deepEqual(buildStaticPreviewScenarioRunnerArgs([], {
  outputRoot: path.join(repoRoot, "output", "playwright", "report-builder-preview-static"),
  baseUrl: "file:///tmp/report-builder-preview-static",
}), [
  "--base-url",
  "file:///tmp/report-builder-preview-static",
  "--output-root",
  path.join(repoRoot, "output", "playwright", "report-builder-preview-static"),
]);

assert.deepEqual(buildStaticPreviewScenarioRunnerArgs(["--list"], {
  outputRoot: path.join(repoRoot, "output", "playwright", "report-builder-preview-static"),
  baseUrl: "file:///tmp/report-builder-preview-static",
}), [
  "--list",
  "--base-url",
  "file:///tmp/report-builder-preview-static",
  "--output-root",
  path.join(repoRoot, "output", "playwright", "report-builder-preview-static"),
]);

console.log("run-report-builder-preview-scenarios-static ✓ resolves static preview paths and injects file-based runner arguments");
