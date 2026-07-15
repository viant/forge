import assert from "node:assert/strict";

import {
  AUTHORED_LANDSCAPE_MIXED_ROWS,
  buildAuthoredLandscapeMixedSavedReportRecord,
} from "./authoredLandscapeMixedSavedReportRecordBuilder.js";
import { buildReportBuilderGetReportDocumentResponse } from "../../components/dashboard/reportBuilderReportDocumentReadResponse.js";
import { buildHydratedReportBuilderDocument } from "../../components/dashboard/reportBuilderHydratedReportDocument.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";
import { resolveReportBuilderReopenCompatibility } from "../../components/dashboard/reportBuilderHydratedReportDocumentDiagnostic.js";
import { validateReportExportRequest } from "../schema/reportSchemas.js";

const record = buildAuthoredLandscapeMixedSavedReportRecord({
  containerId: "demoReportBuilder",
  stateKey: "demoReportBuilder",
  reportId: "authoredLandscapeMixedPreview",
  payloadId: "rbreport_authored_landscape_mixed_preview",
  sourceArtifactId: "authored_landscape_mixed_preview",
  savedAt: 9950,
  documentVersion: 13,
});
const primaryBuilderBlock = record.savedReportPayload.reportDocument.blocks
  .find((block) => block?.id === "primaryBuilder" && block?.kind === "reportBuilderBlock");
const pages = Array.isArray(record.exportRequest.reportPrint?.pages) ? record.exportRequest.reportPrint.pages : [];
const pageOne = pages.find((page) => page?.number === 1) || null;
const pageTwo = pages.find((page) => page?.number === 2) || null;
const pageOneElements = Array.isArray(pageOne?.elements) ? pageOne.elements : [];
const pageTwoElements = Array.isArray(pageTwo?.elements) ? pageTwo.elements : [];
const primaryRequest = record.savedReportPayload.reportSpec?.datasets?.find((dataset) => dataset?.id === "primary")?.request || {};
const primaryTable = pageOneElements.find((element) => element?.id === "primaryTable__title_0") || null;
const channelTrend = pageOneElements.find((element) => element?.id === "channelTrend__title_0") || null;
const stateGeo = pageTwoElements.find((element) => element?.id === "stateGeo__title_0") || null;
const narrative = pageTwoElements.find((element) => element?.id === "narrativeIntro__title_0") || null;
const kpi = pageTwoElements.find((element) => element?.id === "headlineKpi__title_0") || null;

assert.equal(record.savedReportPayload.reportDocument.id, "authoredLandscapeMixedPreview");
assert.ok(primaryBuilderBlock);
assert.equal(primaryBuilderBlock.source.containerId, "demoReportBuilder");
assert.equal(primaryBuilderBlock.source.stateKey, "demoReportBuilder");
assert.equal(record.exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(record.exportRequest.reportPrint.pageGeometry.height, 612);
assert.equal(record.exportRequest.reportPrint.diagnostics.length, 0);
assert.equal(validateReportExportRequest(record.exportRequest).valid, true);
assert.equal(pages.length, 2);
assert.deepEqual(primaryBuilderBlock.state.selectedMeasures, ["totalSpend", "impressions"]);
assert.equal(primaryRequest.measures?.totalSpend, true);
assert.equal(primaryRequest.measures?.impressions, true);
assert.equal(primaryRequest.measures?.spend, true);
assert.equal(primaryRequest.measures?.spendPerImpression, undefined);
assert.equal(primaryRequest.dimensions?.eventDate, true);
assert.equal(primaryRequest.dimensions?.channelId, true);
assert.equal(primaryRequest.dimensions?.stateCode, true);
assert.equal(primaryRequest.dimensions?.stateName, true);
assert.equal(primaryRequest.dimensions?.status, true);
assert.equal(record.savedReportPayload.reportSpec.calculatedFields.some((field) => field.id === "spendPerImpression"), true);
assert.equal(primaryTable?.box?.x, 36);
assert.equal(primaryTable?.box?.y, 84);
assert.equal(channelTrend?.box?.x, 36);
assert.equal(channelTrend?.box?.y, 244);
assert.equal(stateGeo?.box?.x, 36);
assert.equal(stateGeo?.box?.y, 84);
assert.equal(narrative?.box?.x, 36);
assert.equal(narrative?.box?.y, 356);
assert.equal(narrative?.box?.width, 348);
assert.equal(kpi?.box?.x, 408);
assert.equal(kpi?.box?.y, 356);
assert.equal(kpi?.box?.width, 348);
assert.equal(record.exportRequest.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.valueField, "spendPerImpression");
assert.equal(record.exportRequest.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.value, 2.45);
assert.equal(pageTwoElements.find((element) => element?.id === "headlineKpi__value_0")?.text, "Spend / Impression: 2.45000");
assert.equal(resolveReportBuilderReopenCompatibility(
  primaryBuilderBlock.source,
  {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
).compatible, true);

const getResponse = buildReportBuilderGetReportDocumentResponse(record.savedReportPayload, {
  documentVersion: 13,
  savedAt: 9950,
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
assert.deepEqual(hydrated.state.selectedMeasures, ["totalSpend", "impressions"]);
const reopenedModel = buildReportBuilderRuntimePreviewModel({
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Authored Landscape Mixed Report",
    dataSourceRef: "demoReportSource",
  },
  config: hydrated.config,
  state: hydrated.state,
  includeScopeBlock: false,
  includeRefinementBlock: false,
});
assert.equal(reopenedModel.reportSpec.calculatedFields.some((field) => field.id === "spendPerImpression"), true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.measures?.totalSpend, true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.measures?.impressions, true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.measures?.spend, true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.measures?.spendPerImpression, undefined);
assert.equal(reopenedModel.reportSpec.datasets[0].request.dimensions?.eventDate, true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.dimensions?.channelId, true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.dimensions?.stateCode, true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.dimensions?.stateName, true);
assert.equal(reopenedModel.reportSpec.datasets[0].request.dimensions?.status, true);
const reopenedPreview = buildReportBuilderRuntimePreview({
  model: reopenedModel,
  rows: AUTHORED_LANDSCAPE_MIXED_ROWS,
  hasMore: false,
  pageGeometry: record.exportRequest.reportPrint.pageGeometry,
});
assert.equal(reopenedPreview.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.value, 2.45);
assert.equal(reopenedPreview.reportPrint.pages.flatMap((page) => page.elements || []).find((element) => element?.id === "headlineKpi__value_0")?.text, "Spend / Impression: 2.45000");
assert.equal(reopenedPreview.reportPrint.diagnostics.length, 0);
assert.deepEqual(reopenedModel.reportSpec, record.exportRequest.reportSpec);
assert.deepEqual(reopenedPreview.reportFill, record.exportRequest.reportFill);
assert.deepEqual(reopenedPreview.reportPrint, record.exportRequest.reportPrint);

console.log("authoredLandscapeMixedPreviewSavedReportRecordFixture ✓ preview-compatible authored mixed landscape saved record preserves chart, geo, and half-width layout after reopen");
