import assert from "node:assert/strict";

import { normalizeChartAnnotations, resolveChartAnnotationStrokeDasharray } from "./reportChartAnnotations.js";

assert.equal(resolveChartAnnotationStrokeDasharray("solid"), "");
assert.equal(resolveChartAnnotationStrokeDasharray("dashed"), "6 4");
assert.equal(resolveChartAnnotationStrokeDasharray("dotted"), "2 4");

assert.deepEqual(normalizeChartAnnotations({
  annotations: {
    verticalMarkers: [
      { id: "launch", value: "2026-05-02", label: "Launch", color: "#d9822b", lineStyle: "dashed", position: "start" },
    ],
    referenceLines: [
      { id: "goal", axis: "y", value: 38000, label: "Goal", color: "#7a46d8" },
    ],
    bands: [
      { id: "window", axis: "x", from: "2026-05-01", to: "2026-05-03", label: "Window", color: "#137cbd", opacity: 0.18 },
    ],
    notes: [
      { id: "peak", x: "2026-05-02", y: 35500, label: "Peak", color: "#0f9960" },
    ],
  },
}), [
  {
    id: "launch",
    kind: "verticalMarker",
    axis: "x",
    value: "2026-05-02",
    label: "Launch",
    color: "#d9822b",
    lineStyle: "dashed",
    position: "start",
  },
  {
    id: "goal",
    kind: "referenceLine",
    axis: "y",
    value: 38000,
    label: "Goal",
    color: "#7a46d8",
    lineStyle: "solid",
    position: "end",
  },
  {
    id: "window",
    kind: "band",
    axis: "x",
    from: "2026-05-01",
    to: "2026-05-03",
    label: "Window",
    color: "#137cbd",
    opacity: 0.18,
  },
  {
    id: "peak",
    kind: "note",
    x: "2026-05-02",
    y: 35500,
    label: "Peak",
    color: "#0f9960",
  },
]);

assert.deepEqual(normalizeChartAnnotations({
  annotations: {
    verticalMarkers: [{ value: "" }],
    referenceLines: [{ axis: "x" }],
    bands: [{ axis: "y", from: null, to: 1 }],
    notes: [{ x: "2026-05-02", y: 35500 }],
  },
}), []);

console.log("reportChartAnnotations ✓ normalizes canonical chart annotations for runtime and print");
