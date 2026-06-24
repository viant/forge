import {
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
      fixtureModulePath: "/src/components/dashboard/reportBuilderDetailTargetImportedArtifactFixtureState.js",
      fixtureBuilderName: "buildReportBuilderDetailTargetImportedArtifactFixtureState",
      fixtureValueExpression: "({ version: 1, kind: 'reportBuilder.savedView', id: fixture.savedViewArtifact.id, title: `${fixture.savedViewArtifact.title} Overlay`, reportId: fixture.savedViewArtifact.reportId, documentVersion: fixture.savedViewArtifact.documentVersion, savedAt: fixture.savedViewArtifact.savedAt, document: { ...fixture.savedViewArtifact.document, title: `${fixture.savedViewArtifact.document.title} Overlay` } })",
      filename: "detail-target.saved-view.overlay.json",
      importedNoticeText: "Imported saved view Imported Detail Target Modal Saved View Overlay. Reopen is ready; export needs a local export-ready artifact.",
    }),
    {
      type: "waitForDomContains",
      text: "Imported saved report records",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Imported Detail Target Modal Saved View Overlay",
      buttonTexts: ["Use"],
      missingSectionMessage: "saved-view overlay imported record card not found",
      missingButtonMessage: "saved-view overlay use button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Imported Detail Target Modal Saved View Overlay is now the active saved report record.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Active saved artifact",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "No export snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const section = Array.from(document.querySelectorAll('div')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Active saved artifact'));
        if (!section) {
          return false;
        }
        const text = section.innerText || section.textContent || '';
        const buttons = Array.from(section.querySelectorAll('button')).map((entry) => (entry.innerText || entry.textContent || '').trim());
        return text.includes('saved-view artifact')
          && text.includes('No export snapshot')
          && !buttons.includes('Inspect export')
          && !buttons.includes('Review export');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-saved-view-overlay.png",
      fullPage: true,
    },
  ],
};
