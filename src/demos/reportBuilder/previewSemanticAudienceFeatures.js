import {
  collectPreviewSemanticEntityFields,
} from "./previewSemanticEntityFields.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeSelectionIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function normalizeCategory(category = "") {
  return normalizeString(category);
}

function normalizeDefinitionRef(definitionRef = "") {
  return normalizeString(definitionRef);
}

function normalizeGovernance(governance = null) {
  if (!governance || typeof governance !== "object" || Array.isArray(governance)) {
    return null;
  }
  const status = normalizeString(governance.status);
  const certification = normalizeString(governance.certification);
  const classification = normalizeString(governance.classification);
  if (!status && !certification && !classification) {
    return null;
  }
  return {
    ...(status ? { status } : {}),
    ...(certification ? { certification } : {}),
    ...(classification ? { classification } : {}),
  };
}

export const PREVIEW_AUDIENCE_FEATURE_IDS = {
  ageGroup: "age_group",
  audienceIndex: "audience_index",
  audienceSegment: "audience_segment",
  countryCode: "country_code",
  siteType: "site_type",
  publisher: "publisher",
  region: "region",
  metroCode: "metro_code",
  householdUniques: "household_uniques",
};

function isAudienceFeature(field = null) {
  const governance = field?.governance && typeof field.governance === "object" && !Array.isArray(field.governance)
    ? field.governance
    : {};
  const classification = normalizeString(governance.classification).toLowerCase();
  return classification === "audience" || classification === "harmonizer.audience";
}

export function resolvePreviewAudienceFeatureTypes(model = null, entityId = "") {
  const entities = Array.isArray(model?.entities) ? model.entities : [];
  const entity = entities.find((item) => normalizeString(item?.id) === normalizeString(entityId)) || null;
  if (!entity) {
    return [];
  }
  const fields = collectPreviewSemanticEntityFields(entity);
  return fields
    .filter((field) => isAudienceFeature(field))
    .map((field) => ({
      id: normalizeString(field?.id),
      label: normalizeString(field?.label || field?.id),
      featureType: normalizeString(field?.featureType).toLowerCase(),
      ...(normalizeCategory(field?.category) ? { category: normalizeCategory(field.category) } : {}),
      ...(normalizeDefinitionRef(field?.definitionRef) ? { definitionRef: normalizeDefinitionRef(field.definitionRef) } : {}),
      ...(normalizeGovernance(field?.governance) ? { governance: normalizeGovernance(field?.governance) } : {}),
    }))
    .filter((field) => field.id && field.label);
}

export function buildPreviewAudienceFeatureDiagnostics({
  dimensions = [],
  measures = [],
} = {}) {
  const normalizedDimensions = normalizeSelectionIds(dimensions);
  const normalizedMeasures = normalizeSelectionIds(measures);
  const hasAgeGroup = normalizedDimensions.includes(PREVIEW_AUDIENCE_FEATURE_IDS.ageGroup);
  const hasHouseholdUniques = normalizedMeasures.includes(PREVIEW_AUDIENCE_FEATURE_IDS.householdUniques);
  if (!hasAgeGroup || !hasHouseholdUniques) {
    return [];
  }
  const ageGroupIndex = normalizedDimensions.indexOf(PREVIEW_AUDIENCE_FEATURE_IDS.ageGroup);
  const householdUniquesIndex = normalizedMeasures.indexOf(PREVIEW_AUDIENCE_FEATURE_IDS.householdUniques);
  return [
    ...(ageGroupIndex >= 0 ? [{
      code: "unsupportedBreakdown",
      severity: "error",
      path: `selection.dimensions[${ageGroupIndex}]`,
      message: "Audience Age Group is not supported for this semantic selection in the demo provider.",
      suggestedFix: "Remove Audience Age Group or choose a different breakdown to continue.",
    }] : []),
    ...(householdUniquesIndex >= 0 ? [{
      code: "unsupportedMeasure",
      severity: "error",
      path: `selection.measures[${householdUniquesIndex}]`,
      message: "Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.",
      suggestedFix: "Remove Household Uniques or switch to Available Impressions to continue.",
    }] : []),
  ].map((diagnostic) => cloneValue(diagnostic));
}
