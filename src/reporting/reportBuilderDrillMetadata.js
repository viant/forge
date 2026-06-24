import { normalizeDetailTarget, normalizeRefinementActions } from "./drillMetadataProvider.js";
import {
  buildReportBuilderDrillActions,
  normalizeReportBuilderDrillHierarchies,
  resolveReportBuilderDrillHierarchy,
} from "./reportBuilderDrillHierarchy.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveDrillMetadataSource(config = {}) {
  const nested = config?.drillMetadata;
  return nested && typeof nested === "object" && !Array.isArray(nested) ? nested : config;
}

function normalizeDetailTargets(detailTargets = []) {
  return (Array.isArray(detailTargets) ? detailTargets : [])
    .map((target) => normalizeDetailTarget(target))
    .filter(Boolean);
}

function normalizeFieldActionEntries(fieldActions = []) {
  return (Array.isArray(fieldActions) ? fieldActions : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const fieldRef = normalizeString(entry.fieldRef || entry.field || entry.id);
      if (!fieldRef) {
        return null;
      }
      const actions = normalizeRefinementActions(entry.actions || entry.refinementActions || []);
      return {
        fieldRef,
        actions,
      };
    })
    .filter(Boolean);
}

function dedupeActions(actions = []) {
  const seen = new Set();
  const next = [];
  (Array.isArray(actions) ? actions : []).forEach((action) => {
    const id = normalizeString(action?.id);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    next.push(cloneValue(action));
  });
  return next;
}

export function normalizeReportBuilderDrillMetadata(config = {}) {
  const source = resolveDrillMetadataSource(config);
  const hierarchies = normalizeReportBuilderDrillHierarchies(source?.hierarchies || source?.drillHierarchies || []);
  const detailTargets = normalizeDetailTargets(source?.detailTargets || []);
  const fieldActions = normalizeFieldActionEntries(source?.fieldActions || source?.refinementActionsByField || source?.refinementActions || []);
  return {
    hierarchies,
    detailTargets,
    fieldActions,
  };
}

export function resolveReportBuilderDrillMetadata(config = {}, overrides = null) {
  const base = normalizeReportBuilderDrillMetadata(config);
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return base;
  }
  const normalizedOverrides = normalizeReportBuilderDrillMetadata({
    drillMetadata: overrides,
  });
  return {
    hierarchies: Object.prototype.hasOwnProperty.call(overrides, "hierarchies")
      ? normalizedOverrides.hierarchies
      : base.hierarchies,
    detailTargets: Object.prototype.hasOwnProperty.call(overrides, "detailTargets")
      ? normalizedOverrides.detailTargets
      : base.detailTargets,
    fieldActions: Object.prototype.hasOwnProperty.call(overrides, "fieldActions")
      ? normalizedOverrides.fieldActions
      : base.fieldActions,
  };
}

export function createReportBuilderDrillMetadataProvider(config = {}) {
  const normalized = normalizeReportBuilderDrillMetadata(config);
  const detailTargetsByRef = new Map(
    normalized.detailTargets.map((target) => [normalizeString(target?.targetRef), target]),
  );
  const fieldActionsByField = new Map(
    normalized.fieldActions.map((entry) => [entry.fieldRef, entry.actions]),
  );
  return {
    async getDrillHierarchy(fieldRef = "") {
      const hierarchy = resolveReportBuilderDrillHierarchy(normalized.hierarchies, fieldRef);
      return hierarchy ? { drillHierarchy: hierarchy } : null;
    },
    async getDetailTarget(targetRef = "") {
      const detailTarget = detailTargetsByRef.get(normalizeString(targetRef));
      return detailTarget ? { detailTarget } : null;
    },
    async listAvailableRefinements(_blockKind = "", fieldRef = "") {
      const normalizedFieldRef = normalizeString(fieldRef);
      if (!normalizedFieldRef) {
        return { actions: [] };
      }
      return {
        actions: dedupeActions([
          { id: `keep:${normalizedFieldRef}`, label: "Keep only", kind: "keep" },
          { id: `exclude:${normalizedFieldRef}`, label: "Exclude", kind: "exclude" },
          ...buildReportBuilderDrillActions(normalized.hierarchies, normalizedFieldRef),
          ...(fieldActionsByField.get(normalizedFieldRef) || []),
        ]),
      };
    },
  };
}
