import assert from "node:assert/strict";

import {
  resolveReportBuilderSemanticRuntimeFallbackAllowance,
  resolveReportBuilderSemanticRuntimeFallbackPreference,
  resolveReportBuilderSemanticRuntimeState,
} from "./useReportBuilderSemanticRuntimeState.js";

const baseConfig = {
  staticFilters: [
    { id: "dateRange", type: "dateRange", label: "Date Range", semanticRef: "reporting_window" },
  ],
  measures: [
    { id: "avails", key: "avails", label: "Avails" },
  ],
  dimensions: [
    { id: "channelV2", key: "channelV2", label: "Channel" },
  ],
};

assert.deepEqual(resolveReportBuilderSemanticRuntimeState({
  config: baseConfig,
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["channelV2"],
  },
  binding: { mode: "raw" },
}), {
  semanticDisplayConfig: baseConfig,
  semanticSummary: null,
  semanticValidationRequest: null,
  semanticValidationFingerprint: "",
  resolvedSemanticSummary: null,
});

const semanticBinding = {
  mode: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  entity: "line_delivery",
  selectedDimensions: ["channelV2"],
  selectedMeasures: ["avails"],
};

const semanticModel = {
  modelRef: "model://example/performance/delivery@v1",
  version: 1,
  label: "Ad Delivery",
  description: "Governed semantic projection for runtime preview.",
  entities: [
    {
      id: "line_delivery",
      label: "Line Delivery",
      description: "Delivery grain.",
      dimensions: [
        {
          id: "channelV2",
          label: "Channel",
          description: "Approved channel label",
          governance: {
            status: "approved",
            certification: "reviewed",
          },
        },
      ],
      measures: [
        {
          id: "avails",
          label: "Available Impressions",
          description: "Approved avails metric",
          format: "compactNumber",
          governance: {
            status: "approved",
            certification: "certified",
          },
        },
      ],
      parameters: [
        {
          id: "reporting_window",
          label: "Reporting Window",
          description: "Approved reporting window",
        },
      ],
    },
  ],
};

const semanticRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: baseConfig,
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["channelV2"],
    scopeParams: {
      dateRange: {
        start: "2026-05-01",
        end: "2026-05-07",
      },
    },
    binding: semanticBinding,
  },
  binding: semanticBinding,
  model: semanticModel,
});

assert.equal(semanticRuntimeState.semanticDisplayConfig.measures[0].label, "Available Impressions");
assert.equal(semanticRuntimeState.semanticDisplayConfig.measures[0].semanticRef, "avails");
assert.equal(semanticRuntimeState.semanticDisplayConfig.dimensions[0].label, "Channel");
assert.equal(semanticRuntimeState.semanticDisplayConfig.dimensions[0].semanticRef, "channelV2");
assert.deepEqual(semanticRuntimeState.semanticValidationRequest, {
  modelRef: "model://example/performance/delivery@v1",
  selection: {
    entity: "line_delivery",
    dimensions: ["channelV2"],
    measures: ["avails"],
    parameters: {
      reporting_window: {
        start: "2026-05-01",
        end: "2026-05-07",
      },
    },
  },
});
assert.equal(semanticRuntimeState.semanticValidationFingerprint, JSON.stringify({
  modelRef: "model://example/performance/delivery@v1",
  selection: {
    entity: "line_delivery",
    dimensions: ["channelV2"],
    measures: ["avails"],
    parameters: {
      reporting_window: {
        start: "2026-05-01",
        end: "2026-05-07",
      },
    },
  },
}));
assert.deepEqual(semanticRuntimeState.semanticSummary, {
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  modelDescription: "Governed semantic projection for runtime preview.",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  entityDescription: "Delivery grain.",
  selectedDimensions: [
    {
      id: "channelV2",
      rawId: "channelV2",
      label: "Channel",
      description: "Approved channel label",
      governance: {
        status: "approved",
        certification: "reviewed",
      },
    },
  ],
  selectedMeasures: [
    {
      id: "avails",
      rawId: "avails",
      label: "Available Impressions",
      description: "Approved avails metric",
      format: "compactNumber",
      governance: {
        status: "approved",
        certification: "certified",
      },
    },
  ],
  selectedParameters: [
    {
      id: "reporting_window",
      rawId: "dateRange",
      label: "Reporting Window",
      description: "Approved reporting window",
    },
  ],
});
assert.deepEqual(semanticRuntimeState.resolvedSemanticSummary, semanticRuntimeState.semanticSummary);

const fallbackAwareRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: {
    staticFilters: [
      { id: "dateRange", type: "dateRange", label: "Date Range", semanticRef: "reporting_window" },
    ],
    measures: [
      { id: "avails", key: "avails", semanticRef: "avails", label: "Avails" },
    ],
    dimensions: [
      { id: "channelV2", key: "channelV2", semanticRef: "channelV2", label: "Channel" },
    ],
  },
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["channelV2"],
    scopeParams: {
      dateRange: {
        start: "2026-05-01",
        end: "2026-05-07",
      },
    },
    binding: semanticBinding,
  },
  binding: semanticBinding,
  model: null,
  providerAvailable: true,
  modelLoading: true,
  fallbackSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Fallback Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Fallback Line Delivery",
    selectedDimensions: [
      { id: "channelV2", rawId: "channelV2", label: "Fallback Channel" },
    ],
    selectedMeasures: [
      { id: "avails", rawId: "avails", label: "Fallback Available Impressions", format: "compactNumber" },
    ],
  },
  fallbackFingerprint: JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
      entity: "line_delivery",
      dimensions: ["channelV2"],
      measures: ["avails"],
      parameters: {
        reporting_window: {
          start: "2026-05-01",
          end: "2026-05-07",
        },
      },
    },
  }),
});

assert.equal(fallbackAwareRuntimeState.resolvedSemanticSummary.modelLabel, "Fallback Ad Delivery");
assert.equal(fallbackAwareRuntimeState.resolvedSemanticSummary.entityLabel, "Fallback Line Delivery");
assert.equal(fallbackAwareRuntimeState.resolvedSemanticSummary.selectedMeasures[0].label, "Fallback Available Impressions");
assert.equal(fallbackAwareRuntimeState.resolvedSemanticSummary.selectedDimensions[0].label, "Fallback Channel");

const rawIdFallbackAwareRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: {
    staticFilters: [
      { id: "dateRange", type: "dateRange", label: "Date Range", semanticRef: "reporting_window" },
    ],
    measures: [
      { id: "totalSpend", key: "totalSpend", semanticRef: "spend", label: "Spend" },
      { id: "impressions", key: "impressions", semanticRef: "impressions", label: "Impressions" },
    ],
    dimensions: [
      { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Date" },
      { id: "channelId", key: "channelId", semanticRef: "channel", label: "Channel" },
    ],
  },
  state: {
    selectedMeasures: ["totalSpend", "impressions"],
    selectedDimensions: ["eventDate", "channelId"],
    scopeParams: {
      dateRange: {
        start: "2026-06-19",
        end: "2026-06-25",
      },
    },
    binding: {
      mode: "semantic",
      modelRef: "model://example/performance/delivery@v1",
      entity: "line_delivery",
      selectedDimensions: ["event_date", "channel"],
      selectedMeasures: ["spend", "impressions"],
    },
  },
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["spend", "impressions"],
  },
  model: null,
  providerAvailable: true,
  modelLoading: true,
  fallbackSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Canonical Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Canonical Line Delivery",
    selectedDimensions: [
      { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
      { id: "channel", rawId: "channelId", label: "Canonical Channel" },
    ],
    selectedMeasures: [
      { id: "spend", rawId: "totalSpend", label: "Canonical Spend", format: "currency" },
      { id: "impressions", rawId: "impressions", label: "Canonical Impressions", format: "compactNumber" },
    ],
    selectedParameters: [
      { id: "reporting_window", rawId: "dateRange", label: "Canonical Reporting Window" },
    ],
  },
  fallbackFingerprint: JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
      entity: "line_delivery",
      dimensions: ["event_date", "channel"],
      measures: ["spend", "impressions"],
      parameters: {
        reporting_window: {
          start: "2026-06-19",
          end: "2026-06-25",
        },
      },
    },
  }),
});

