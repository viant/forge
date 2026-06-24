import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

const lines = source.split("\n");
const missingFieldGroupRender = [];
const missingScopeSummaryRender = [];

function assertWindowIncludes(marker, expected, message) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `${message}\nMarker not found: ${marker}`);
  const window = source.slice(index, index + 1000);
  assert.equal(
    window.includes(expected),
    true,
    `${message}\nExpected to find ${expected} near ${marker}`,
  );
}

for (let index = 0; index < lines.length; index += 1) {
  if (!lines[index].includes("semanticBindingChips") || !lines[index].includes("length > 0")) {
    continue;
  }
  const window = lines
    .slice(Math.max(0, index - 3), Math.min(lines.length, index + 16))
    .join("\n");
  if (window.includes("renderSemanticBindingFieldGroups(")) {
    continue;
  }
  missingFieldGroupRender.push({
    line: index + 1,
    snippet: window,
  });

  if (window.includes("renderScopeSummaryItems(")) {
    continue;
  }
  missingScopeSummaryRender.push({
    line: index + 1,
    snippet: window,
  });
}

assert.deepEqual(missingFieldGroupRender, [], [
  "Every semantic chip block in ReportBuilder.jsx should render field-level semantic lineage when available.",
  ...missingFieldGroupRender.map((entry) => `line ${entry.line}\n${entry.snippet}`),
].join("\n\n"));

assert.deepEqual(missingScopeSummaryRender, [], [
  "Every semantic chip block in ReportBuilder.jsx should render report scope details when available.",
  ...missingScopeSummaryRender.map((entry) => `line ${entry.line}\n${entry.snippet}`),
].join("\n\n"));

assert.equal(
  source.includes("renderSemanticBindingFieldGroups(importedStandaloneExportRequestPanelState"),
  true,
  "Imported standalone export request summaries should render semantic field groups when available.",
);

assert.equal(
  source.includes("renderScopeSummaryItems(importedStandaloneExportRequestPanelState"),
  true,
  "Imported standalone export request summaries should render scope summaries when available.",
);

assertWindowIncludes(
  "renderInspectorNoticePanel(importedPipelineExportRequestPanelState",
  "includeSemanticBindingChips: true",
  "Imported pipeline export request inspectors should render semantic binding chips.",
);

assertWindowIncludes(
  "renderInspectorNoticePanel(reopenedExportRequestPanelState",
  "includeSemanticBindingChips: true",
  "Reopened export request inspectors should render semantic binding chips.",
);

assertWindowIncludes(
  "renderInspectorNoticePanel(draftExportRequestPanelState",
  "includeSemanticBindingChips: true",
  "Draft export request inspectors should render semantic binding chips.",
);

assertWindowIncludes(
  "renderInspectorNoticePanel(importedStandaloneExportRequestDetailPanelState",
  "includeSemanticBindingChips: true",
  "Imported standalone export request inspectors should render semantic binding chips.",
);

assert.equal(
  source.includes("renderAuthoredDocumentProgress(importedPipelinePreviewPanelState"),
  true,
  "Imported runtime previews should render authored block and drill summaries when available.",
);

assert.equal(
  source.includes("renderAuthoredDocumentProgress(panelState"),
  true,
  "Inspector notice panels should render authored block and drill summaries when available.",
);

console.log("reportBuilderSemanticBindingCoverage ✓ every ReportBuilder semantic chip section renders field-level semantic lineage and report scope");
