import assert from "node:assert/strict";

import { buildChartCategoryTickLabel, buildMeasuredChartCategoryTickLabel, normalizeChartCategoryLabelConfig } from "./chartCategoryLabel.js";

assert.deepEqual(normalizeChartCategoryLabelConfig({ lines: 2, maxCharacters: 18 }), { lines: 2, maxCharacters: 18 });
assert.deepEqual(normalizeChartCategoryLabelConfig({ lines: 1, maxCharacters: 999 }), { lines: 1, maxCharacters: 120 });
assert.equal(normalizeChartCategoryLabelConfig({ lines: 3 }), null);
assert.deepEqual(buildChartCategoryTickLabel("Creative\uFFFD\uFFFD long label", { lines: 2, maxCharacters: 8 }), {
  fullText: "Creative? long label",
  lines: ["Creative", "? long …"],
  truncated: true,
});
assert.deepEqual(buildMeasuredChartCategoryTickLabel(
  "Delivery - Leave Checked",
  { lines: 2, maxCharacters: 10 },
  72,
  (value) => value.length * 6,
), {
  fullText: "Delivery - Leave Checked",
  lines: ["Delivery -", "Leave Ch…"],
  truncated: true,
  measured: true,
});
assert.deepEqual(buildMeasuredChartCategoryTickLabel(
  "Point of Care|Veterinary's Offices",
  { lines: 2, maxCharacters: 18 },
  120,
  (value) => value.length * 6,
), {
  fullText: "Point of Care|Veterinary's Offices",
  lines: ["Point of Care|", "Veterinary's Offi…"],
  truncated: true,
  measured: true,
});
const longMeasuredLabel = buildMeasuredChartCategoryTickLabel(
  "Entertainment|Recreational Locations With A Very Long Suffix",
  { lines: 2, maxCharacters: 18 },
  120,
  (value) => value.length * 6,
);
assert.ok(longMeasuredLabel.lines.length <= 2);
assert.ok(longMeasuredLabel.lines.every((line) => Array.from(line).length <= 18));
assert.equal(longMeasuredLabel.truncated, true);
