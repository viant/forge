import {
  buildReportRuntimeRefinement,
  clearReportRuntimeRefinements,
  removeReportRuntimeRefinement,
  upsertReportRuntimeRefinement,
} from "./reportRuntimeRefinements.js";
import {
  clearReportRuntimeDrillTransitions,
  normalizeReportRuntimeDrillTransition,
  removeReportRuntimeDrillTransition,
  upsertReportRuntimeDrillTransition,
} from "./reportRuntimeDrillState.js";
import { normalizeReportRefinements } from "../../reporting/reportRefinementModel.js";
import { normalizeReportRuntimeHostIntent } from "../../reporting/reportRuntimeHostIntent.js";

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeReportRuntimeDetailDiagnostic(detailDiagnostic = null) {
  if (!detailDiagnostic || typeof detailDiagnostic !== "object" || Array.isArray(detailDiagnostic)) {
    return null;
  }
  const code = String(detailDiagnostic?.code || "").trim();
  const severity = String(detailDiagnostic?.severity || "").trim().toLowerCase();
  const message = String(detailDiagnostic?.message || "").trim();
  if (!code || !message) {
    return null;
  }
  return {
    code,
    severity: severity || "warning",
    message,
  };
}

export function createReportRuntimeInteractionState() {
  return {
    refinements: [],
    drillTransitions: [],
    hostIntent: null,
    detailDiagnostic: null,
  };
}

export function normalizeReportRuntimeInteractionState(state = null, {
  allowEmpty = true,
} = {}) {
  const refinements = normalizeReportRefinements(state?.refinements);
  const drillTransitions = (Array.isArray(state?.drillTransitions) ? state.drillTransitions : [])
    .map((entry) => normalizeReportRuntimeDrillTransition(entry))
    .filter(Boolean);
  const hostIntent = normalizeReportRuntimeHostIntent(state?.hostIntent);
  const detailDiagnostic = normalizeReportRuntimeDetailDiagnostic(state?.detailDiagnostic);
  if (!allowEmpty && refinements.length === 0 && drillTransitions.length === 0 && !hostIntent && !detailDiagnostic) {
    return null;
  }
  return {
    refinements,
    drillTransitions,
    hostIntent: hostIntent || null,
    detailDiagnostic: detailDiagnostic || null,
  };
}

export function replaceReportRuntimeInteractionState(state = null) {
  return normalizeReportRuntimeInteractionState(state) || createReportRuntimeInteractionState();
}

export function applyReportRuntimeInteractionRefinement(state = {}, refinement = null) {
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    refinements: upsertReportRuntimeRefinement(state?.refinements, refinement),
  };
}

export function applyReportRuntimeInteractionDrillTransition(state = {}, {
  refinement = null,
  nextFieldRef = "",
  sourceField = "",
  sourceBlockId = "",
} = {}) {
  const normalizedRefinement = buildReportRuntimeRefinement(refinement);
  if (!normalizedRefinement || !nextFieldRef || !sourceField) {
    return {
      ...createReportRuntimeInteractionState(),
      ...(state || {}),
    };
  }
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    refinements: upsertReportRuntimeRefinement(state?.refinements, normalizedRefinement),
    drillTransitions: upsertReportRuntimeDrillTransition(state?.drillTransitions, {
      refinementId: normalizedRefinement.id,
      sourceField,
      nextFieldRef,
      sourceBlockId,
    }),
  };
}

export function removeReportRuntimeInteractionRefinement(state = {}, refinementId = "") {
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    refinements: removeReportRuntimeRefinement(state?.refinements, refinementId),
    drillTransitions: removeReportRuntimeDrillTransition(state?.drillTransitions, refinementId),
  };
}

export function clearReportRuntimeInteractionRefinements(state = {}) {
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    refinements: clearReportRuntimeRefinements(state?.refinements),
    drillTransitions: clearReportRuntimeDrillTransitions(state?.drillTransitions),
  };
}

export function clearReportRuntimeInteractionState() {
  return createReportRuntimeInteractionState();
}

export function setReportRuntimeInteractionHostIntent(state = {}, hostIntent = null) {
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    hostIntent: cloneValue(hostIntent),
  };
}

export function clearReportRuntimeInteractionHostIntent(state = {}) {
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    hostIntent: null,
  };
}

export function setReportRuntimeInteractionDetailDiagnostic(state = {}, detailDiagnostic = null) {
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    detailDiagnostic: cloneValue(detailDiagnostic),
  };
}

export function clearReportRuntimeInteractionDetailDiagnostic(state = {}) {
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    detailDiagnostic: null,
  };
}

export function clearReportRuntimeInteractionDetailState(state = {}) {
  return {
    ...createReportRuntimeInteractionState(),
    ...(state || {}),
    hostIntent: null,
    detailDiagnostic: null,
  };
}

export function reduceReportRuntimeInteractionState(state = {}, action = {}) {
  switch (action?.type) {
    case "replaceState":
      return replaceReportRuntimeInteractionState(action.state);
    case "applyRefinement":
      return applyReportRuntimeInteractionRefinement(state, action.refinement);
    case "applyDrillTransition":
      return applyReportRuntimeInteractionDrillTransition(state, action.payload);
    case "removeRefinement":
      return removeReportRuntimeInteractionRefinement(state, action.refinementId);
    case "clearRefinements":
      return clearReportRuntimeInteractionRefinements(state);
    case "setHostIntent":
      return setReportRuntimeInteractionHostIntent(state, action.hostIntent);
    case "clearHostIntent":
      return clearReportRuntimeInteractionHostIntent(state);
    case "setDetailDiagnostic":
      return setReportRuntimeInteractionDetailDiagnostic(state, action.detailDiagnostic);
    case "clearDetailDiagnostic":
      return clearReportRuntimeInteractionDetailDiagnostic(state);
    case "clearDetailState":
      return clearReportRuntimeInteractionDetailState(state);
    case "clear":
      return clearReportRuntimeInteractionState();
    default:
      return {
        ...createReportRuntimeInteractionState(),
        ...(state || {}),
      };
  }
}
