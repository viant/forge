import assert from "node:assert/strict";

import { buildChartCategoryTickLabel, normalizeChartCategoryLabelConfig } from "./chartCategoryLabel.js";

assert.deepEqual(normalizeChartCategoryLabelConfig({ lines: 2, maxCharacters: 18 }), { lines: 2, maxCharacters: 18 });
assert.deepEqual(normalizeChartCategoryLabelConfig({ lines: 1, maxCharacters: 999 }), { lines: 1, maxCharacters: 120 });
assert.equal(normalizeChartCategoryLabelConfig({ lines: 3 }), null);
assert.deepEqual(buildChartCategoryTickLabel("Creative\uFFFD\uFFFD long label", { lines: 2, maxCharacters: 8 }), {
  fullText: "Creative? long label",
  lines: ["Creative", "? long …"],
  truncated: true,
});
