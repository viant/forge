import {
  buildPreviewHydratedRuntimeInteractionSnapshot,
  buildPreviewRuntimeInteractionAdvancedWindowState,
  buildPreviewRuntimeInteractionWindowState,
} from "./previewRuntimeInteractionSession.js";
import { clearReportRuntimeInteractionDetailState } from "../../components/dashboard/reportRuntimeInteractionStateModel.js";

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeStateKey(stateKey = "") {
  return String(stateKey || "").trim();
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function syncRuntimeInteractionState(runtimeSurface = null, nextBuilderState = null) {
  if (typeof runtimeSurface?.replaceInteractionState !== "function") {
    return false;
  }
  const nextRuntimeInteraction = buildPreviewHydratedRuntimeInteractionSnapshot(
    nextBuilderState?.reportDocumentReopenSession || nextBuilderState,
  );
  runtimeSurface.replaceInteractionState(nextRuntimeInteraction);
  return true;
}

function commitRuntimeInteractionWindowState(nextWindowFormState = null, {
  normalizedStateKey = "",
  setWindowFormState = null,
  persistBuilderState = null,
  runtimeSurface = null,
  syncRuntimeSurface = true,
} = {}) {
  if (!isPlainObject(nextWindowFormState) || !normalizedStateKey) {
    return null;
  }
  if (syncRuntimeSurface) {
    syncRuntimeInteractionState(runtimeSurface, nextWindowFormState[normalizedStateKey] || null);
  }
  if (typeof setWindowFormState === "function") {
    setWindowFormState(nextWindowFormState);
  }
  if (typeof persistBuilderState === "function") {
    persistBuilderState(nextWindowFormState[normalizedStateKey] || null);
  }
  return cloneValue(nextWindowFormState[normalizedStateKey] || null);
}

export function attachPreviewRuntimeInteractionApi(metrics = {}, {
  getWindowFormState = null,
  setWindowFormState = null,
  persistBuilderState = null,
  runtimeSurface = null,
  runtimeInteractionSnapshot = null,
  stateKey = "",
} = {}) {
  const normalizedStateKey = normalizeStateKey(stateKey);

  metrics.getStandaloneRuntimeInteraction = function getStandaloneRuntimeInteraction() {
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const currentSnapshot = buildPreviewHydratedRuntimeInteractionSnapshot(
      currentWindowFormState?.[normalizedStateKey]?.reportDocumentReopenSession || currentWindowFormState?.[normalizedStateKey],
    );
    return currentSnapshot ? cloneValue(currentSnapshot) : (runtimeInteractionSnapshot ? cloneValue(runtimeInteractionSnapshot) : null);
  };

  metrics.getStandaloneRuntimeHistoryCapabilities = function getStandaloneRuntimeHistoryCapabilities() {
    return {
      canUndo: runtimeSurface?.canUndoInteraction === true,
      canRedo: runtimeSurface?.canRedoInteraction === true,
    };
  };

  metrics.replaceStandaloneRuntimeInteraction = function replaceStandaloneRuntimeInteraction(snapshot = null) {
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const nextWindowFormState = buildPreviewRuntimeInteractionWindowState({
      windowFormState: currentWindowFormState,
      stateKey: normalizedStateKey,
      runtimeInteractionSnapshot: snapshot,
    });
    return commitRuntimeInteractionWindowState(nextWindowFormState, {
      normalizedStateKey,
      setWindowFormState,
      persistBuilderState,
      runtimeSurface,
    });
  };

  metrics.advanceStandaloneRuntimeInteraction = function advanceStandaloneRuntimeInteraction(interactionUpdater = null) {
    if (typeof interactionUpdater !== "function") {
      return null;
    }
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const nextWindowFormState = buildPreviewRuntimeInteractionAdvancedWindowState({
      windowFormState: currentWindowFormState,
      stateKey: normalizedStateKey,
      interactionUpdater,
    });
    return commitRuntimeInteractionWindowState(nextWindowFormState, {
      normalizedStateKey,
      setWindowFormState,
      persistBuilderState,
      runtimeSurface,
    });
  };

  metrics.clearStandaloneRuntimeInteractions = function clearStandaloneRuntimeInteractions() {
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const nextWindowFormState = buildPreviewRuntimeInteractionWindowState({
      windowFormState: currentWindowFormState,
      stateKey: normalizedStateKey,
      runtimeInteractionSnapshot: null,
    });
    const persisted = commitRuntimeInteractionWindowState(nextWindowFormState, {
      normalizedStateKey,
      setWindowFormState,
      persistBuilderState,
      runtimeSurface,
    });
    if (typeof runtimeSurface?.clearInteractionState === "function") {
      runtimeSurface.clearInteractionState();
      return true;
    }
    return !!persisted;
  };

  metrics.clearStandaloneRuntimeDetailState = function clearStandaloneRuntimeDetailState() {
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const nextWindowFormState = buildPreviewRuntimeInteractionAdvancedWindowState({
      windowFormState: currentWindowFormState,
      stateKey: normalizedStateKey,
      interactionUpdater(currentSnapshot = null) {
        return clearReportRuntimeInteractionDetailState(currentSnapshot);
      },
    });
    const persisted = commitRuntimeInteractionWindowState(nextWindowFormState, {
      normalizedStateKey,
      setWindowFormState,
      persistBuilderState,
      runtimeSurface,
    });
    if (typeof runtimeSurface?.clearDetailState === "function") {
      runtimeSurface.clearDetailState();
      return true;
    }
    return !!persisted;
  };

  metrics.undoStandaloneRuntimeInteraction = function undoStandaloneRuntimeInteraction() {
    if (typeof runtimeSurface?.undoInteractionState !== "function") {
      return false;
    }
    const nextSnapshot = runtimeSurface.undoInteractionState();
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const nextWindowFormState = buildPreviewRuntimeInteractionWindowState({
      windowFormState: currentWindowFormState,
      stateKey: normalizedStateKey,
      runtimeInteractionSnapshot: nextSnapshot,
    });
    return commitRuntimeInteractionWindowState(nextWindowFormState, {
      normalizedStateKey,
      setWindowFormState,
      persistBuilderState,
      runtimeSurface,
      syncRuntimeSurface: false,
    });
  };

  metrics.redoStandaloneRuntimeInteraction = function redoStandaloneRuntimeInteraction() {
    if (typeof runtimeSurface?.redoInteractionState !== "function") {
      return false;
    }
    const nextSnapshot = runtimeSurface.redoInteractionState();
    const currentWindowFormState = typeof getWindowFormState === "function"
      ? getWindowFormState()
      : null;
    const nextWindowFormState = buildPreviewRuntimeInteractionWindowState({
      windowFormState: currentWindowFormState,
      stateKey: normalizedStateKey,
      runtimeInteractionSnapshot: nextSnapshot,
    });
    return commitRuntimeInteractionWindowState(nextWindowFormState, {
      normalizedStateKey,
      setWindowFormState,
      persistBuilderState,
      runtimeSurface,
      syncRuntimeSurface: false,
    });
  };

  return metrics;
}

export function detachPreviewRuntimeInteractionApi(metrics = {}) {
  if (!isPlainObject(metrics)) {
    return metrics;
  }
  delete metrics.getStandaloneRuntimeInteraction;
  delete metrics.getStandaloneRuntimeHistoryCapabilities;
  delete metrics.replaceStandaloneRuntimeInteraction;
  delete metrics.advanceStandaloneRuntimeInteraction;
  delete metrics.clearStandaloneRuntimeInteractions;
  delete metrics.clearStandaloneRuntimeDetailState;
  delete metrics.undoStandaloneRuntimeInteraction;
  delete metrics.redoStandaloneRuntimeInteraction;
  return metrics;
}
