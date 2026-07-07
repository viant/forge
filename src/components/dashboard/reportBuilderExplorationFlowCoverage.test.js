import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import chartSelectionScenario from "../../../tests/report-builder-preview-semantic-exploration-chart-selection.scenario.mjs";
import tableRowScenario from "../../../tests/report-builder-preview-semantic-exploration-table-row.scenario.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const reportBuilderSource = fs.readFileSync(
  path.join(repoRoot, "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  reportBuilderSource.includes("buildReportBuilderExplorationSourceContextFromChartSelection"),
  true,
  "ReportBuilder should import the chart-selection exploration source-context helper.",
);

assert.equal(
  reportBuilderSource.includes('sourceKind: "reportBuilder.chartSelection"'),
  true,
  "ReportBuilder should start an explicit exploration session from chart selections.",
);

assert.equal(
  reportBuilderSource.includes("Start draft"),
  true,
  "Chart selection notices should expose an explicit Start draft action.",
);

assert.equal(
  reportBuilderSource.includes("!designWorkspaceMode && explorationBannerState?.active ? ("),
  true,
  "ReportBuilder should keep the local draft banner visible on authored preview/report surfaces instead of hiding save/reopen controls behind the raw results-only path.",
);

assert.equal(
  reportBuilderSource.includes("draftExportActionState ? (") && reportBuilderSource.includes("triggerDraftExport"),
  true,
  "The local draft banner should surface the draft PDF export action alongside keep/save controls.",
);

const steps = Array.isArray(chartSelectionScenario?.steps) ? chartSelectionScenario.steps : [];
const tableRowSteps = Array.isArray(tableRowScenario?.steps) ? tableRowScenario.steps : [];

assert.equal(
  steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Start draft"),
  true,
  "The chart-selection preview scenario should start a draft explicitly.",
);

assert.equal(
  steps.some((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("reportBuilder.chartSelection")),
  true,
  "The chart-selection preview scenario should verify chart-selection draft provenance in localStorage.",
);

assert.equal(
  tableRowSteps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Discard draft"),
  true,
  "The table-row preview scenario should use draft terminology for discard actions.",
);

assert.equal(
  tableRowSteps.some((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Draft discarded.")),
  true,
  "The table-row preview scenario should confirm draft discard feedback.",
);

assert.equal(
  tableRowSteps.some((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("reportBuilder.tableRow")),
  true,
  "The table-row preview scenario should verify table-row draft provenance in localStorage.",
);

assert.equal(
  tableRowSteps.some((step) => step?.type === "eval" && String(step?.expression || "").includes("beginStandaloneDraft") && String(step?.expression || "").includes("reportBuilder.tableRow")),
  true,
  "The table-row preview scenario should use the explicit preview draft hook rather than a stale DOM trigger.",
);

console.log("reportBuilderExplorationFlowCoverage ✓ chart and table exploration preview coverage tracks explicit draft provenance");
