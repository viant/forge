import { buildReportRuntimeRefinement } from "./reportRuntimeRefinements.js";

export function executeReportRuntimeAction(execution = null, runtimeHandlers = null) {
  if (!execution || typeof execution !== "object" || Array.isArray(execution)) {
    return {
      executed: false,
      reason: "invalidExecution",
    };
  }
  if ((execution.kind === "keep" || execution.kind === "exclude") && typeof runtimeHandlers?.applyRefinement === "function") {
    const refinement = buildReportRuntimeRefinement(execution.refinement);
    const result = runtimeHandlers.applyRefinement(refinement);
    return {
      executed: true,
      branch: "refinement",
      result,
    };
  }
  if (execution.kind === "drill" && typeof runtimeHandlers?.applyDrillTransition === "function") {
    const transitionPayload = {
      refinement: execution.refinement,
      ...execution.transition,
    };
    const result = runtimeHandlers.applyDrillTransition(transitionPayload);
    return {
      executed: true,
      branch: "drill",
      result,
    };
  }
  if (execution.kind === "detail" && typeof runtimeHandlers?.openDetailTarget === "function") {
    const result = runtimeHandlers.openDetailTarget(execution.detailRequest);
    return {
      executed: true,
      branch: "detail",
      result,
    };
  }
  if (execution.kind === "removeRefinement") {
    const refinementId = String(execution?.refinementId || "").trim();
    if (!refinementId) {
      return {
        executed: false,
        reason: "invalidExecution",
      };
    }
    if (typeof runtimeHandlers?.removeRefinement !== "function") {
      return {
        executed: false,
        reason: "unsupportedExecution",
      };
    }
    const result = runtimeHandlers.removeRefinement(refinementId);
    return {
      executed: true,
      branch: "removeRefinement",
      result,
    };
  }
  if (execution.kind === "clearRefinements" && typeof runtimeHandlers?.clearRefinements === "function") {
    const result = runtimeHandlers.clearRefinements();
    return {
      executed: true,
      branch: "clearRefinements",
      result,
    };
  }
  if (execution.kind === "undoRefinements" && typeof runtimeHandlers?.undoRefinements === "function") {
    const result = runtimeHandlers.undoRefinements();
    return {
      executed: true,
      branch: "undoRefinements",
      result,
    };
  }
  if (execution.kind === "redoRefinements" && typeof runtimeHandlers?.redoRefinements === "function") {
    const result = runtimeHandlers.redoRefinements();
    return {
      executed: true,
      branch: "redoRefinements",
      result,
    };
  }
  return {
    executed: false,
    reason: "unsupportedExecution",
  };
}
