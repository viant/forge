import { resolveKey } from "../utils/selector.js";
import { normalizePresentationText } from "../utils/presentationText.js";
import { getTemplateSelectors, resolveTemplateText } from "../utils/linkTarget.js";

function normalizeString(value = "") {
  return String(value ?? "").trim();
}

function hasField(row, selector) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const parts = normalizeString(selector).split(".").filter(Boolean);
  if (parts.length === 0) return false;
  let cursor = row;
  return parts.every((part) => {
    if (!cursor || typeof cursor !== "object" || !Object.prototype.hasOwnProperty.call(cursor, part)) return false;
    cursor = cursor[part];
    return true;
  });
}

export function normalizeReportTableLink(link = null) {
  if (!link || typeof link !== "object" || Array.isArray(link)) return null;
  const kind = normalizeString(link.kind).toLowerCase();
  if (kind === "external") {
    const urlField = normalizeString(link.urlField);
    if (urlField) return { kind: "external", urlField };
    const hrefTemplate = normalizeString(link.hrefTemplate);
    return hrefTemplate ? { kind: "external", hrefTemplate } : null;
  }
  if (kind === "entitydetail") {
    const handler = normalizeString(link.handler);
    const idField = normalizeString(link.idField);
    return handler && idField ? { kind: "entityDetail", handler, idField } : null;
  }
  return null;
}

export function getReportTableLinkFields(config = null) {
  const link = normalizeReportTableLink(config);
  if (!link) return [];
  if (link.urlField || link.idField) return [link.urlField || link.idField];
  return getTemplateSelectors(link.hrefTemplate);
}

export function resolveReportTableLink({ row, column, value, entityDetailHandlers = null } = {}) {
  const link = normalizeReportTableLink(column?.link);
  const text = normalizePresentationText(value);
  if (!link || !text) return null;
  if (link.kind === "external") {
    let rawUrl;
    if (link.hrefTemplate) {
      const fields = getTemplateSelectors(link.hrefTemplate);
      if (fields.some(field => {
        if (!hasField(row, field)) return true;
        const destinationValue = resolveKey(row, field);
        return destinationValue == null || normalizeString(destinationValue) === "";
      })) return null;
      rawUrl = resolveTemplateText(link.hrefTemplate, row);
    } else {
      if (!hasField(row, link.urlField)) return null;
      rawUrl = normalizeString(resolveKey(row, link.urlField));
    }
    let url;
    try {
      url = new URL(rawUrl);
    } catch (_) {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return {
      kind: "external",
      href: url.href,
      text,
      target: "_blank",
      rel: "noopener noreferrer",
      title: text,
    };
  }
  if (!hasField(row, link.idField)) return null;
  const entityId = resolveKey(row, link.idField);
  if (entityId === undefined || entityId === null || normalizeString(entityId) === "") return null;
  const handler = entityDetailHandlers && Object.prototype.hasOwnProperty.call(entityDetailHandlers, link.handler)
    ? entityDetailHandlers[link.handler]
    : null;
  if (typeof handler !== "function") return null;
  return { kind: "entityDetail", handler, handlerName: link.handler, entityId, text, title: text };
}
