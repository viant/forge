import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const viteNodePath = path.join(repoRoot, "node_modules", "vite-node", "vite-node.mjs");

const runtimeUnitTests = [
  "src/reporting/calculatedFieldModel.test.js",
  "src/reporting/reportRuntimeBlock.test.js",
  "src/reporting/runtimeFilterBindingModel.test.js",
  "src/reporting/reportRuntimeHostIntent.test.js",
  "src/reporting/reportRuntimeRefinementFilter.test.js",
  "src/reporting/reportRuntimeRequestRefinementModel.test.js",
  "src/reporting/reportPrintChartSvg.test.js",
  "src/components/dashboard/reportBuilderDocumentBlocks.test.js",
  "src/components/dashboard/reportBuilderRuntimePreview.test.js",
  "src/components/dashboard/reportBuilderRuntimePreviewSource.test.js",
  "src/components/dashboard/reportRuntimeActionExecutor.test.js",
  "src/components/dashboard/reportRuntimeChartActionModel.test.js",
  "src/components/dashboard/reportRuntimeChartExecutionModel.test.js",
  "src/components/dashboard/reportRuntimeChartInteractionState.test.js",
  "src/components/dashboard/reportRuntimeChartInteractions.test.js",
  "src/components/dashboard/reportRuntimeRefinementBarExecutionModel.test.js",
  "src/components/dashboard/reportRuntimeChartSelectionState.test.js",
  "src/components/dashboard/reportRuntimeChartSelectionViewModel.test.js",
  "src/components/dashboard/reportRuntimeDetailDiagnosticModel.test.js",
  "src/components/dashboard/reportRuntimeDrillProvider.test.js",
  "src/components/dashboard/reportRuntimeDrillState.test.js",
  "src/components/dashboard/reportRuntimeModel.test.js",
  "src/components/dashboard/reportRuntimeOverlayViewModel.test.js",
  "src/components/dashboard/reportRuntimePreviewHandlers.test.js",
  "src/components/dashboard/reportRuntimeRefinements.test.js",
  "src/components/dashboard/reportRuntimeTableActionModel.test.js",
  "src/components/dashboard/reportRuntimeTableExecutionModel.test.js",
  "src/components/dashboard/reportRuntimeTableInteractionState.test.js",
  "src/components/dashboard/useAuthoredRuntimePreviewSurface.test.js",
  "src/components/dashboard/useReportBuilderSemanticModelState.test.js",
  "src/components/dashboard/useReportRuntimeInteractionState.test.js",
  "src/demos/reportBuilder/previewForecastDrillLadders.test.js",
  "src/demos/reportBuilder/previewReportDocumentTemplates.test.js",
  "src/demos/reportBuilder/previewAuthoredReport.test.js",
  "src/demos/reportBuilder/previewDetailTarget.test.js",
  "src/demos/reportBuilder/previewRuntimeInteractionApi.test.js",
  "src/demos/reportBuilder/previewRuntimeInteractionSession.test.js",
  "src/demos/reportBuilder/previewRuntimeSurfaceApi.test.js",
  "src/demos/reportBuilder/previewSavedReportPayload.test.js",
  "src/demos/reportBuilder/previewRuntimeQuery.test.js",
  "src/demos/reportBuilder/previewRuntimeRefinements.test.js",
  "src/reporting/fixtures/authoredLandscapeReportPrintFixture.test.js",
  "src/reporting/fixtures/authoredLandscapeSavedReportRecordFixture.test.js",
  "src/reporting/fixtures/authoredLandscapePreviewSavedReportRecordFixture.test.js",
  "src/reporting/fixtures/authoredLandscapeMixedSavedReportRecordFixture.test.js",
  "src/reporting/fixtures/authoredLandscapeMixedPreviewSavedReportRecordFixture.test.js",
  "src/reporting/fixtures/authoredLandscapeGeoReportPrintFixture.test.js",
  "src/reporting/fixtures/authoredLandscapeMixedReportPrintFixture.test.js",
  "src/reporting/fixtures/authoredLandscapeMixedBuilderReportPrintFixture.test.js",
  "src/reporting/fixtures/authoredDerivedCompactSavedReportRecordFixture.test.js",
  "src/reporting/fixtures/authoredDerivedCompactPreviewSavedReportRecordFixture.test.js",
  "src/reporting/fixtures/authoredDerivedCompactInteractedSavedReportRecordFixture.test.js",
  "src/reporting/fixtures/authoredDerivedCompactInteractedSavedReportRecordFixture.golden.test.js",
  "src/reporting/fixtures/authoredDerivedCompactBuilderReportPrintFixture.test.js",
  "src/reporting/fixtures/authoredDerivedCompactInteractedBuilderReportPrintFixture.test.js",
  "src/reporting/fixtures/forecastInventoryLandscapeReportPrintFixture.test.js",
  "src/reporting/fixtures/forecastLocationLandscapeReportPrintFixture.test.js",
];

const runtimeJSXUnitTests = [
  "src/components/dashboard/DashboardReportRuntime.test.js",
  "src/components/dashboard/ReportRuntime.test.js",
];

for (const relativePath of runtimeUnitTests) {
  const result = spawnSync(
    process.execPath,
    ["--no-warnings", relativePath],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const relativePath of runtimeJSXUnitTests) {
  const result = spawnSync(
    process.execPath,
    [viteNodePath, relativePath],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("authored-runtime-unit-tests ✓ runtime contract, interaction, and preview helpers pass together");
