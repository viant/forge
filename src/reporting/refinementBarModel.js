function normalizeString(value = "") {
  return String(value || "").trim();
}

export function normalizeRefinementBarText(value, defaultValue = null) {
  if (value == null) {
    return defaultValue;
  }
  return normalizeString(value);
}

const SUPPORTED_REFINEMENT_BAR_ACTIONS = new Set(["remove", "clearAll", "undo", "redo"]);

export function normalizeRefinementBarActionKinds(actionKinds, {
  defaultActionKinds = null,
} = {}) {
  const source = Array.isArray(actionKinds) ? actionKinds : defaultActionKinds;
  if (!Array.isArray(source)) {
    return null;
  }
  const next = [];
  const seen = new Set();
  source.forEach((entry) => {
    const normalized = normalizeString(entry);
    if (!SUPPORTED_REFINEMENT_BAR_ACTIONS.has(normalized) || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
}
