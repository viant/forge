import assert from "node:assert/strict";

import { validatePreviewSemanticSelectionParameters } from "./previewSemanticParameterValidation.js";

const semanticModel = {
  modelRef: "model://example/performance/delivery@v1",
  entities: [
    {
      id: "line_delivery",
      parameters: [
        { id: "reporting_window", label: "Date Range", dataType: "date" },
        { id: "delivery_channels_filter", label: "Channels", dataType: "string" },
        { id: "audience_segment", label: "Audience Segment", dataType: "string", definitionRef: "harmonizer://feature/user.segment" },
      ],
    },
  ],
};

const flatFieldSemanticModel = {
  modelRef: "model://example/performance/delivery@v1",
  entities: [
    {
      id: "line_delivery",
      fields: [
        { id: "reporting_window", label: "Date Range", featureType: "parameter", dataType: "date" },
        { id: "delivery_channels_filter", label: "Channels", featureType: "parameter", dataType: "string" },
        { id: "audience_segment", label: "Audience Segment", featureType: "parameter", dataType: "string", definitionRef: "harmonizer://feature/user.segment" },
        { id: "audience_index", label: "Audience Index", featureType: "measure", dataType: "number", definitionRef: "harmonizer://feature/user.segment.index" },
      ],
    },
  ],
};

const staticFilters = [
  {
    id: "dateRange",
    semanticRef: "reporting_window",
    label: "Date Range",
    type: "dateRange",
  },
  {
    id: "channelsFilter",
    semanticRef: "delivery_channels_filter",
    label: "Channels",
    multiple: true,
    options: [
      { label: "Display", value: "Display" },
      { label: "CTV", value: "CTV" },
    ],
  },
  {
    id: "audienceSegmentFilter",
    semanticRef: "audience_segment",
    label: "Audience Segment",
    multiple: true,
    options: [
      { label: "Young Adults", value: "Young Adults" },
      { label: "Established Adults", value: "Established Adults" },
    ],
  },
];

assert.deepEqual(validatePreviewSemanticSelectionParameters({
  model: semanticModel,
  entityId: "line_delivery",
  staticFilters,
  parameters: {
    reporting_window: {
      start: "2026-05-01",
      end: "2026-05-07",
    },
    delivery_channels_filter: ["Display", "CTV"],
    audience_segment: ["Young Adults"],
  },
}), {
  parameters: {
    reporting_window: {
      start: "2026-05-01",
      end: "2026-05-07",
    },
    delivery_channels_filter: ["Display", "CTV"],
    audience_segment: ["Young Adults"],
  },
  diagnostics: [],
});

assert.deepEqual(validatePreviewSemanticSelectionParameters({
  model: flatFieldSemanticModel,
  entityId: "line_delivery",
  staticFilters,
  parameters: {
    reporting_window: {
      start: "2026-05-01",
      end: "2026-05-07",
    },
    delivery_channels_filter: ["Display"],
    audience_segment: ["Young Adults"],
  },
}), {
  parameters: {
    reporting_window: {
      start: "2026-05-01",
      end: "2026-05-07",
    },
    delivery_channels_filter: ["Display"],
    audience_segment: ["Young Adults"],
  },
  diagnostics: [],
});

assert.deepEqual(validatePreviewSemanticSelectionParameters({
  model: semanticModel,
  entityId: "line_delivery",
  staticFilters,
  parameters: {
    reporting_window: {
      start: "2026-05-07",
      end: "2026-05-01",
    },
  },
}), {
  parameters: {
    reporting_window: {
      start: "2026-05-07",
      end: "2026-05-01",
    },
  },
  diagnostics: [
    {
      code: "invalidParameterRange",
      severity: "error",
      path: "selection.parameters.reporting_window",
      message: "Date Range start date must be on or before the end date.",
      suggestedFix: "Adjust the date range so the start date is not after the end date.",
    },
  ],
});

assert.deepEqual(validatePreviewSemanticSelectionParameters({
  model: semanticModel,
  entityId: "line_delivery",
  staticFilters,
  parameters: {
    reporting_window: {
      start: "2026-05-01",
    },
  },
}), {
  parameters: {
    reporting_window: {
      start: "2026-05-01",
    },
  },
  diagnostics: [
    {
      code: "incompleteParameter",
      severity: "error",
      path: "selection.parameters.reporting_window",
      message: "Date Range requires both start and end dates.",
      suggestedFix: "Provide both start and end dates to continue.",
    },
  ],
});

assert.deepEqual(validatePreviewSemanticSelectionParameters({
  model: semanticModel,
  entityId: "line_delivery",
  staticFilters,
  parameters: {
    delivery_channels_filter: ["Display", "Roku"],
  },
}), {
  parameters: {
    delivery_channels_filter: ["Display", "Roku"],
  },
  diagnostics: [
    {
      code: "unsupportedParameterValue",
      severity: "error",
      path: "selection.parameters.delivery_channels_filter",
      message: "Channels contains unsupported values: Roku.",
      suggestedFix: "Choose one of the configured semantic scope values before running the report.",
    },
  ],
});

assert.deepEqual(validatePreviewSemanticSelectionParameters({
  model: semanticModel,
  entityId: "line_delivery",
  staticFilters,
  parameters: {
    audience_segment: ["Young Adults", "Prospects"],
  },
}), {
  parameters: {
    audience_segment: ["Young Adults", "Prospects"],
  },
  diagnostics: [
    {
      code: "unsupportedParameterValue",
      severity: "error",
      path: "selection.parameters.audience_segment",
      message: "Audience Segment contains unsupported values: Prospects.",
      suggestedFix: "Choose one of the configured semantic scope values before running the report.",
    },
  ],
});

assert.deepEqual(validatePreviewSemanticSelectionParameters({
  model: semanticModel,
  entityId: "line_delivery",
  staticFilters,
  parameters: {
    unknown_parameter: "x",
  },
}), {
  parameters: {
    unknown_parameter: "x",
  },
  diagnostics: [
    {
      code: "unknownParameter",
      severity: "error",
      path: "selection.parameters.unknown_parameter",
      message: "unknown_parameter is not available in the current semantic entity.",
      suggestedFix: "Remove the unsupported semantic scope parameter or choose a supported filter.",
    },
  ],
});

console.log("previewSemanticParameterValidation ✓ validates preview semantic parameter payloads against entity parameter metadata and configured scope rules");
