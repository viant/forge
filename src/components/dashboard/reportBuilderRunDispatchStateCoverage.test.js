import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("const currentState = currentBuilderStateRef.current || state;\n        setManualRunSequence((current) => current + 1);"),
  true,
  "ReportBuilder should snapshot the latest builder state before dispatching a manual run.",
);

assert.equal(
  source.includes("dispatchReportRequest(currentState, { forceFetch: true, markManual: true });"),
  true,
  "ReportBuilder should run against the latest builder state instead of a stale render snapshot.",
);

assert.equal(
  source.includes("dispatchReportRequest(currentBuilderStateRef.current || state, { forceFetch: true, markManual: true });"),
  true,
  "ReportBuilder should use the latest builder state when authored preview auto-run dispatches a refresh.",
);
