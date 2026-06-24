import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("buildReportBuilderLifecycleActionState(activeSavedArtifactSummary"),
  true,
  "ReportBuilder should derive provider-driven lifecycle/share actions for the active saved artifact.",
);

assert.equal(
  source.includes("triggerActiveSavedArtifactLifecycleAction"),
  true,
  "ReportBuilder should expose a dedicated lifecycle action trigger for the active saved artifact summary.",
);

assert.equal(
  source.includes("activeSavedArtifactLifecycleActionState.actions"),
  true,
  "ReportBuilder should render lifecycle/share action buttons from the derived active saved artifact action state.",
);

assert.equal(
  source.includes("projectReportBuilderLifecycleEnvelopeState({"),
  true,
  "ReportBuilder should route shared-artifact lifecycle reconciliation through the shared lifecycle-result helper.",
);

assert.match(
  source,
  /triggerActiveSavedArtifactLifecycleAction[\s\S]*replaceSelectedListEntrySource:/,
  "ReportBuilder should let active saved-artifact lifecycle actions reconcile prepared catalog responses when they target the same artifact.",
);

assert.equal(
  source.includes("buildReportBuilderLifecycleActionState(selectedListReportDocumentsEntrySummary"),
  true,
  "ReportBuilder should derive provider-driven lifecycle/share actions for the selected catalog entry.",
);

assert.equal(
  source.includes("triggerSelectedListEntryLifecycleAction"),
  true,
  "ReportBuilder should expose a dedicated lifecycle action trigger for selected catalog entries.",
);

assert.equal(
  source.includes("selectedListEntryLifecycleActionState?.actions"),
  true,
  "ReportBuilder should render lifecycle/share action buttons from the selected catalog-entry action state.",
);

assert.equal(
  source.includes("triggerReopenedSessionLifecycleAction"),
  true,
  "ReportBuilder should expose a dedicated lifecycle action trigger for reopened shared-artifact sessions.",
);

assert.equal(
  source.includes("applyLifecycleSharedArtifactResult(result"),
  true,
  "ReportBuilder should normalize successful lifecycle results into local shared-artifact records.",
);

assert.equal(
  source.includes("projectReportBuilderLifecycleEnvelopeState({"),
  true,
  "ReportBuilder should normalize richer lifecycle result envelopes before projecting host-returned artifacts.",
);

assert.equal(
  source.includes("envelope.getReportDocumentRequest"),
  true,
  "ReportBuilder should accept host-returned get-request artifacts from lifecycle result envelopes.",
);

assert.equal(
  source.includes("envelope.reopenReportDocumentDiagnostic"),
  true,
  "ReportBuilder should accept host-returned reopen diagnostics from lifecycle result envelopes.",
);

assert.equal(
  source.includes("envelope.createReportDocumentPayload"),
  true,
  "ReportBuilder should accept host-returned create payloads from lifecycle result envelopes.",
);

assert.equal(
  source.includes("envelope.updateReportDocumentPayload"),
  true,
  "ReportBuilder should accept host-returned update payloads from lifecycle result envelopes.",
);

assert.equal(
  source.includes("envelope.updateReportDocumentConflictDiagnostic"),
  true,
  "ReportBuilder should accept host-returned update conflict diagnostics from lifecycle result envelopes.",
);

assert.equal(
  source.includes("label=\"Latest shared artifact\""),
  true,
  "ReportBuilder should surface the latest returned shared artifact in the real builder flow.",
);

assert.equal(
  source.includes("triggerLatestLifecycleSharedArtifactExport"),
  true,
  "ReportBuilder should expose export execution for the latest returned shared artifact when the bundle is valid.",
);

assert.equal(
  source.includes("downloadLatestLifecycleSharedArtifact"),
  true,
  "ReportBuilder should expose direct artifact download for the latest returned shared artifact.",
);

assert.equal(
  source.includes("ariaLabel: \"Latest shared artifact summary\""),
  true,
  "ReportBuilder should expose an inspector panel for the latest returned shared artifact itself.",
);

assert.equal(
  source.includes("resolveReportBuilderSharedArtifactHandler(builderContext?.handlers?.reportSharedArtifacts)"),
  true,
  "ReportBuilder should resolve the hosted shared-artifact inventory handler.",
);

assert.equal(
  source.includes("normalizeReportBuilderSharedArtifactInventory(result)"),
  true,
  "ReportBuilder should normalize backend shared-artifact inventory results into existing local record contracts.",
);

