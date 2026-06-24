import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReportBuilderResultState } from "./reportBuilderComponents.jsx";

const animatedHtml = renderToStaticMarkup(
  React.createElement(ReportBuilderResultState, {
    icon: "refresh",
    eyebrow: "Loading",
    title: "Refreshing report data",
    description: "Preparing the latest result set for the current scope.",
    animated: true,
  }),
);

assert.match(animatedHtml, /forge-report-builder__result-state[^"]*is-animated/);
assert.match(animatedHtml, /forge-report-builder__result-state-icon[^"]*is-animated/);
assert.ok(animatedHtml.includes("forge-report-builder__result-state-icon-glyph"));
assert.ok(animatedHtml.includes("Refreshing report data"));

const staticHtml = renderToStaticMarkup(
  React.createElement(ReportBuilderResultState, {
    icon: "warning-sign",
    eyebrow: "Result error",
    title: "We couldn't render these results",
    description: "A synthetic result-state message.",
  }),
);

assert.doesNotMatch(staticHtml, /forge-report-builder__result-state[^"]*is-animated/);
assert.doesNotMatch(staticHtml, /forge-report-builder__result-state-icon[^"]*is-animated/);

console.log("reportBuilderResultState ✓ animates loading result cards without affecting static states");