assert.equal(rawIdFallbackAwareRuntimeState.resolvedSemanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(rawIdFallbackAwareRuntimeState.resolvedSemanticSummary.entityLabel, "Canonical Line Delivery");
assert.equal(rawIdFallbackAwareRuntimeState.resolvedSemanticSummary.selectedDimensions[0].label, "Canonical Delivery Date");
assert.equal(rawIdFallbackAwareRuntimeState.resolvedSemanticSummary.selectedMeasures[0].label, "Canonical Spend");
assert.equal(rawIdFallbackAwareRuntimeState.resolvedSemanticSummary.selectedParameters[0].label, "Canonical Reporting Window");

const noProviderFallbackRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: {
    staticFilters: [
      { id: "dateRange", type: "dateRange", label: "Date Range", semanticRef: "reporting_window" },
    ],
    measures: [
      { id: "avails", key: "avails", semanticRef: "avails", label: "Avails" },
    ],
    dimensions: [
      { id: "channelV2", key: "channelV2", semanticRef: "channelV2", label: "Channel" },
    ],
  },
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["channelV2"],
    scopeParams: {
      dateRange: {
        start: "2026-05-01",
        end: "2026-05-07",
      },
    },
    binding: semanticBinding,
  },
  binding: semanticBinding,
  model: null,
  providerAvailable: false,
  modelLoading: false,
  fallbackSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Fallback Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Fallback Line Delivery",
    selectedDimensions: [
      { id: "channelV2", rawId: "channelV2", label: "Fallback Channel" },
    ],
    selectedMeasures: [
      { id: "avails", rawId: "avails", label: "Fallback Available Impressions", format: "compactNumber" },
    ],
  },
  fallbackFingerprint: JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
      entity: "line_delivery",
      dimensions: ["channelV2"],
      measures: ["avails"],
      parameters: {
        reporting_window: {
          start: "2026-05-01",
          end: "2026-05-07",
        },
      },
    },
  }),
});

assert.equal(noProviderFallbackRuntimeState.resolvedSemanticSummary.modelRef, "model://example/performance/delivery@v1");
assert.equal(noProviderFallbackRuntimeState.resolvedSemanticSummary.modelLabel || "", "");
assert.equal(noProviderFallbackRuntimeState.resolvedSemanticSummary.entityLabel || "", "");
assert.equal(noProviderFallbackRuntimeState.resolvedSemanticSummary.selectedMeasures[0].label, "Avails");
assert.equal(noProviderFallbackRuntimeState.resolvedSemanticSummary.selectedDimensions[0].label, "Channel");

assert.equal(resolveReportBuilderSemanticRuntimeFallbackPreference({
  providerAvailable: true,
  modelLoading: true,
  modelError: "",
  model: null,
}), true);
assert.equal(resolveReportBuilderSemanticRuntimeFallbackPreference({
  providerAvailable: false,
  modelLoading: false,
  modelError: "",
  model: null,
}), false);
assert.equal(resolveReportBuilderSemanticRuntimeFallbackPreference({
  providerAvailable: true,
  modelLoading: false,
  modelError: "load failed",
  model: null,
}), false);
assert.equal(resolveReportBuilderSemanticRuntimeFallbackAllowance({
  providerAvailable: true,
  modelLoading: true,
  modelError: "",
  model: null,
}), true);
assert.equal(resolveReportBuilderSemanticRuntimeFallbackAllowance({
  providerAvailable: false,
  modelLoading: false,
  modelError: "",
  model: null,
}), false);
assert.equal(resolveReportBuilderSemanticRuntimeFallbackAllowance({
  providerAvailable: true,
  modelLoading: false,
  modelError: "load failed",
  model: null,
}), false);
assert.equal(resolveReportBuilderSemanticRuntimeFallbackAllowance({
  providerAvailable: true,
  modelLoading: false,
  modelError: "",
  model: semanticModel,
}), true);

const lineageAwareRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: {
    measures: [
      { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Avails" },
    ],
    dimensions: [
      { id: "publisherId", key: "publisherId", semanticRef: "publisher", label: "Publisher" },
    ],
  },
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["publisherId"],
    binding: {
      mode: "semantic",
      modelRef: "model://example/performance/delivery@v1",
      entity: "line_delivery",
      selectedDimensions: ["publisher"],
      selectedMeasures: ["available_impressions"],
    },
  },
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["publisher"],
    selectedMeasures: ["available_impressions"],
  },
  model: {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Ad Delivery",
    entities: [
      {
        id: "line_delivery",
        label: "Line Delivery",
        dimensions: [
          {
            id: "publisher",
            label: "Publisher",
            category: "Inventory",
            definitionRef: "harmonizer://feature/publisher",
            governance: {
              status: "approved",
              certification: "reviewed",
              classification: "harmonizer.audience",
            },
          },
        ],
        measures: [
          {
            id: "available_impressions",
            label: "Available Impressions",
            category: "Metrics",
            format: "compactNumber",
          },
        ],
      },
    ],
  },
});

