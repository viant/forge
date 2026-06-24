import { extractReportDocumentTemplateIdentity } from "../reportDocumentModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function normalizeTemplateIdentityFixture(fixture = null) {
  const normalizedFixture = cloneValue(fixture);
  if (Array.isArray(normalizedFixture)) {
    return normalizedFixture.map((entry) => normalizeTemplateIdentityFixture(entry));
  }
  if (!normalizedFixture || typeof normalizedFixture !== "object") {
    return normalizedFixture;
  }
  const normalizedObject = Object.fromEntries(
    Object.entries(normalizedFixture).map(([key, value]) => [key, normalizeTemplateIdentityFixture(value)]),
  );
  if (normalizeString(normalizedObject?.kind) === "reportDocument") {
    const templateIdentity = extractReportDocumentTemplateIdentity(normalizedObject);
    return templateIdentity
      ? {
        ...normalizedObject,
        ...templateIdentity,
      }
      : normalizedObject;
  }
  if (normalizeString(normalizedObject?.kind) === "getReportDocumentResponse") {
    const templateIdentity = extractReportDocumentTemplateIdentity(normalizedObject.document);
    return templateIdentity
      ? {
        ...normalizedObject,
        ...templateIdentity,
      }
      : normalizedObject;
  }
  if (normalizeString(normalizedObject?.kind) === "listReportDocumentsResponse") {
    return {
      ...normalizedObject,
      entries: (Array.isArray(normalizedObject.entries) ? normalizedObject.entries : []).map((entry) => {
        const templateIdentity = extractReportDocumentTemplateIdentity(entry?.document);
        return templateIdentity
          ? {
            ...entry,
            ...templateIdentity,
          }
          : entry;
      }),
    };
  }
  return normalizedObject;
}