assert.match(
  source,
  /configuredSavedPayloads:\s*\[\s*\.\.\.rawLocalReportDocumentSavedPayloads\.filter\(\(entry\) => entry !== savedReportPayload\),\s*\.\.\.localLifecycleSharedArtifactRecords,\s*\.\.\.backendSharedArtifactRecords,\s*\.\.\.importedLocalSavedReportRecords,\s*\]/s,
  "ReportBuilder should resolve selected catalog entries against backend shared-artifact records as well as local payloads.",
);

assert.match(
  source,
  /buildReportBuilderGetReportDocumentRequest\(\s*activeListReportDocumentsResponse,/,
  "ReportBuilder should prepare catalog get requests from the active list response, including backend inventory-backed catalogs.",
);

assert.match(
  source,
  /buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState\(\s*activeListReportDocumentsResponse,/,
  "ReportBuilder should expand selected reopen bundles from the active list response when the backend inventory is the visible catalog.",
);

assert.match(
  source,
  /buildReportBuilderSelectedGetReportDocumentResponse\(\s*activeListReportDocumentsResponse,/,
  "ReportBuilder should resolve selected reopen bundles from backend inventory-backed catalog entries.",
);

assert.match(
  source,
  /buildReportBuilderListReportDocumentsEntryDiagnostic\(\s*activeListReportDocumentsResponse,/,
  "ReportBuilder should derive reopen diagnostics from the active list response instead of only explicit local catalog payloads.",
);

assert.equal(
  source.includes("setBackendSharedArtifactRecords(nextBackendSharedArtifactRecords)"),
  true,
  "ReportBuilder should reconcile backend shared-artifact inventory through the shared lifecycle-result helper.",
);

assert.equal(
  source.includes("resolveReportBuilderSharedArtifactInventoryRecord("),
  true,
  "ReportBuilder should resolve the selected backend inventory record before attempting explicit artifact hydration.",
);

assert.equal(
  source.includes("reportSharedArtifactHandler.getArtifact({ artifactId: selectedBackendSharedArtifactId })"),
  true,
  "ReportBuilder should hydrate the selected backend shared artifact through the explicit getArtifact host handler.",
);

assert.equal(
  source.includes("mergeReportBuilderSharedArtifactInventoryRecord("),
  true,
  "ReportBuilder should merge refreshed backend shared artifacts back into the in-memory inventory.",
);

assert.equal(
  source.includes("listReportDocumentsResponseInspector?.artifactId || \"\""),
  true,
  "ReportBuilder should surface the selected catalog entry backend artifact id in the catalog inspector chips.",
);

assert.equal(
  source.includes("listReportDocumentsResponseInspector?.sourceArtifactId || \"\""),
  true,
  "ReportBuilder should surface the selected catalog entry source artifact id in the catalog inspector chips.",
);

assert.equal(
  source.includes("buildReportBuilderSelectedGetReportDocumentResponseFromSharedArtifact("),
  true,
  "ReportBuilder should prefer a direct selected-get response built from the refreshed backend shared artifact when the active catalog comes from backend inventory.",
);

assert.equal(
  source.includes("getReportDocumentResponseSummary.lifecycle"),
  true,
  "ReportBuilder should surface prepared reopen-bundle lifecycle provenance when the response came from a backend shared artifact.",
);

assert.equal(
  source.includes("buildReportBuilderLifecycleActionState(reopenedSessionNoticeState"),
  true,
  "ReportBuilder should derive provider-driven lifecycle/share actions for reopened shared-artifact sessions.",
);

assert.equal(
  source.includes("triggerReopenedSessionLifecycleAction"),
  true,
  "ReportBuilder should expose a dedicated lifecycle action trigger for reopened shared-artifact sessions.",
);

assert.equal(
  source.includes("reopenedSessionLifecycleActionState?.actions"),
  true,
  "ReportBuilder should render lifecycle/share action buttons from the reopened shared-artifact session state.",
);

assert.equal(
  source.includes("nextHydratedSession"),
  true,
  "ReportBuilder should persist returned shared-artifact provenance back into the reopened session after lifecycle actions.",
);

assert.equal(
  source.includes("setBackendSharedArtifactRecords((current) => mergeReportBuilderSharedArtifactInventoryRecord("),
  true,
  "ReportBuilder should reconcile the backend shared-artifact inventory after reopened-session lifecycle actions.",
);

assert.equal(
  source.includes("setUpdateReportDocumentConflictDiagnostic(null)"),
  true,
  "ReportBuilder should still clear stale update-conflict diagnostics when lifecycle results invalidate the prepared update payload anchor.",
);

console.log("reportBuilderLifecycleActionCoverage ✓ saved artifact and selected catalog summaries remain wired to generic lifecycle/share action state");
