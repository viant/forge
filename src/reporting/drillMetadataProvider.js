const REQUIRED_DRILL_METADATA_PROVIDER_METHODS = [
  "getDrillHierarchy",
  "getDetailTarget",
  "listAvailableRefinements",
];

const SUPPORTED_REFINEMENT_ACTION_KINDS = new Set(["keep", "exclude", "drill", "detail"]);

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function unwrapPayload(payload = {}, key = "") {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && payload[key] && typeof payload[key] === "object") {
    return payload[key];
  }
  return payload;
}

export function validateDrillMetadataProvider(provider = null) {
  const missing = REQUIRED_DRILL_METADATA_PROVIDER_METHODS.filter((method) => typeof provider?.[method] !== "function");
  return {
    valid: missing.length === 0,
    missing,
  };
}

export function hasDrillMetadataProvider(provider = null) {
  return validateDrillMetadataProvider(provider).valid;
}

export function normalizeDrillHierarchy(payload = {}) {
  const hierarchy = unwrapPayload(payload, "drillHierarchy");
  if (!hierarchy || typeof hierarchy !== "object" || Array.isArray(hierarchy)) {
    return null;
  }
  const fieldRef = normalizeString(hierarchy.fieldRef);
  const levels = (Array.isArray(hierarchy.levels) ? hierarchy.levels : [])
    .map((level) => {
      if (!level || typeof level !== "object" || Array.isArray(level)) {
        return null;
      }
      const id = normalizeString(level.id);
      const field = normalizeString(level.field);
      const label = normalizeString(level.label);
      if (!id || !field || !label) {
        return null;
      }
      return { id, field, label };
    })
    .filter(Boolean);
  if (!fieldRef || levels.length === 0) {
    return null;
  }
  return {
    fieldRef,
    levels,
  };
}

export function normalizeDetailTarget(payload = {}) {
  const detailTarget = unwrapPayload(payload, "detailTarget");
  if (!detailTarget || typeof detailTarget !== "object" || Array.isArray(detailTarget)) {
    return null;
  }
  const targetRef = normalizeString(detailTarget.targetRef);
  const navigationMode = normalizeString(detailTarget.navigationMode);
  if (!targetRef || !navigationMode) {
    return null;
  }
  return {
    targetRef,
    navigationMode,
    parameters: detailTarget.parameters && typeof detailTarget.parameters === "object" && !Array.isArray(detailTarget.parameters)
      ? cloneValue(detailTarget.parameters)
      : {},
    ...(normalizeString(detailTarget.title) ? { title: normalizeString(detailTarget.title) } : {}),
    ...(normalizeString(detailTarget.description) ? { description: normalizeString(detailTarget.description) } : {}),
  };
}

export function normalizeRefinementActions(payload = {}) {
  const actions = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.actions) ? payload.actions : []);
  return actions
    .map((action) => {
      if (!action || typeof action !== "object" || Array.isArray(action)) {
        return null;
      }
      const id = normalizeString(action.id);
      const label = normalizeString(action.label);
      const kind = normalizeString(action.kind).toLowerCase();
      if (!id || !label || !SUPPORTED_REFINEMENT_ACTION_KINDS.has(kind)) {
        return null;
      }
      return {
        id,
        label,
        kind,
        ...(normalizeString(action.targetRef) ? { targetRef: normalizeString(action.targetRef) } : {}),
        ...(normalizeString(action.nextFieldRef) ? { nextFieldRef: normalizeString(action.nextFieldRef) } : {}),
      };
    })
    .filter(Boolean);
}

export function resolveRefinementActionIdentityKey(action = {}) {
  const kind = normalizeString(action?.kind).toLowerCase();
  if (!kind) {
    return "";
  }
  if (kind === "drill") {
    const nextFieldRef = normalizeString(action?.nextFieldRef);
    return nextFieldRef ? `drill:${nextFieldRef}` : `drill:${normalizeString(action?.id)}`;
  }
  if (kind === "detail") {
    const targetRef = normalizeString(action?.targetRef);
    return targetRef ? `detail:${targetRef}` : `detail:${normalizeString(action?.id)}`;
  }
  if (kind === "keep" || kind === "exclude") {
    return kind;
  }
  return `${kind}:${normalizeString(action?.id)}`;
}

export function dedupeRefinementActions(actions = []) {
  const deduped = [];
  const indexByKey = new Map();
  (Array.isArray(actions) ? actions : []).forEach((action) => {
    const normalized = normalizeRefinementActions([action])[0] || null;
    if (!normalized) {
      return;
    }
    const identityKey = resolveRefinementActionIdentityKey(normalized);
    if (!identityKey) {
      return;
    }
    const existingIndex = indexByKey.get(identityKey);
    if (existingIndex === undefined) {
      indexByKey.set(identityKey, deduped.length);
      deduped.push(normalized);
      return;
    }
    deduped[existingIndex] = normalized;
  });
  return deduped;
}

export function createDrillMetadataProvider(provider = {}) {
  const validation = validateDrillMetadataProvider(provider);
  if (!validation.valid) {
    throw new Error(`Drill metadata provider missing methods: ${validation.missing.join(", ")}`);
  }
  return {
    async getDrillHierarchy(fieldRef = "", options = {}) {
      return normalizeDrillHierarchy(await provider.getDrillHierarchy(fieldRef, options));
    },
    async getDetailTarget(targetRef = "", options = {}) {
      return normalizeDetailTarget(await provider.getDetailTarget(targetRef, options));
    },
    async listAvailableRefinements(blockKind = "", fieldRef = "", options = {}) {
      return normalizeRefinementActions(await provider.listAvailableRefinements(blockKind, fieldRef, options));
    },
  };
}
