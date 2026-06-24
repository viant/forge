import {
  attachPreviewRuntimeInteractionApi,
  detachPreviewRuntimeInteractionApi,
} from "./previewRuntimeInteractionApi.js";
import {
  isReportBuilderExplorationActive,
  beginReportBuilderExplorationSession,
  recordReportBuilderExplorationHistory,
} from "../../components/dashboard/reportBuilderExplorationSession.js";
import {
  buildReportBuilderCalculatedFieldConfig,
  removeReportBuilderLocalTableCalculationState,
  upsertReportBuilderLocalCalculatedFieldState,
  upsertReportBuilderLocalTableCalculationState,
  upsertReportBuilderLocalTableCalculationDraftState,
} from "../../components/dashboard/reportBuilderCalculatedFieldAuthoring.js";
import {
  buildReportBuilderDocumentBlockDraft,
  buildReportBuilderDocumentBlockFieldOptions,
  duplicateReportBuilderDocumentBlockState,
  moveReportBuilderDocumentBlockState,
  removeReportBuilderDocumentBlockState,
  upsertReportBuilderDocumentBlockState,
} from "../../components/dashboard/reportBuilderDocumentBlocks.js";
import {
  prepareReportBuilderTableCalculationApplication,
} from "../../components/dashboard/reportBuilderUtils.js";

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

function commitBuilderState({
  normalizedStateKey = "",
  nextBuilderState = null,
  getWindowFormState = null,
  setWindowFormState = null,
  persistBuilderState = null,
} = {}) {
  if (!normalizedStateKey || !isPlainObject(nextBuilderState)) {
    return null;
  }
  if (typeof setWindowFormState === "function") {
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const nextWindowFormState = {
      ...(isPlainObject(currentWindowFormState) ? currentWindowFormState : {}),
      [normalizedStateKey]: nextBuilderState,
    };
    setWindowFormState(nextWindowFormState);
  }
  if (typeof persistBuilderState === "function") {
    persistBuilderState(nextBuilderState);
  }
  return cloneValue(nextBuilderState);
}

