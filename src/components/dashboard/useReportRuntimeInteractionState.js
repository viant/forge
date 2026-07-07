import React from "react";

import {
  createReportRuntimeInteractionState,
  replaceReportRuntimeInteractionState,
  reduceReportRuntimeInteractionState,
} from "./reportRuntimeInteractionStateModel.js";

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildHistoryTrackedInteractionState(state = null) {
  const normalized = replaceReportRuntimeInteractionState(state);
  return {
    refinements: cloneValue(normalized.refinements || []),
    drillTransitions: cloneValue(normalized.drillTransitions || []),
    datasetScopeParams: cloneValue(normalized.datasetScopeParams || {}),
  };
}

function restoreHistoryTrackedInteractionState(currentState = null, trackedState = null) {
  const normalizedCurrentState = replaceReportRuntimeInteractionState(currentState);
  const normalizedTrackedState = buildHistoryTrackedInteractionState(trackedState);
  return {
    ...normalizedCurrentState,
    refinements: normalizedTrackedState.refinements,
    drillTransitions: normalizedTrackedState.drillTransitions,
    datasetScopeParams: normalizedTrackedState.datasetScopeParams,
    hostIntent: null,
    detailDiagnostic: null,
  };
}

function stableSerializeInteractionHistoryState(state = null) {
  return JSON.stringify(state == null ? buildHistoryTrackedInteractionState(state) : state);
}

export function createReportRuntimeInteractionHistoryState() {
  return {
    past: [],
    future: [],
  };
}

function normalizeReportRuntimeInteractionHistoryState(historyState = null) {
  return {
    past: (Array.isArray(historyState?.past) ? historyState.past : []).map((entry) => buildHistoryTrackedInteractionState(entry)),
    future: (Array.isArray(historyState?.future) ? historyState.future : []).map((entry) => buildHistoryTrackedInteractionState(entry)),
  };
}

export function summarizeReportRuntimeInteractionHistoryState(historyState = null) {
  const normalized = normalizeReportRuntimeInteractionHistoryState(historyState);
  return {
    canUndo: normalized.past.length > 0,
    canRedo: normalized.future.length > 0,
  };
}

export function recordReportRuntimeInteractionHistory(historyState = null, currentState = null, nextState = null) {
  const normalizedHistoryState = normalizeReportRuntimeInteractionHistoryState(historyState);
  const currentTrackedState = buildHistoryTrackedInteractionState(currentState);
  const nextTrackedState = buildHistoryTrackedInteractionState(nextState);
  if (stableSerializeInteractionHistoryState(currentTrackedState) === stableSerializeInteractionHistoryState(nextTrackedState)) {
    return {
      historyState: normalizedHistoryState,
      nextState: replaceReportRuntimeInteractionState(nextState),
      changed: false,
    };
  }
  return {
    historyState: {
      past: [...normalizedHistoryState.past, currentTrackedState],
      future: [],
    },
    nextState: replaceReportRuntimeInteractionState(nextState),
    changed: true,
  };
}

export function undoReportRuntimeInteractionHistory(historyState = null, currentState = null) {
  const normalizedHistoryState = normalizeReportRuntimeInteractionHistoryState(historyState);
  if (normalizedHistoryState.past.length === 0) {
    return {
      historyState: normalizedHistoryState,
      nextState: replaceReportRuntimeInteractionState(currentState),
      changed: false,
    };
  }
  const previousTrackedState = normalizedHistoryState.past[normalizedHistoryState.past.length - 1];
  return {
    historyState: {
      past: normalizedHistoryState.past.slice(0, -1),
      future: [buildHistoryTrackedInteractionState(currentState), ...normalizedHistoryState.future],
    },
    nextState: restoreHistoryTrackedInteractionState(currentState, previousTrackedState),
    changed: true,
  };
}

export function redoReportRuntimeInteractionHistory(historyState = null, currentState = null) {
  const normalizedHistoryState = normalizeReportRuntimeInteractionHistoryState(historyState);
  if (normalizedHistoryState.future.length === 0) {
    return {
      historyState: normalizedHistoryState,
      nextState: replaceReportRuntimeInteractionState(currentState),
      changed: false,
    };
  }
  const [nextTrackedState, ...remainingFuture] = normalizedHistoryState.future;
  return {
    historyState: {
      past: [...normalizedHistoryState.past, buildHistoryTrackedInteractionState(currentState)],
      future: remainingFuture,
    },
    nextState: restoreHistoryTrackedInteractionState(currentState, nextTrackedState),
    changed: true,
  };
}

