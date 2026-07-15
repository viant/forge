import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("savedReportPayloadApiArtifactEntries.map((artifact) => {"),
  true,
  "ReportBuilder should render prepared API artifacts inside the saved payload handoff area.",
);

assert.equal(
  source.includes("Catalog delivery"),
  true,
  "ReportBuilder should expose list-response workflow controls inside the API handoff area.",
);

assert.equal(
  source.includes("prepareGetReportDocumentRequestPayload"),
  true,
  "API handoff coverage expects the get request preparation flow to remain wired.",
);

assert.equal(
  source.includes("prepareSelectedGetReportDocumentResponseFromListEntry"),
  true,
  "API handoff coverage expects selected get-response expansion to remain wired.",
);

assert.equal(
  source.includes("Conflict review"),
  true,
  "ReportBuilder should expose update conflict workflow controls inside the API handoff area.",
);

assert.equal(
  source.includes("prepareUpdateReportDocumentConflictDiagnostic"),
  true,
  "API handoff coverage expects update conflict diagnostic preparation to remain wired.",
);

assert.equal(
  source.includes("hideSavedPayloadHandoffGetResponseSummary"),
  true,
  "ReportBuilder should track handoff-owned get responses separately from imported or standalone ones.",
);

assert.equal(
  source.includes("getReportDocumentResponseSummary && !hideSavedPayloadHandoffGetResponseSummary"),
  true,
  "Handoff-owned get response summaries should collapse out of the standalone surface.",
);

assert.equal(
  source.includes("listReportDocumentsResponseSummary && !hideSavedPayloadHandoffListResponseSummary"),
  true,
  "Handoff-owned list response summaries should collapse out of the standalone surface.",
);

assert.equal(
  source.includes("updateReportDocumentConflictDiagnosticSummary && !hideSavedPayloadHandoffUpdateConflictSummary"),
  true,
  "Handoff-owned conflict diagnostics should collapse out of the standalone surface.",
);

assert.equal(
  source.includes("reopenReportDocumentDiagnosticSummary && !hideSavedPayloadHandoffReopenDiagnosticSummary"),
  true,
  "Handoff-owned reopen diagnostics should collapse out of the standalone surface.",
);

assert.equal(
  source.includes('artifact.id === "reopenReportDocumentDiagnostic"'),
  true,
  "API handoff coverage expects reopen diagnostics to render as prepared handoff artifacts.",
);

assert.equal(
  source.includes("savedReportPayloadSummary && savedReportPayloadApiArtifactsOpen && hideSavedPayloadHandoffGetResponseSummary ?"),
  true,
  "Handoff-owned get response inspectors should render inside the API handoff area.",
);

assert.equal(
  fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/reportBuilderSavedArtifactViewState.js"),
    "utf8",
  ).includes('downloadLabel: "Download reopen bundle file"'),
  true,
  "Handoff-owned reopen bundle inspectors should use deliverable-oriented download labels.",
);

assert.equal(
  fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/reportBuilderSavedArtifactViewState.js"),
    "utf8",
  ).includes('downloadLabel: "Download catalog response file"'),
  true,
  "Handoff-owned catalog inspectors should use deliverable-oriented download labels.",
);

assert.equal(
  fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/reportBuilderSavedArtifactViewState.js"),
    "utf8",
  ).includes('downloadLabel: "Download create request file"'),
  true,
  "Handoff-owned create request inspectors should use deliverable-oriented download labels.",
);

assert.equal(
  source.includes("savedReportPayloadSummary && savedReportPayloadApiArtifactsOpen && hideSavedPayloadHandoffReopenDiagnosticSummary ?"),
  true,
  "Handoff-owned reopen diagnostic inspectors should render inside the API handoff area.",
);

assert.equal(
  source.includes("!hideSavedPayloadHandoffGetResponseSummary && !hideImportedActivationGetResponseSummary ? renderInspectorNoticePanel(getReportDocumentResponseInspector"),
  true,
  "Standalone get response inspectors should only remain for non-handoff artifacts.",
);

assert.equal(
  source.includes("!hideSavedPayloadHandoffUpdateConflictSummary && !hideImportedActivationUpdatePayloadSummary ? renderInspectorNoticePanel(updateReportDocumentConflictDiagnosticInspector"),
  true,
  "Standalone update conflict inspectors should only remain for non-handoff artifacts.",
);

