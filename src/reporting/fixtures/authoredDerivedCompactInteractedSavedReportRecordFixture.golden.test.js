import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredDerivedCompactSavedReportRecord } from "./authoredDerivedCompactSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-derived-compact-interacted-saved-report-record-fixture.v1.json", import.meta.url);
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

assert.deepEqual(record, fixture);

console.log("authoredDerivedCompactInteractedSavedReportRecordFixture ✓ authored compact derived interacted saved record stays aligned with generated runtime output");
