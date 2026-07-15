import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const authoredRuntimeRunnerPath = path.join(repoRoot, "scripts", "run-authored-runtime-unit-tests.mjs");
const phase1VerifierPath = path.join(repoRoot, "scripts", "verify-semantic-preview-phase1.mjs");
const packageJsonPath = path.join(repoRoot, "package.json");

const authoredRuntimeRunner = fs.readFileSync(authoredRuntimeRunnerPath, "utf8");
const phase1Verifier = fs.readFileSync(phase1VerifierPath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const requiredRuntimeProofFiles = [
  "scripts/report-builder-preview-semantic-left-rail-resize-handle-scenario-assets.test.mjs",
  "scripts/report-builder-preview-semantic-result-pane-toggle-scenario-assets.test.mjs",
  "scripts/report-builder-left-rail-drill-layout-css.test.mjs",
  "scripts/report-builder-preview-semantic-left-rail-drill-runtime-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-detail-target-provider-preset-save-reopen-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-reopen-report-document-provider-unavailable-runtime-preview-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-reopen-report-document-validation-retry-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-reopen-report-document-chart-detail-response-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-reopen-report-document-chart-detail-recovery-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-reopen-report-document-chart-detail-actionable-diagnostics-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-reopen-report-document-location-chart-detail-recovery-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-reopen-report-document-location-actionable-diagnostics-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-reopen-report-document-location-chart-actionable-diagnostics-left-rail-layout-scenario-assets.test.mjs",
  "scripts/report-builder-preview-runtime-table-action-provider-retry-scenario-assets.test.mjs",
  "scripts/report-builder-preview-runtime-chart-detail-parity-scenario-assets.test.mjs",
  "scripts/report-builder-preview-runtime-chart-detail-parity-refresh-scenario-assets.test.mjs",
  "scripts/report-builder-preview-runtime-first-drill-inflight-retains-collection-rows-scenario-assets.test.mjs",
  "scripts/report-builder-preview-runtime-table-detail-scenario-assets.test.mjs",
  "scripts/report-builder-preview-empty-table-apply-current-fields-scenario-assets.test.mjs",
  "scripts/report-builder-preview-empty-table-apply-current-fields-save-reopen-scenario-assets.test.mjs",
  "src/components/dashboard/reportBuilderLeftRailLayout.test.js",
  "src/components/dashboard/reportBuilderRuntimePreviewRecoveryCoverage.test.js",
  "scripts/report-builder-preview-semantic-recovery-scenario-assets.test.mjs",
  "scripts/report-builder-preview-runtime-preview-retry-scenario-assets.test.mjs",
];

for (const file of requiredRuntimeProofFiles) {
  assert.equal(
    authoredRuntimeRunner.includes(file),
    true,
    `authored-runtime runner should include ${file}`,
  );
}

assert.equal(
  authoredRuntimeRunner.includes('"src/components/dashboard/reportBuilderRuntimePreviewSection.test.js"'),
  true,
  "authored-runtime runner should still execute reportBuilderRuntimePreviewSection.test.js",
);
assert.equal(
  authoredRuntimeRunner.includes('const runtimeJSXUnitTests = ['),
  true,
  "authored-runtime runner should keep a JSX/Vite lane",
);

const jsxLaneIndex = authoredRuntimeRunner.indexOf('"src/components/dashboard/reportBuilderRuntimePreviewSection.test.js"');
const jsxLaneBlockIndex = authoredRuntimeRunner.indexOf("const runtimeJSXUnitTests = [");
assert.equal(
  jsxLaneIndex > jsxLaneBlockIndex,
  true,
  "reportBuilderRuntimePreviewSection.test.js should live in the JSX/Vite runner lane",
);

assert.equal(
  phase1Verifier.includes('label: "semantic runtime path structural suite"'),
  true,
  "Phase 1 verifier should run the semantic runtime path structural suite",
);
assert.equal(
  phase1Verifier.includes('"--no-warnings", "scripts/run-authored-runtime-unit-tests.mjs"'),
  true,
  "Phase 1 verifier should invoke the authored-runtime suite",
);

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

console.log("report-builder-preview-proof-integration ✓ authored-runtime and Phase 1 verification paths include the semantic left-rail proof family and the corrected JSX runner lane");
