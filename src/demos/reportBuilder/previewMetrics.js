import {
  attachPreviewSemanticValidationBehaviorApi,
  loadStoredPreviewSemanticValidationBehaviors,
  persistPreviewSemanticValidationBehaviors,
} from "./previewSemanticValidation.js";
import {
  attachPreviewSemanticModelBehaviorApi,
  loadStoredPreviewSemanticModelBehaviors,
  persistPreviewSemanticModelBehaviors,
} from "./previewSemanticModel.js";
import { attachPreviewDetailTargetBehaviorApi } from "./previewDetailTargetBehaviors.js";
import { attachPreviewRuntimeActionBehaviorApi } from "./previewRuntimeActionBehaviors.js";
import { attachPreviewFetchBehaviorApi } from "./previewFetchBehaviors.js";

function resolveStorage(windowLike = null, explicitStorage = undefined) {
  if (explicitStorage !== undefined) {
    return explicitStorage;
  }
  return windowLike?.sessionStorage || null;
}

export function createReportBuilderPreviewMetrics({ storage = null } = {}) {
  const next = {
    fetchCollectionCount: 0,
    fetchRecordsCount: 0,
    getModelCount: 0,
    validateSelectionCount: 0,
    windowFormChangeCount: 0,
    inputSignalChangeCount: 0,
    currentWindowFormJSON: "{}",
    currentInputJSON: "{}",
    lastWindowFormJSON: undefined,
    lastInputJSON: undefined,
    lastFetchRequest: null,
    fetchRequestHistory: [],
    fetchEventHistory: [],
    semanticModelBehaviors: loadStoredPreviewSemanticModelBehaviors(storage),
    semanticValidationBehaviors: loadStoredPreviewSemanticValidationBehaviors(storage),
    detailTargetBehaviors: [],
    runtimeActionBehaviors: [],
    fetchBehaviors: [],
    resetCounters() {
      this.fetchCollectionCount = 0;
      this.fetchRecordsCount = 0;
      this.getModelCount = 0;
      this.validateSelectionCount = 0;
      this.windowFormChangeCount = 0;
      this.inputSignalChangeCount = 0;
      this.lastWindowFormJSON = this.currentWindowFormJSON;
      this.lastInputJSON = this.currentInputJSON;
      this.lastFetchRequest = null;
      this.fetchRequestHistory = [];
      this.fetchEventHistory = [];
    },
  };
  const previewMetrics = attachPreviewFetchBehaviorApi(
    attachPreviewRuntimeActionBehaviorApi(
      attachPreviewDetailTargetBehaviorApi(
        attachPreviewSemanticValidationBehaviorApi(
          attachPreviewSemanticModelBehaviorApi(next),
        ),
      ),
    ),
  );
  const replaceSemanticModelBehaviors = previewMetrics.replaceSemanticModelBehaviors;
  const queueSemanticModelBehavior = previewMetrics.queueSemanticModelBehavior;
  const clearSemanticModelBehaviors = previewMetrics.clearSemanticModelBehaviors;
  const replaceSemanticValidationBehaviors = previewMetrics.replaceSemanticValidationBehaviors;
  const queueSemanticValidationBehavior = previewMetrics.queueSemanticValidationBehavior;
  const clearSemanticValidationBehaviors = previewMetrics.clearSemanticValidationBehaviors;
  previewMetrics.replaceSemanticModelBehaviors = function replaceSemanticModelBehaviorsPersisted(nextBehaviors = []) {
    const count = replaceSemanticModelBehaviors.call(previewMetrics, nextBehaviors);
    persistPreviewSemanticModelBehaviors(storage, previewMetrics.semanticModelBehaviors);
    return count;
  };
  previewMetrics.queueSemanticModelBehavior = function queueSemanticModelBehaviorPersisted(nextBehavior = {}) {
    const count = queueSemanticModelBehavior.call(previewMetrics, nextBehavior);
    persistPreviewSemanticModelBehaviors(storage, previewMetrics.semanticModelBehaviors);
    return count;
  };
  previewMetrics.clearSemanticModelBehaviors = function clearSemanticModelBehaviorsPersisted() {
    const count = clearSemanticModelBehaviors.call(previewMetrics);
    persistPreviewSemanticModelBehaviors(storage, previewMetrics.semanticModelBehaviors);
    return count;
  };
  previewMetrics.replaceSemanticValidationBehaviors = function replaceSemanticValidationBehaviorsPersisted(nextBehaviors = []) {
    const count = replaceSemanticValidationBehaviors.call(previewMetrics, nextBehaviors);
    persistPreviewSemanticValidationBehaviors(storage, previewMetrics.semanticValidationBehaviors);
    return count;
  };
  previewMetrics.queueSemanticValidationBehavior = function queueSemanticValidationBehaviorPersisted(nextBehavior = {}) {
    const count = queueSemanticValidationBehavior.call(previewMetrics, nextBehavior);
    persistPreviewSemanticValidationBehaviors(storage, previewMetrics.semanticValidationBehaviors);
    return count;
  };
  previewMetrics.clearSemanticValidationBehaviors = function clearSemanticValidationBehaviorsPersisted() {
    const count = clearSemanticValidationBehaviors.call(previewMetrics);
    persistPreviewSemanticValidationBehaviors(storage, previewMetrics.semanticValidationBehaviors);
    return count;
  };
  return previewMetrics;
}

export function ensureReportBuilderPreviewMetrics(windowLike = null, { storage } = {}) {
  if (!windowLike || typeof windowLike !== "object") {
    return null;
  }
  const current = windowLike.__REPORT_BUILDER_PREVIEW__;
  if (current && typeof current === "object") {
    return current;
  }
  const next = createReportBuilderPreviewMetrics({
    storage: resolveStorage(windowLike, storage),
  });
  windowLike.__REPORT_BUILDER_PREVIEW__ = next;
  return next;
}

export function incrementReportBuilderPreviewMetric(metrics = null, metricKey = "") {
  if (!metrics || typeof metrics !== "object") {
    return 0;
  }
  const key = String(metricKey || "").trim();
  if (!key) {
    return 0;
  }
  metrics[key] = Number(metrics[key] || 0) + 1;
  return metrics[key];
}

export function recordReportBuilderPreviewObservation({
  metrics = null,
  kind = "windowForm",
  currentJSON = "{}",
  previousObservedJSON = undefined,
} = {}) {
  if (!metrics || typeof metrics !== "object") {
    return {
      previousObservedJSON,
      changed: false,
    };
  }
  const normalizedKind = String(kind || "").trim().toLowerCase();
  const isWindowForm = normalizedKind === "windowform";
  const currentKey = isWindowForm ? "currentWindowFormJSON" : "currentInputJSON";
  const lastKey = isWindowForm ? "lastWindowFormJSON" : "lastInputJSON";
  const countKey = isWindowForm ? "windowFormChangeCount" : "inputSignalChangeCount";
  metrics[currentKey] = currentJSON;
  if (previousObservedJSON === undefined) {
    if (metrics[lastKey] === undefined) {
      metrics[lastKey] = currentJSON;
    }
    return {
      previousObservedJSON: currentJSON,
      changed: false,
    };
  }
  if (previousObservedJSON !== currentJSON) {
    metrics[countKey] = Number(metrics[countKey] || 0) + 1;
    metrics[lastKey] = currentJSON;
    return {
      previousObservedJSON: currentJSON,
      changed: true,
    };
  }
  return {
    previousObservedJSON,
    changed: false,
  };
}
