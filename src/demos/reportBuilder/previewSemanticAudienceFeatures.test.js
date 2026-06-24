import assert from "node:assert/strict";

import {
  buildPreviewAudienceFeatureDiagnostics,
  PREVIEW_AUDIENCE_FEATURE_IDS,
  resolvePreviewAudienceFeatureTypes,
} from "./previewSemanticAudienceFeatures.js";

assert.deepEqual(PREVIEW_AUDIENCE_FEATURE_IDS, {
  ageGroup: "age_group",
  audienceIndex: "audience_index",
  audienceSegment: "audience_segment",
  countryCode: "country_code",
  siteType: "site_type",
  publisher: "publisher",
  region: "region",
  metroCode: "metro_code",
  householdUniques: "household_uniques",
});

const semanticModel = {
  entities: [
    {
      id: "line_delivery",
      dimensions: [
        {
          id: "event_date",
          label: "Delivery Date",
          governance: { status: "approved" },
        },
        {
          id: "age_group",
          label: "Audience Age Group",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.demographic.age",
          governance: { status: "draft", classification: "harmonizer.audience" },
        },
        {
          id: "country_code",
          label: "Market",
          category: "Location",
          definitionRef: "harmonizer://feature/location",
          governance: { status: "deprecated", classification: "harmonizer.audience" },
        },
        {
          id: "site_type",
          label: "Site Type",
          category: "Inventory",
          definitionRef: "harmonizer://feature/ad.site.type",
          governance: { status: "approved", classification: "harmonizer.audience" },
        },
        {
          id: "publisher",
          label: "Publisher",
          category: "Inventory",
          definitionRef: "harmonizer://feature/publisher",
          governance: { status: "approved", certification: "reviewed", classification: "harmonizer.audience" },
        },
        {
          id: "region",
          label: "Region",
          category: "Location",
          definitionRef: "harmonizer://feature/location",
          governance: { status: "approved", classification: "harmonizer.audience" },
        },
        {
          id: "metro_code",
          label: "Metro Area",
          category: "Location",
          definitionRef: "harmonizer://feature/location.metrocode",
          governance: { status: "approved", classification: "harmonizer.audience" },
        },
      ],
      measures: [
        {
          id: "available_impressions",
          label: "Available Impressions",
          category: "Metrics",
          governance: { status: "approved", certification: "certified", classification: "reporting.metric" },
        },
        {
          id: "audience_index",
          label: "Audience Index",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment.index",
          governance: { status: "approved", certification: "reviewed", classification: "harmonizer.audience" },
        },
        {
          id: "household_uniques",
          label: "Household Uniques",
          category: "Metrics",
          governance: { status: "approved", certification: "reviewed", classification: "reporting.metric" },
        },
      ],
      parameters: [
        {
          id: "audience_segment",
          label: "Audience Segment",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment",
          governance: { status: "approved", classification: "harmonizer.audience" },
        },
      ],
    },
  ],
};

assert.deepEqual(resolvePreviewAudienceFeatureTypes(semanticModel, "line_delivery"), [
  {
    id: "age_group",
    label: "Audience Age Group",
    featureType: "dimension",
    category: "Audience",
    definitionRef: "harmonizer://feature/user.demographic.age",
    governance: {
      status: "draft",
      classification: "harmonizer.audience",
    },
  },
  {
    id: "country_code",
    label: "Market",
    featureType: "dimension",
    category: "Location",
    definitionRef: "harmonizer://feature/location",
    governance: {
      status: "deprecated",
      classification: "harmonizer.audience",
    },
  },
  {
    id: "site_type",
    label: "Site Type",
    featureType: "dimension",
    category: "Inventory",
    definitionRef: "harmonizer://feature/ad.site.type",
    governance: {
      status: "approved",
      classification: "harmonizer.audience",
    },
  },
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
    id: "region",
    label: "Region",
    featureType: "dimension",
    category: "Location",
    definitionRef: "harmonizer://feature/location",
    governance: {
      status: "approved",
      classification: "harmonizer.audience",
    },
  },
  {
    id: "metro_code",
    label: "Metro Area",
    featureType: "dimension",
    category: "Location",
    definitionRef: "harmonizer://feature/location.metrocode",
    governance: {
      status: "approved",
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
]);

const flatSemanticModel = {
  entities: [
    {
      id: "line_delivery",
      fields: [
        {
          id: "publisher",
          label: "Publisher",
          featureType: "dimension",
          category: "Inventory",
          definitionRef: "harmonizer://feature/publisher",
          governance: { status: "approved", certification: "reviewed", classification: "harmonizer.audience" },
        },
        {
          id: "audience_index",
          label: "Audience Index",
          featureType: "measure",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment.index",
          governance: { status: "approved", certification: "reviewed", classification: "harmonizer.audience" },
        },
        {
          id: "audience_segment",
          label: "Audience Segment",
          featureType: "parameter",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment",
          governance: { status: "approved", classification: "harmonizer.audience" },
        },
        {
          id: "ignored_metric",
          label: "Ignored Metric",
          featureType: "metric",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment.score",
          governance: { status: "approved", classification: "harmonizer.audience" },
        },
      ],
    },
  ],
};

assert.deepEqual(resolvePreviewAudienceFeatureTypes(flatSemanticModel, "line_delivery"), [
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
]);

assert.deepEqual(
  buildPreviewAudienceFeatureDiagnostics({
    dimensions: ["event_date", "age_group"],
    measures: ["available_impressions", "household_uniques"],
  }),
  [
    {
      code: "unsupportedBreakdown",
      severity: "error",
      path: "selection.dimensions[1]",
      message: "Audience Age Group is not supported for this semantic selection in the demo provider.",
      suggestedFix: "Remove Audience Age Group or choose a different breakdown to continue.",
    },
    {
      code: "unsupportedMeasure",
      severity: "error",
      path: "selection.measures[1]",
      message: "Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.",
      suggestedFix: "Remove Household Uniques or switch to Available Impressions to continue.",
    },
  ],
);

assert.deepEqual(
  buildPreviewAudienceFeatureDiagnostics({
    dimensions: ["event_date", "age_group"],
    measures: ["available_impressions"],
  }),
  [],
);

assert.deepEqual(
  buildPreviewAudienceFeatureDiagnostics({
    dimensions: ["event_date", "channel"],
    measures: ["available_impressions", "household_uniques"],
  }),
  [],
);

console.log("previewSemanticAudienceFeatures ✓ resolves current harmonizer-backed audience dimensions and validates the unsupported age-group/household-uniques combination");
