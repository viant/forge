import assert from "node:assert/strict";

import { resolveDefaultReportBuilderInsertionAfterId } from "./reportBuilderDocumentInsertionModel.js";

assert.equal(resolveDefaultReportBuilderInsertionAfterId(), "primaryBuilder");

assert.equal(resolveDefaultReportBuilderInsertionAfterId({
  preferredInsertionAfterId: "detailTable",
  authoredBlocks: [
    { id: "headlineKpi" },
    { id: "detailTable" },
  ],
}), "detailTable");

assert.equal(resolveDefaultReportBuilderInsertionAfterId({
  authoredBlocks: [
    { id: "headlineKpi" },
    { id: "detailTable" },
  ],
}), "detailTable");

assert.equal(resolveDefaultReportBuilderInsertionAfterId({
  authoredBlocks: [
    { id: "headlineKpi" },
    { id: "detailTable" },
    { id: "statusPills" },
  ],
}), "statusPills");

console.log("reportBuilderDocumentInsertionModel ✓ resolves document-first insertion anchors before falling back to primaryBuilder");
