import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const reportBuilderSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);
const repairHelperSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/reportBuilderCurrentSelectionRepair.js"),
  "utf8",
);

assert.equal(
  reportBuilderSource.includes("repairReportBuilderDocumentBlockWithCurrentSelection("),
  true,
  "ReportBuilder should delegate empty-table repair through the shared current-selection repair helper.",
);

assert.equal(
  reportBuilderSource.includes("dispatchReportRequest(repairResult.nextState, { forceFetch: true });"),
  true,
  "ReportBuilder should rerun the authored report after repairing an empty table block from the current selection.",
);

assert.equal(
  repairHelperSource.includes("now uses the current fields. Refreshing results."),
  true,
  "ReportBuilder should confirm that the empty-table repair is also refreshing the live result surface.",
);
