import {
  applyReportBuilderHydratedDocumentSessionState,
  resolveReportBuilderHydratedDocumentSessionFromState,
  setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction,
} from "../../components/dashboard/reportBuilderHydratedReportDocument.js";
import { normalizeReportRuntimeInteractionState } from "../../components/dashboard/reportRuntimeInteractionStateModel.js";

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function buildPreviewRuntimeInteractionSnapshot(interactionState = null) {
  return normalizeReportRuntimeInteractionState(interactionState, {
    allowEmpty: false,
  });
}

export function buildPreviewHydratedRuntimeInteractionSnapshot(session = null) {
  return buildPreviewRuntimeInteractionSnapshot(session?.runtimePreviewInteraction || null);
}

export function buildPreviewRuntimeInteractionFingerprint(snapshot = null) {
  return JSON.stringify(snapshot == null ? null : snapshot);
}

export function buildPreviewRuntimeInteractionPersistedState({
  persistedBuilderState = null,
  hydratedReportDocumentSession = null,
  runtimeInteractionSnapshot = null,
} = {}) {
  if (!isPlainObject(persistedBuilderState) || !hydratedReportDocumentSession) {
    return null;
  }
  const nextSession = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(
    cloneValue(hydratedReportDocumentSession),
    cloneValue(runtimeInteractionSnapshot),
  );
  if (!nextSession) {
    return null;
  }
  return applyReportBuilderHydratedDocumentSessionState(
    cloneValue(persistedBuilderState),
    nextSession,
  );
}

export function buildPreviewRuntimeInteractionPersistedStateFromBuilderState({
  persistedBuilderState = null,
  runtimeInteractionSnapshot = null,
} = {}) {
  if (!isPlainObject(persistedBuilderState)) {
    return null;
  }
  const hydratedReportDocumentSession = resolveReportBuilderHydratedDocumentSessionFromState(
    persistedBuilderState,
  );
  if (!hydratedReportDocumentSession) {
    return null;
  }
  return buildPreviewRuntimeInteractionPersistedState({
    persistedBuilderState,
    hydratedReportDocumentSession,
    runtimeInteractionSnapshot,
  });
}

export function buildPreviewRuntimeInteractionAdvancedState({
  persistedBuilderState = null,
  interactionUpdater = null,
} = {}) {
  if (!isPlainObject(persistedBuilderState) || typeof interactionUpdater !== "function") {
    return null;
  }
  const hydratedReportDocumentSession = resolveReportBuilderHydratedDocumentSessionFromState(
    persistedBuilderState,
  );
  if (!hydratedReportDocumentSession) {
    return null;
  }
  const currentSnapshot = buildPreviewHydratedRuntimeInteractionSnapshot(
    hydratedReportDocumentSession,
  );
  const nextSnapshot = interactionUpdater(cloneValue(currentSnapshot));
  return buildPreviewRuntimeInteractionPersistedState({
    persistedBuilderState,
    hydratedReportDocumentSession,
    runtimeInteractionSnapshot: nextSnapshot,
  });
}

export function buildPreviewRuntimeInteractionWindowState({
  windowFormState = null,
  stateKey = "",
  runtimeInteractionSnapshot = null,
} = {}) {
  if (!isPlainObject(windowFormState)) {
    return null;
  }
  const normalizedStateKey = String(stateKey || "").trim();
  if (!normalizedStateKey) {
    return null;
  }
  if (!isPlainObject(windowFormState?.[normalizedStateKey])) {
    return null;
  }
  const nextBuilderState = buildPreviewRuntimeInteractionPersistedStateFromBuilderState({
    persistedBuilderState: windowFormState?.[normalizedStateKey],
    runtimeInteractionSnapshot,
  });
  if (!nextBuilderState) {
    return null;
  }
  return {
    ...cloneValue(windowFormState),
    [normalizedStateKey]: nextBuilderState,
  };
}

export function buildPreviewRuntimeInteractionAdvancedWindowState({
  windowFormState = null,
  stateKey = "",
  interactionUpdater = null,
} = {}) {
  if (!isPlainObject(windowFormState)) {
    return null;
  }
  const normalizedStateKey = String(stateKey || "").trim();
  if (!normalizedStateKey) {
    return null;
  }
  if (!isPlainObject(windowFormState?.[normalizedStateKey])) {
    return null;
  }
  const nextBuilderState = buildPreviewRuntimeInteractionAdvancedState({
    persistedBuilderState: windowFormState?.[normalizedStateKey],
    interactionUpdater,
  });
  if (!nextBuilderState) {
    return null;
  }
  return {
    ...cloneValue(windowFormState),
    [normalizedStateKey]: nextBuilderState,
  };
}
