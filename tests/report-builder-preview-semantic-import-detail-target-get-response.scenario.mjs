import {
  buildAuthoredDetailTargetRestorationWaitStep,
  buildReopenedHydratedSessionVerificationSteps,
  buildImportedFixtureArtifactSteps,
  buildRuntimeDetailTargetResolutionSteps,
  buildTemporaryDetailTargetMutationSteps,
  buildTitledCardButtonClickStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildImportedFixtureArtifactSteps({
      fixtureModulePath: "/src/components/dashboard/reportBuilderDetailTargetImportedArtifactFixtureState.js",
      fixtureBuilderName: "buildReportBuilderDetailTargetImportedArtifactFixtureState",
      fixtureValueExpression: "fixture.getReportDocumentResponse",
      filename: "detail-target.get-report-document-response.json",
      importedNoticeText: "Imported getReportDocument response Imported Detail Target Modal Demo.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported local reopenables",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Imported Detail Target Modal Demo",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const input = document.querySelector('input[aria-label=\"Import report file\"]'); if (!input) { throw new Error('import api unavailable'); } return import('/src/components/dashboard/reportBuilderDetailTargetImportedArtifactFixtureState.js').then(({ buildReportBuilderDetailTargetImportedArtifactFixtureState }) => { const fixture = buildReportBuilderDetailTargetImportedArtifactFixtureState(); const payload = { ...fixture.getReportDocumentResponse, reportRef: { reportId: 'secondaryImportedDetailTarget' }, documentVersion: 25, savedAt: 10130, document: { ...fixture.getReportDocumentResponse.document, id: 'secondaryImportedDetailTarget', title: 'Secondary Imported Detail Target Demo' }, source: { ...fixture.getReportDocumentResponse.source, payloadId: 'rbreport_secondary_imported_detail_target', sourceArtifactId: 'secondary_imported_detail_target_demo', reportId: 'secondaryImportedDetailTarget' }, reportSpec: { ...fixture.getReportDocumentResponse.reportSpec, title: 'Secondary Imported Detail Target Demo' } }; const file = new File([JSON.stringify(payload, null, 2)], 'secondary-detail-target.get-response.json', { type: 'application/json' }); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; }); })()"
    },
    {
      type: "waitForDomContains",
      text: "Imported getReportDocument response Secondary Imported Detail Target Demo.",
      timeoutMs: 60000
    },
    {
      type: "waitForEval",
      "expression": "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Imported local reopenables') && text.includes('2 artifacts') && text.includes('Imported Detail Target Modal Demo') && text.includes('Secondary Imported Detail Target Demo'); })()",
      "timeoutMs": 60000
    },
    ...buildTemporaryDetailTargetMutationSteps({
      temporaryTargetRef: "target://example/performance/channel-detail",
      authoredTargetRef: "target://example/performance/channel-detail-modal",
      fieldRef: "channelV2",
    }),
    buildTitledCardButtonClickStep({
      title: "Imported Detail Target Modal Demo",
      buttonTexts: ["Use"],
      missingButtonMessage: "Imported Detail Target Modal Demo Use button not found.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported Detail Target Modal Demo is now the active local get response.",
      timeoutMs: 60000
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Imported Detail Target Modal Demo",
      timeoutMs: 60000
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
      file: "report-builder-preview-semantic-import-detail-target-get-response.png",
      fullPage: true
    }
  ],
};
