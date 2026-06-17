import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportPrint } from "../schema/reportSchemas.js";
import { buildAuthoredDerivedCompactSavedReportRecord } from "./authoredDerivedCompactSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-derived-compact-interacted-builder-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredDerivedCompactSavedReportRecord({
  reportId: "authoredDerivedCompactInteracted",
  payloadId: "rbreport_authored_derived_compact_interacted",
  sourceArtifactId: "authored_derived_compact_interacted",
  savedAt: 10150,
  documentVersion: 15,
  refinements: [
    {
      op: "keep",
      field: "channelId",
      values: ["Display"],
      sourceBlockId: "reachRateTable",
      label: "Keep Channel = Display",
    },
  ],
});
const reportPrint = record.exportRequest.reportPrint;

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
assert.deepEqual(reportPrint, fixture);

console.log("authoredDerivedCompactInteractedBuilderReportPrintFixture ✓ authored compact derived interacted builder print fixture stays aligned with generated runtime output");
