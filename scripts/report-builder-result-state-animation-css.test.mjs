import assert from "node:assert/strict";
import fs from "node:fs/promises";

const dashboardCss = await fs.readFile(
  "/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/Dashboard.css",
  "utf8",
);

assert.match(
  dashboardCss,
  /\.forge-report-builder__result-state-icon-glyph\s*\{[\s\S]*width:\s*16px;[\s\S]*height:\s*16px;[\s\S]*will-change:\s*transform;/,
);
assert.match(
  dashboardCss,
  /\.forge-report-builder__result-state-icon-glyph\s*>\s*\.bp6-icon\s*>\s*svg\s*\{[\s\S]*transform-origin:\s*center center;[\s\S]*transform-box:\s*fill-box;[\s\S]*will-change:\s*transform;/,
);
assert.match(
  dashboardCss,
  /\.forge-report-builder__result-state-icon\.is-animated\s+\.forge-report-builder__result-state-icon-glyph\s*>\s*\.bp6-icon\s*>\s*svg\s*\{[\s\S]*animation:\s*forge-report-builder-result-state-spin 1\.1s linear infinite;/,
);
assert.match(
  dashboardCss,
  /@keyframes forge-report-builder-result-state-spin\s*\{[\s\S]*0%\s*\{[\s\S]*transform:\s*rotate\(0deg\);[\s\S]*100%\s*\{[\s\S]*transform:\s*rotate\(360deg\);[\s\S]*\}/,
);
assert.doesNotMatch(
  dashboardCss,
  /@keyframes forge-report-builder-result-state-spin[\s\S]*(scale|translate|skew)\(/,
);

console.log("report-builder-result-state-animation-css ✓ loading result icon uses fixed-size pure rotation without translation or scaling");
