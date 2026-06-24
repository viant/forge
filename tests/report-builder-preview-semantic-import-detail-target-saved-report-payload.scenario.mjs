import {
  buildReopenedHydratedSessionVerificationSteps,
  buildAuthoredDetailTargetRestorationWaitStep,
  buildRuntimeDetailTargetResolutionSteps,
  buildSeededSavedPayloadArtifactImportSteps,
  buildTemporaryDetailTargetMutationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildSeededSavedPayloadArtifactImportSteps({
      reportId: "importedDetailTargetModalDemo",
      artifactExpression: "payload",
      filename: "detail-target.saved-report-payload.json",
      missingArtifactMessage: "seeded detail-target saved report payload not found",
      importedNoticeText: "Imported saved report payload Imported Detail Target Modal Demo.",
    }),
    {
      type: "waitForDomContains",
      text: "Saved report payload: Imported Detail Target Modal Demo",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Measures Avails') && text.includes('Dimensions Event Date, Channel') && text.includes('1 detail target') && text.includes('1 field action'); })()",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: "24"
    },
    {
      type: "waitForDomContains",
      text: "Using document version 24.",
      timeoutMs: 60000
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get response"
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Imported Detail Target Modal Demo",
      timeoutMs: 60000
    },
    ...buildTemporaryDetailTargetMutationSteps({
      temporaryTargetRef: "target://example/performance/channel-detail",
      authoredTargetRef: "target://example/performance/channel-detail-modal",
      fieldRef: "channelV2",
    }),
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
      file: "report-builder-preview-semantic-import-detail-target-saved-report-payload.png",
      fullPage: true
    }
  ],
};
