import { clampPresentationText, normalizePresentationClampConfig } from "../utils/presentationText.js";

export function normalizeChartCategoryLabelConfig(value = null) {
  return normalizePresentationClampConfig(value);
}

export function buildChartCategoryTickLabel(value, config = null) {
  const normalizedConfig = normalizeChartCategoryLabelConfig(config);
  if (!normalizedConfig) return null;
  return clampPresentationText(value, normalizedConfig);
}
