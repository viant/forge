function normalizeString(value = "") {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const PREVIEW_SEMANTIC_FIELD_TYPES = new Set(["dimension", "measure", "parameter"]);

export function normalizePreviewSemanticFeatureType(type = "", fallbackType = "") {
  const normalizedType = normalizeString(type).toLowerCase();
  if (PREVIEW_SEMANTIC_FIELD_TYPES.has(normalizedType)) {
    return normalizedType;
  }
  const normalizedFallbackType = normalizeString(fallbackType).toLowerCase();
  if (PREVIEW_SEMANTIC_FIELD_TYPES.has(normalizedFallbackType)) {
    return normalizedFallbackType;
  }
  return "";
}

function collectEntityFieldsForType(fields = [], fallbackType = "", existingIds = new Set()) {
  const next = [];
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!isPlainObject(field)) {
      return;
    }
    const id = normalizeString(field?.id || field?.key);
    const featureType = normalizePreviewSemanticFeatureType(field?.featureType, fallbackType);
    if (!id || !featureType || existingIds.has(id)) {
      return;
    }
    existingIds.add(id);
    next.push({
      ...cloneValue(field),
      featureType,
    });
  });
  return next;
}

export function collectPreviewSemanticEntityFields(entity = null) {
  if (!isPlainObject(entity)) {
    return [];
  }
  const existingIds = new Set();
  return [
    ...collectEntityFieldsForType(entity?.dimensions, "dimension", existingIds),
    ...collectEntityFieldsForType(entity?.measures, "measure", existingIds),
    ...collectEntityFieldsForType(entity?.parameters, "parameter", existingIds),
    ...collectEntityFieldsForType(entity?.fields, "", existingIds),
  ];
}

export function collectPreviewSemanticEntityParameters(entity = null) {
  return collectPreviewSemanticEntityFields(entity)
    .filter((field) => field.featureType === "parameter");
}
