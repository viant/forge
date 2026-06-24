function normalizeString(value = "") {
  return String(value || "").trim();
}

function titleCaseWords(value = "") {
  return normalizeString(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function buildSemanticFieldGovernanceChipViewModels(governance = {}) {
  const normalizedGovernance = governance && typeof governance === "object" && !Array.isArray(governance)
    ? governance
    : {};
  const status = normalizeString(normalizedGovernance.status).toLowerCase();
  const certification = normalizeString(normalizedGovernance.certification).toLowerCase();
  const ownerRef = normalizeString(normalizedGovernance.ownerRef);
  return [
    status === "deprecated"
      ? { key: "deprecated", label: "Deprecated", tone: "deprecated" }
      : null,
    status === "draft"
      ? { key: "draft", label: "Draft", tone: "draft" }
      : null,
    status === "approved"
      ? { key: "approved", label: "Approved", tone: "approved" }
      : null,
    certification
      ? { key: `certification:${certification}`, label: titleCaseWords(certification), tone: "certification" }
      : null,
    ownerRef
      ? { key: `owner:${ownerRef}`, label: `Owner ${ownerRef}`, tone: "owner" }
      : null,
  ].filter(Boolean);
}
