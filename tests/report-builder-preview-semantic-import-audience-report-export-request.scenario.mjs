import {
  buildAudienceArtifactInspectionSteps,
  buildAudienceDefinitionRefWaitSteps,
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
      fixtureValueExpression: "fixture.pdfReportExportRequest",
      filename: "capacity-audience.export-request.json",
      importedNoticeText: "Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported export request:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Source: savedPayload • Format: PDF",
      timeoutMs: 60000,
    },
    ...buildAudienceArtifactInspectionSteps({
      summaryTexts: ["Imported export request:", "Source: savedPayload • Format: PDF"],
      semanticExtraText: "ReportPrint",
      inspectActionStep: buildSectionButtonClickStep({
        sectionIncludes: "Imported export request:",
        buttonTexts: ["Inspect export", "Hide export"],
        missingSectionMessage: "imported export request notice not found",
        missingButtonMessage: "inspect export button not found",
      }),
      inspectResultTexts: ['"kind": "reportExportRequest"', '"kind": "reportPrint"'],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-report-export-request.png",
      fullPage: true,
    },
  ],
};
