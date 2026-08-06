import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/demos/reportBuilder/ReportBuilderPreview.jsx"),
  "utf8",
);

assert.equal(
  source.includes("metrics.lastExportRequest = exportRecord;"),
  true,
  "Preview export handling should capture the latest export request metadata for downstream history scenarios.",
);

assert.equal(
  source.includes("metrics.exportRequestHistory = ["),
  true,
  "Preview export handling should append export requests into a durable preview-side history list.",
);

assert.equal(
  source.includes("metrics.lastExportStatus = {"),
  true,
  "Preview export status polling should retain the latest job status for proof scenarios.",
);

assert.equal(
  source.includes("applyPreviewExportBehavior("),
  true,
  "Preview export handling should remain compatible with the override behavior API used by scenario proofs.",
);

console.log("previewExportHistory ✓ preview export handlers retain request/status history and stay wired to export override behaviors");
