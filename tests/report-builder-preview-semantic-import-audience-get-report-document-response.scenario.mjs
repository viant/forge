import {
  buildAudienceArtifactInspectionSteps,
  buildAudienceDefinitionRefWaitSteps,
  buildAudienceReopenVerificationSteps,
  buildAudienceSemanticBindingWaitStep,
  buildImportedFixtureArtifactSteps,
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
      fixtureValueExpression: "fixture.getReportDocumentResponse",
      filename: "capacity-audience.get-response.json",
      importedNoticeText: "Imported getReportDocument response Capacity Audience Segment Index Q3.",
    }),
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Audience Segment Index Q3",
      timeoutMs: 60000,
    },
    ...buildAudienceArtifactInspectionSteps({
      inspectActionStep: {
        type: "clickRole",
        role: "button",
        name: "Inspect get response",
      },
      inspectResultTexts: ['"kind": "getReportDocumentResponse"'],
    }),
    ...buildAudienceReopenVerificationSteps(),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-get-report-document-response.png",
      fullPage: true,
    },
  ],
};
