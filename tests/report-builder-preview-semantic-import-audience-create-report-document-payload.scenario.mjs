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
      fixtureValueExpression: "fixture.createReportDocumentPayload",
      filename: "capacity-audience.create-report-document.json",
      importedNoticeText: "Imported createReportDocument payload Capacity Audience Segment Index Q3. Reopen in builder is ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Create ReportDocument payload: Capacity Audience Segment Index Q3",
      timeoutMs: 60000,
    },
    ...buildAudienceArtifactInspectionSteps({
      inspectActionStep: {
        type: "clickRole",
        role: "button",
        name: "Inspect create payload",
      },
      inspectResultTexts: ['"kind": "createReportDocumentPayload"'],
    }),
    ...buildAudienceReopenVerificationSteps(),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-create-report-document-payload.png",
      fullPage: true,
    },
  ],
};