assert.equal(lineageAwareRuntimeState.semanticSummary.selectedDimensions[0].category, "Inventory");
assert.equal(lineageAwareRuntimeState.semanticSummary.selectedDimensions[0].definitionRef, "harmonizer://feature/publisher");
assert.deepEqual(lineageAwareRuntimeState.semanticSummary.selectedDimensions[0].governance, {
  status: "approved",
  certification: "reviewed",
  classification: "harmonizer.audience",
});

const audienceFeatureRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: {
    measures: [
      { id: "audienceIndex", key: "audienceIndex", semanticRef: "audience_index", label: "Audience Index" },
    ],
    dimensions: [
      { id: "publisherId", key: "publisherId", semanticRef: "publisher", label: "Publisher" },
    ],
    staticFilters: [
      { id: "audienceSegmentFilter", field: "audienceSegmentFilter", label: "Audience Segment", multiple: true, semanticRef: "audience_segment" },
    ],
  },
  state: {
    selectedMeasures: ["audienceIndex"],
    selectedDimensions: ["publisherId"],
    scopeParams: {
      audienceSegmentFilter: ["Young Adults"],
    },
    binding: {
      mode: "semantic",
      modelRef: "model://example/performance/delivery@v1",
      entity: "line_delivery",
      selectedDimensions: ["publisher"],
      selectedMeasures: ["audience_index"],
    },
  },
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["publisher"],
    selectedMeasures: ["audience_index"],
  },
  model: {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Ad Delivery",
    entities: [
      {
        id: "line_delivery",
        label: "Line Delivery",
        dimensions: [
          {
            id: "publisher",
            label: "Publisher",
            category: "Inventory",
            definitionRef: "harmonizer://feature/publisher",
            governance: {
              status: "approved",
              certification: "reviewed",
              classification: "harmonizer.audience",
            },
          },
        ],
        measures: [
          {
            id: "audience_index",
            label: "Audience Index",
            category: "Audience",
            definitionRef: "harmonizer://feature/user.segment.index",
            governance: {
              status: "approved",
              certification: "reviewed",
              classification: "harmonizer.audience",
            },
          },
        ],
        parameters: [
          {
            id: "audience_segment",
            label: "Audience Segment",
            category: "Audience",
            definitionRef: "harmonizer://feature/user.segment",
            governance: {
              status: "approved",
              classification: "harmonizer.audience",
            },
          },
        ],
      },
    ],
  },
});

assert.equal(audienceFeatureRuntimeState.semanticSummary.selectedMeasures[0].category, "Audience");
assert.equal(audienceFeatureRuntimeState.semanticSummary.selectedMeasures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.deepEqual(audienceFeatureRuntimeState.semanticSummary.selectedMeasures[0].governance, {
  status: "approved",
  certification: "reviewed",
  classification: "harmonizer.audience",
});
assert.equal(audienceFeatureRuntimeState.semanticSummary.selectedParameters[0].category, "Audience");
assert.equal(audienceFeatureRuntimeState.semanticSummary.selectedParameters[0].definitionRef, "harmonizer://feature/user.segment");
assert.deepEqual(audienceFeatureRuntimeState.semanticSummary.selectedParameters[0].governance, {
  status: "approved",
  classification: "harmonizer.audience",
});

const flatFieldAudienceRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: {
    measures: [
      { id: "audienceIndex", key: "audienceIndex", semanticRef: "audience_index", label: "Audience Index" },
    ],
    dimensions: [
      { id: "publisherId", key: "publisherId", semanticRef: "publisher", label: "Publisher" },
    ],
    staticFilters: [
      { id: "audienceSegmentFilter", field: "audienceSegmentFilter", label: "Audience Segment", multiple: true, semanticRef: "audience_segment" },
    ],
  },
  state: {
    selectedMeasures: ["audienceIndex"],
    selectedDimensions: ["publisherId"],
    scopeParams: {
      audienceSegmentFilter: ["Young Adults"],
    },
    binding: {
      mode: "semantic",
      modelRef: "model://example/performance/delivery@v1",
      entity: "line_delivery",
      selectedDimensions: ["publisher"],
      selectedMeasures: ["audience_index"],
    },
  },
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["publisher"],
    selectedMeasures: ["audience_index"],
  },
  model: {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Ad Delivery",
    entities: [
      {
        id: "line_delivery",
        label: "Line Delivery",
        fields: [
          {
            id: "publisher",
            label: "Publisher",
            featureType: "dimension",
            category: "Inventory",
            definitionRef: "harmonizer://feature/publisher",
            governance: {
              status: "approved",
              certification: "reviewed",
              classification: "harmonizer.audience",
            },
          },
          {
            id: "audience_index",
            label: "Audience Index",
            featureType: "measure",
            category: "Audience",
            definitionRef: "harmonizer://feature/user.segment.index",
            governance: {
              status: "approved",
              certification: "reviewed",
              classification: "harmonizer.audience",
            },
          },
          {
            id: "audience_segment",
            label: "Audience Segment",
            featureType: "parameter",
            category: "Audience",
            definitionRef: "harmonizer://feature/user.segment",
            governance: {
              status: "approved",
              classification: "harmonizer.audience",
            },
          },
        ],
      },
    ],
  },
});

