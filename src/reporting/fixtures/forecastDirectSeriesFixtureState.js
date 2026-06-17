import { buildForecastKpiBlendByDateLandscapeSavedReportRecord } from "./forecastPreviewSavedReportRecordBuilder.js";

function findPrimaryBuilderBlock(record = null) {
  return record?.savedReportPayload?.reportDocument?.blocks
    ?.find((block) => block?.id === "primaryBuilder" && block?.kind === "reportBuilderBlock") || null;
}

export function buildForecastDirectSeriesFixtureState() {
  const record = buildForecastKpiBlendByDateLandscapeSavedReportRecord();
  return {
    record,
    exportRequest: record.exportRequest,
    reportPrint: record.reportPrint,
    reportFill: record.reportFill,
    savedReportPayload: record.savedReportPayload,
    primaryBuilderBlock: findPrimaryBuilderBlock(record),
  };
}