assert.equal(
  source.includes("savedReportPayloadSummary && savedReportPayloadApiArtifactsOpen && hideSavedPayloadHandoffListResponseSummary ?"),
  true,
  "API handoff coverage expects handoff-owned selected list-entry follow-on surfaces to render inside the handoff area.",
);

assert.equal(
  source.includes("API handoff selected catalog entry export request summary"),
  true,
  "Handoff-owned selected catalog entry export request panels should use catalog-entry wording.",
);

assert.equal(
  source.includes("!hideSavedPayloadHandoffListResponseSummary ? renderInspectorNoticePanel(selectedListEntryExportRequestPanelState"),
  true,
  "Standalone selected-entry export request inspectors should only remain for non-handoff list flows.",
);

assert.equal(
  source.includes("selectedListReportDocumentsEntry && !selectedListReportDocumentsEntryCompileValidation.valid && !hideSavedPayloadHandoffListResponseSummary"),
  true,
  "Selected-entry compile warnings should stay below only for non-handoff list flows.",
);

assert.equal(
  source.includes("selectedListReportDocumentsEntryMetaChips.map((chip) => ("),
  true,
  "API handoff coverage expects selected-entry metadata chips to remain visible when the lower list section is hidden.",
);

assert.equal(
  source.includes("selectedListReportDocumentsEntryNotice.message"),
  true,
  "API handoff coverage expects the no-local-backing guidance to remain visible in the handoff area.",
);

assert.equal(
  fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/reportBuilderSavedArtifactViewState.js"),
    "utf8",
  ).includes("Open delivery handoff"),
  true,
  "Saved report payload controls should use delivery-oriented handoff language.",
);

assert.equal(
  fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/reportBuilderSavedArtifactViewState.js"),
    "utf8",
  ).includes('inspectLabel = "Review artifact"'),
  true,
  "Prepared handoff artifacts should default to review-oriented labels instead of raw JSON wording.",
);

assert.equal(
  source.includes("const handleListReportDocumentsSelectedReportIdChange = React.useCallback"),
  true,
  "ReportBuilder should centralize list-entry selection resets for the handoff and legacy list surfaces.",
);

assert.equal(
  source.includes("savedReportPayloadApiArtifactEntriesById.getReportDocumentResponse?.inspectLabel"),
  true,
  "Standalone prepared-artifact controls should reuse the same label state as the handoff artifacts.",
);

assert.equal(
  source.includes('label={savedReportPayloadApiArtifactEntriesById.getReportDocumentResponse?.label || "Reopen bundle"}'),
  true,
  "Standalone reopen bundle summaries should reuse the same artifact label as the handoff surface.",
);

assert.equal(
  source.includes('label={savedReportPayloadApiArtifactEntriesById.listReportDocumentsResponse?.label || "Catalog response"}'),
  true,
  "Standalone catalog summaries should reuse the same artifact label as the handoff surface.",
);

assert.equal(
  source.includes('label={savedReportPayloadApiArtifactEntriesById.updateReportDocumentConflictDiagnostic?.label || "Conflict diagnostic"}'),
  true,
  "Standalone conflict diagnostic summaries should reuse the same artifact label as the handoff surface.",
);

assert.equal(
  source.includes("Prepared reopen bundle for"),
  true,
  "Saved-report feedback should use reopen bundle language for prepared get responses.",
);

assert.equal(
  source.includes("Prepared catalog response with"),
  true,
  "Saved-report feedback should use catalog response language for prepared list responses.",
);

assert.equal(
  source.includes("Prepared create request"),
  true,
  "Saved-report feedback should use create request language for prepared create payloads.",
);

assert.equal(
  source.includes("Prepared update request"),
  true,
  "Saved-report feedback should use update request language for prepared update payloads.",
);

assert.equal(
  source.includes("setSelectedListEntryExportRequestOpen(false);"),
  true,
  "Changing the selected list entry should close any selected-entry export request inspector state.",
);

assert.equal(
  source.includes("[PREPARED_API_ARTIFACT_KEYS.getReportDocumentRequestPayload]: \"\""),
  true,
  "Changing the selected list entry should clear handoff-owned get-request provenance.",
);

console.log("reportBuilderApiHandoffCoverage ✓ API handoff owns prepared catalog/get-request/conflict workflows");