assert.equal(flatFieldAudienceRuntimeState.semanticSummary.selectedDimensions[0].definitionRef, "harmonizer://feature/publisher");
assert.equal(flatFieldAudienceRuntimeState.semanticSummary.selectedMeasures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(flatFieldAudienceRuntimeState.semanticSummary.selectedParameters[0].definitionRef, "harmonizer://feature/user.segment");
assert.deepEqual(flatFieldAudienceRuntimeState.semanticValidationRequest, {
  modelRef: "model://example/performance/delivery@v1",
  selection: {
    entity: "line_delivery",
    dimensions: ["publisher"],
    measures: ["audience_index"],
    parameters: {
      audience_segment: ["Young Adults"],
    },
  },
});

const fallbackFieldMetadataRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: {
    measures: [
      { id: "avails", key: "avails", semanticRef: "avails", label: "Avails" },
    ],
    dimensions: [
      { id: "channelV2", key: "channelV2", semanticRef: "channelV2", label: "Channel" },
    ],
  },
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["channelV2"],
    binding: semanticBinding,
  },
  binding: semanticBinding,
  model: {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Sparse Ad Delivery",
    entities: [
      {
        id: "line_delivery",
        label: "Sparse Line Delivery",
        dimensions: [
          {
            id: "different_dimension",
            label: "Different Dimension",
          },
        ],
        measures: [
          {
            id: "different_measure",
            label: "Different Measure",
          },
        ],
      },
    ],
  },
  fallbackSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Fallback Ad Delivery",
    modelDescription: "Fallback governed reporting model.",
    entity: "line_delivery",
    entityLabel: "Fallback Line Delivery",
    entityDescription: "Fallback delivery grain.",
    selectedDimensions: [
      {
        id: "channelV2",
        rawId: "channelV2",
        label: "Fallback Channel",
        description: "Fallback approved channel label",
        governance: {
          status: "approved",
          certification: "reviewed",
        },
      },
    ],
    selectedMeasures: [
      {
        id: "avails",
        rawId: "avails",
        label: "Fallback Available Impressions",
        description: "Fallback approved avails metric",
        format: "compactNumber",
        governance: {
          status: "approved",
          certification: "certified",
        },
      },
    ],
  },
  fallbackFingerprint: JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
      entity: "line_delivery",
      dimensions: ["channelV2"],
      measures: ["avails"],
      parameters: {},
    },
  }),
});

assert.equal(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.modelLabel, "Sparse Ad Delivery");
assert.equal(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.modelDescription, "Fallback governed reporting model.");
assert.equal(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.entityLabel, "Sparse Line Delivery");
assert.equal(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.entityDescription, "Fallback delivery grain.");
assert.equal(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.selectedDimensions[0].label, "Channel");
assert.equal(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.selectedDimensions[0].description, "Fallback approved channel label");
assert.deepEqual(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.selectedDimensions[0].governance, {
  status: "approved",
  certification: "reviewed",
});
assert.equal(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.selectedMeasures[0].label, "Avails");
assert.equal(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.selectedMeasures[0].description, "Fallback approved avails metric");
assert.deepEqual(fallbackFieldMetadataRuntimeState.resolvedSemanticSummary.selectedMeasures[0].governance, {
  status: "approved",
  certification: "certified",
});

console.log("useReportBuilderSemanticRuntimeState ✓ resolves provider-backed semantic display config and runtime summary state");
