function normalizeString(value = "") {
  return String(value || "").trim();
}

export function normalizeReportBuilderDrillLevel(level = {}, index = 0) {
  if (!level || typeof level !== "object" || Array.isArray(level)) {
    return null;
  }
  const field = normalizeString(level.field || level.fieldRef || level.id);
  const label = normalizeString(level.label || field);
  const id = normalizeString(level.id || field || `level_${index + 1}`);
  if (!field || !label || !id) {
    return null;
  }
  return {
    id,
    field,
    label,
  };
}

export function normalizeReportBuilderDrillHierarchy(hierarchy = {}) {
  if (!hierarchy || typeof hierarchy !== "object" || Array.isArray(hierarchy)) {
    return null;
  }
  const levels = (Array.isArray(hierarchy.levels) ? hierarchy.levels : [])
    .map((level, index) => normalizeReportBuilderDrillLevel(level, index))
    .filter(Boolean);
  if (levels.length < 2) {
    return null;
  }
  const id = normalizeString(hierarchy.id || hierarchy.fieldRef || levels[0]?.field);
  if (!id) {
    return null;
  }
  return {
    id,
    ...(normalizeString(hierarchy.label) ? { label: normalizeString(hierarchy.label) } : {}),
    levels,
  };
}

export function normalizeReportBuilderDrillHierarchies(hierarchies = []) {
  return (Array.isArray(hierarchies) ? hierarchies : [])
    .map((hierarchy) => normalizeReportBuilderDrillHierarchy(hierarchy))
    .filter(Boolean);
}

export function findReportBuilderDrillHierarchyLevel(hierarchies = [], fieldRef = "") {
  const normalizedFieldRef = normalizeString(fieldRef);
  if (!normalizedFieldRef) {
    return null;
  }
  for (const hierarchy of normalizeReportBuilderDrillHierarchies(hierarchies)) {
    const levelIndex = hierarchy.levels.findIndex((level) => level.field === normalizedFieldRef);
    if (levelIndex >= 0) {
      return {
        hierarchy,
        levelIndex,
        level: hierarchy.levels[levelIndex],
        nextLevel: hierarchy.levels[levelIndex + 1] || null,
      };
    }
  }
  return null;
}

export function resolveReportBuilderDrillHierarchy(hierarchies = [], fieldRef = "") {
  const match = findReportBuilderDrillHierarchyLevel(hierarchies, fieldRef);
  if (!match) {
    return null;
  }
  return {
    fieldRef: normalizeString(fieldRef),
    levels: match.hierarchy.levels.slice(match.levelIndex),
  };
}

export function buildReportBuilderDrillActions(hierarchies = [], fieldRef = "") {
  const match = findReportBuilderDrillHierarchyLevel(hierarchies, fieldRef);
  if (!match?.nextLevel) {
    return [];
  }
  return [{
    id: `drill:${normalizeString(fieldRef)}:${match.nextLevel.field}`,
    label: `Drill to ${match.nextLevel.label}`,
    kind: "drill",
    nextFieldRef: match.nextLevel.field,
  }];
}
