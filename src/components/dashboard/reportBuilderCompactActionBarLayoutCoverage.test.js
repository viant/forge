import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const builderSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);
const cssSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/Dashboard.css"),
  "utf8",
);

const compactActionBarIndex = builderSource.indexOf('{workspaceMode !== "report" ? renderCompactBottomBar() : null}');
const authoredSurfaceIndex = builderSource.indexOf('{!showAuthoredReportSurface ? (');

assert.notEqual(
  compactActionBarIndex,
  -1,
  "ReportBuilder should render the compact action bar in runtime mode.",
);

assert.notEqual(
  authoredSurfaceIndex,
  -1,
  "ReportBuilder should still branch between primary result mode and authored report mode.",
);

assert.equal(
  compactActionBarIndex < authoredSurfaceIndex,
  true,
  "ReportBuilder should place the compact action bar before runtime content so it does not cover table rows.",
);

assert.equal(
  cssSource.includes(".forge-report-builder__compact-action-bar {\n    position: relative;"),
  true,
  "Compact action bar should use in-flow positioning instead of a sticky overlay.",
);
