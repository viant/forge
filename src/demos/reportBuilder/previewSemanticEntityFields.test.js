import assert from "node:assert/strict";

import {
  collectPreviewSemanticEntityFields,
  collectPreviewSemanticEntityParameters,
  normalizePreviewSemanticFeatureType,
} from "./previewSemanticEntityFields.js";

assert.equal(normalizePreviewSemanticFeatureType("Measure"), "measure");
assert.equal(normalizePreviewSemanticFeatureType("", "parameter"), "parameter");
assert.equal(normalizePreviewSemanticFeatureType("unsupported"), "");

const splitEntity = {
  id: "line_delivery",
  dimensions: [
    { id: "country_code", label: "Market" },
  ],
  measures: [
    { id: "audience_index", label: "Audience Index" },
  ],
  parameters: [
    { id: "audience_segment", label: "Audience Segment" },
  ],
};

assert.deepEqual(collectPreviewSemanticEntityFields(splitEntity), [
  { id: "country_code", label: "Market", featureType: "dimension" },
  { id: "audience_index", label: "Audience Index", featureType: "measure" },
  { id: "audience_segment", label: "Audience Segment", featureType: "parameter" },
]);

const flatEntity = {
  id: "line_delivery",
  fields: [
    {
      id: "publisher",
      label: "Publisher",
      featureType: "dimension",
      governance: { classification: "harmonizer.audience" },
    },
    {
      id: "audience_index",
      label: "Audience Index",
      featureType: "measure",
      governance: { classification: "harmonizer.audience" },
    },
    {
      id: "audience_segment",
      label: "Audience Segment",
      featureType: "parameter",
      governance: { classification: "harmonizer.audience" },
    },
    {
      id: "ignored_unknown",
      label: "Ignored Unknown",
      featureType: "unsupported",
    },
  ],
};

assert.deepEqual(collectPreviewSemanticEntityFields(flatEntity), [
  {
    id: "publisher",
    label: "Publisher",
    featureType: "dimension",
    governance: { classification: "harmonizer.audience" },
  },
  {
    id: "audience_index",
    label: "Audience Index",
    featureType: "measure",
    governance: { classification: "harmonizer.audience" },
  },
  {
    id: "audience_segment",
    label: "Audience Segment",
    featureType: "parameter",
    governance: { classification: "harmonizer.audience" },
  },
]);

assert.deepEqual(collectPreviewSemanticEntityParameters(flatEntity), [
  {
    id: "audience_segment",
    label: "Audience Segment",
    featureType: "parameter",
    governance: { classification: "harmonizer.audience" },
  },
]);

const mixedEntity = {
  id: "line_delivery",
  dimensions: [
    { id: "country_code", label: "Market" },
  ],
  fields: [
    { id: "country_code", label: "Market Duplicate", featureType: "dimension" },
    { id: "metro_code", label: "Metro Area", featureType: "dimension" },
  ],
};

assert.deepEqual(collectPreviewSemanticEntityFields(mixedEntity), [
  { id: "country_code", label: "Market", featureType: "dimension" },
  { id: "metro_code", label: "Metro Area", featureType: "dimension" },
]);

console.log("previewSemanticEntityFields ✓ normalizes split and flat preview semantic entity field contracts");
