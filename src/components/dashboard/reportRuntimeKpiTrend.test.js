import assert from "node:assert/strict";

import { resolveRuntimeKpiTrend } from "./reportRuntimeKpiTrend.js";

assert.deepEqual(resolveRuntimeKpiTrend(0.17, true), {
    kind: "positive", arrow: "↑", color: "#18794e",
});
assert.deepEqual(resolveRuntimeKpiTrend(-0.069, true), {
    kind: "negative", arrow: "↓", color: "#c23030",
});
assert.deepEqual(resolveRuntimeKpiTrend(0, true), {
    kind: "neutral", arrow: "→", color: "#2563eb",
});
assert.deepEqual(resolveRuntimeKpiTrend(1, false), {
    kind: "neutral", arrow: "", color: "#30404d",
});

console.log("reportRuntimeKpiTrend ✓ positive and negative movement has accessible sign color");
