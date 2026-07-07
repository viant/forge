import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReportBuilderAuthoredRuntimePreviewHeader } from "./reportBuilderRuntimePreviewSection.js";

const html = renderToStaticMarkup(React.createElement(ReportBuilderAuthoredRuntimePreviewHeader, {
  state: {
    eyebrow: "Authored Runtime",
    title: "Semantic Capacity Trend Q3",
    subtitle: "Weekly Rollup",
    description: "Refine the current builder result through the compiled runtime flow.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
      "Model Ad Delivery",
      "Entity Line Delivery",
      "Measures Available Impressions",
    ],
    semanticBindingFieldGroups: [
      {
        id: "measures",
        title: "Selected measures (1)",
        fields: [
          {
            id: "available_impressions",
            label: "Available Impressions",
            description: "Approved avails metric",
          },
        ],
      },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
      {
        id: "dateRange",
        label: "Reporting Window",
        description: "Approved reporting window for runtime preview.",
      },
    ],
  },
}));

assert.equal(html.includes("Semantic Binding"), true);
assert.equal(html.includes("Measures Available Impressions"), true);
assert.equal(html.includes("Selected measures (1)"), true);
assert.equal(html.includes("Approved avails metric"), true);
assert.equal(html.includes("Filters"), true);
assert.equal(html.includes("Reporting Window"), true);
assert.equal(html.includes("data-report-builder-semantic-binding=\"true\""), true);
assert.equal(html.includes("data-report-builder-scope-summary=\"true\""), true);

console.log("reportBuilderRuntimePreviewSection ✓ renders authored runtime semantic binding and scope sections");
