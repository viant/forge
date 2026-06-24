import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { parseReportBuilderLocalImport } from "../../components/dashboard/reportBuilderLocalImport.js";
import { buildReportBuilderImportFeedback } from "../../components/dashboard/reportBuilderFeedback.js";

const fixtureUrl = new URL("./capacity-audience-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const staleFixture = JSON.parse(JSON.stringify(fixture));
staleFixture.reportPrint.fillHash = "fnv1a:deadbeef";

assert.deepEqual(validateReportExportRequest(staleFixture), {
  valid: false,
  errors: [
    {
      path: "$.reportPrint.fillHash",
      code: "invalidContract",
      message: "ReportPrint fillHash must match reportFill.",
    },
  ],
});

const importedStaleFixture = parseReportBuilderLocalImport(JSON.stringify(staleFixture), {
  fileName: "capacity-audience.stale-export-request.json",
});

assert.equal(importedStaleFixture.valid, false);
assert.equal(importedStaleFixture.code, "invalidReportExportRequest");
assert.match(importedStaleFixture.message, /report export request failed validation/i);

assert.deepEqual(buildReportBuilderImportFeedback({
  valid: true,
  kind: "reportExportRequest",
  message: "Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.",
  from: "savedPayload",
  format: "PDF",
  payload: {
    ...fixture,
    __validationErrors: [
      {
        path: "$.reportPrint.fillHash",
        code: "invalidContract",
        message: "ReportPrint fillHash must match reportFill.",
      },
    ],
  },
}), {
  level: "success",
  message: "Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.",
  metaChips: ["savedPayload", "PDF", "1 contract issue"],
  validationDiagnostics: [
    {
      id: "invalidContract:0",
      code: "invalidContract",
      path: "$.reportPrint.fillHash",
      message: "ReportPrint fillHash must match reportFill.",
    },
  ],
  semanticBindingTitle: "Semantic Binding",
  semanticBindingChips: [
    "Model Ad Delivery",
    "Entity Line Delivery",
    "Dimensions Market",
    "Measures Audience Index",
    "Parameters Date Range, Audience Segment",
    "Categories Location, Audience +1",
    "Lineage harmonizer://feature/location +2",
  ],
  semanticBindingFieldGroups: [
    {
      id: "dimensions",
      title: "Selected dimensions (1)",
      fields: [
        {
          id: "country_code",
          rawId: "country",
          label: "Market",
          category: "Location",
          definitionRef: "harmonizer://feature/location",
          governance: {
            status: "approved",
            classification: "harmonizer.audience",
          },
        },
      ],
    },
    {
      id: "measures",
      title: "Selected measures (1)",
      fields: [
        {
          id: "audience_index",
          rawId: "audienceIndex",
          label: "Audience Index",
          format: "number",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment.index",
          governance: {
            status: "approved",
            certification: "reviewed",
            classification: "harmonizer.audience",
          },
        },
      ],
    },
    {
      id: "parameters",
      title: "Selected parameters (2)",
      fields: [
        {
          id: "reporting_window",
          rawId: "dateRange",
          label: "Date Range",
          category: "Scope",
        },
        {
          id: "audience_segment",
          rawId: "audienceSegmentFilter",
          label: "Audience Segment",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment",
          governance: {
            status: "approved",
            classification: "harmonizer.audience",
          },
        },
      ],
    },
  ],
  scopeSummaryTitle: "Report Scope",
  scopeSummaryText: "Date Range • Channels • Audience Segment",
  scopeSummaryItems: [
    {
      id: "dateRange",
      label: "Date Range",
    },
    {
      id: "channelsFilter",
      label: "Channels",
    },
    {
      id: "audienceSegmentFilter",
      label: "Audience Segment",
    },
  ],
});

console.log("capacityAudienceStaleExportRequestFixture ✓ stale export request bundles are rejected and surfaced with conformance diagnostics");