export function resolveReportRuntimeInteractionResetBehavior({
  hasSeenInitialReset = false,
  previousResetKey = undefined,
  nextResetKey = undefined,
  pendingSeededState = false,
} = {}) {
  if (nextResetKey === undefined) {
    return {
      shouldReset: false,
      nextHasSeenInitialReset: hasSeenInitialReset,
      nextPreviousResetKey: undefined,
      nextPendingSeededState: pendingSeededState,
      reason: "missingResetKey",
    };
  }
  if (!hasSeenInitialReset) {
    return {
      shouldReset: false,
      nextHasSeenInitialReset: true,
      nextPreviousResetKey: nextResetKey,
      nextPendingSeededState: false,
      reason: "initialMount",
    };
  }
  const resetChanged = previousResetKey !== nextResetKey;
  if (pendingSeededState && !resetChanged) {
    return {
      shouldReset: false,
      nextHasSeenInitialReset: true,
      nextPreviousResetKey: nextResetKey,
      nextPendingSeededState: false,
      reason: "seededState",
    };
  }
  return {
    shouldReset: resetChanged,
    nextHasSeenInitialReset: true,
    nextPreviousResetKey: nextResetKey,
    nextPendingSeededState: false,
    reason: resetChanged ? "resetChanged" : "unchangedResetKey",
  };
}

