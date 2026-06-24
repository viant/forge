import {
  buildAuthoredDetailTargetRestorationWaitStep,
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
      fixtureValueExpression: "fixture.savedReportRecord",
      filename: "detail-target.saved-report-record.json",
      importedNoticeText: "Imported saved report record Imported Detail Target Modal Demo. Reopen in builder is ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported saved report records",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Imported Detail Target Modal Demo",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const input = document.querySelector('input[aria-label=\"Import report file\"]'); if (!input) { throw new Error('import api unavailable'); } return import('/src/components/dashboard/reportBuilderDetailTargetImportedArtifactFixtureState.js').then(({ buildReportBuilderDetailTargetImportedArtifactFixtureState }) => { const fixture = buildReportBuilderDetailTargetImportedArtifactFixtureState(); const payload = { ...fixture.savedReportRecord, documentVersion: 25, savedAt: 10130, savedReportPayload: { ...fixture.savedReportRecord.savedReportPayload, payloadId: 'rbreport_secondary_imported_detail_target_record', sourceArtifactId: 'secondary_imported_detail_target_record', title: 'Secondary Imported Detail Target Demo', reportDocument: { ...fixture.savedReportRecord.savedReportPayload.reportDocument, id: 'secondaryImportedDetailTarget', title: 'Secondary Imported Detail Target Demo' }, reportSpec: { ...fixture.savedReportRecord.savedReportPayload.reportSpec, title: 'Secondary Imported Detail Target Demo', blocks: fixture.savedReportRecord.savedReportPayload.reportSpec.blocks, datasets: fixture.savedReportRecord.savedReportPayload.reportSpec.datasets } } }; const file = new File([JSON.stringify(payload, null, 2)], 'secondary-detail-target.saved-report-record.json', { type: 'application/json' }); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; }); })()"
    },
    {
      type: "waitForDomContains",
      text: "Imported saved report record Secondary Imported Detail Target Demo. Reopen in builder is ready.",
      timeoutMs: 60000
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Imported saved report records') && text.includes('Imported Detail Target Modal Demo') && text.includes('Secondary Imported Detail Target Demo') && text.includes('2 records') && text.includes('1 detail target') && text.includes('1 field action'); })()",
      timeoutMs: 60000,
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
      text: "Imported Detail Target Modal Demo is now the active saved report record.",
      timeoutMs: 60000
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Imported Detail Target Modal Demo",
      timeoutMs: 60000
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder"
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Imported Detail Target Modal Demo for editing.",
      timeoutMs: 60000
    },
    buildAuthoredDetailTargetRestorationWaitStep({
      targetRef: "target://example/performance/channel-detail-modal",
      parameters: {
        channel: "$value",
        eventDate: "$row.eventDate",
        source: "archived",
      },
    }),
    ...buildRuntimeDetailTargetResolutionSteps({
      actionText: "Show Channel details",
      expectedTexts: [
        "target://example/performance/channel-detail-modal",
        "modal",
        "channel",
        "Display",
        "eventDate",
        "2026-05-01",
        "source",
        "archived",
      ],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-detail-target-saved-report-record.png",
      fullPage: true
    }
  ],
};
