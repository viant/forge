import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("savedExplorationArtifactOpen\n            ? buildReportBuilderExplorationArtifactInspectorState(savedExplorationArtifact)\n            : null"),
  true,
  "Saved exploration artifact inspectors should only render when the draft inspector is explicitly opened.",
);

assert.equal(
  source.includes("savedReportPayloadOpen\n            ? buildReportBuilderSavedReportPayloadInspectorState(savedReportPayload)\n            : null"),
  true,
  "Saved report payload inspectors should stay hidden until the report inspector is opened.",
);

assert.equal(
  source.includes("getReportDocumentResponseOpen\n            ? buildReportBuilderReportDocumentReadResponseInspectorState(getReportDocumentResponse)\n            : null"),
  true,
  "Prepared getReportDocument responses should respect the Inspect get response toggle.",
);

assert.equal(
  source.includes("createReportDocumentPayloadOpen\n            ? buildReportBuilderCreateReportDocumentPayloadInspectorState(createReportDocumentPayload)\n            : null"),
  true,
  "Prepared createReportDocument payloads should stay collapsed until their inspector is opened.",
);

assert.equal(
  source.includes("updateReportDocumentPayloadOpen\n            ? buildReportBuilderUpdateReportDocumentPayloadInspectorState(updateReportDocumentPayload)\n            : null"),
  true,
  "Prepared updateReportDocument payloads should stay collapsed until their inspector is opened.",
);

assert.equal(
  source.includes("listReportDocumentsResponseOpen\n            ? buildReportBuilderReportDocumentReadResponseInspectorState(listReportDocumentsResponse, {"),
  true,
  "Prepared listReportDocuments responses should respect the Inspect list response toggle.",
);

assert.equal(
  source.includes("getReportDocumentRequestPayloadOpen\n            ? buildReportBuilderGetReportDocumentRequestInspectorState(getReportDocumentRequestPayload, {"),
  true,
  "Prepared getReportDocument requests should respect the Inspect get request toggle.",
);

console.log("reportBuilderInspectorToggleCoverage ✓ saved and prepared inspector panels stay collapsed until explicitly opened");