export function useReportRuntimeInteractionState({
  initialState = null,
  resetKey = undefined,
} = {}) {
  const normalizedInitialState = React.useMemo(
    () => replaceReportRuntimeInteractionState(initialState),
    [initialState],
  );
  const [interactionState, dispatch] = React.useReducer(
    reduceReportRuntimeInteractionState,
    normalizedInitialState,
  );
  const interactionStateRef = React.useRef(normalizedInitialState);
  const historyStateRef = React.useRef(createReportRuntimeInteractionHistoryState());
  const [historyCapabilities, setHistoryCapabilities] = React.useState(
    summarizeReportRuntimeInteractionHistoryState(historyStateRef.current),
  );
  const initialStateFingerprint = React.useMemo(
    () => JSON.stringify(normalizedInitialState),
    [normalizedInitialState],
  );
  const lastSeedFingerprintRef = React.useRef(initialStateFingerprint);
  const hasSeenInitialResetRef = React.useRef(false);
  const previousResetKeyRef = React.useRef(undefined);
  const pendingSeededStateRef = React.useRef(false);

  const updateHistoryState = React.useCallback((nextHistoryState = null) => {
    historyStateRef.current = normalizeReportRuntimeInteractionHistoryState(nextHistoryState);
    setHistoryCapabilities(summarizeReportRuntimeInteractionHistoryState(historyStateRef.current));
  }, []);

  const replaceInteractionStateInternal = React.useCallback((nextState = null, {
    historyState = null,
    resetHistory = false,
  } = {}) => {
    const normalizedNextState = replaceReportRuntimeInteractionState(nextState);
    interactionStateRef.current = normalizedNextState;
    if (resetHistory) {
      updateHistoryState(createReportRuntimeInteractionHistoryState());
    } else if (historyState != null) {
      updateHistoryState(historyState);
    }
    dispatch({
      type: "replaceState",
      state: normalizedNextState,
    });
    return normalizedNextState;
  }, [updateHistoryState]);

  const applyHistoryTrackedAction = React.useCallback((action = null) => {
    const currentState = interactionStateRef.current;
    const nextState = reduceReportRuntimeInteractionState(currentState, action || {});
    const historyUpdate = recordReportRuntimeInteractionHistory(
      historyStateRef.current,
      currentState,
      nextState,
    );
    if (!historyUpdate.changed) {
      return currentState;
    }
    return replaceInteractionStateInternal(historyUpdate.nextState, {
      historyState: historyUpdate.historyState,
    });
  }, [replaceInteractionStateInternal]);

  React.useEffect(() => {
    interactionStateRef.current = interactionState;
  }, [interactionState]);

  const applyRefinement = React.useCallback((refinement) => {
    return applyHistoryTrackedAction({
      type: "applyRefinement",
      refinement,
    });
  }, [applyHistoryTrackedAction]);

  const applyDrillTransition = React.useCallback(({ refinement, nextFieldRef, sourceField, sourceBlockId }) => {
    return applyHistoryTrackedAction({
      type: "applyDrillTransition",
      payload: {
        refinement,
        nextFieldRef,
        sourceField,
        sourceBlockId,
      },
    });
  }, [applyHistoryTrackedAction]);

  const removeRefinementById = React.useCallback((refinementId) => {
    return applyHistoryTrackedAction({
      type: "removeRefinement",
      refinementId,
    });
  }, [applyHistoryTrackedAction]);

  const clearRefinements = React.useCallback(() => {
    return applyHistoryTrackedAction({
      type: "clearRefinements",
    });
  }, [applyHistoryTrackedAction]);

  const setDatasetScopeParamValue = React.useCallback(({ datasetRef, paramId, value }) => {
    return applyHistoryTrackedAction({
      type: "setDatasetScopeParamValue",
      payload: {
        datasetRef,
        paramId,
        value,
      },
    });
  }, [applyHistoryTrackedAction]);

  const clearInteractionState = React.useCallback(() => {
    return replaceInteractionStateInternal(createReportRuntimeInteractionState(), {
      resetHistory: true,
    });
  }, [replaceInteractionStateInternal]);

  const replaceInteractionState = React.useCallback((nextState) => {
    return replaceInteractionStateInternal(nextState, {
      resetHistory: true,
    });
  }, [replaceInteractionStateInternal]);

  const undoInteractionState = React.useCallback(() => {
    const historyUpdate = undoReportRuntimeInteractionHistory(
      historyStateRef.current,
      interactionStateRef.current,
    );
    if (!historyUpdate.changed) {
      return interactionStateRef.current;
    }
    return replaceInteractionStateInternal(historyUpdate.nextState, {
      historyState: historyUpdate.historyState,
    });
  }, [replaceInteractionStateInternal]);

  const redoInteractionState = React.useCallback(() => {
    const historyUpdate = redoReportRuntimeInteractionHistory(
      historyStateRef.current,
      interactionStateRef.current,
    );
    if (!historyUpdate.changed) {
      return interactionStateRef.current;
    }
    return replaceInteractionStateInternal(historyUpdate.nextState, {
      historyState: historyUpdate.historyState,
    });
  }, [replaceInteractionStateInternal]);

  const clearHostIntent = React.useCallback(() => {
    dispatch({
      type: "clearHostIntent",
    });
  }, []);

  const clearDetailDiagnostic = React.useCallback(() => {
    dispatch({
      type: "clearDetailDiagnostic",
    });
  }, []);

  const clearDetailState = React.useCallback(() => {
    dispatch({
      type: "clearDetailState",
    });
  }, []);

  const setHostIntent = React.useCallback((hostIntent) => {
    dispatch({
      type: "setHostIntent",
      hostIntent,
    });
  }, []);

  const setDetailDiagnostic = React.useCallback((detailDiagnostic) => {
    dispatch({
      type: "setDetailDiagnostic",
      detailDiagnostic,
    });
  }, []);

  React.useEffect(() => {
    if (lastSeedFingerprintRef.current === initialStateFingerprint) {
      return;
    }
    lastSeedFingerprintRef.current = initialStateFingerprint;
    pendingSeededStateRef.current = true;
    replaceInteractionStateInternal(normalizedInitialState, {
      resetHistory: true,
    });
  }, [initialStateFingerprint, normalizedInitialState, replaceInteractionStateInternal]);

  React.useEffect(() => {
    const resetBehavior = resolveReportRuntimeInteractionResetBehavior({
      hasSeenInitialReset: hasSeenInitialResetRef.current,
      previousResetKey: previousResetKeyRef.current,
      nextResetKey: resetKey,
      pendingSeededState: pendingSeededStateRef.current,
    });
    hasSeenInitialResetRef.current = resetBehavior.nextHasSeenInitialReset;
    previousResetKeyRef.current = resetBehavior.nextPreviousResetKey;
    pendingSeededStateRef.current = resetBehavior.nextPendingSeededState;
    if (!resetBehavior.shouldReset) {
      return;
    }
    replaceInteractionStateInternal(createReportRuntimeInteractionState(), {
      resetHistory: true,
    });
  }, [replaceInteractionStateInternal, resetKey]);

  return {
    refinements: interactionState.refinements,
    drillTransitions: interactionState.drillTransitions,
    datasetScopeParams: interactionState.datasetScopeParams,
    hostIntent: interactionState.hostIntent,
    detailDiagnostic: interactionState.detailDiagnostic,
    canUndoInteraction: historyCapabilities.canUndo,
    canRedoInteraction: historyCapabilities.canRedo,
    setHostIntent,
    setDetailDiagnostic,
    applyRefinement,
    applyDrillTransition,
    setDatasetScopeParamValue,
    removeRefinementById,
    clearRefinements,
    undoInteractionState,
    redoInteractionState,
    replaceInteractionState,
    clearInteractionState,
    clearHostIntent,
    clearDetailDiagnostic,
    clearDetailState,
  };
}
