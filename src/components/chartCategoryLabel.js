import { clampPresentationText } from "../utils/presentationText.js";

export function normalizeChartCategoryLabelConfig(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const lines = Number(value.lines);
  if (lines !== 1 && lines !== 2) return null;
  const maxCharacters = Math.max(4, Math.min(120, Number(value.maxCharacters) || 28));
  return { lines, maxCharacters };
}

export function buildChartCategoryTickLabel(value, config = null) {
  const normalizedConfig = normalizeChartCategoryLabelConfig(config);
  if (!normalizedConfig) return null;
  return clampPresentationText(value, normalizedConfig);
}
