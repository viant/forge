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
import { resolveReportBuilderReopenCompatibility } from "../../components/dashboard/reportBuilderHydratedReportDocumentDiagnostic.js";
import { validateReportExportRequest } from "../schema/reportSchemas.js";

const record = buildAuthoredDerivedCompactSavedReportRecord({
  containerId: "demoReportBuilder",
  stateKey: "demoReportBuilder",
  reportId: "authoredDerivedCompactPreview",
  payloadId: "rbreport_authored_derived_compact_preview",
  sourceArtifactId: "authored_derived_compact_preview",
  savedAt: 10100,
  documentVersion: 14,
});
const primaryBuilderBlock = record.savedReportPayload.reportDocument.blocks
  .find((block) => block?.id === "primaryBuilder" && block?.kind === "reportBuilderBlock");
const primaryRequest = record.savedReportPayload.reportSpec?.datasets?.find((dataset) => dataset?.id === "primary")?.request || {};

assert.equal(record.savedReportPayload.reportDocument.id, "authoredDerivedCompactPreview");
assert.ok(primaryBuilderBlock);
assert.equal(primaryBuilderBlock.source.containerId, "demoReportBuilder");
assert.equal(primaryBuilderBlock.source.stateKey, "demoReportBuilder");
assert.equal(validateReportExportRequest(record.exportRequest).valid, true);
assert.deepEqual(primaryBuilderBlock.state.selectedMeasures, ["totalSpend"]);
assert.equal(primaryRequest.measures?.totalSpend, true);
assert.equal(primaryRequest.measures?.hhUniqs, true);
assert.equal(primaryRequest.measures?.reachRate, undefined);
assert.equal(primaryRequest.dimensions?.country, true);
assert.equal(primaryRequest.dimensions?.channelId, true);
assert.equal(record.savedReportPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(record.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartSpec?.seriesField, "channelId");
assert.equal(record.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(resolveReportBuilderReopenCompatibility(
  primaryBuilderBlock.source,
  {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
).compatible, true);

const getResponse = buildReportBuilderGetReportDocumentResponse(record.savedReportPayload, {
  documentVersion: 14,
  savedAt: 10100,
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
assert.deepEqual(hydrated.state.selectedMeasures, ["totalSpend"]);

const reopenedModel = buildReportBuilderRuntimePreviewModel({
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Authored Derived Compact Report",
    dataSourceRef: "demoReportSource",
  },
  config: hydrated.config,
  state: hydrated.state,
  includeScopeBlock: false,
  includeRefinementBlock: false,
});
assert.equal(reopenedModel.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.measures?.hhUniqs, true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.dimensions?.channelId, true);
const reopenedPreview = buildReportBuilderRuntimePreview({
  model: reopenedModel,
  rows: AUTHORED_DERIVED_COMPACT_ROWS,
  hasMore: false,
  pageGeometry: record.exportRequest.reportPrint.pageGeometry,
});
assert.deepEqual(reopenedModel.reportSpec, record.exportRequest.reportSpec);
assert.deepEqual(reopenedPreview.reportFill, record.exportRequest.reportFill);
assert.deepEqual(reopenedPreview.reportPrint, record.exportRequest.reportPrint);

console.log("authoredDerivedCompactPreviewSavedReportRecordFixture ✓ preview-compatible authored compact derived saved record preserves chart and table parity after reopen");
