import {
  attachPreviewRuntimeInteractionApi,
  detachPreviewRuntimeInteractionApi,
} from "./previewRuntimeInteractionApi.js";

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeStateKey(stateKey = "") {
  return String(stateKey || "").trim();
}

function normalizeReportId(reportId = "") {
  return String(reportId || "").trim();
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergePlainObjects(base = null, patch = null) {
  if (!isPlainObject(base)) {
    return cloneValue(patch);
  }
  if (!isPlainObject(patch)) {
    return cloneValue(base);
  }
  const next = {
    ...cloneValue(base),
  };
  Object.entries(patch).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      next[key] = mergePlainObjects(base[key], value);
      return;
    }
    next[key] = cloneValue(value);
  });
  return next;
}

function resolveSavedReportPayloadTarget(entry = null) {
  if (!isPlainObject(entry)) {
    return null;
  }
  if (isPlainObject(entry?.savedReportPayload)) {
    return entry.savedReportPayload;
  }
  return entry;
}

function resolveSavedReportPayloadReportId(payload = null) {
  const resolvedPayload = resolveSavedReportPayloadTarget(payload);
  if (!isPlainObject(resolvedPayload)) {
    return "";
  }
  return normalizeReportId(
    resolvedPayload?.reportDocument?.id
    || resolvedPayload?.reportRef?.reportId
    || resolvedPayload?.reportId
    || "",
  );
}

function buildPatchedSavedReportPayloadTarget(target = null, patch = null) {
  if (!isPlainObject(target) || !isPlainObject(patch)) {
    return target;
  }
  const nextTarget = {
    ...cloneValue(target),
    ...cloneValue(patch),
  };
  if (isPlainObject(target?.compileState) || isPlainObject(patch?.compileState)) {
    nextTarget.compileState = {
      ...(isPlainObject(target?.compileState) ? cloneValue(target.compileState) : {}),
      ...(isPlainObject(patch?.compileState) ? cloneValue(patch.compileState) : {}),
    };
  }
  return nextTarget;
}

