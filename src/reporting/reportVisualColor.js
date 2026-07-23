function normalizeHexColor(value = "") {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  return match ? match[1] : "";
}

export function buildReportVisualTint(color = "", amount = 0.86) {
  const hex = normalizeHexColor(color);
  if (!hex) {
    return "";
  }
  const ratio = Math.max(0, Math.min(1, Number(amount) || 0));
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const tinted = channels
    .map((channel) => Math.round(channel + ((255 - channel) * ratio)).toString(16).padStart(2, "0"))
    .join("");
  return `#${tinted}`;
}
