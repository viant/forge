import assert from "node:assert/strict";

import { isReportDatasetBackedBlockKind } from "./reportBlockKindModel.js";

assert.equal(isReportDatasetBackedBlockKind("tableBlock"), true);
assert.equal(isReportDatasetBackedBlockKind("chartBlock"), true);
assert.equal(isReportDatasetBackedBlockKind("kpiBlock"), true);
assert.equal(isReportDatasetBackedBlockKind("geoMapBlock"), true);
assert.equal(isReportDatasetBackedBlockKind("badgesBlock"), true);
assert.equal(isReportDatasetBackedBlockKind("filterBarBlock"), true);
assert.equal(isReportDatasetBackedBlockKind(" tableBlock "), true);
assert.equal(isReportDatasetBackedBlockKind("reportBuilderBlock"), false);
assert.equal(isReportDatasetBackedBlockKind("markdownBlock"), false);
assert.equal(isReportDatasetBackedBlockKind("TableBlock"), false);
assert.equal(isReportDatasetBackedBlockKind(""), false);

console.log("reportBlockKindModel ✓ centralizes dataset-backed authored block kind detection");
