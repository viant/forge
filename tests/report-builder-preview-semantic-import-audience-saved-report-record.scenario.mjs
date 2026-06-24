import {
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
      fixtureValueExpression: "fixture.savedReportRecord",
      filename: "capacity-audience.saved-report-record.json",
      importedNoticeText: "Imported saved report record Capacity Audience Segment Index Q3. Reopen and export are ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported saved report records",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Audience Segment Index Q3",
      timeoutMs: 60000,
    },
    buildAudienceSemanticBindingWaitStep({ extraText: "export-ready" }),
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    ...buildAudienceDefinitionRefWaitSteps({
      extraTexts: ['"kind": "getReportDocumentResponse"'],
    }),
    ...buildAudienceReopenVerificationSteps(),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-saved-report-record.png",
      fullPage: true,
    },
  ],
};
