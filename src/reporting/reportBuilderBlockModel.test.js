import assert from "node:assert/strict";

import { resolveReportBuilderBlock } from "./reportBuilderBlockModel.js";

assert.equal(resolveReportBuilderBlock(null), null);
assert.equal(resolveReportBuilderBlock({ blocks: [] }), null);

assert.deepEqual(
  resolveReportBuilderBlock({
    blocks: [
      { id: "narrativeIntro", kind: "markdownBlock" },
      { id: "primaryBuilder", kind: "reportBuilderBlock", title: "Builder" },
      { id: "headlineKpi", kind: "kpiBlock" },
    ],
  }),
  { id: "primaryBuilder", kind: "reportBuilderBlock", title: "Builder" },
);

console.log("reportBuilderBlockModel ✓ resolves the embedded reportBuilderBlock from a report document");
