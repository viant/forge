import React from "react";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeItems(values = []) {
  return (Array.isArray(values) ? values : []).filter(Boolean);
}

export function ReportBuilderAuthoredRuntimePreviewHeader({ state = null } = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }
  const chips = normalizeItems(state.semanticBindingChips);
  const fieldGroups = normalizeItems(state.semanticBindingFieldGroups);
  const scopeItems = normalizeItems(state.scopeSummaryItems);
  return React.createElement(
    "div",
    { className: "forge-report-builder__runtime-preview-header" },
    React.createElement("div", { className: "forge-report-builder__runtime-preview-eyebrow" }, normalizeString(state.eyebrow)),
    React.createElement("h4", { className: "forge-report-builder__runtime-preview-title" }, normalizeString(state.title)),
    normalizeString(state.subtitle)
      ? React.createElement("div", { className: "forge-report-builder__runtime-preview-description" }, normalizeString(state.subtitle))
      : null,
    React.createElement("p", { className: "forge-report-builder__runtime-preview-description" }, normalizeString(state.description)),
    chips.length > 0
      ? React.createElement(
          "div",
          { className: "forge-report-builder__result-meta", "aria-label": normalizeString(state.semanticBindingTitle || "Semantic Binding") || undefined },
          ...chips.map((chip) => React.createElement("span", {
            key: `chip:${chip}`,
            className: "forge-report-builder__result-meta-chip",
          }, chip)),
        )
      : null,
    ...fieldGroups.map((group) => React.createElement(
      "div",
      { key: `group:${normalizeString(group.id)}`, style: { display: "grid", gap: 8, marginTop: 10 } },
      React.createElement("div", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#738694",
        },
      }, normalizeString(group.title)),
      React.createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 } },
        ...normalizeItems(group.fields).map((field, index) => React.createElement(
          "div",
          {
            key: `${normalizeString(group.id)}:${normalizeString(field?.id || field?.label || index)}`,
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d7e2ee",
              background: "#fbfdff",
            },
          },
          React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#183247" } }, normalizeString(field?.label || field?.id)),
          normalizeString(field?.description)
            ? React.createElement("div", { style: { fontSize: 11, lineHeight: 1.45, color: "#5f6b7c" } }, normalizeString(field.description))
            : null,
        )),
      ),
    )),
    scopeItems.length > 0
      ? React.createElement(
          "div",
          { style: { display: "grid", gap: 8, marginTop: 10 } },
          normalizeString(state.scopeSummaryTitle)
            ? React.createElement("div", {
              style: {
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#738694",
              },
            }, normalizeString(state.scopeSummaryTitle))
            : null,
          normalizeString(state.scopeSummaryText)
            ? React.createElement("div", { style: { fontSize: 12, color: "#486579" } }, normalizeString(state.scopeSummaryText))
            : null,
          React.createElement(
            "div",
            { style: { display: "grid", gap: 8 } },
            ...scopeItems.map((item, index) => React.createElement(
              "div",
              {
                key: `scope:${normalizeString(item?.id || item?.label || index)}`,
                style: {
                  border: "1px solid #d7e2ee",
                  borderRadius: 10,
                  background: "#fbfdff",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                },
              },
              React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#183247" } }, normalizeString(item?.label || item?.id)),
              normalizeString(item?.description)
                ? React.createElement("div", { style: { fontSize: 11, lineHeight: 1.45, color: "#5f6b7c" } }, normalizeString(item.description))
                : null,
            )),
          ),
        )
      : null,
  );
}
