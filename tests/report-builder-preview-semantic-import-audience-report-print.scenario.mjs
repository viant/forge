import {
  buildAudienceArtifactInspectionSteps,
  buildAudienceSemanticBindingWaitStep,
  buildImportedFixtureArtifactSteps,
  buildSectionButtonClickStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildImportedFixtureArtifactSteps({
      fixtureModulePath: "/src/reporting/fixtures/capacityAudienceArtifactFixtureState.js",
      fixtureBuilderName: "buildCapacityAudienceArtifactFixtureState",
      fixtureValueExpression: "fixture.pdfReportPrint",
      filename: "capacity-audience.report-print.json",
      importedNoticeText: "Imported ReportPrint Capacity Audience Segment Index Q3. Inspect or download is ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported ReportPrint:",
      timeoutMs: 60000,
    },
    ...buildAudienceArtifactInspectionSteps({
      summaryTexts: ["Imported ReportPrint:"],
      inspectActionStep: buildSectionButtonClickStep({
        sectionIncludes: "Imported ReportPrint:",
        buttonTexts: ["Inspect ReportPrint", "Hide ReportPrint"],
        missingSectionMessage: "imported report print notice not found",
        missingButtonMessage: "inspect report print button not found",
      }),
      inspectResultTexts: ['"kind": "reportPrint"', '"title": "Capacity Audience Segment Index Q3"'],
      includeDefinitionRefs: false,
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-report-print.png",
      fullPage: true,
    },
  ],
};