export function attachPreviewRuntimeSurfaceApi(metrics = {}, {
  getBuilderConfig = null,
  setBuilderConfig = null,
  getSemanticModelProviderAvailable = null,
  setSemanticModelProviderAvailable = null,
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

  metrics.getSemanticModelProviderAvailable = function getSemanticModelProviderAvailableSnapshot() {
    if (typeof getSemanticModelProviderAvailable !== "function") {
      return null;
    }
    return getSemanticModelProviderAvailable() === true;
  };

  metrics.setSemanticModelProviderAvailable = function setSemanticModelProviderAvailability(enabled = true) {
    if (typeof setSemanticModelProviderAvailable !== "function") {
      return null;
    }
    return setSemanticModelProviderAvailable(enabled !== false) === true;
  };

  metrics.getHydratedReportDocumentSession = function getHydratedReportDocumentSession() {
    const currentBuilderState = metrics.getBuilderState();
    const currentSession = isPlainObject(currentBuilderState?.reportDocumentReopenSession)
      ? currentBuilderState.reportDocumentReopenSession
      : null;
    return currentSession ? cloneValue(currentSession) : null;
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

  metrics.beginStandaloneDraft = function beginStandaloneDraft({
    sourceKind = "reportBuilder.result",
    sourceLabel = "the current result state",
    sourceContext = null,
    patch = { __scenarioDraft: true },
    nowMs = Date.now(),
  } = {}) {
    if (!normalizedStateKey) {
      return null;
    }
    const current = metrics.getBuilderState();
    if (!isPlainObject(current)) {
      return null;
    }
    const started = beginReportBuilderExplorationSession(current, {
      container: {
        id: normalizedStateKey,
        stateKey: normalizedStateKey,
      },
      sourceKind,
      sourceContext: (
        sourceContext && typeof sourceContext === "object" && !Array.isArray(sourceContext)
          ? cloneValue(sourceContext)
          : {
            label: String(sourceLabel || "").trim() || "the current result state",
          }
      ),
      nowMs,
    });
    const drafted = recordReportBuilderExplorationHistory(started, {
      ...current,
      ...(isPlainObject(patch) ? cloneValue(patch) : {}),
    }, {
      nowMs: Number(nowMs || Date.now()) + 1,
    });
    if (!drafted || typeof drafted !== "object" || Array.isArray(drafted)) {
      return null;
    }
    return commitBuilderState({
      normalizedStateKey,
      nextBuilderState: drafted,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
  };

  metrics.applyAuthoredDocumentBlock = function applyAuthoredDocumentBlock({
    kind = "markdownBlock",
    seed = null,
    editingId = "",
  } = {}) {
    const current = metrics.getBuilderState();
    const currentBuilderConfig = metrics.getBuilderConfig();
    if (!isPlainObject(current) || !isPlainObject(currentBuilderConfig)) {
      return null;
    }
    const fieldOptions = buildReportBuilderDocumentBlockFieldOptions({
      config: currentBuilderConfig,
      state: current,
    });
    const existingBlocks = Array.isArray(current?.reportDocumentBlocks)
      ? cloneValue(current.reportDocumentBlocks)
      : [];
    const draft = buildReportBuilderDocumentBlockDraft(kind, seed, {
      ...fieldOptions,
      existingBlocks,
    });
    const result = upsertReportBuilderDocumentBlockState(current, draft, {
      editingId,
      valueFieldOptions: fieldOptions.valueFieldOptions,
      secondaryFieldOptions: fieldOptions.secondaryFieldOptions,
      tableColumnOptions: fieldOptions.tableColumnOptions,
      scopeParamOptions: fieldOptions.scopeParamOptions,
      chartConfig: fieldOptions.chartConfig,
      chartFieldOptions: fieldOptions.chartFieldOptions,
    });
    if (!result?.valid || !isPlainObject(result?.nextState)) {
      return cloneValue(result);
    }
    commitBuilderState({
      normalizedStateKey,
      nextBuilderState: result.nextState,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
    return cloneValue(result);
  };

  metrics.applyLocalCalculatedField = function applyLocalCalculatedField({
    draft = null,
    editingId = "",
    selectOnCreate = true,
  } = {}) {
    const current = metrics.getBuilderState();
    const currentBuilderConfig = metrics.getBuilderConfig();
    if (!isPlainObject(current) || !isPlainObject(currentBuilderConfig)) {
      return null;
    }
    const effectiveBuilderConfig = buildReportBuilderCalculatedFieldConfig(currentBuilderConfig, current);
    const result = upsertReportBuilderLocalCalculatedFieldState(
      current,
      isPlainObject(draft) ? draft : {},
      effectiveBuilderConfig,
      {
        editingId,
        selectOnCreate,
      },
    );
    if (!result?.valid || !isPlainObject(result?.nextState)) {
      return cloneValue(result);
    }
    const nextBuilderState = isReportBuilderExplorationActive(current)
      ? result.nextState
      : recordReportBuilderExplorationHistory(
        beginReportBuilderExplorationSession(current, {
          container: {
            id: normalizedStateKey,
            stateKey: normalizedStateKey,
          },
          sourceKind: "reportBuilder.result",
          sourceContext: {
            label: result.field?.label || result.field?.id || "Calculated field",
          },
        }),
        result.nextState,
      );
    commitBuilderState({
      normalizedStateKey,
      nextBuilderState,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
    return cloneValue(result);
  };

  metrics.applyLocalTableCalculationDraft = function applyLocalTableCalculationDraft({
    draft = null,
    editingId = "",
    selectOnCreate = true,
  } = {}) {
    const current = metrics.getBuilderState();
    const currentBuilderConfig = metrics.getBuilderConfig();
    if (!isPlainObject(current) || !isPlainObject(currentBuilderConfig)) {
      return null;
    }
    const validationBuilderConfig = buildReportBuilderCalculatedFieldConfig(currentBuilderConfig, current);
    const authored = upsertReportBuilderLocalTableCalculationDraftState(
      current,
      isPlainObject(draft) ? draft : {},
      validationBuilderConfig,
      {
        editingId,
        selectOnCreate,
      },
    );
    if (!authored?.valid || !isPlainObject(authored?.nextState) || !authored?.field) {
      return cloneValue(authored);
    }
    const effectiveBuilderConfig = buildReportBuilderCalculatedFieldConfig(currentBuilderConfig, authored.nextState);
    const prepared = prepareReportBuilderTableCalculationApplication(
      effectiveBuilderConfig,
      authored.nextState,
      authored.field.id,
      {
        forceAutoFetch: true,
        switchToTable: true,
      },
    );
    if (!prepared?.canApply || !isPlainObject(prepared?.nextState)) {
      return cloneValue({
        valid: false,
        field: authored.field,
        nextState: authored.nextState,
        prepared,
      });
    }
    const nextBuilderState = isReportBuilderExplorationActive(current)
      ? prepared.nextState
      : recordReportBuilderExplorationHistory(
        beginReportBuilderExplorationSession(current, {
          container: {
            id: normalizedStateKey,
            stateKey: normalizedStateKey,
          },
          sourceKind: "reportBuilder.result",
          sourceContext: {
            label: authored.field?.label || authored.field?.id || "Table calculation",
          },
        }),
        prepared.nextState,
      );
    commitBuilderState({
      normalizedStateKey,
      nextBuilderState,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
    return cloneValue({
      valid: true,
      field: authored.field,
      authored,
      prepared,
      nextState: prepared.nextState,
    });
  };

  metrics.applyQuickTableCalculation = function applyQuickTableCalculation(tableCalculationId = "") {
    const current = metrics.getBuilderState();
    const currentBuilderConfig = metrics.getBuilderConfig();
    const normalizedTableCalculationId = String(tableCalculationId || "").trim();
    if (!isPlainObject(current) || !isPlainObject(currentBuilderConfig) || !normalizedTableCalculationId) {
      return null;
    }
    const effectiveBuilderConfig = buildReportBuilderCalculatedFieldConfig(currentBuilderConfig, current);
    const prepared = prepareReportBuilderTableCalculationApplication(
      effectiveBuilderConfig,
      current,
      normalizedTableCalculationId,
      {
        forceAutoFetch: true,
        switchToTable: true,
      },
    );
    if (!prepared?.canApply || !isPlainObject(prepared?.nextState)) {
      return cloneValue({
        valid: false,
        prepared,
        field: null,
        nextState: current,
      });
    }
    const authored = upsertReportBuilderLocalTableCalculationState(
      prepared.nextState,
      currentBuilderConfig,
      normalizedTableCalculationId,
      {
        selectOnCreate: true,
      },
    );
    if (!authored?.valid || !isPlainObject(authored?.nextState) || !authored?.field) {
      return cloneValue({
        valid: false,
        prepared,
        authored,
        field: null,
        nextState: prepared.nextState,
      });
    }
    const nextBuilderState = isReportBuilderExplorationActive(current)
      ? authored.nextState
      : recordReportBuilderExplorationHistory(
        beginReportBuilderExplorationSession(current, {
          container: {
            id: normalizedStateKey,
            stateKey: normalizedStateKey,
          },
          sourceKind: "reportBuilder.result",
          sourceContext: {
            label: authored.field?.label || authored.field?.id || "Table calculation",
          },
        }),
        authored.nextState,
      );
    commitBuilderState({
      normalizedStateKey,
      nextBuilderState,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
    return cloneValue({
      valid: true,
      field: authored.field,
      authored,
      prepared,
      nextState: authored.nextState,
    });
  };

  metrics.removeLocalTableCalculation = function removeLocalTableCalculation(fieldId = "") {
    const current = metrics.getBuilderState();
    const normalizedFieldId = String(fieldId || "").trim();
    if (!isPlainObject(current) || !normalizedFieldId) {
      return null;
    }
    const nextState = removeReportBuilderLocalTableCalculationState(current, normalizedFieldId);
    if (!isPlainObject(nextState)) {
      return null;
    }
    const committedState = isReportBuilderExplorationActive(current)
      ? nextState
      : recordReportBuilderExplorationHistory(
        beginReportBuilderExplorationSession(current, {
          container: {
            id: normalizedStateKey,
            stateKey: normalizedStateKey,
          },
          sourceKind: "reportBuilder.result",
          sourceContext: {
            label: normalizedFieldId,
          },
        }),
        nextState,
      );
    commitBuilderState({
      normalizedStateKey,
      nextBuilderState: committedState,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
    return cloneValue(committedState);
  };

  metrics.duplicateAuthoredDocumentBlock = function duplicateAuthoredDocumentBlock(blockId = "") {
    const current = metrics.getBuilderState();
    if (!isPlainObject(current)) {
      return null;
    }
    const result = duplicateReportBuilderDocumentBlockState(current, blockId);
    if (!result?.valid || !isPlainObject(result?.nextState)) {
      return cloneValue(result);
    }
    commitBuilderState({
      normalizedStateKey,
      nextBuilderState: result.nextState,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
    return cloneValue(result);
  };

  metrics.moveAuthoredDocumentBlock = function moveAuthoredDocumentBlock(blockId = "", direction = "up") {
    const current = metrics.getBuilderState();
    if (!isPlainObject(current)) {
      return null;
    }
    const nextState = moveReportBuilderDocumentBlockState(current, blockId, direction);
    if (!isPlainObject(nextState)) {
      return null;
    }
    return commitBuilderState({
      normalizedStateKey,
      nextBuilderState: nextState,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
  };

  metrics.removeAuthoredDocumentBlock = function removeAuthoredDocumentBlock(blockId = "") {
    const current = metrics.getBuilderState();
    if (!isPlainObject(current)) {
      return null;
    }
    const nextState = removeReportBuilderDocumentBlockState(current, blockId);
    if (!isPlainObject(nextState)) {
      return null;
    }
    return commitBuilderState({
      normalizedStateKey,
      nextBuilderState: nextState,
      getWindowFormState,
      setWindowFormState,
      persistBuilderState,
    });
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
  delete metrics.getSemanticModelProviderAvailable;
  delete metrics.setSemanticModelProviderAvailable;
  delete metrics.patchBuilderConfig;
  delete metrics.getBuilderState;
  delete metrics.getHydratedReportDocumentSession;
  delete metrics.patchBuilderState;
  delete metrics.beginStandaloneDraft;
  delete metrics.applyAuthoredDocumentBlock;
  delete metrics.applyLocalCalculatedField;
  delete metrics.applyLocalTableCalculationDraft;
  delete metrics.applyQuickTableCalculation;
  delete metrics.removeLocalTableCalculation;
  delete metrics.duplicateAuthoredDocumentBlock;
  delete metrics.moveAuthoredDocumentBlock;
  delete metrics.removeAuthoredDocumentBlock;
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
