import {
  buildAriaSectionButtonClickStep,
  buildSectionButtonClickStep,
  buildSeededSavedPayloadArtifactImportSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildSeededSavedPayloadArtifactImportSteps({
      reportId: "capacityTrendQ3",
      artifactExpression: "payload?.reportSpec",
      filename: "capacity-trend.report-spec.json",
      missingArtifactMessage: "seeded report spec not found",
      importedNoticeText: "Imported ReportSpec Capacity Trend Q3. Compiled local runtime preview is ready.",
    }),
    ...buildSeededSavedPayloadArtifactImportSteps({
      reportId: "capacityTrendQ3",
      artifactExpression: "record?.exportRequest?.reportFill",
      filename: "capacity-trend.report-fill.json",
      missingArtifactMessage: "seeded report fill not found",
      importedNoticeText: "Imported ReportFill capacity-trend.report-fill. Inspect or download is ready.",
    }).slice(6),
    {
      type: "waitForDomContains",
      text: "Imported ReportFill matches the imported ReportSpec by specVersion and specHash. Attach it explicitly to use real filled rows.",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Imported ReportFill:",
      buttonTexts: ["Attach to ReportSpec"],
      missingSectionMessage: "imported report fill notice not found",
      missingButtonMessage: "attach button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Imported ReportFill is attached to the imported ReportSpec runtime preview.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Detach ReportFill",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Local runtime preview compiled from the imported ReportSpec and attached ReportFill artifacts.",
      timeoutMs: 60000,
    },
    buildAriaSectionButtonClickStep({
      ariaLabel: "Imported runtime preview",
      buttonTexts: ["Inspect ReportFill"],
      missingSectionMessage: "imported runtime section not found",
      missingButtonMessage: "runtime inspect report fill button not found",
    }),
    {
      type: "waitForDomContains",
      text: "\"rowCount\": 8",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-fill-attach-report-spec.png",
      fullPage: true,
    },
  ],
};
