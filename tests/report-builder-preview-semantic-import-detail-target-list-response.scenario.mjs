import {
  buildAuthoredDetailTargetRestorationWaitStep,
  buildReopenedHydratedSessionVerificationSteps,
  buildImportedListEntryFixturePreparationSteps,
  buildRuntimeDetailTargetResolutionSteps,
  buildTemporaryDetailTargetMutationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildImportedListEntryFixturePreparationSteps({
      fixtureModulePath: "/src/components/dashboard/reportBuilderDetailTargetImportedArtifactFixtureState.js",
      fixtureBuilderName: "buildReportBuilderDetailTargetImportedArtifactFixtureState",
      savedRecordFilename: "detail-target.saved-report-record.json",
      listResponseFilename: "detail-target.list-response.json",
      savedRecordNoticeText: "Imported saved report record Imported Detail Target Modal Demo. Reopen in builder is ready.",
      listResponseNoticeText: "Imported listReportDocuments response with 1 entry.",
      listResponseSummaryText: "List ReportDocuments response: 1 entries",
      selectedEntryText: "Selected entry: Imported Detail Target Modal Demo",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Imported local reopenables') && text.includes('Imported saved report records') && text.includes('1 detail target') && text.includes('1 field action'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "No local payload backing",
    },
    ...buildTemporaryDetailTargetMutationSteps({
      temporaryTargetRef: "target://example/performance/channel-detail",
      authoredTargetRef: "target://example/performance/channel-detail-modal",
      fieldRef: "channelV2",
    }),
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Prepared getReportDocument request for importedDetailTargetModalDemo. Inspect or download it when needed.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Open selected response",
    },
    {
      type: "waitForDomContains",
      text: "Prepared getReportDocument response for importedDetailTargetModalDemo. Inspect or download it when needed.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Imported Detail Target Modal Demo",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Imported Detail Target Modal Demo",
      reportId: "importedDetailTargetModalDemo",
      documentVersion: 24,
    }),
    buildAuthoredDetailTargetRestorationWaitStep({
      targetRef: "target://example/performance/channel-detail-modal",
      fieldRef: "channelV2",
      parameters: {
        channel: "$value",
        eventDate: "$row.eventDate",
        source: "archived",
      },
      requireFieldAction: true,
      absentDetailTargetRefs: ["target://example/performance/channel-detail"],
      absentFieldActionTargetRefs: ["target://example/performance/channel-detail"],
    }),
    ...buildRuntimeDetailTargetResolutionSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show Channel details",
      expectedTexts: [
        "target://example/performance/channel-detail-modal",
        "modal",
        "Display",
        "eventDate",
        "2026-05-01",
        "source",
        "archived",
      ],
      forbiddenTexts: [
        "Detail target resolved with omitted parameters: channel.",
        "No detail target resolved",
        "Failed to resolve detail target",
      ],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-detail-target-list-response.png",
      fullPage: true
    }
  ],
};