export function attachPreviewRuntimeSurfaceApi(metrics = {}, {
  getBuilderConfig = null,
  setBuilderConfig = null,
  getWindowFormState = null,
  setWindowFormState = null,
  getCollectionRows = null,
  setCollectionRows = null,
  setCollectionInfo = null,
  setControl = null,
  getSavedReportPayloads = null,
  setSavedReportPayloads = null,
  buildSavedReportPayloadRecord = null,
  runtimeSurface = null,
  runtimeInteractionSnapshot = null,
  stateKey = "",
  persistBuilderState = null,
} = {}) {
  const normalizedStateKey = normalizeStateKey(stateKey);

  metrics.getBuilderState = function getBuilderState() {
    if (!normalizedStateKey) {
      return null;
    }
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const current = currentWindowFormState?.[normalizedStateKey] || null;
    return current ? cloneValue(current) : null;
  };

  metrics.getBuilderConfig = function getBuilderConfigSnapshot() {
    const current = typeof getBuilderConfig === "function"
      ? getBuilderConfig()
      : null;
    return current ? cloneValue(current) : null;
  };

  metrics.patchBuilderState = function patchBuilderState(patch = {}) {
    if (!normalizedStateKey) {
      return null;
    }
    const current = metrics.getBuilderState() || {};
    const nextBuilderState = {
      ...current,
      ...(patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {}),
    };
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    if (currentWindowFormState != null && !isPlainObject(currentWindowFormState)) {
      return null;
    }
    const nextWindowFormState = {
      ...(isPlainObject(currentWindowFormState) ? currentWindowFormState : {}),
      [normalizedStateKey]: nextBuilderState,
    };
    if (typeof setWindowFormState === "function") {
      setWindowFormState(nextWindowFormState);
    }
    if (typeof persistBuilderState === "function") {
      persistBuilderState(nextBuilderState);
    }
    return cloneValue(nextBuilderState);
  };

  metrics.patchBuilderConfig = function patchBuilderConfig(patch = {}) {
    const currentBuilderConfig = metrics.getBuilderConfig();
    if (currentBuilderConfig != null && !isPlainObject(currentBuilderConfig)) {
      return null;
    }
    const nextBuilderConfig = mergePlainObjects(
      isPlainObject(currentBuilderConfig) ? currentBuilderConfig : {},
      isPlainObject(patch) ? patch : {},
    );
    if (typeof setBuilderConfig === "function") {
      setBuilderConfig(nextBuilderConfig);
    }
    return cloneValue(nextBuilderConfig);
  };

  metrics.getCollectionRows = function getStandaloneCollectionRows() {
    const currentRows = typeof getCollectionRows === "function"
      ? getCollectionRows()
      : [];
    return Array.isArray(currentRows) ? cloneValue(currentRows) : [];
  };

  metrics.replaceCollectionRows = function replaceCollectionRows(rows = [], {
    hasMore = false,
    error = null,
  } = {}) {
    if (typeof setCollectionRows === "function") {
      setCollectionRows(Array.isArray(rows) ? cloneValue(rows) : []);
    }
    if (typeof setCollectionInfo === "function") {
      setCollectionInfo({
        hasMore: hasMore === true,
      });
    }
    if (typeof setControl === "function") {
      setControl({
        loading: false,
        error,
      });
    }
    return metrics.getCollectionRows();
  };

  metrics.applyStandaloneRuntimeRefinement = function applyStandaloneRuntimeRefinement(refinement = null) {
    if (!refinement || typeof refinement !== "object" || Array.isArray(refinement)) {
      return false;
    }
    if (typeof runtimeSurface?.applyRefinement !== "function") {
      return false;
    }
    runtimeSurface.applyRefinement(refinement);
    return true;
  };

  metrics.getSeededSavedReportPayloads = function getSeededSavedReportPayloads() {
    const currentPayloads = typeof getSavedReportPayloads === "function"
      ? getSavedReportPayloads()
      : [];
    return Array.isArray(currentPayloads) ? cloneValue(currentPayloads) : [];
  };

  metrics.replaceSeededSavedReportPayloads = function replaceSeededSavedReportPayloads(payloads = []) {
    if (typeof setSavedReportPayloads !== "function") {
      return null;
    }
    const nextPayloads = Array.isArray(payloads) ? cloneValue(payloads) : [];
    setSavedReportPayloads(nextPayloads);
    return metrics.getSeededSavedReportPayloads();
  };

  metrics.appendSeededSavedReportPayloadRecord = function appendSeededSavedReportPayloadRecord(seed = {}) {
    if (typeof setSavedReportPayloads !== "function" || typeof buildSavedReportPayloadRecord !== "function") {
      return null;
    }
    let nextRecord = null;
    try {
      nextRecord = buildSavedReportPayloadRecord(seed);
    } catch (_) {
      return null;
    }
    if (!isPlainObject(nextRecord)) {
      return null;
    }
    const currentPayloads = metrics.getSeededSavedReportPayloads();
    setSavedReportPayloads([
      ...currentPayloads,
      cloneValue(nextRecord),
    ]);
    return cloneValue(nextRecord);
  };

  metrics.patchSeededSavedReportPayload = function patchSeededSavedReportPayload(reportId = "", patch = null) {
    if (typeof setSavedReportPayloads !== "function") {
      return null;
    }
    const normalizedReportId = normalizeReportId(reportId);
    if (!normalizedReportId || !isPlainObject(patch)) {
      return null;
    }
    const currentPayloads = metrics.getSeededSavedReportPayloads();
    let matchedPayload = null;
    const nextPayloads = currentPayloads.map((payload) => {
      if (resolveSavedReportPayloadReportId(payload) !== normalizedReportId) {
        return payload;
      }
      const target = resolveSavedReportPayloadTarget(payload);
      const nextTarget = buildPatchedSavedReportPayloadTarget(target, patch);
      if (isPlainObject(payload?.savedReportPayload)) {
        const nextRecord = {
          ...cloneValue(payload),
          savedReportPayload: nextTarget,
        };
        matchedPayload = nextTarget;
        return nextRecord;
      }
      matchedPayload = nextTarget;
      return nextTarget;
    });
    if (!matchedPayload) {
      return null;
    }
    setSavedReportPayloads(nextPayloads);
    return cloneValue(matchedPayload);
  };

  attachPreviewRuntimeInteractionApi(metrics, {
    getWindowFormState,
    setWindowFormState,
    persistBuilderState,
    runtimeSurface,
    runtimeInteractionSnapshot,
    stateKey: normalizedStateKey,
  });

  return metrics;
}

export function detachPreviewRuntimeSurfaceApi(metrics = {}) {
  if (!isPlainObject(metrics)) {
    return metrics;
  }
  delete metrics.getBuilderConfig;
  delete metrics.patchBuilderConfig;
  delete metrics.getBuilderState;
  delete metrics.patchBuilderState;
  delete metrics.getCollectionRows;
  delete metrics.replaceCollectionRows;
  delete metrics.applyStandaloneRuntimeRefinement;
  delete metrics.getSeededSavedReportPayloads;
  delete metrics.replaceSeededSavedReportPayloads;
  delete metrics.appendSeededSavedReportPayloadRecord;
  delete metrics.patchSeededSavedReportPayload;
  detachPreviewRuntimeInteractionApi(metrics);
  return metrics;
}
