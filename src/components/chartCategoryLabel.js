import { clampPresentationText, normalizePresentationClampConfig, normalizePresentationText } from "../utils/presentationText.js";

export function normalizeChartCategoryLabelConfig(value = null) {
  return normalizePresentationClampConfig(value);
}

export function buildChartCategoryTickLabel(value, config = null) {
  const normalizedConfig = normalizeChartCategoryLabelConfig(config);
  if (!normalizedConfig) return null;
  return clampPresentationText(value, normalizedConfig);
}

export function buildMeasuredChartCategoryTickLabel(value, config = null, availableWidth = 0, measureText = null) {
  const normalizedConfig = normalizeChartCategoryLabelConfig(config);
  const fullText = normalizePresentationText(value);
  const width = Math.max(0, Number(availableWidth) || 0);
  if (!normalizedConfig || normalizedConfig.lines !== 2 || !fullText || width <= 0 || typeof measureText !== "function") {
    return buildChartCategoryTickLabel(value, config);
  }
  const maxCharacters = normalizedConfig.maxCharacters;
  const graphemes = Array.from(fullText);
  const totalLimit = maxCharacters * 2;
  const visibleText = graphemes.length > totalLimit
    ? `${graphemes.slice(0, Math.max(1, totalLimit - 1)).join("")}…`
    : fullText;
  const breakpoints = new Set();
  Array.from(visibleText).forEach((character, index) => {
    if (/\s/.test(character) || /[|/–—-]/.test(character)) {
      breakpoints.add(index + 1);
    }
  });
  breakpoints.add(Math.min(maxCharacters, Array.from(visibleText).length));
  const fitLine = (rawLine) => {
    const source = Array.from(rawLine.trim());
    let visible = source.slice(0, maxCharacters);
    let truncated = source.length > visible.length;
    if (truncated && visible.length > 0) {
      visible = [...visible.slice(0, Math.max(1, visible.length - 1)), "…"];
    }
    while (visible.length > 1 && Math.max(0, Number(measureText(visible.join(""))) || 0) > width) {
      truncated = true;
      visible = [...visible.slice(0, Math.max(1, visible.length - 2)), "…"];
    }
    const text = visible.join("");
    return { text, width: Math.max(0, Number(measureText(text)) || 0), truncated };
  };
  const candidates = [];
  Array.from(breakpoints).forEach((index) => {
    const characters = Array.from(visibleText);
    if (index <= 0 || index >= characters.length) return;
    const rawLines = [characters.slice(0, index).join("").trim(), characters.slice(index).join("").trim()];
    if (!rawLines[0] || !rawLines[1]) return;
    const fitted = rawLines.map(fitLine);
    const lines = fitted.map((line) => line.text);
    const widths = fitted.map((line) => line.width);
    candidates.push({
      lines,
      widths,
      fits: widths.every((lineWidth) => lineWidth <= width),
      semanticBreak: /[|/–—-]/.test(characters[index - 1] || ""),
      truncated: fitted.some((line) => line.truncated),
    });
  });
  if (candidates.length === 0) {
    return buildChartCategoryTickLabel(value, normalizedConfig);
  }
  const fitting = candidates.filter((candidate) => candidate.fits);
  const pool = fitting.length > 0 ? fitting : candidates;
  const selected = pool.sort((left, right) => {
    if (left.semanticBreak !== right.semanticBreak) return left.semanticBreak ? -1 : 1;
    if (left.truncated !== right.truncated) return left.truncated ? 1 : -1;
    const leftMax = Math.max(...left.widths);
    const rightMax = Math.max(...right.widths);
    if (leftMax !== rightMax) return leftMax - rightMax;
    return Math.abs(left.widths[0] - left.widths[1]) - Math.abs(right.widths[0] - right.widths[1]);
  })[0];
  return {
    fullText,
    lines: selected.lines,
    truncated: graphemes.length > totalLimit || selected.truncated || !selected.fits,
    measured: true,
  };
}
