import { formatRefinementActionLabel } from "./reportRuntimeChartActionModel.js";
import { resolveReportRuntimeFieldActionKey } from "./reportRuntimeModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function supportsRuntimeRefinement(field = {}) {
  return field?.runtimeFilterable === true;
}

export function buildReportRuntimeTableActionDescriptors({
  blockId = "",
  field = {},
  providerActionsByField = new Map(),
} = {}) {
  const key = resolveReportRuntimeFieldActionKey(blockId, field?.valueKey);
  const providerActions = Array.isArray(providerActionsByField.get(key))
    ? providerActionsByField.get(key)
    : [];
  const hasProviderActionConfig = providerActionsByField.has(key);
  const actionsByKind = providerActions.reduce((acc, action) => {
    const kind = normalizeString(action?.kind).toLowerCase();
    if (!kind) {
      return acc;
    }
    const current = acc.get(kind) || [];
    current.push(action);
    acc.set(kind, current);
    return acc;
  }, new Map());
  const descriptors = [];
  const keepExcludeKinds = hasProviderActionConfig
    ? ["keep", "exclude"].filter((kindName) => actionsByKind.has(kindName) && supportsRuntimeRefinement(field))
    : (supportsRuntimeRefinement(field) ? ["keep", "exclude"] : []);
  keepExcludeKinds.forEach((kindName) => {
    const kindActions = actionsByKind.get(kindName) || [null];
    kindActions.forEach((metadataAction, index) => {
      descriptors.push({
        id: kindActions.length > 1
          ? `${kindName}:${normalizeString(field?.valueKey)}:${index}`
          : `${kindName}:${normalizeString(field?.valueKey)}`,
        kind: kindName,
        fieldValueKey: normalizeString(field?.valueKey),
        label: normalizeString(metadataAction?.label || formatRefinementActionLabel(kindName, field?.label)),
      });
    });
  });
  (actionsByKind.get("drill") || []).forEach((drillAction) => {
    if (!supportsRuntimeRefinement(field) || !normalizeString(drillAction?.nextFieldRef)) {
      return;
    }
    descriptors.push({
      id: drillAction.id || `drill:${normalizeString(field?.valueKey)}`,
      kind: "drill",
      fieldValueKey: normalizeString(field?.valueKey),
      label: normalizeString(drillAction.label || formatRefinementActionLabel("drill", field?.label)),
      nextFieldRef: normalizeString(drillAction.nextFieldRef),
    });
  });
  (actionsByKind.get("detail") || []).forEach((detailAction) => {
    if (!normalizeString(detailAction?.targetRef)) {
      return;
    }
    descriptors.push({
      id: detailAction.id || `detail:${normalizeString(field?.valueKey)}`,
      kind: "detail",
      fieldValueKey: normalizeString(field?.valueKey),
      label: normalizeString(detailAction.label || formatRefinementActionLabel("detail", field?.label)),
      targetRef: normalizeString(detailAction.targetRef),
    });
  });
  return descriptors;
}
