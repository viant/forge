import assert from "node:assert/strict";

import { matchesReportBuilderSavedReportRecordSource } from "../../src/components/dashboard/reportBuilderSavedReportRecords.js";

const revenueSavedPayloadRecord = {
  reportId: "revenueSummary",
  source: {
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_revenue_summary_v1",
    sourceArtifactId: "revenue_summary",
  },
};

const matchingRevenueSavedPayloadRecord = {
  reportId: "revenueSummary",
  source: {
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_revenue_summary_v1",
    sourceArtifactId: "revenue_summary",
  },
};

assert.equal(
  matchesReportBuilderSavedReportRecordSource(
    revenueSavedPayloadRecord,
    matchingRevenueSavedPayloadRecord,
  ),
  true,
);

const collidingRevenueSavedPayloadRecord = {
  reportId: "revenueSummary",
  source: {
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_revenue_summary_remote",
    sourceArtifactId: "revenue_summary",
  },
};

assert.equal(
  matchesReportBuilderSavedReportRecordSource(
    revenueSavedPayloadRecord,
    collidingRevenueSavedPayloadRecord,
  ),
  false,
);

const matchingSavedViewRecord = {
  reportId: "revenueSummary",
  source: {
    kind: "reportBuilder.savedView",
    sourceArtifactId: "saved_view_revenue_summary",
  },
};

assert.equal(
  matchesReportBuilderSavedReportRecordSource(
    matchingSavedViewRecord,
    {
      reportId: "revenueSummary",
      source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_revenue_summary",
      },
    },
  ),
  true,
);

assert.equal(
  matchesReportBuilderSavedReportRecordSource(
    revenueSavedPayloadRecord,
    {
      reportId: "revenueDetail",
      source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_revenue_summary_v1",
        sourceArtifactId: "revenue_summary",
      },
    },
  ),
  false,
);

console.log("reportBuilderSavedReportRecords ✓ matches reopened and selected records by full source identity without collapsing payload collisions");
