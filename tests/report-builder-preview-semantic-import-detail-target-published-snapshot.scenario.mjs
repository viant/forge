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
      fixtureValueExpression: "fixture.publishedSnapshotArtifact",
      filename: "detail-target.published-snapshot.json",
      importedNoticeText: "Imported published snapshot Imported Detail Target Modal Published Snapshot. Reopen and export are ready.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported saved report records",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Imported Detail Target Modal Published Snapshot') && text.includes('published-snapshot artifact') && text.includes('1 detail target') && text.includes('1 field action'); })()",
      timeoutMs: 60000,
    },
    ...buildTemporaryDetailTargetMutationSteps({
      temporaryTargetRef: "target://example/performance/channel-detail",
      authoredTargetRef: "target://example/performance/channel-detail-modal",
      fieldRef: "channelV2",
    }),
    buildTitledCardButtonClickStep({
      title: "Imported Detail Target Modal Published Snapshot",
      buttonTexts: ["Use"],
      missingButtonMessage: "Imported Detail Target Modal Published Snapshot Use button not found.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported Detail Target Modal Published Snapshot is now the active saved report record.",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Imported Detail Target Modal Published Snapshot",
      reportId: "importedDetailTargetModalDemo",
      documentVersion: 25,
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
      file: "report-builder-preview-semantic-import-detail-target-published-snapshot.png",
      fullPage: true,
    },
  ],
};
