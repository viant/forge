import assert from "node:assert/strict";

import {
  buildReportBuilderSemanticBindingViewState,
  buildReportBuilderSemanticBindingViewStateFromReportSpec,
} from "./reportBuilderSemanticBindingViewState.js";

assert.equal(buildReportBuilderSemanticBindingViewState(), null);

assert.deepEqual(buildReportBuilderSemanticBindingViewState({
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time" },
      { id: "channel", rawId: "channelV2", label: "Channel", category: "Delivery", definitionRef: "semantic://example/channel" },
      { id: "country_code", rawId: "country", label: "Market", category: "Location", definitionRef: "harmonizer://feature/location" },
    ],
    selectedMeasures: [
      { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics" },
      { id: "household_uniques", rawId: "hhUniqs", label: "Household Uniques", category: "Metrics" },
      { id: "ctr", rawId: "ctr", label: "CTR", category: "Metrics" },
    ],
    selectedParameters: [
      { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", category: "Scope", definitionRef: "semantic://example/reporting_window" },
    ],
  },
}), {
  title: "Semantic Binding",
  chips: [
    "Model Ad Delivery",
    "Entity Line Delivery",
    "Dimensions Delivery Date, Channel +1",
    "Measures Available Impressions, Household Uniques +1",
    "Parameters Reporting Window",
    "Categories Time, Delivery +3",
    "Lineage semantic://example/channel +2",
  ],
  modelLabel: "Ad Delivery",
  entityLabel: "Line Delivery",
  fieldGroups: [
    {
      id: "dimensions",
      title: "Selected dimensions (3)",
      fields: [
        { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time" },
        { id: "channel", rawId: "channelV2", label: "Channel", category: "Delivery", definitionRef: "semantic://example/channel" },
        { id: "country_code", rawId: "country", label: "Market", category: "Location", definitionRef: "harmonizer://feature/location" },
      ],
    },
    {
      id: "measures",
      title: "Selected measures (3)",
      fields: [
        { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics" },
        { id: "household_uniques", rawId: "hhUniqs", label: "Household Uniques", category: "Metrics" },
        { id: "ctr", rawId: "ctr", label: "CTR", category: "Metrics" },
      ],
    },
    {
      id: "parameters",
      title: "Selected parameters (1)",
      fields: [
        { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", category: "Scope", definitionRef: "semantic://example/reporting_window" },
      ],
    },
  ],
});

assert.deepEqual(buildReportBuilderSemanticBindingViewState({
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions"],
  },
}), {
  title: "Semantic Binding",
  chips: [
    "Model model://example/performance/delivery@v1",
    "Entity line_delivery",
    "Dimensions event_date, channel",
    "Measures available_impressions",
  ],
  modelLabel: "model://example/performance/delivery@v1",
  entityLabel: "line_delivery",
  fieldGroups: [
    {
      id: "dimensions",
      title: "Selected dimensions (2)",
      fields: [
        { id: "event_date", rawId: "event_date", label: "event_date" },
        { id: "channel", rawId: "channel", label: "channel" },
      ],
    },
    {
      id: "measures",
      title: "Selected measures (1)",
      fields: [
        { id: "available_impressions", rawId: "available_impressions", label: "available_impressions" },
      ],
    },
  ],
});

assert.deepEqual(buildReportBuilderSemanticBindingViewStateFromReportSpec({
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
  },
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time", definitionRef: "semantic://example/event_date" },
    ],
    selectedMeasures: [
      { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics" },
    ],
    selectedParameters: [
      { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", category: "Scope", definitionRef: "semantic://example/reporting_window" },
    ],
  },
}), {
  title: "Semantic Binding",
  chips: [
    "Model Ad Delivery",
    "Entity Line Delivery",
    "Dimensions Delivery Date",
    "Measures Available Impressions",
    "Parameters Reporting Window",
    "Categories Time, Metrics +1",
    "Lineage semantic://example/event_date +1",
  ],
  modelLabel: "Ad Delivery",
  entityLabel: "Line Delivery",
  fieldGroups: [
    {
      id: "dimensions",
      title: "Selected dimensions (1)",
      fields: [
        { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time", definitionRef: "semantic://example/event_date" },
      ],
    },
    {
      id: "measures",
      title: "Selected measures (1)",
      fields: [
        { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics" },
      ],
    },
    {
      id: "parameters",
      title: "Selected parameters (1)",
      fields: [
        { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", category: "Scope", definitionRef: "semantic://example/reporting_window" },
      ],
    },
  ],
});

console.log("reportBuilderSemanticBindingViewState ✓ derives reader-facing semantic binding chips from semantic summaries and bindings");
