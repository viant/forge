import assert from "node:assert/strict";

import { resolveReportRuntimeChartInteractionSupport } from "./reportRuntimeChartInteractions.js";

assert.deepEqual(resolveReportRuntimeChartInteractionSupport({
  type: "line",
}), {
  enabled: true,
  reason: "",
  message: "",
  legendEnabled: false,
});

assert.deepEqual(resolveReportRuntimeChartInteractionSupport({
  type: "pie",
}), {
  enabled: true,
  reason: "",
  message: "",
  legendEnabled: false,
});

assert.deepEqual(resolveReportRuntimeChartInteractionSupport({
  type: "donut",
}), {
  enabled: true,
  reason: "",
  message: "",
  legendEnabled: false,
});

assert.deepEqual(resolveReportRuntimeChartInteractionSupport({
  type: "line",
  seriesField: "channelV2",
}), {
  enabled: true,
  reason: "",
  message: "",
  legendEnabled: true,
});

assert.deepEqual(resolveReportRuntimeChartInteractionSupport({
  type: "bar",
  seriesField: "channelV2",
}), {
  enabled: true,
  reason: "",
  message: "",
  legendEnabled: true,
});

assert.deepEqual(resolveReportRuntimeChartInteractionSupport({
  type: "pie",
  seriesField: "channelV2",
}), {
  enabled: false,
  reason: "seriesField",
  message: "Chart actions are currently available only for supported cartesian series-field charts, single-series charts, and categorical pies/donuts.",
  legendEnabled: false,
});

assert.deepEqual(resolveReportRuntimeChartInteractionSupport({
  type: "radar",
}), {
  enabled: false,
  reason: "unsupportedType",
  message: "Chart actions are currently available only for supported cartesian charts and categorical pies/donuts.",
  legendEnabled: false,
});

assert.deepEqual(resolveReportRuntimeChartInteractionSupport({}), {
  enabled: false,
  reason: "missingType",
  message: "Chart actions are unavailable because this chart does not declare a type.",
  legendEnabled: false,
});

console.log("reportRuntimeChartInteractions ✓ describes the supported authored runtime chart action surface");
