import assert from "node:assert/strict";

import {
  AUTHORED_DERIVED_COMPACT_ROWS,
  buildAuthoredDerivedCompactSavedReportRecord,
} from "./authoredDerivedCompactSavedReportRecordBuilder.js";
import { buildReportBuilderGetReportDocumentResponse } from "../../components/dashboard/reportBuilderReportDocumentReadResponse.js";
import { buildHydratedReportBuilderDocument } from "../../components/dashboard/reportBuilderHydratedReportDocument.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";
import { validateReportExportRequest } from "../schema/reportSchemas.js";

const keepDisplayRecord = buildAuthoredDerivedCompactSavedReportRecord({
  containerId: "demoReportBuilder",
  stateKey: "demoReportBuilder",
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

const primaryRequest = keepDisplayRecord.savedReportPayload.reportSpec?.datasets?.find((dataset) => dataset?.id === "primary")?.request || {};
assert.equal(validateReportExportRequest(keepDisplayRecord.exportRequest).valid, true);
assert.deepEqual(primaryRequest.filters.includeChannelId, ["Display"]);
assert.equal(primaryRequest.dimensions?.channelId, true);
assert.equal(primaryRequest.measures?.hhUniqs, true);
assert.equal(primaryRequest.measures?.reachRate, undefined);
assert.equal(keepDisplayRecord.savedReportPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(keepDisplayRecord.exportRequest.reportFill.datasets[0].rows.every((row) => row.channelId === "Display"), true);
assert.equal(keepDisplayRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartSpec?.seriesField, "channelId");
assert.deepEqual(
  keepDisplayRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.resolvedChart?.seriesKeys,
  ["Display"],
);
assert.equal(keepDisplayRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.length, 2);
assert.equal(keepDisplayRecord.exportRequest.reportPrint.diagnostics.length, 0);

const getResponse = buildReportBuilderGetReportDocumentResponse(keepDisplayRecord.savedReportPayload, {
  documentVersion: 15,
  savedAt: 10150,
});
const hydrated = buildHydratedReportBuilderDocument(getResponse, {
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
  builderIdentity: {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
});
assert.equal(hydrated.valid, true);

const reopenedModel = buildReportBuilderRuntimePreviewModel({
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Authored Derived Compact Report",
    dataSourceRef: "demoReportSource",
  },
  config: hydrated.config,
  state: hydrated.state,
  refinements: keepDisplayRecord.savedReportPayload.reportSpec.refinements,
  includeScopeBlock: false,
  includeRefinementBlock: false,
});
assert.deepEqual(reopenedModel.reportSpec.datasets[0].request.filters.includeChannelId, ["Display"]);

const reopenedPreview = buildReportBuilderRuntimePreview({
  model: reopenedModel,
  rows: AUTHORED_DERIVED_COMPACT_ROWS,
  hasMore: false,
  pageGeometry: keepDisplayRecord.exportRequest.reportPrint.pageGeometry,
});
assert.deepEqual(reopenedModel.reportSpec, keepDisplayRecord.exportRequest.reportSpec);
assert.deepEqual(reopenedPreview.reportFill, keepDisplayRecord.exportRequest.reportFill);
assert.deepEqual(reopenedPreview.reportPrint, keepDisplayRecord.exportRequest.reportPrint);

console.log("authoredDerivedCompactInteractedSavedReportRecordFixture ✓ authored compact derived post-interaction record preserves chart, table, and print parity");
