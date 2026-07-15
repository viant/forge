import React, { useEffect, useMemo, useState } from "react";

import Chart from "../Chart.jsx";
import {
  REPORT_LAYOUT_GRID_COLUMNS,
  resolveReportLayoutSpan,
} from "../../reporting/reportLayoutModel.js";
import { setSelector } from "../../utils/selector.js";
import DashboardTableContent from "./DashboardTableContent.jsx";
import {
  formatReportRuntimeRefinement,
  resolveReportRuntimeCompactBindingSummaryChips,
  formatReportRuntimeScopeValue,
  resolveReportRuntimeActiveScopeSummary,
  resolveReportRuntimeChartActionFields,
  resolveReportRuntimeBindingSummaryChips,
  resolveReportRuntimeBindingSummary,
  resolveReportRuntimeBlocks,
  resolveReportRuntimeRefinementFields,
  resolveReportRuntimeScopeSummary,
} from "./reportRuntimeModel.js";
import {
  buildIdleReportRuntimeProviderActionsState,
  buildPendingReportRuntimeProviderActionsState,
  buildResolvedReportRuntimeProviderActionsState,
  loadReportRuntimeProviderActions,
} from "./reportRuntimeProviderActions.js";
import { resolveReportRuntimeChartInteractionSupport } from "./reportRuntimeChartInteractions.js";
import {
  buildReportRuntimeDiagnosticsViewModel,
  buildReportRuntimeHostIntentViewModel,
} from "./reportRuntimeOverlayViewModel.js";
import { buildReportRuntimeChartInteractionState } from "./reportRuntimeChartInteractionState.js";
import { buildReportRuntimeChartSelectionViewModel } from "./reportRuntimeChartSelectionViewModel.js";
import { executeReportRuntimeAction } from "./reportRuntimeActionExecutor.js";
import {
  buildReportRuntimeTableInteractionState,
} from "./reportRuntimeTableInteractionState.js";
import {
  buildReportRuntimeRefinementBarClearExecution,
  buildReportRuntimeRefinementBarRedoExecution,
  buildReportRuntimeRefinementBarRemoveExecution,
  buildReportRuntimeRefinementBarUndoExecution,
} from "./reportRuntimeRefinementBarExecutionModel.js";
import {
  clearReportRuntimeChartSelection,
  setReportRuntimeChartSelection,
} from "./reportRuntimeChartSelectionState.js";
import { resolveReportRuntimeDrillMetadataProvider } from "./reportRuntimeDrillProvider.js";
import { DEFAULT_GEO_PALETTE, US_STATE_TILES, normalizeGeoKey } from "./geoMapUtils.js";
import { buildSemanticFieldGovernanceChipViewModels } from "./semanticFieldGovernanceView.js";
import { formatDashboardValue } from "./dashboardUtils.js";
import { resolveDashboardRowActionIdentity } from "./dashboardRowActionPresentation.js";
import { InlineStaticFilterControl } from "./reportBuilderComponents.jsx";
import { resolveReportDatasetRefResolution } from "../../reporting/reportDatasetRefModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function titleizeRuntimeField(value = "") {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  return normalized
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\bid\b/gi, "ID")
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatRuntimeRefinementChipLabel(refinement = {}) {
  return formatReportRuntimeRefinement(refinement);
}

function supportsReportRuntimeExecution(execution = null, runtimeHandlers = null) {
  const kind = normalizeString(execution?.kind).toLowerCase();
  if (kind === "keep" || kind === "exclude") {
    return typeof runtimeHandlers?.applyRefinement === "function";
  }
  if (kind === "drill") {
    return typeof runtimeHandlers?.applyDrillTransition === "function";
  }
  if (kind === "detail") {
    return typeof runtimeHandlers?.openDetailTarget === "function";
  }
  if (kind === "removeRefinement") {
    return typeof runtimeHandlers?.removeRefinement === "function";
  }
  if (kind === "clearrefinements") {
    return typeof runtimeHandlers?.clearRefinements === "function";
  }
  if (kind === "undorefinements") {
    return typeof runtimeHandlers?.undoRefinements === "function";
  }
  if (kind === "redorefinements") {
    return typeof runtimeHandlers?.redoRefinements === "function";
  }
  return false;
}

function createRuntimeContext(dataset = {}, locale = "en-US") {
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const diagnostics = Array.isArray(dataset?.provenance?.diagnostics) ? dataset.provenance.diagnostics : [];
  const controlValue = diagnostics.find((entry) => normalizeString(entry?.severity).toLowerCase() === "error")
    ? { loading: false, error: diagnostics.find((entry) => normalizeString(entry?.severity).toLowerCase() === "error")?.message || "Dataset failed to load." }
    : { loading: false, error: null };
  return {
    locale,
    identity: {
      dataSourceRef: normalizeString(dataset?.dataSourceRef || dataset?.id || "reportRuntime"),
    },
    signals: {
      collection: {
        value: rows,
        peek: () => rows,
      },
      control: {
        value: controlValue,
        peek: () => controlValue,
      },
      selection: {
        value: null,
        peek: () => null,
      },
      collectionInfo: {
        value: {
          hasMore: dataset?.provenance?.hasMore === true,
        },
        peek: () => ({
          hasMore: dataset?.provenance?.hasMore === true,
        }),
      },
    },
  };
}

function buildRuntimeTableRows(block = {}, dataset = {}) {
  const resolvedRows = Array.isArray(block?.content?.resolvedRows) ? block.content.resolvedRows : [];
  const originalRows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  if (resolvedRows.length === 0) {
    return originalRows;
  }
  return resolvedRows.map((resolvedRow, rowIndex) => {
    const cells = Array.isArray(resolvedRow?.cells) ? resolvedRow.cells : [];
    return cells.reduce((acc, cell) => {
      const sourceKey = normalizeString(cell?.sourceKey || cell?.key);
      const displayKey = normalizeString(cell?.displayKey || cell?.key);
      const next = sourceKey
        ? setSelector(acc, sourceKey, cloneValue(cell?.value))
        : acc;
      return displayKey && displayKey !== sourceKey
        ? setSelector(next, displayKey, cloneValue(cell?.displayValue))
        : next;
    }, cloneValue(originalRows[rowIndex]) || {});
  });
}

function RuntimePanel({ title = "", subtitle = "", children, className = "" }) {
  return (
    <section
      className={className || undefined}
      style={{
        border: "1px solid #dbe5ec",
        borderRadius: 16,
        background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
        boxShadow: "0 8px 18px rgba(16, 22, 26, 0.035), 0 1px 2px rgba(16, 22, 26, 0.05)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {title || subtitle ? (
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {title ? <h3 style={{ margin: 0, fontSize: 15, color: "#182026" }}>{title}</h3> : null}
          {subtitle ? <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#5f6b7c" }}>{subtitle}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

function resolveRuntimeLayoutSpanForBlock(block = {}) {
  const requestedSpan = resolveReportLayoutSpan(block?.layoutItem);
  const normalizedKind = normalizeString(block?.kind).toLowerCase();
  const columns = Array.isArray(block?.content?.columns)
    ? block.content.columns
    : (Array.isArray(block?.columns) ? block.columns : []);
  if (normalizedKind === "tableblock" && columns.length >= 5) {
    return REPORT_LAYOUT_GRID_COLUMNS;
  }
  if (normalizedKind === "tableblock" && columns.length >= 3 && requestedSpan <= 6) {
    return REPORT_LAYOUT_GRID_COLUMNS;
  }
  if (normalizedKind === "tableblock" && columns.length >= 3) {
    return Math.max(requestedSpan, 8);
  }
  return requestedSpan;
}

function resolveRuntimeLayoutGridColumn(block = {}) {
  const span = resolveRuntimeLayoutSpanForBlock(block);
  return span >= REPORT_LAYOUT_GRID_COLUMNS ? "1 / -1" : `span ${span}`;
}

function resolveRuntimeLayoutGridColumns(viewportWidth = 0) {
  const normalizedWidth = Number(viewportWidth) || 0;
  if (normalizedWidth > 0 && normalizedWidth <= 960) {
    return 1;
  }
  return REPORT_LAYOUT_GRID_COLUMNS;
}

function resolveResponsiveRuntimeLayoutGridColumn(block = {}, gridColumns = REPORT_LAYOUT_GRID_COLUMNS) {
  if (Number(gridColumns || 0) <= 1) {
    return "1 / -1";
  }
  const span = resolveRuntimeLayoutSpanForBlock(block);
  return span >= gridColumns ? "1 / -1" : `span ${Math.max(1, Math.min(gridColumns, span))}`;
}

function formatKpiValue(value, format = "", locale = "en-US") {
  if (value == null) {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatKpiValue(entry, format, locale)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return formatDashboardValue(value, format, locale);
}

function resolveRuntimeTheme(reportSpec = {}, reportDocument = null) {
  const source = reportSpec?.theme && typeof reportSpec.theme === "object" && !Array.isArray(reportSpec.theme)
    ? reportSpec.theme
    : (reportDocument?.theme && typeof reportDocument.theme === "object" && !Array.isArray(reportDocument.theme) ? reportDocument.theme : {});
  const accentTone = normalizeString(source?.accentTone).toLowerCase();
  const badgePalette = normalizeString(source?.badgePalette).toLowerCase();
  return {
    accentTone: ["blue", "green", "amber", "rose", "slate"].includes(accentTone) ? accentTone : "blue",
    badgePalette: ["soft", "bold"].includes(badgePalette) ? badgePalette : "soft",
  };
}

function resolveRuntimeAccentPalette(accentTone = "blue") {
  switch (normalizeString(accentTone).toLowerCase()) {
    case "green":
      return { accent: "#16a34a", background: "#eef8f0", border: "#cfe7d6", text: "#0f6b3a", chipBackground: "#daf5e4" };
    case "amber":
      return { accent: "#d9822b", background: "#fff7e1", border: "#f5d28c", text: "#8a5d00", chipBackground: "#fff0c2" };
    case "rose":
      return { accent: "#d64545", background: "#fff1f0", border: "#f5c2c0", text: "#a82a2a", chipBackground: "#fde2df" };
    case "slate":
      return { accent: "#5f6b7c", background: "#f5f7fa", border: "#d8e2eb", text: "#486581", chipBackground: "#e9eef4" };
    case "blue":
    default:
      return { accent: "#2f6de1", background: "#eef4ff", border: "#cddcfd", text: "#2457b8", chipBackground: "#e0edff" };
  }
}

function resolveRuntimeKpiToneStyles(tone = "", theme = {}) {
  const normalizedTone = normalizeString(tone).toLowerCase();
  if (normalizedTone === "danger") {
    return {
      accent: "#d64545",
      chipBackground: "#fff1f0",
      chipBorder: "#f5c2c0",
      chipText: "#a82a2a",
    };
  }
  if (normalizedTone === "warning") {
    return {
      accent: "#d9822b",
      chipBackground: "#fff7e1",
      chipBorder: "#f5d28c",
      chipText: "#8a5d00",
    };
  }
  if (normalizedTone === "success") {
    return {
      accent: "#16a34a",
      chipBackground: "#eef8f0",
      chipBorder: "#cfe7d6",
      chipText: "#0f6b3a",
    };
  }
  if (normalizedTone === "info") {
    const accent = resolveRuntimeAccentPalette(theme?.accentTone);
    return {
      accent: accent.accent,
      chipBackground: accent.background,
      chipBorder: accent.border,
      chipText: accent.text,
    };
  }
  const accent = resolveRuntimeAccentPalette(theme?.accentTone);
  return {
    accent: accent.border,
    chipBackground: theme?.badgePalette === "bold" ? accent.chipBackground : "#f7fafc",
    chipBorder: theme?.badgePalette === "bold" ? accent.border : "#d8e2eb",
    chipText: theme?.badgePalette === "bold" ? accent.text : "#486581",
  };
}

function resolveRuntimeBadgeToneStyles(tone = "", theme = {}) {
  const normalizedTone = normalizeString(tone).toLowerCase();
  const bold = theme?.badgePalette === "bold";
  if (normalizedTone === "danger") {
    return {
      background: bold ? "#fdd8d5" : "#fff1f0",
      border: bold ? "#d64545" : "#f5c2c0",
      text: "#a82a2a",
    };
  }
  if (normalizedTone === "warning") {
    return {
      background: bold ? "#ffe2a8" : "#fff7e1",
      border: bold ? "#d9822b" : "#f5d28c",
      text: "#8a5d00",
    };
  }
  if (normalizedTone === "success") {
    return {
      background: bold ? "#d5f0dc" : "#eef8f0",
      border: bold ? "#16a34a" : "#cfe7d6",
      text: "#0f6b3a",
    };
  }
  if (normalizedTone === "info") {
    const accent = resolveRuntimeAccentPalette(theme?.accentTone);
    return {
      background: bold ? accent.chipBackground : accent.background,
      border: bold ? accent.accent : accent.border,
      text: accent.text,
    };
  }
  const accent = resolveRuntimeAccentPalette(theme?.accentTone);
  return {
    background: bold ? accent.chipBackground : "#f7fafc",
    border: bold ? accent.border : "#d8e2eb",
    text: bold ? accent.text : "#486581",
  };
}

export function ChartSelectionPanel({
  viewModel = null,
  onAction = null,
  onClearSelection = null,
}) {
  const panelClassName = "forge-report-runtime-chart-selection";
  const resolvedViewModel = viewModel && typeof viewModel === "object" && !Array.isArray(viewModel)
    ? viewModel
    : {
      kind: "idle",
      message: "Click a chart mark to apply authored runtime actions.",
    };
  if (resolvedViewModel.kind === "unsupported") {
    return (
      <div className={panelClassName} style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
        {resolvedViewModel.message}
      </div>
    );
  }
  if (resolvedViewModel.kind === "idle") {
    return (
      <div className={panelClassName} style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
        {resolvedViewModel.message}
      </div>
    );
  }
  const canClearSelection = resolvedViewModel.canClearSelection && typeof onClearSelection === "function";
  return (
    <div className={panelClassName} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="forge-report-runtime-chart-selection__summary" style={{ fontSize: 12, color: "#30404d" }}>
          <strong style={{ color: "#182026" }}>Selected value:</strong> {resolvedViewModel.summary}
        </div>
        {canClearSelection ? (
          <button
            type="button"
            className="forge-report-runtime-chart-selection__clear"
            onClick={onClearSelection}
            style={{
              border: "1px solid #d8e1e8",
              background: "#ffffff",
              color: "#30404d",
              borderRadius: 999,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Clear selection
          </button>
        ) : null}
      </div>
      {Array.isArray(resolvedViewModel.actions) && resolvedViewModel.actions.length > 0 ? (
        <div className="forge-report-runtime-chart-selection__actions" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {resolvedViewModel.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="forge-report-runtime-chart-action"
              data-testid="report-runtime-chart-action"
              data-action-id={resolveDashboardRowActionIdentity(action)}
              data-action-kind={normalizeString(action?.kind).toLowerCase() || "action"}
              onClick={() => onAction?.(action.id)}
              style={{
                border: "1px solid #d8e1e8",
                background: "#ffffff",
                color: "#30404d",
                borderRadius: 999,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BindingChips({ bindingSummary = null }) {
  const chips = resolveReportRuntimeBindingSummaryChips(bindingSummary);
  if (chips.length === 0) {
    return null;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {chips.map((chip, index) => (
        <span
          key={`${chip}:${index}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#21538f",
            background: "#eaf3ff",
            border: "1px solid #c8dcfb",
            borderRadius: 999,
            padding: "4px 10px",
            letterSpacing: "0.02em",
          }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function CompactBindingChips({ bindingSummary = null }) {
  const chips = resolveReportRuntimeCompactBindingSummaryChips(bindingSummary);
  if (chips.length === 0) {
    return null;
  }
  return (
    <div
      data-report-runtime-binding-panel="semantic-compact"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      }}
      aria-label="Semantic binding"
    >
      {chips.map((chip) => (
        <span
          key={chip}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid #d8e1e8",
            borderRadius: 999,
            background: "#f5f8fb",
            color: "#30404d",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function BindingFieldGovernanceChips({ field = {} }) {
  const governance = field?.governance && typeof field.governance === "object" && !Array.isArray(field.governance)
    ? field.governance
    : {};
  const toneByKind = {
    deprecated: { background: "#fff1f0", border: "#f5c2c0", text: "#a82a2a" },
    draft: { background: "#eef6ff", border: "#c9dcf8", text: "#21538f" },
    approved: { background: "#eef8f2", border: "#cfe7d6", text: "#2d6b3f" },
    certification: { background: "#edf7ee", border: "#cde5d1", text: "#2d6b3f" },
    owner: { background: "#f4f7fa", border: "#d7e2ee", text: "#486579" },
  };
  const chips = buildSemanticFieldGovernanceChipViewModels(governance)
    .map((chip) => ({
      ...chip,
      tone: toneByKind[chip.tone] || toneByKind.owner,
    }));
  if (chips.length === 0) {
    return null;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "3px 8px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            background: chip.tone.background,
            border: `1px solid ${chip.tone.border}`,
            color: chip.tone.text,
          }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

function BindingFieldCard({ field = {} }) {
  const label = normalizeString(field?.label || field?.id);
  const rawId = normalizeString(field?.rawId);
  const description = normalizeString(field?.description);
  const category = normalizeString(field?.category);
  const definitionRef = normalizeString(field?.definitionRef);
  if (!label) {
    return null;
  }
  return (
    <div
      style={{
        border: "1px solid #dbe5ec",
        borderRadius: 12,
        background: "#ffffff",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#182026" }}>
          {label}
        </div>
        {category ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                background: "#f1f5f9",
                border: "1px solid #d9e2ec",
                color: "#486581",
              }}
            >
              {category}
            </span>
          </div>
        ) : null}
        {rawId ? (
          <div style={{ fontSize: 11, color: "#5f6b7c", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            {rawId}
          </div>
        ) : null}
        {definitionRef ? (
          <div style={{ fontSize: 11, color: "#5f6b7c", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: 1.45 }}>
            {definitionRef}
          </div>
        ) : null}
        {description ? (
          <div style={{ fontSize: 11, lineHeight: 1.45, color: "#5f6b7c" }}>
            {description}
          </div>
        ) : null}
      </div>
      <BindingFieldGovernanceChips field={field} />
    </div>
  );
}

function BindingFieldGroup({ title = "", fields = [] }) {
  const resolvedFields = Array.isArray(fields) ? fields.filter((field) => field && typeof field === "object") : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#738694" }}>
        {title}
      </div>
      {resolvedFields.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {resolvedFields.map((field, index) => (
            <BindingFieldCard
              key={`${normalizeString(field?.id || field?.rawId || field?.label || "field")}:${index}`}
              field={field}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#5f6b7c" }}>
          No fields selected.
        </div>
      )}
    </div>
  );
}

function BindingMetadataCard({ label = "", value = "", description = "" }) {
  const resolvedValue = normalizeString(value);
  const resolvedDescription = normalizeString(description);
  if (!resolvedValue && !resolvedDescription) {
    return null;
  }
  return (
    <div
      style={{
        border: "1px solid #dbe5ec",
        borderRadius: 12,
        background: "#ffffff",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#738694" }}>
        {label}
      </div>
      {resolvedValue ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#182026" }}>
          {resolvedValue}
        </div>
      ) : null}
      {resolvedDescription ? (
        <div style={{ fontSize: 11, lineHeight: 1.5, color: "#5f6b7c" }}>
          {resolvedDescription}
        </div>
      ) : null}
    </div>
  );
}

function BindingDetailsPanel({ bindingSummary = null, presentationMode = "preview" }) {
  if (!bindingSummary || typeof bindingSummary !== "object" || Array.isArray(bindingSummary)) {
    return null;
  }
  if (normalizeString(bindingSummary.kind).toLowerCase() !== "semantic") {
    return null;
  }
  if (normalizeString(presentationMode).toLowerCase() === "report") {
    return null;
  }
  return (
    <div
      data-report-runtime-binding-panel="semantic"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        borderTop: "1px solid #e6edf3",
        paddingTop: 14,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#21538f" }}>
          {normalizeString(bindingSummary.title || "Semantic Binding")}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#5f6b7c" }}>
          Governed model and field selections compiled into this runtime artifact.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <BindingMetadataCard
          label="Model"
          value={bindingSummary.modelLabel || bindingSummary.modelRef}
          description={bindingSummary.modelDescription}
        />
        <BindingMetadataCard
          label="Entity"
          value={bindingSummary.entityLabel || bindingSummary.entity}
          description={bindingSummary.entityDescription}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <BindingFieldGroup
          title={`Selected dimensions (${Number(bindingSummary.dimensionCount || 0)})`}
          fields={bindingSummary.selectedDimensions}
        />
        <BindingFieldGroup
          title={`Selected measures (${Number(bindingSummary.measureCount || 0)})`}
          fields={bindingSummary.selectedMeasures}
        />
        {Number(bindingSummary.parameterCount || 0) > 0 || (Array.isArray(bindingSummary.selectedParameters) && bindingSummary.selectedParameters.length > 0) ? (
          <BindingFieldGroup
            title={`Selected parameters (${Number(bindingSummary.parameterCount || 0)})`}
            fields={bindingSummary.selectedParameters}
          />
        ) : null}
      </div>
    </div>
  );
}

function ActiveScopeSummary({ activeScopeSummary = null }) {
  if (!activeScopeSummary || typeof activeScopeSummary !== "object" || Array.isArray(activeScopeSummary)) {
    return null;
  }
  const items = Array.isArray(activeScopeSummary?.items) ? activeScopeSummary.items : [];
  if (items.length === 0) {
    return null;
  }
  return (
    <div
      data-report-runtime-active-scope-summary="true"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderTop: "1px dashed #cfdced",
        paddingTop: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#21538f" }}>
          {normalizeString(activeScopeSummary.title || "Active Refinements")} ({activeScopeSummary.count})
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.5, color: "#5f6b7c" }}>
          {normalizeString(activeScopeSummary.description)}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((item) => (
          <span
            key={item.id}
            className="forge-report-runtime-active-scope-chip"
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "#21538f",
              background: "#eef4fb",
              border: "1px solid #cfdced",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScopeDetailsPanel({ scopeSummary = null, activeScopeSummary = null, presentationMode = "preview" }) {
  if (!scopeSummary || typeof scopeSummary !== "object" || Array.isArray(scopeSummary)) {
    return null;
  }
  const params = Array.isArray(scopeSummary?.params) ? scopeSummary.params : [];
  if (params.length === 0) {
    return null;
  }
  const normalizedPresentationMode = normalizeString(presentationMode).toLowerCase();
  const baselineSubtitle = normalizedPresentationMode === "report"
    ? ""
    : "Baseline filters compiled into this runtime. Live keep, exclude, and drill changes appear in Active refinements.";
  return (
    <div
      data-report-runtime-scope-panel="shared"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        borderTop: "1px solid #e6edf3",
        paddingTop: 14,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#21538f" }}>
          {normalizeString(scopeSummary.title || "Filters")} (baseline)
        </div>
        {baselineSubtitle ? (
          <div style={{ fontSize: 12, lineHeight: 1.5, color: "#5f6b7c" }}>
            {baselineSubtitle}
          </div>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {params.map((param) => (
          <BindingMetadataCard
            key={normalizeString(param?.id)}
            label={normalizeString(param?.label || param?.id)}
            value={formatReportRuntimeScopeValue(param)}
            description={normalizeString(param?.description)}
          />
        ))}
      </div>
      <ActiveScopeSummary activeScopeSummary={activeScopeSummary} />
    </div>
  );
}

function DiagnosticsPanel({ diagnostics = [], onRetryProviderActions = null, providerActionsLoading = false }) {
  const viewModel = buildReportRuntimeDiagnosticsViewModel(diagnostics);
  if (!viewModel.hasDiagnostics) {
    return null;
  }
  return (
    <RuntimePanel className="forge-report-runtime-diagnostics" title="Runtime Diagnostics">
      <div className="forge-report-runtime-diagnostics__list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {viewModel.diagnostics.map((diagnostic, index) => {
          const severity = normalizeString(diagnostic?.severity || "info").toLowerCase();
          const tone = severity === "error"
            ? { background: "#fdecea", border: "#db3737", text: "#a82a2a" }
            : severity === "warning"
              ? { background: "#fff7e1", border: "#d9822b", text: "#8a5d00" }
              : { background: "#ebf1f5", border: "#ced9e0", text: "#30404d" };
          return (
            <div
              key={`${diagnostic?.code || "diagnostic"}-${index}`}
              className={`forge-report-runtime-diagnostic-card forge-report-runtime-diagnostic-card--${severity}`}
              style={{
                border: `1px solid ${tone.border}`,
                background: tone.background,
                color: tone.text,
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div>
                  <strong style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.04em" }}>
                    {severity}
                  </strong>
                  {" "}
                  {diagnostic?.message || diagnostic?.code || "Unknown runtime diagnostic."}
                </div>
                {diagnostic?.suggestedFix ? (
                  <div style={{ fontSize: 11, lineHeight: 1.5, color: tone.text }}>
                    {diagnostic.suggestedFix}
                  </div>
                ) : null}
                {diagnostic?.code === "actionProviderFailed" && typeof onRetryProviderActions === "function" ? (
                  <div>
                    <button
                      type="button"
                      onClick={onRetryProviderActions}
                      disabled={providerActionsLoading}
                      style={{
                        border: `1px solid ${tone.border}`,
                        background: providerActionsLoading ? "#f4f7fa" : "#ffffff",
                        color: providerActionsLoading ? "#98a2b3" : tone.text,
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: providerActionsLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {providerActionsLoading ? "Retrying action provider" : "Retry action provider"}
                    </button>
                  </div>
                ) : null}
                {diagnostic?.code || diagnostic?.blockId || diagnostic?.path ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {diagnostic?.code ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          border: `1px solid ${tone.border}`,
                          background: "#ffffffaa",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: tone.text,
                        }}
                      >
                        {diagnostic.code}
                      </span>
                    ) : null}
                    {diagnostic?.blockId ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          border: `1px solid ${tone.border}`,
                          background: "#ffffffaa",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontSize: 10,
                          color: tone.text,
                        }}
                      >
                        Block {diagnostic.blockId}
                      </span>
                    ) : null}
                    {diagnostic?.path ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          border: `1px solid ${tone.border}`,
                          background: "#ffffffaa",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontSize: 10,
                          color: tone.text,
                        }}
                      >
                        {diagnostic.path}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </RuntimePanel>
  );
}

function BlockDiagnosticsCallout({ diagnostics = [], onRetryProviderActions = null, providerActionsLoading = false }) {
  const warningDiagnostics = buildReportRuntimeDiagnosticsViewModel(diagnostics).diagnostics
    .filter((diagnostic) => normalizeString(diagnostic?.severity || "info").toLowerCase() !== "error");
  if (warningDiagnostics.length === 0) {
    return null;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
      {warningDiagnostics.map((diagnostic, index) => (
        <div
          key={`${normalizeString(diagnostic?.code || "diagnostic")}:${normalizeString(diagnostic?.path || "")}:${index}`}
          style={{
            border: "1px solid #d9b25f",
            background: "#fff7e6",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, color: "#8a5d00", lineHeight: 1.5 }}>
            {normalizeString(diagnostic?.message || "Runtime warning.")}
          </div>
          {normalizeString(diagnostic?.suggestedFix) ? (
            <div style={{ fontSize: 11, color: "#8a5d00", lineHeight: 1.5 }}>
              {normalizeString(diagnostic.suggestedFix)}
            </div>
          ) : null}
          {diagnostic?.code === "actionProviderFailed" && typeof onRetryProviderActions === "function" ? (
            <div>
              <button
                type="button"
                onClick={onRetryProviderActions}
                disabled={providerActionsLoading}
                style={{
                  border: "1px solid #d9b25f",
                  background: providerActionsLoading ? "#f4f7fa" : "#ffffff",
                  color: providerActionsLoading ? "#98a2b3" : "#8a5d00",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: providerActionsLoading ? "not-allowed" : "pointer",
                }}
              >
                {providerActionsLoading ? "Retrying action provider" : "Retry action provider"}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BlockErrorCallout({ diagnostic = null }) {
  if (!diagnostic) {
    return null;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, color: "#a82a2a", lineHeight: 1.5 }}>
        {diagnostic.message}
      </div>
      {normalizeString(diagnostic?.suggestedFix) ? (
        <div style={{ fontSize: 11, color: "#8a5d00", lineHeight: 1.5 }}>
          {normalizeString(diagnostic.suggestedFix)}
        </div>
      ) : null}
    </div>
  );
}

function buildBlockDiagnosticsIndex(diagnostics = []) {
  const next = new Map();
  (Array.isArray(diagnostics) ? diagnostics : []).forEach((diagnostic) => {
    const blockId = normalizeString(diagnostic?.blockId);
    if (!blockId) {
      return;
    }
    const current = next.get(blockId) || [];
    current.push(diagnostic);
    next.set(blockId, current);
  });
  return next;
}

function resolveRuntimeBlockDatasetRef(block = {}, {
  availableDatasetRefs = [],
} = {}) {
  const paramDatasetRef = Array.isArray(block?.content?.params)
    ? normalizeString(block.content.params.find((param) => normalizeString(param?.datasetRef))?.datasetRef)
    : "";
  return resolveReportDatasetRefResolution({
    preferredDatasetRef: normalizeString(block?.datasetRef || paramDatasetRef),
    availableDatasetRefs,
    fallbackDatasetRef: "primary",
  });
}

function resolveDatasetBackedBlockDiagnostics(block = {}, diagnostics = [], dataset = null) {
  const resolvedDiagnostics = Array.isArray(diagnostics) ? diagnostics : [];
  const datasetDiagnostics = Array.isArray(dataset?.provenance?.diagnostics)
    ? dataset.provenance.diagnostics
    : [];
  if (datasetDiagnostics.length === 0) {
    return resolvedDiagnostics;
  }
  const normalizedBlockId = normalizeString(block?.id);
  const combined = [...resolvedDiagnostics];
  const seen = new Set(
    combined.map((diagnostic) => [
      normalizeString(diagnostic?.severity),
      normalizeString(diagnostic?.code),
      normalizeString(diagnostic?.path),
      normalizeString(diagnostic?.message),
      normalizeString(diagnostic?.suggestedFix),
    ].join("::")),
  );
  datasetDiagnostics.forEach((diagnostic, index) => {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
      return;
    }
    const normalizedDiagnostic = {
      ...cloneValue(diagnostic),
      ...(normalizedBlockId ? { blockId: normalizedBlockId } : {}),
      ...(normalizeString(diagnostic?.id) ? {} : { id: `${normalizedBlockId || "block"}:datasetDiagnostic:${index + 1}` }),
    };
    const key = [
      normalizeString(normalizedDiagnostic?.severity),
      normalizeString(normalizedDiagnostic?.code),
      normalizeString(normalizedDiagnostic?.path),
      normalizeString(normalizedDiagnostic?.message),
      normalizeString(normalizedDiagnostic?.suggestedFix),
    ].join("::");
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    combined.push(normalizedDiagnostic);
  });
  return combined;
}

function HostIntentPanel({ hostIntent = null, runtimeHandlers = null }) {
  const viewModel = buildReportRuntimeHostIntentViewModel(hostIntent, {
    canClearHostIntent: typeof runtimeHandlers?.clearDetailState === "function"
      || typeof runtimeHandlers?.clearHostIntent === "function",
  });
  if (!viewModel.hasHostIntent) {
    return null;
  }
  return (
    <RuntimePanel
      className="forge-report-runtime-host-intent"
      title={viewModel.hostIntent.title}
      subtitle={viewModel.hostIntent.description}
    >
      <div className="forge-report-runtime-host-intent__content" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="forge-report-runtime-host-intent__badges" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color: "#21538f", background: "#eaf3ff", border: "1px solid #c8dcfb", borderRadius: 999, padding: "4px 10px" }}>
            {viewModel.hostIntent.intentKind}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color: "#5f6b7c", background: "#f4f7fa", border: "1px solid #d8e1e8", borderRadius: 999, padding: "4px 10px" }}>
            {viewModel.hostIntent.navigationMode}
          </span>
        </div>
        <div className="forge-report-runtime-host-intent__target" style={{ fontSize: 12, color: "#30404d", lineHeight: 1.6 }}>
          <strong style={{ color: "#182026" }}>Target:</strong> {viewModel.hostIntent.targetRef}
        </div>
        {viewModel.hostIntent.parameters.length > 0 ? (
          <div className="forge-report-runtime-host-intent__parameters" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {viewModel.hostIntent.parameters.map(({ key, value }) => (
              <span
                key={key}
                className="forge-report-runtime-host-intent__parameter"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid #d4dee8",
                  background: "#f7fafc",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "#30404d",
                }}
              >
                <strong style={{ color: "#182026" }}>{key}</strong>
                <span>{value}</span>
              </span>
            ))}
          </div>
        ) : null}
        {viewModel.canClearHostIntent ? (
          <div>
            <button
              type="button"
              onClick={() => {
                if (typeof runtimeHandlers?.clearDetailState === "function") {
                  runtimeHandlers.clearDetailState();
                  return;
                }
                runtimeHandlers.clearHostIntent?.();
                runtimeHandlers.clearDetailDiagnostic?.();
              }}
              style={{
                border: "1px solid #d8e1e8",
                background: "#ffffff",
                color: "#30404d",
                borderRadius: 999,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Dismiss intent
            </button>
          </div>
        ) : null}
      </div>
    </RuntimePanel>
  );
}

function renderRuntimeMarkdownInline(value = "") {
  const segments = String(value || "").split(/(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g).filter((segment) => segment !== "");
  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return <strong key={index}>{segment.slice(2, -2)}</strong>;
    }
    if (segment.startsWith("*") && segment.endsWith("*")) {
      return <em key={index}>{segment.slice(1, -1)}</em>;
    }
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code key={index} style={{ fontSize: "0.92em", background: "#eef3f8", borderRadius: 4, padding: "1px 4px" }}>
          {segment.slice(1, -1)}
        </code>
      );
    }
    return segment;
  });
}

function RuntimeMarkdownBody({ markdown = "" }) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const renderedLines = lines
    .map((line, index) => {
      const trimmed = normalizeString(line);
      if (!trimmed) {
        return null;
      }
      if (trimmed.startsWith("## ")) {
        return <h4 key={index} style={{ margin: 0, fontSize: 16, color: "#182026" }}>{renderRuntimeMarkdownInline(trimmed.slice(3))}</h4>;
      }
      if (trimmed.startsWith("# ")) {
        return <h3 key={index} style={{ margin: 0, fontSize: 18, color: "#182026" }}>{renderRuntimeMarkdownInline(trimmed.slice(2))}</h3>;
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        return <p key={index} style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#30404d" }}>{renderRuntimeMarkdownInline(trimmed)}</p>;
      }
      if (/^[-*+]\s+/.test(trimmed)) {
        return <p key={index} style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#30404d" }}>• {renderRuntimeMarkdownInline(trimmed.replace(/^[-*+]\s+/, ""))}</p>;
      }
      if (trimmed.startsWith("> ")) {
        return (
          <p
            key={index}
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#486581",
              borderLeft: "3px solid #d8e2eb",
              paddingLeft: 10,
            }}
          >
            {renderRuntimeMarkdownInline(trimmed.slice(2))}
          </p>
        );
      }
      return <p key={index} style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#30404d" }}>{renderRuntimeMarkdownInline(trimmed)}</p>;
    })
    .filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {renderedLines}
    </div>
  );
}

function MarkdownBlock({ block = {} }) {
  const markdown = String(block?.content?.markdown || block?.markdown || "");
  const lines = markdown.split(/\n+/).filter((line) => line.length > 0);
  const title = normalizeString(block?.title || block?.content?.title);
  const firstLine = normalizeString(lines[0] || "");
  const firstHeadingText = firstLine.startsWith("## ")
    ? normalizeString(firstLine.slice(3))
    : (firstLine.startsWith("# ") ? normalizeString(firstLine.slice(2)) : "");
  const panelTitle = firstHeadingText && title && firstHeadingText.toLowerCase() === title.toLowerCase()
    ? ""
    : title;
  return (
    <RuntimePanel title={panelTitle}>
      <RuntimeMarkdownBody markdown={markdown || "No narrative content."} />
    </RuntimePanel>
  );
}

function BadgesBlock({ block = {}, locale = "en-US", theme = {} }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const items = (Array.isArray(content?.items) ? content.items : Array.isArray(block?.items) ? block.items : [])
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const explicitDisplayValue = item?.displayValue;
      const formattedDisplayValue = normalizeString(item?.format)
        && item?.value !== undefined
        && item?.value !== null
        && String(item?.value) !== ""
          ? formatDashboardValue(item.value, item.format, locale)
          : item?.value;
      const resolvedDisplayValue = explicitDisplayValue !== undefined && explicitDisplayValue !== null && String(explicitDisplayValue) !== ""
        ? explicitDisplayValue
        : formattedDisplayValue;
      return {
        id: normalizeString(item?.id || item?.label || item?.value),
        label: normalizeString(item?.label),
        value: item?.value,
        displayValue: resolvedDisplayValue === undefined || resolvedDisplayValue === null || String(resolvedDisplayValue) === ""
          ? ""
          : String(resolvedDisplayValue),
        tone: normalizeString(item?.tone || "info"),
      };
    })
    .filter((item) => item.label || item.displayValue);
  return (
    <RuntimePanel title={normalizeString(block?.title || content?.title || "Status Pills")}>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          No pills configured.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {items.map((item, index) => {
            const toneStyles = resolveRuntimeBadgeToneStyles(item.tone, theme);
            return (
              <span
                key={item.id || `${item.label}_${index + 1}`}
                data-report-runtime-badge-tone={normalizeString(item.tone).toLowerCase() || "info"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: toneStyles.text,
                  background: toneStyles.background,
                  border: `1px solid ${toneStyles.border}`,
                  borderRadius: 999,
                  padding: "6px 12px",
                }}
              >
                {item.displayValue ? `${item.label}: ${item.displayValue}` : item.label}
              </span>
            );
          })}
        </div>
      )}
    </RuntimePanel>
  );
}

function KpiBlock({ block = {}, diagnostics = [], locale = "en-US", onRetryProviderActions = null, providerActionsLoading = false, theme = {} }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const rowCount = Math.max(0, Number(content?.rowCount || 0) || 0);
  const hasPrimaryValue = content?.value !== undefined && content?.value !== null;
  const hasSecondaryValue = !!content?.secondaryField
    && content?.secondaryValue !== undefined
    && content?.secondaryValue !== null;
  const toneStyles = resolveRuntimeKpiToneStyles(content?.tone, theme);
  const blockTitle = normalizeString(block?.title || content?.title || "KPI");
  const valueLabel = normalizeString(content?.valueLabel || content?.valueField || "Value");
  const showValueLabel = !!valueLabel && valueLabel.toLowerCase() !== blockTitle.toLowerCase();
  const presentationMode = ["body", "both"].includes(normalizeString(content?.presentationMode || block?.presentationMode).toLowerCase())
    ? normalizeString(content?.presentationMode || block?.presentationMode).toLowerCase()
    : "card";
  const showCard = presentationMode !== "body";
  const bodyMarkdown = String(content?.bodyMarkdown || "");
  const showBody = presentationMode !== "card" && !!bodyMarkdown.trim();
  const invalidDiagnostic = (Array.isArray(diagnostics) ? diagnostics : [])
    .find((diagnostic) => normalizeString(diagnostic?.severity || "info").toLowerCase() === "error")
    || null;
  return (
    <RuntimePanel
      className="forge-report-runtime-kpi-panel"
      title={blockTitle}
      subtitle={normalizeString(content?.description)}
    >
      <div
        data-report-runtime-kpi-tone={normalizeString(content?.tone).toLowerCase() || "neutral"}
        style={{
          height: 4,
          width: 32,
          borderRadius: 999,
          background: toneStyles.accent,
          marginBottom: 2,
        }}
      />
      <BlockDiagnosticsCallout diagnostics={diagnostics} onRetryProviderActions={onRetryProviderActions} providerActionsLoading={providerActionsLoading} />
      {invalidDiagnostic ? (
        <BlockErrorCallout diagnostic={invalidDiagnostic} />
      ) : rowCount === 0 || !hasPrimaryValue ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          {normalizeString(content?.emptyLabel || "No KPI value available.")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {showCard ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {showValueLabel ? (
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5f6b7c" }}>
                    {valueLabel}
                  </span>
                ) : null}
                <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: "#182026" }}>
                  {formatKpiValue(content?.value, normalizeString(content?.valueFormat || content?.format), locale)}
                </span>
              </div>
              {hasSecondaryValue ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#30404d" }}>
                  <strong style={{ color: "#182026" }}>
                    {normalizeString(content?.secondaryLabel || content?.secondaryField)}
                  </strong>
                  <span>{formatKpiValue(content?.secondaryValue, normalizeString(content?.secondaryFormat), locale)}</span>
                </div>
              ) : null}
            </>
          ) : null}
          {showBody ? (
            <div
              style={{
                borderTop: showCard ? "1px solid #e6edf3" : "none",
                paddingTop: showCard ? 10 : 0,
              }}
            >
              <RuntimeMarkdownBody markdown={bodyMarkdown} />
            </div>
          ) : null}
          {!showCard && !showBody ? (
            <RuntimeMarkdownBody markdown={`${valueLabel}: ${formatKpiValue(content?.value, normalizeString(content?.valueFormat || content?.format), locale)}`} />
          ) : null}
        </div>
      )}
    </RuntimePanel>
  );
}

function CollectionBlock({ block = {}, diagnostics = [], locale = "en-US", onRetryProviderActions = null, providerActionsLoading = false }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const invalidDiagnostic = (Array.isArray(diagnostics) ? diagnostics : [])
    .find((diagnostic) => normalizeString(diagnostic?.severity || "info").toLowerCase() === "error")
    || null;
  const items = (Array.isArray(content?.items) ? content.items : [])
    .filter((item) => item && typeof item === "object" && !Array.isArray(item));
  const gridColumns = Math.max(1, Math.min(4, Math.trunc(Number(content?.columns || 2)) || 2));
  const layout = normalizeString(content?.layout).toLowerCase() === "list" ? "list" : "grid";
  return (
    <RuntimePanel
      className="forge-report-runtime-collection-panel"
      title={normalizeString(block?.title || content?.title || "Collection")}
      subtitle={normalizeString(content?.description)}
    >
      <BlockDiagnosticsCallout diagnostics={diagnostics} onRetryProviderActions={onRetryProviderActions} providerActionsLoading={providerActionsLoading} />
      {invalidDiagnostic ? (
        <BlockErrorCallout diagnostic={invalidDiagnostic} />
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          {normalizeString(content?.emptyLabel || "No collection items available.")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: layout === "list" ? "1fr" : `repeat(${gridColumns}, minmax(0, 1fr))`,
            gap: 12,
          }}
        >
          {items.map((item, index) => {
            const title = normalizeString(item?.title || `Item ${index + 1}`);
            const valueLabel = normalizeString(item?.valueLabel || item?.valueField || "");
            const secondaryLabel = normalizeString(item?.secondaryLabel || item?.secondaryField || "");
            const bodyMarkdown = String(item?.bodyMarkdown || "");
            return (
              <div
                key={normalizeString(item?.id || title || `item_${index + 1}`)}
                style={{
                  border: "1px solid #dbe5ec",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#182026" }}>{title}</div>
                {valueLabel ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5f6b7c" }}>
                      {valueLabel}
                    </span>
                    <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color: "#182026" }}>
                      {formatKpiValue(item?.value, normalizeString(item?.valueFormat || item?.format), locale)}
                    </span>
                  </div>
                ) : null}
                {secondaryLabel ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#30404d" }}>
                    <strong style={{ color: "#182026" }}>{secondaryLabel}</strong>
                    <span>{formatKpiValue(item?.secondaryValue, normalizeString(item?.secondaryFormat), locale)}</span>
                  </div>
                ) : null}
                {bodyMarkdown.trim() ? <RuntimeMarkdownBody markdown={bodyMarkdown} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </RuntimePanel>
  );
}

function SectionHeaderBlock({ block = {} }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  return (
    <RuntimePanel
      className="forge-report-runtime-section-panel"
      title={normalizeString(block?.title || content?.title || "Section")}
      subtitle={normalizeString(content?.subtitle || block?.subtitle)}
    >
      {normalizeString(content?.description || block?.description) ? (
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#30404d" }}>
          {normalizeString(content?.description || block?.description)}
        </div>
      ) : null}
    </RuntimePanel>
  );
}

function StepperBlock({ block = {} }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const steps = (Array.isArray(content?.steps) ? content.steps : [])
    .filter((step) => step && typeof step === "object" && !Array.isArray(step));
  return (
    <RuntimePanel
      className="forge-report-runtime-stepper-panel"
      title={normalizeString(block?.title || content?.title || "Process")}
      subtitle={normalizeString(content?.description)}
    >
      {steps.length === 0 ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          No process steps configured.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {steps.map((step, index) => (
            <div
              key={normalizeString(step?.id || `step_${index + 1}`)}
              style={{
                display: "grid",
                gridTemplateColumns: "40px minmax(0, 1fr)",
                gap: 12,
                alignItems: "start",
                border: "1px solid #dbe5ec",
                borderRadius: 12,
                background: "#fff",
                padding: 12,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "#1d4ed8",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {index + 1}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {normalizeString(step?.title) ? (
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#182026" }}>{normalizeString(step.title)}</div>
                ) : null}
                {String(step?.body || "").trim() ? (
                  <RuntimeMarkdownBody markdown={String(step.body || "")} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </RuntimePanel>
  );
}

function resolveInfoPanelToneStyles(tone = "", theme = {}) {
  const normalized = normalizeString(tone).toLowerCase();
  if (normalized === "warning") {
    return { border: "#f5c542", background: "#fff9e6", eyebrow: "#8a5d00" };
  }
  if (normalized === "danger") {
    return { border: "#f5c2c0", background: "#fff5f4", eyebrow: "#a82a2a" };
  }
  if (normalized === "success") {
    return { border: "#b7e4c7", background: "#f1fbf5", eyebrow: "#0a6640" };
  }
  const accent = resolveRuntimeAccentPalette(theme?.accentTone);
  return { border: accent.border, background: accent.background, eyebrow: accent.text };
}

function InfoPanelBlock({ block = {}, theme = {} }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const tone = resolveInfoPanelToneStyles(content?.tone || block?.tone, theme);
  return (
    <section
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 16,
        background: tone.background,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
      data-report-runtime-info-panel-tone={normalizeString(content?.tone || block?.tone).toLowerCase() || "info"}
    >
      {normalizeString(content?.eyebrow || block?.eyebrow) ? (
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: tone.eyebrow }}>
          {normalizeString(content?.eyebrow || block?.eyebrow)}
        </div>
      ) : null}
      <div style={{ fontSize: 18, fontWeight: 700, color: "#182026" }}>
        {normalizeString(block?.title || content?.title || "Info Panel")}
      </div>
      {normalizeString(content?.description || block?.description) ? (
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#30404d" }}>
          {normalizeString(content?.description || block?.description)}
        </div>
      ) : null}
      {String(content?.body || block?.body || "").trim() ? (
        <RuntimeMarkdownBody markdown={String(content?.body || block?.body || "")} />
      ) : null}
    </section>
  );
}

function resolveCalloutToneStyles(tone = "", theme = {}) {
  const normalized = normalizeString(tone).toLowerCase();
  if (normalized === "warning") {
    return { border: "#f5c542", background: "#fff9e6", accent: "#8a5d00", chipBackground: "#fff0c2" };
  }
  if (normalized === "danger") {
    return { border: "#f5c2c0", background: "#fff5f4", accent: "#a82a2a", chipBackground: "#fde2df" };
  }
  if (normalized === "success") {
    return { border: "#b7e4c7", background: "#f1fbf5", accent: "#0a6640", chipBackground: "#daf5e4" };
  }
  const accent = resolveRuntimeAccentPalette(theme?.accentTone);
  return { border: accent.border, background: accent.background, accent: accent.accent, chipBackground: accent.chipBackground };
}

function CalloutBlock({ block = {}, theme = {} }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const tone = resolveCalloutToneStyles(content?.tone || block?.tone, theme);
  const badges = (Array.isArray(content?.badges) ? content.badges : Array.isArray(block?.badges) ? block.badges : [])
    .map((badge) => normalizeString(badge))
    .filter(Boolean);
  const icon = normalizeString(content?.icon || block?.icon);
  return (
    <section
      style={{
        border: `1px solid ${tone.border}`,
        borderLeft: `6px solid ${tone.accent}`,
        borderRadius: 16,
        background: tone.background,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
      data-report-runtime-callout-tone={normalizeString(content?.tone || block?.tone).toLowerCase() || "info"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {icon ? (
          <span style={{ fontSize: 18, lineHeight: 1, color: tone.accent }}>{icon}</span>
        ) : null}
        <div style={{ fontSize: 18, fontWeight: 700, color: "#182026" }}>
          {normalizeString(block?.title || content?.title || "Callout")}
        </div>
      </div>
      {normalizeString(content?.description || block?.description) ? (
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#30404d" }}>
          {normalizeString(content?.description || block?.description)}
        </div>
      ) : null}
      {badges.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {badges.map((badge, index) => (
            <span
              key={`${badge}-${index}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                padding: "4px 10px",
                background: tone.chipBackground,
                color: tone.accent,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}
      {String(content?.body || block?.body || "").trim() ? (
        <RuntimeMarkdownBody markdown={String(content?.body || block?.body || "")} />
      ) : null}
    </section>
  );
}

function KanbanBlock({ block = {} }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const columns = (Array.isArray(content?.columns) ? content.columns : [])
    .filter((column) => column && typeof column === "object" && !Array.isArray(column));
  return (
    <RuntimePanel
      className="forge-report-runtime-kanban-panel"
      title={normalizeString(block?.title || content?.title || "Pipeline")}
      subtitle={normalizeString(content?.description)}
    >
      {columns.length === 0 ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          No pipeline columns configured.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))`,
            gap: 12,
          }}
        >
          {columns.map((column, index) => (
            <div
              key={normalizeString(column?.id || `column_${index + 1}`)}
              style={{
                border: "1px solid #dbe5ec",
                borderRadius: 14,
                background: "#fbfdff",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#182026" }}>
                {normalizeString(column?.title || `Column ${index + 1}`)}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {(Array.isArray(column?.cards) ? column.cards : []).map((card, cardIndex) => (
                  <div
                    key={normalizeString(card?.id || `card_${cardIndex + 1}`)}
                    style={{
                      border: "1px solid #d7e2ee",
                      borderRadius: 12,
                      background: "#fff",
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {normalizeString(card?.badge) ? (
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#486579" }}>
                        {normalizeString(card.badge)}
                      </span>
                    ) : null}
                    {normalizeString(card?.title) ? (
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#182026" }}>{normalizeString(card.title)}</div>
                    ) : null}
                    {String(card?.body || "").trim() ? <RuntimeMarkdownBody markdown={String(card.body || "")} /> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </RuntimePanel>
  );
}

function TimelineBlock({ block = {} }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const events = (Array.isArray(content?.events) ? content.events : [])
    .filter((event) => event && typeof event === "object" && !Array.isArray(event));
  return (
    <RuntimePanel
      className="forge-report-runtime-timeline-panel"
      title={normalizeString(block?.title || content?.title || "Timeline")}
      subtitle={normalizeString(content?.description)}
    >
      {events.length === 0 ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          No timeline events configured.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {events.map((event, index) => (
            <div
              key={normalizeString(event?.id || `event_${index + 1}`)}
              style={{
                display: "grid",
                gridTemplateColumns: "96px minmax(0, 1fr)",
                gap: 12,
                alignItems: "start",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#486579", textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: 4 }}>
                {normalizeString(event?.date || event?.badge || `Event ${index + 1}`)}
              </div>
              <div
                style={{
                  border: "1px solid #dbe5ec",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {normalizeString(event?.badge) ? (
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#486579" }}>
                      {normalizeString(event.badge)}
                    </span>
                  ) : null}
                  {normalizeString(event?.title) ? (
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#182026" }}>{normalizeString(event.title)}</div>
                  ) : null}
                </div>
                {String(event?.body || "").trim() ? <RuntimeMarkdownBody markdown={String(event.body || "")} /> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </RuntimePanel>
  );
}

function buildRuntimeSections(blocks = [], hiddenBlockIds = new Set()) {
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  const explicitTabGroup = normalizedBlocks.find((block) => normalizeString(block?.kind) === "tabGroupBlock") || null;
  const explicitSectionIds = Array.isArray(explicitTabGroup?.content?.sectionIds)
    ? explicitTabGroup.content.sectionIds.map((sectionId) => normalizeString(sectionId)).filter(Boolean)
    : (Array.isArray(explicitTabGroup?.sectionIds) ? explicitTabGroup.sectionIds.map((sectionId) => normalizeString(sectionId)).filter(Boolean) : []);
  const sections = [];
  let current = null;
  normalizedBlocks.forEach((block, index) => {
    const kind = normalizeString(block?.kind);
    if (kind === "tabGroupBlock") {
      return;
    }
    if (hiddenBlockIds.has(normalizeString(block?.id))) {
      return;
    }
    if (kind === "sectionBlock") {
      current = {
        id: normalizeString(block?.id || `section_${index + 1}`) || `section_${index + 1}`,
        title: normalizeString(block?.title || block?.content?.title || `Section ${sections.length + 1}`) || `Section ${sections.length + 1}`,
        navigationLabel: normalizeString(block?.content?.navigationLabel || block?.navigationLabel || block?.title || `Section ${sections.length + 1}`) || `Section ${sections.length + 1}`,
        block,
        items: [],
      };
      sections.push(current);
      return;
    }
    if (!current) {
      current = {
        id: "overview",
        title: "Overview",
        navigationLabel: "Overview",
        block: null,
        items: [],
      };
      sections.push(current);
    }
    current.items.push(block);
  });
  const filteredSections = sections.filter((section) => section.block || section.items.length > 0);
  if (explicitSectionIds.length === 0) {
    return filteredSections;
  }
  const sectionById = new Map(filteredSections.map((section) => [normalizeString(section?.id), section]));
  const orderedSections = explicitSectionIds
    .map((sectionId) => sectionById.get(sectionId) || null)
    .filter(Boolean);
  const trailingSections = filteredSections.filter((section) => !explicitSectionIds.includes(normalizeString(section?.id)));
  return [...orderedSections, ...trailingSections];
}

function resolveRuntimeTabGroupConfig(blocks = []) {
  const tabGroupBlock = (Array.isArray(blocks) ? blocks : [])
    .find((block) => normalizeString(block?.kind) === "tabGroupBlock")
    || null;
  if (!tabGroupBlock) {
    return null;
  }
  const sectionIds = Array.isArray(tabGroupBlock?.content?.sectionIds)
    ? tabGroupBlock.content.sectionIds.map((sectionId) => normalizeString(sectionId)).filter(Boolean)
    : (Array.isArray(tabGroupBlock?.sectionIds) ? tabGroupBlock.sectionIds.map((sectionId) => normalizeString(sectionId)).filter(Boolean) : []);
  return {
    id: normalizeString(tabGroupBlock?.id || "tabGroupBlock") || "tabGroupBlock",
    title: normalizeString(tabGroupBlock?.content?.title || tabGroupBlock?.title || "Sections") || "Sections",
    sectionIds,
    defaultSectionId: normalizeString(tabGroupBlock?.content?.defaultSectionId || tabGroupBlock?.defaultSectionId),
  };
}

function resolveRuntimeCompositeConfig(blocks = []) {
  const composites = (Array.isArray(blocks) ? blocks : [])
    .filter((block) => normalizeString(block?.kind) === "compositeBlock");
  const childBlockIdSet = new Set();
  composites.forEach((block) => {
    const childBlockIds = Array.isArray(block?.content?.childBlockIds)
      ? block.content.childBlockIds
      : (Array.isArray(block?.childBlockIds) ? block.childBlockIds : []);
    childBlockIds
      .map((blockId) => normalizeString(blockId))
      .filter(Boolean)
      .forEach((blockId) => childBlockIdSet.add(blockId));
  });
  return {
    composites,
    childBlockIdSet,
  };
}

function TableBlock({ block = {}, diagnostics = [], dataset = {}, reportSpec = {}, providerActionsByField = new Map(), runtimeHandlers = null, locale = "en-US", onRetryProviderActions = null, providerActionsLoading = false }) {
  const invalidDiagnostic = (Array.isArray(diagnostics) ? diagnostics : [])
    .find((diagnostic) => normalizeString(diagnostic?.severity || "info").toLowerCase() === "error")
    || null;
  const columns = Array.isArray(block?.content?.columns)
    ? block.content.columns
    : (Array.isArray(block?.columns) ? block.columns : []);
  if (invalidDiagnostic) {
    return (
      <RuntimePanel
        className="forge-report-runtime-table-panel"
        title={normalizeString(block?.title || "Table")}
      >
        <BlockDiagnosticsCallout diagnostics={diagnostics} onRetryProviderActions={onRetryProviderActions} providerActionsLoading={providerActionsLoading} />
        <BlockErrorCallout diagnostic={invalidDiagnostic} />
      </RuntimePanel>
    );
  }
  const refinementFields = resolveReportRuntimeRefinementFields(reportSpec, block);
  const tableInteractionState = buildReportRuntimeTableInteractionState({
    blockId: block.id,
    fields: refinementFields,
    providerActionsByField,
  });
  const runtimeTableRows = buildRuntimeTableRows(block, dataset);
  const rowActions = tableInteractionState.actions
    .filter((action) => supportsReportRuntimeExecution(action, runtimeHandlers))
    .map((action) => ({
    ...action,
    onExecute: ({ item }) => {
      const execution = action.resolveExecution(item);
      executeReportRuntimeAction(execution, runtimeHandlers);
    },
  }));
  return (
    <RuntimePanel
      className="forge-report-runtime-table-panel"
      title={normalizeString(block?.title || "Table")}
    >
      <BlockDiagnosticsCallout diagnostics={diagnostics} onRetryProviderActions={onRetryProviderActions} providerActionsLoading={providerActionsLoading} />
      {columns.length === 0 ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          No table fields selected. Edit this table block in Design to choose at least one field.
        </div>
      ) : (
      <DashboardTableContent
        container={{
          id: block.id,
          kind: "dashboard.table",
          title: normalizeString(block?.title || "Table"),
          dataSourceRef: normalizeString(dataset?.dataSourceRef || block?.datasetRef),
          dashboard: {
            table: {
              columns,
              density: "compact",
              limit: Math.max(1, Number(dataset?.provenance?.rowCount || reportSpec?.parameters?.pageSize || 50) || 50),
              rowActionDisplay: "compact",
              rowActions,
            },
          },
        }}
        context={createRuntimeContext({
          ...dataset,
          rows: runtimeTableRows,
        }, locale)}
        locale={locale}
      />
      )}
    </RuntimePanel>
  );
}

function FilterBarBlock({ block = {}, scopeParams = new Map(), activeScopeSummary = null, presentationMode = "preview", runtimeHandlers = null, availableDatasetRefs = [] }) {
  const params = Array.isArray(block?.content?.params) ? block.content.params : [];
  const criteria = Array.isArray(block?.content?.criteria) ? block.content.criteria : [];
  const normalizedDatasetRef = resolveRuntimeBlockDatasetRef(block, { availableDatasetRefs }).datasetRef;
  const isPrimaryScope = normalizedDatasetRef === "primary";
  const canEditFilterParams = params.some((param) => (
    (normalizeString(param?.type).toLowerCase() === "daterange" && typeof runtimeHandlers?.setScopeParamDate === "function")
    || (Array.isArray(param?.options) && param.options.length > 0 && typeof runtimeHandlers?.toggleScopeParamOption === "function")
  ));
  return (
    <RuntimePanel
      title={canEditFilterParams
        ? normalizeString(block?.content?.title || block?.title || "Filters")
        : `${normalizeString(block?.content?.title || block?.title || "Filters")} (baseline)`}
      subtitle={canEditFilterParams
        ? (
            normalizeString(presentationMode).toLowerCase() === "report"
              ? ""
              : (isPrimaryScope
              ? "Change these baseline report filters here. Live keep, exclude, and drill changes appear in Active refinements."
              : "Change filters for this block here. These filters apply to this data block only.")
          )
        : (normalizeString(presentationMode).toLowerCase() === "report"
            ? ""
            : "Baseline filters compiled from the live builder state. Live keep, exclude, and drill changes appear in Active refinements.")}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {params.map((param) => {
          const metadata = scopeParams.get(normalizeString(param?.id)) || {};
          const label = normalizeString(metadata?.label || param?.label || param?.id);
          const description = normalizeString(metadata?.description || param?.description);
          const interactiveFilter = {
            ...metadata,
            ...param,
            id: normalizeString(param?.id),
            label,
            description,
          };
          const canEditDateRange = normalizeString(interactiveFilter?.type).toLowerCase() === "daterange"
            && typeof runtimeHandlers?.setScopeParamDate === "function";
          const canEditOptions = Array.isArray(interactiveFilter?.options)
            && interactiveFilter.options.length > 0
            && typeof runtimeHandlers?.toggleScopeParamOption === "function";
          if (canEditDateRange || canEditOptions) {
            return (
              <InlineStaticFilterControl
                key={param?.id}
                filter={interactiveFilter}
                value={param?.value}
                onToggle={(optionValue) => runtimeHandlers.toggleScopeParamOption(interactiveFilter, optionValue)}
                onDateRange={(edge, value) => runtimeHandlers.setScopeParamDate(interactiveFilter, edge, value)}
              />
            );
          }
          return (
            <span
              key={param?.id}
              style={{
                display: "inline-flex",
                alignItems: "flex-start",
                flexDirection: "column",
                gap: 4,
                border: "1px solid #d4dee8",
                background: "#f7fafc",
                borderRadius: 14,
                padding: "6px 10px",
                fontSize: 12,
                color: "#30404d",
                minWidth: 160,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <strong style={{ color: "#182026" }}>{label}</strong>
                <span>{formatReportRuntimeScopeValue({ ...metadata, value: param?.value })}</span>
              </span>
              {description ? (
                <span style={{ fontSize: 11, lineHeight: 1.4, color: "#5f6b7c" }}>{description}</span>
              ) : null}
            </span>
          );
        })}
        {params.length === 0 ? <span style={{ fontSize: 12, color: "#5f6b7c" }}>No report filters.</span> : null}
      </div>
      {criteria.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px dashed #d8e1e8", paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#738694" }}>
            Active Targeting
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {criteria.map((criterion) => (
              <div
                key={normalizeString(criterion?.id || criterion?.label)}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #d4dee8",
                  background: "#f7fafc",
                  borderRadius: 12,
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "#30404d",
                }}
              >
                <strong style={{ color: "#182026" }}>
                  {normalizeString(criterion?.label || criterion?.filterLabel || criterion?.id)}
                </strong>
                <span>
                  {Array.isArray(criterion?.displayValues) && criterion.displayValues.length > 0
                    ? criterion.displayValues.join(", ")
                    : (Array.isArray(criterion?.rawValues)
                      ? criterion.rawValues.map((value) => String(value ?? "")).filter(Boolean).join(", ")
                      : "—")}
                </span>
                {criterion?.enabled === false ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8a5d00" }}>Off</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <ActiveScopeSummary activeScopeSummary={activeScopeSummary} />
    </RuntimePanel>
  );
}

export function RefinementBarBlock({ block = {}, runtimeHandlers = null }) {
  const refinements = Array.isArray(block?.content?.refinements) ? block.content.refinements : [];
  const actionKinds = Array.isArray(block?.content?.actionKinds) ? block.content.actionKinds : [];
  const hasExplicitActionKinds = Array.isArray(block?.content?.actionKinds);
  const enabledActionKinds = new Set(actionKinds.map((actionKind) => normalizeString(actionKind)).filter(Boolean));
  const canRemoveRefinements = typeof runtimeHandlers?.removeRefinement === "function"
    && (!hasExplicitActionKinds || enabledActionKinds.has("remove"));
  const canClearRefinements = typeof runtimeHandlers?.clearRefinements === "function"
    && (!hasExplicitActionKinds || enabledActionKinds.has("clearAll"));
  const canUndoRefinements = typeof runtimeHandlers?.undoRefinements === "function"
    && (!hasExplicitActionKinds || enabledActionKinds.has("undo"));
  const canRedoRefinements = typeof runtimeHandlers?.redoRefinements === "function"
    && (!hasExplicitActionKinds || enabledActionKinds.has("redo"));
  const undoEnabled = canUndoRefinements && runtimeHandlers?.canUndoRefinements === true;
  const redoEnabled = canRedoRefinements && runtimeHandlers?.canRedoRefinements === true;
  const clearExecution = canClearRefinements && refinements.length > 0
    ? buildReportRuntimeRefinementBarClearExecution({
      blockId: block?.id,
    })
    : null;
  const undoExecution = canUndoRefinements
    ? buildReportRuntimeRefinementBarUndoExecution({
      blockId: block?.id,
    })
    : null;
  const redoExecution = canRedoRefinements
    ? buildReportRuntimeRefinementBarRedoExecution({
      blockId: block?.id,
    })
    : null;
  if (refinements.length === 0 && !undoEnabled && !redoEnabled) {
    return null;
  }
  const refinementBarTitle = normalizeString(block?.content?.title || block?.title) || "Active Refinements";
  return (
    <div className="forge-report-runtime-refinement-block" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="forge-report-runtime-refinement-block__header" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", color: "#182026" }}>
          {refinementBarTitle}
        </span>
        <span style={{ fontSize: 11, lineHeight: 1.4, color: "#5f6b7c" }}>
          This session — live keep, exclude, and drill changes layered on top of the baseline scope.
        </span>
      </div>
      <div
        className="forge-report-runtime-refinement-strip"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
        }}
      >
      {refinements.map((refinement, index) => {
        const refinementId = normalizeString(refinement?.id);
        const refinementLabel = formatRuntimeRefinementChipLabel(refinement);
        const canRemoveRefinement = canRemoveRefinements && !!refinementId;
        return (
          <span
            key={refinementId || `refinement:${index}:${refinementLabel}`}
            className="forge-report-runtime-refinement-chip"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              color: "#21538f",
              background: "#eef4fb",
              border: "1px solid #cfdced",
              borderRadius: 999,
              padding: "6px 10px",
            }}
          >
            {refinementLabel}
            {canRemoveRefinement ? (
              <button
                type="button"
                onClick={() => executeReportRuntimeAction(
                  buildReportRuntimeRefinementBarRemoveExecution({
                    blockId: block?.id,
                    refinement,
                  }),
                  runtimeHandlers,
                )}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#21538f",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: 0,
                }}
                aria-label={`Remove refinement ${refinementLabel}`}
              >
                ×
              </button>
            ) : null}
          </span>
        );
      })}
      {canClearRefinements && refinements.length > 0 ? (
        <button
          type="button"
          aria-label="Clear all refinements"
          onClick={() => executeReportRuntimeAction(clearExecution, runtimeHandlers)}
          style={{
            border: "1px solid #d8e1e8",
            background: "#ffffff",
            color: "#30404d",
            borderRadius: 999,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Clear all
        </button>
      ) : null}
      {canUndoRefinements ? (
        <button
          type="button"
          aria-label="Undo refinement changes"
          disabled={!undoEnabled}
          onClick={() => {
            if (!undoEnabled) {
              return;
            }
            executeReportRuntimeAction(undoExecution, runtimeHandlers);
          }}
          style={{
            border: "1px solid #d8e1e8",
            background: undoEnabled ? "#ffffff" : "#f4f7fa",
            color: undoEnabled ? "#30404d" : "#98a2b3",
            borderRadius: 999,
            padding: "4px 10px",
            cursor: undoEnabled ? "pointer" : "not-allowed",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Undo
        </button>
      ) : null}
      {canRedoRefinements ? (
        <button
          type="button"
          aria-label="Redo refinement changes"
          disabled={!redoEnabled}
          onClick={() => {
            if (!redoEnabled) {
              return;
            }
            executeReportRuntimeAction(redoExecution, runtimeHandlers);
          }}
          style={{
            border: "1px solid #d8e1e8",
            background: redoEnabled ? "#ffffff" : "#f4f7fa",
            color: redoEnabled ? "#30404d" : "#98a2b3",
            borderRadius: 999,
            padding: "4px 10px",
            cursor: redoEnabled ? "pointer" : "not-allowed",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Redo
        </button>
      ) : null}
      </div>
    </div>
  );
}

function shouldRenderRefinementBarBlock(block = {}, runtimeHandlers = null) {
  const refinements = Array.isArray(block?.content?.refinements) ? block.content.refinements : [];
  if (refinements.length > 0) {
    return true;
  }
  return runtimeHandlers?.canUndoRefinements === true || runtimeHandlers?.canRedoRefinements === true;
}

function GeoMapBlock({ block = {}, diagnostics = [], onRetryProviderActions = null, providerActionsLoading = false }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const geo = content?.geo && typeof content.geo === "object" && !Array.isArray(content.geo)
    ? content.geo
    : {};
  const resolvedGeo = content?.resolvedGeo && typeof content.resolvedGeo === "object" && !Array.isArray(content.resolvedGeo)
    ? content.resolvedGeo
    : {};
  const shape = normalizeString(resolvedGeo?.shape || geo?.shape || "us-states");
  const supportedShape = shape === "us-states" || shape === "us-state-tiles";
  const regions = Array.isArray(resolvedGeo?.regions) ? resolvedGeo.regions : [];
  const ranking = Array.isArray(resolvedGeo?.ranking) ? resolvedGeo.ranking : [];
  const regionsByKey = new Map(
    regions
      .map((region) => [normalizeGeoKey(region?.key), region])
      .filter(([key]) => !!key),
  );
  const tileRegions = supportedShape
    ? US_STATE_TILES.map((tile) => ({
      ...tile,
      region: regionsByKey.get(tile.key) || null,
    }))
    : [];
  const activeRegion = resolvedGeo?.activeRegion && typeof resolvedGeo.activeRegion === "object" && !Array.isArray(resolvedGeo.activeRegion)
    ? resolvedGeo.activeRegion
    : (ranking[0] || null);
  const legend = resolvedGeo?.legend && typeof resolvedGeo.legend === "object" && !Array.isArray(resolvedGeo.legend)
    ? resolvedGeo.legend
    : null;
  const palette = Array.isArray(legend?.palette) && legend.palette.length > 0
    ? legend.palette
    : DEFAULT_GEO_PALETTE;
  const hasData = ranking.length > 0;
  const invalidDiagnostic = (Array.isArray(diagnostics) ? diagnostics : [])
    .find((diagnostic) => normalizeString(diagnostic?.severity || "info").toLowerCase() === "error")
    || null;

  return (
    <RuntimePanel
      className="forge-report-runtime-geo-panel"
      title={normalizeString(block?.title || "Geo Map")}
      subtitle={normalizeString(resolvedGeo?.metricLabel || geo?.metric?.label)
        ? `${normalizeString(resolvedGeo?.metricLabel || geo?.metric?.label)} across ${shape}`
        : `Resolved geographic rollup (${shape})`}
    >
      <BlockDiagnosticsCallout diagnostics={diagnostics} onRetryProviderActions={onRetryProviderActions} providerActionsLoading={providerActionsLoading} />
      {invalidDiagnostic ? (
        <BlockErrorCallout diagnostic={invalidDiagnostic} />
      ) : !supportedShape ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          Unsupported geo shape: {shape || "unknown"}.
        </div>
      ) : !hasData ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          No geo data.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(220px, 320px)", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "#30404d" }}>
              <span><strong>{Number(resolvedGeo?.summary?.regionCount || 0)}</strong> Regions</span>
              <span><strong>{normalizeString(resolvedGeo?.summary?.totalValue || "-")}</strong> Total</span>
              <span><strong>{normalizeString(resolvedGeo?.summary?.topKey || "-")}</strong> Top Region</span>
            </div>
            <div
              role="list"
              aria-label={normalizeString(block?.title || "Geo map")}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, minmax(34px, 1fr))",
                gridTemplateRows: "repeat(8, minmax(34px, 1fr))",
                gap: 8,
              }}
            >
              {tileRegions.map((entry) => {
                const region = entry.region;
                const label = normalizeString(region?.label || entry.label || entry.key);
                const displayValue = normalizeString(region?.displayValue || "-");
                return (
                  <div
                    key={entry.key}
                    role="listitem"
                    title={`${label} (${entry.key}): ${displayValue}`}
                    style={{
                      gridColumn: entry.col,
                      gridRow: entry.row,
                      borderRadius: 10,
                      border: region ? "1px solid rgba(24,32,38,0.14)" : "1px dashed rgba(95,107,124,0.22)",
                      background: region?.color || "#eef3f8",
                      color: region ? "#102a43" : "#5f6b7c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {entry.key}
                  </div>
                );
              })}
            </div>
            {legend ? (
              Array.isArray(legend?.rules) && legend.rules.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#30404d" }}>
                  {legend.rules.map((rule) => (
                    <span
                      key={`${rule?.label || rule?.color}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <i style={{ width: 10, height: 10, borderRadius: 999, background: rule?.color || "#d8e1e8", display: "inline-block" }} />
                      {normalizeString(rule?.label || rule?.color)}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#30404d" }}>
                  <span>{normalizeString(legend?.min || "-")}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {palette.map((color) => (
                      <i key={color} style={{ width: 16, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
                    ))}
                  </div>
                  <span>{normalizeString(legend?.max || "-")}</span>
                </div>
              )
            ) : null}
          </div>
          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                border: "1px solid #d8e1e8",
                borderRadius: 12,
                padding: "12px 14px",
                background: "#fbfdff",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5f6b7c" }}>
                Selected Area
              </span>
              <strong style={{ fontSize: 15, color: "#182026" }}>
                {activeRegion ? `${normalizeString(activeRegion.label || activeRegion.key)} (${normalizeString(activeRegion.key)})` : "-"}
              </strong>
              <span style={{ fontSize: 12, color: "#30404d" }}>
                {normalizeString(resolvedGeo?.metricLabel || geo?.metric?.label || "Metric")}: {normalizeString(activeRegion?.displayValue || "-")}
              </span>
              {normalizeString(activeRegion?.statusLabel) ? (
                <span style={{ fontSize: 11, color: activeRegion?.statusColor || "#30404d" }}>
                  {normalizeString(activeRegion.statusLabel)}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5f6b7c" }}>
                Top Regions
              </div>
              {ranking.slice(0, 5).map((region) => (
                <div
                  key={normalizeString(region?.key)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                    fontSize: 12,
                    color: "#30404d",
                  }}
                >
                  <strong style={{ color: "#182026" }}>{normalizeString(region?.key)}</strong>
                  <div style={{ height: 8, borderRadius: 999, background: "#eef3f8", overflow: "hidden" }}>
                    <i
                      style={{
                        width: `${Math.max(4, Math.min(100, Number(activeRegion?.rawValue || 0) > 0 ? (Number(region?.rawValue || 0) / Number(activeRegion?.rawValue || 1)) * 100 : 4))}%`,
                        height: "100%",
                        display: "block",
                        background: region?.color || "#9fb3c8",
                      }}
                    />
                  </div>
                  <span>{normalizeString(region?.displayValue || "-")}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </RuntimePanel>
  );
}

function UnsupportedBlock({ block = {} }) {
  return (
    <RuntimePanel
      title={normalizeString(block?.title || block?.id || "Unsupported Block")}
      subtitle={`Unsupported report block kind '${normalizeString(block?.kind)}'.`}
    />
  );
}

export default function ReportRuntime({
  reportSpec = {},
  reportDocument = null,
  reportFill = {},
  title = "",
  subtitle = "",
  locale = "en-US",
  runtimeHandlers = null,
  hostIntent = null,
  presentationMode = "preview",
  showContextSummary = true,
  suppressFilterBarBlocks = false,
  suppressFilterBarBlockDatasetRefs = [],
}) {
  const reportPresentation = normalizeString(presentationMode).toLowerCase() === "report";
  const [runtimeViewportWidth, setRuntimeViewportWidth] = useState(() => (
    typeof window !== "undefined" ? Number(window.innerWidth || 0) || 0 : 0
  ));
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleResize = () => {
      setRuntimeViewportWidth(Number(window.innerWidth || 0) || 0);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  const runtimeGridColumns = resolveRuntimeLayoutGridColumns(runtimeViewportWidth);
  const suppressedFilterBarDatasetRefs = useMemo(
    () => new Set(
      (Array.isArray(suppressFilterBarBlockDatasetRefs) ? suppressFilterBarBlockDatasetRefs : [])
        .map((entry) => normalizeString(entry))
        .filter(Boolean),
    ),
    [suppressFilterBarBlockDatasetRefs],
  );
  const datasetIndex = useMemo(() => new Map(
    (Array.isArray(reportFill?.datasets) ? reportFill.datasets : [])
      .map((dataset) => [normalizeString(dataset?.id), dataset])
      .filter(([id]) => !!id),
  ), [reportFill]);
  const availableDatasetRefs = useMemo(
    () => Array.from(datasetIndex.keys()),
    [datasetIndex],
  );
  const scopeSummary = useMemo(
    () => resolveReportRuntimeScopeSummary({
      reportSpec,
      reportDocument,
      title,
    }),
    [reportSpec, reportDocument, title],
  );
  const scopeParamIndex = useMemo(() => new Map(
    (Array.isArray(scopeSummary?.params) ? scopeSummary.params : [])
      .map((param) => [normalizeString(param?.id), param])
      .filter(([id]) => !!id),
  ), [scopeSummary]);
  const activeScopeSummary = useMemo(
    () => resolveReportRuntimeActiveScopeSummary(reportFill?.refinements),
    [reportFill?.refinements],
  );
  const bindingSummary = useMemo(
    () => resolveReportRuntimeBindingSummary({
      reportSpec,
      reportDocument,
      title,
    }),
    [reportSpec, reportDocument, title],
  );
  const allRuntimeBlocks = useMemo(
    () => resolveReportRuntimeBlocks(reportSpec, reportFill),
    [reportSpec, reportFill],
  );
  const hasTopLevelFilterBarBlock = useMemo(
    () => allRuntimeBlocks.some((block) => normalizeString(block?.kind) === "filterBarBlock"),
    [allRuntimeBlocks],
  );
  const topFilterBarBlocks = useMemo(
    () => reportPresentation
      ? allRuntimeBlocks.filter((block) => {
          if (normalizeString(block?.kind) !== "filterBarBlock") {
            return false;
          }
          const normalizedDatasetRef = resolveRuntimeBlockDatasetRef(block, { availableDatasetRefs }).datasetRef;
          return !suppressedFilterBarDatasetRefs.has(normalizedDatasetRef);
        })
      : [],
    [allRuntimeBlocks, availableDatasetRefs, reportPresentation, suppressedFilterBarDatasetRefs],
  );
  const hasTopLevelRefinementBarBlock = useMemo(
    () => allRuntimeBlocks.some((block) => normalizeString(block?.kind) === "refinementBarBlock"),
    [allRuntimeBlocks],
  );
  const [selectedChartSelectionsByBlock, setSelectedChartSelectionsByBlock] = useState({});
  const [activeSectionId, setActiveSectionId] = useState("");
  const [providerActionState, setProviderActionState] = useState(() => buildIdleReportRuntimeProviderActionsState());
  const [providerReloadSequence, setProviderReloadSequence] = useState(0);
  const drillMetadataProvider = useMemo(
    () => resolveReportRuntimeDrillMetadataProvider({ reportSpec, runtimeHandlers }),
    [reportSpec, runtimeHandlers],
  );
  const retryProviderActions = () => {
    setProviderReloadSequence((current) => current + 1);
  };

  useEffect(() => {
    setSelectedChartSelectionsByBlock({});
  }, [reportFill?.specHash]);

  useEffect(() => {
    let cancelled = false;
    async function loadProviderActions() {
      setProviderActionState((current) => buildPendingReportRuntimeProviderActionsState(current));
      const {
        providerActionsByField: nextMap,
        providerDiagnostics: nextDiagnostics,
      } = await loadReportRuntimeProviderActions({
        provider: drillMetadataProvider,
        reportSpec,
        blocks: allRuntimeBlocks,
      });
      if (cancelled) {
        return;
      }
      setProviderActionState(buildResolvedReportRuntimeProviderActionsState({
        providerActionsByField: nextMap,
        providerDiagnostics: nextDiagnostics,
      }));
    }
    loadProviderActions();
    return () => {
      cancelled = true;
    };
  }, [drillMetadataProvider, allRuntimeBlocks, reportSpec, providerReloadSequence]);

  const providerActionsByField = providerActionState.providerActionsByField;
  const providerDiagnostics = providerActionState.providerDiagnostics;
  const providerActionsLoading = providerActionState.loading === true;

  const runtimeDiagnostics = useMemo(() => ([
    ...(Array.isArray(reportFill?.diagnostics) ? reportFill.diagnostics : []),
    ...providerDiagnostics,
  ]), [providerDiagnostics, reportFill?.diagnostics]);
  const blockDiagnosticsIndex = useMemo(
    () => buildBlockDiagnosticsIndex(runtimeDiagnostics),
    [runtimeDiagnostics],
  );

  const setSelectedChartSelection = (blockId, selection) => {
    const normalizedBlockId = normalizeString(blockId);
    if (!normalizedBlockId) {
      return;
    }
    setSelectedChartSelectionsByBlock((previous) => setReportRuntimeChartSelection(previous, normalizedBlockId, selection));
  };

  const clearSelectedChartSelection = (blockId = "") => {
    const normalizedBlockId = normalizeString(blockId);
    if (!normalizedBlockId) {
      return;
    }
    setSelectedChartSelectionsByBlock((previous) => clearReportRuntimeChartSelection(previous, normalizedBlockId));
  };

  const renderFilterBarBlock = (block) => (
    <FilterBarBlock
      key={block.id}
      block={block}
      scopeParams={scopeParamIndex}
      activeScopeSummary={hasTopLevelRefinementBarBlock ? null : activeScopeSummary}
      presentationMode={presentationMode}
      runtimeHandlers={runtimeHandlers}
      availableDatasetRefs={availableDatasetRefs}
    />
  );

  const runtimeCompositeConfig = useMemo(
    () => resolveRuntimeCompositeConfig(allRuntimeBlocks),
    [allRuntimeBlocks],
  );
  const runtimeTheme = useMemo(
    () => resolveRuntimeTheme(reportSpec, reportDocument),
    [reportDocument, reportSpec],
  );
  const runtimeBlockIndex = useMemo(
    () => new Map(
      (Array.isArray(allRuntimeBlocks) ? allRuntimeBlocks : [])
        .map((block) => [normalizeString(block?.id), block])
        .filter(([id]) => !!id),
    ),
    [allRuntimeBlocks],
  );

  const renderBlock = (block) => {
    const kind = normalizeString(block?.kind);
    if (kind === "tabGroupBlock") {
      return null;
    }
    if (kind === "sectionBlock") {
      return <SectionHeaderBlock key={block.id} block={block} />;
    }
    if (kind === "stepperBlock") {
      return <StepperBlock key={block.id} block={block} />;
    }
    if (kind === "infoPanelBlock") {
      return <InfoPanelBlock key={block.id} block={block} theme={runtimeTheme} />;
    }
    if (kind === "calloutBlock") {
      return <CalloutBlock key={block.id} block={block} theme={runtimeTheme} />;
    }
    if (kind === "kanbanBlock") {
      return <KanbanBlock key={block.id} block={block} />;
    }
    if (kind === "timelineBlock") {
      return <TimelineBlock key={block.id} block={block} />;
    }
    if (kind === "markdownBlock") {
      return <MarkdownBlock key={block.id} block={block} />;
    }
    if (kind === "badgesBlock") {
      return <BadgesBlock key={block.id} block={block} locale={locale} theme={runtimeTheme} />;
    }
    if (kind === "kpiBlock") {
      const dataset = datasetIndex.get(resolveRuntimeBlockDatasetRef(block, { availableDatasetRefs }).datasetRef) || null;
      return <KpiBlock key={block.id} block={block} diagnostics={resolveDatasetBackedBlockDiagnostics(block, blockDiagnosticsIndex.get(normalizeString(block?.id)) || [], dataset)} locale={locale} onRetryProviderActions={retryProviderActions} providerActionsLoading={providerActionsLoading} theme={runtimeTheme} />;
    }
    if (kind === "collectionBlock") {
      const dataset = datasetIndex.get(resolveRuntimeBlockDatasetRef(block, { availableDatasetRefs }).datasetRef) || null;
      return <CollectionBlock key={block.id} block={block} diagnostics={resolveDatasetBackedBlockDiagnostics(block, blockDiagnosticsIndex.get(normalizeString(block?.id)) || [], dataset)} locale={locale} onRetryProviderActions={retryProviderActions} providerActionsLoading={providerActionsLoading} />;
    }
    if (kind === "filterBarBlock") {
      const normalizedDatasetRef = resolveRuntimeBlockDatasetRef(block, { availableDatasetRefs }).datasetRef;
      if (suppressFilterBarBlocks || suppressedFilterBarDatasetRefs.has(normalizedDatasetRef) || (reportPresentation && topFilterBarBlocks.length > 0)) {
        return null;
      }
      return renderFilterBarBlock(block);
    }
    if (kind === "refinementBarBlock") {
      if (!shouldRenderRefinementBarBlock(block, runtimeHandlers)) {
        return null;
      }
      return <RefinementBarBlock key={block.id} block={block} runtimeHandlers={runtimeHandlers} />;
    }
    if (kind === "tableBlock") {
      const resolvedDatasetRef = resolveRuntimeBlockDatasetRef(block, { availableDatasetRefs }).datasetRef;
      const dataset = datasetIndex.get(resolvedDatasetRef) || { id: resolvedDatasetRef || block?.datasetRef, rows: [] };
      return (
        <TableBlock
          key={block.id}
          block={block}
          diagnostics={resolveDatasetBackedBlockDiagnostics(block, blockDiagnosticsIndex.get(normalizeString(block?.id)) || [], dataset)}
          dataset={dataset}
          reportSpec={reportSpec}
          providerActionsByField={providerActionsByField}
          runtimeHandlers={runtimeHandlers}
          locale={locale}
          onRetryProviderActions={retryProviderActions}
          providerActionsLoading={providerActionsLoading}
        />
      );
    }
    if (kind === "chartBlock") {
      const resolvedDatasetRef = resolveRuntimeBlockDatasetRef(block, { availableDatasetRefs }).datasetRef;
      const dataset = datasetIndex.get(resolvedDatasetRef) || { id: resolvedDatasetRef || block?.datasetRef, rows: [] };
      const diagnostics = resolveDatasetBackedBlockDiagnostics(block, blockDiagnosticsIndex.get(normalizeString(block?.id)) || [], dataset);
      const invalidDiagnostic = diagnostics
        .find((diagnostic) => normalizeString(diagnostic?.severity || "info").toLowerCase() === "error")
        || null;
      if (invalidDiagnostic) {
        return (
          <RuntimePanel
            className="forge-report-runtime-chart-panel"
            key={block.id}
            title={normalizeString(block?.title || block?.content?.chartSpec?.title || block?.chartSpec?.title || "Chart")}
          >
            <BlockDiagnosticsCallout diagnostics={diagnostics} onRetryProviderActions={retryProviderActions} providerActionsLoading={providerActionsLoading} />
            <BlockErrorCallout diagnostic={invalidDiagnostic} />
          </RuntimePanel>
        );
      }
      const chartFields = resolveReportRuntimeChartActionFields(reportSpec, block);
      const selectedDatum = selectedChartSelectionsByBlock[normalizeString(block?.id)] || null;
      const chartSpec = block?.content?.chartSpec || block?.chartSpec || {};
      const chartModel = block?.content?.chartModel || block?.chartModel || null;
      const chartInteractionSupport = resolveReportRuntimeChartInteractionSupport(chartSpec);
      const chartInteractionState = buildReportRuntimeChartInteractionState({
        blockId: block?.id,
        blockTitle: block?.title,
        fields: chartFields,
        selection: selectedDatum,
        providerActionsByField,
        interactionSupport: chartInteractionSupport,
        canClearSelection: chartInteractionSupport.enabled,
      });
      const supportedChartExecutions = chartInteractionState.executions
        .filter((execution) => supportsReportRuntimeExecution(execution, runtimeHandlers));
      const effectiveChartInteractionSupport = chartInteractionSupport.enabled && supportedChartExecutions.length === 0
        ? {
          enabled: false,
          reason: "readOnlyRuntime",
          message: "Chart actions are unavailable because this runtime preview is read-only.",
          legendEnabled: false,
        }
        : chartInteractionSupport;
      const chartInteractionEnabled = effectiveChartInteractionSupport.enabled;
      const supportedChartActions = supportedChartExecutions.map((execution) => ({
        id: execution.id,
        label: execution.label,
        kind: execution.kind,
      }));
      const chartSelectionViewModel = buildReportRuntimeChartSelectionViewModel({
        blockTitle: block?.title,
        selection: selectedDatum,
        actions: supportedChartActions,
        interactionSupport: effectiveChartInteractionSupport,
        canClearSelection: chartInteractionEnabled,
      });
      const chartExecutionsById = new Map(
        supportedChartExecutions.map((execution) => [normalizeString(execution?.id), execution]),
      );
      return (
        <RuntimePanel
          className="forge-report-runtime-chart-panel"
          key={block.id}
          title={normalizeString(block?.title || block?.content?.chartSpec?.title || block?.chartSpec?.title || "Chart")}
        >
          <BlockDiagnosticsCallout diagnostics={diagnostics} onRetryProviderActions={retryProviderActions} providerActionsLoading={providerActionsLoading} />
          {chartModel ? (
            <Chart
              container={{
                id: block.id,
                kind: "dashboard.chart",
                title: normalizeString(block?.title || block?.content?.chartSpec?.title || block?.chartSpec?.title || "Chart"),
                dataSourceRef: normalizeString(dataset?.dataSourceRef || block?.datasetRef),
                chart: chartModel,
              }}
              context={createRuntimeContext(dataset, locale)}
              isActive
              embedded={false}
              showControls={!reportPresentation}
              onDatumSelect={!reportPresentation && chartInteractionEnabled ? ((selection) => setSelectedChartSelection(block.id, selection)) : null}
              onLegendItemSelect={!reportPresentation && chartInteractionSupport.legendEnabled ? ((selection) => setSelectedChartSelection(block.id, selection)) : null}
            />
          ) : (
            <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
              Chart actions are unavailable because this authored chart does not compile to a runtime chart model.
            </div>
          )}
          {!reportPresentation ? (
            <ChartSelectionPanel
              viewModel={chartSelectionViewModel}
              onAction={(actionId) => executeReportRuntimeAction(chartExecutionsById.get(normalizeString(actionId)), runtimeHandlers)}
              onClearSelection={chartInteractionEnabled ? (() => clearSelectedChartSelection(block.id)) : null}
            />
          ) : null}
        </RuntimePanel>
      );
    }
    if (kind === "geoMapBlock") {
      const dataset = datasetIndex.get(resolveRuntimeBlockDatasetRef(block, { availableDatasetRefs }).datasetRef) || null;
      return <GeoMapBlock key={block.id} block={block} diagnostics={resolveDatasetBackedBlockDiagnostics(block, blockDiagnosticsIndex.get(normalizeString(block?.id)) || [], dataset)} onRetryProviderActions={retryProviderActions} providerActionsLoading={providerActionsLoading} />;
    }
    if (kind === "compositeBlock") {
      const childBlockIds = Array.isArray(block?.content?.childBlockIds)
        ? block.content.childBlockIds
        : (Array.isArray(block?.childBlockIds) ? block.childBlockIds : []);
      const childBlocks = childBlockIds
        .map((blockId) => runtimeBlockIndex.get(normalizeString(blockId)) || null)
        .filter(Boolean);
      return (
        <RuntimePanel
          key={block.id}
          title={normalizeString(block?.title || block?.content?.title || "Grouped Panel")}
          subtitle={normalizeString(block?.content?.description || block?.description)}
        >
          {childBlocks.length > 0 ? (
            renderLayoutBlockGrid(childBlocks, `runtime:${normalizeString(block?.id || "composite")}`)
          ) : (
            <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
              Add one or more child blocks to this grouped panel.
            </div>
          )}
        </RuntimePanel>
      );
    }
    return <UnsupportedBlock key={block?.id || kind} block={block} />;
  };

  const runtimeSections = useMemo(
    () => buildRuntimeSections(allRuntimeBlocks, runtimeCompositeConfig.childBlockIdSet),
    [allRuntimeBlocks, runtimeCompositeConfig],
  );
  const runtimeTabGroup = useMemo(
    () => resolveRuntimeTabGroupConfig(allRuntimeBlocks),
    [allRuntimeBlocks],
  );
  const visibleRuntimeBlocks = useMemo(
    () => (
      Array.isArray(allRuntimeBlocks)
        ? allRuntimeBlocks.filter((block) => {
          const blockId = normalizeString(block?.id);
          const kind = normalizeString(block?.kind);
          if (kind === "tabGroupBlock") {
            return false;
          }
          return !runtimeCompositeConfig.childBlockIdSet.has(blockId);
        })
        : []
    ),
    [allRuntimeBlocks, runtimeCompositeConfig],
  );
  const resolvedActiveSectionId = normalizeString(activeSectionId || runtimeTabGroup?.defaultSectionId || runtimeSections[0]?.id);

  useEffect(() => {
    if (!Array.isArray(runtimeSections) || runtimeSections.length === 0) {
      setActiveSectionId("");
      return;
    }
    if (runtimeSections.some((section) => normalizeString(section?.id) === resolvedActiveSectionId)) {
      return;
    }
    setActiveSectionId(normalizeString(runtimeSections[0]?.id));
  }, [runtimeSections, resolvedActiveSectionId]);

  const renderLayoutBlockGrid = (blocks = [], keyPrefix = "runtime") => {
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return null;
    }
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: runtimeGridColumns <= 1
            ? "minmax(0, 1fr)"
            : `repeat(${REPORT_LAYOUT_GRID_COLUMNS}, minmax(0, 1fr))`,
          gap: 16,
        }}
        data-report-runtime-layout-columns={runtimeGridColumns}
      >
        {blocks.map((block) => (
          <div
            key={`${keyPrefix}:${block?.id || "block"}`}
            data-report-runtime-block-id={normalizeString(block?.id)}
            data-report-runtime-layout-span={resolveRuntimeLayoutSpanForBlock(block)}
            style={{
              minWidth: 0,
              gridColumn: resolveResponsiveRuntimeLayoutGridColumn(block, runtimeGridColumns),
            }}
          >
            {renderBlock(block)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {showContextSummary ? (
        <RuntimePanel
          title={normalizeString(title || reportDocument?.title || reportSpec?.title || (reportPresentation ? "Report" : "Report Runtime Preview"))}
          subtitle={normalizeString(subtitle)}
        >
          {!reportPresentation ? <BindingChips bindingSummary={bindingSummary} /> : null}
          <BindingDetailsPanel bindingSummary={bindingSummary} presentationMode={presentationMode} />
          {!hasTopLevelFilterBarBlock ? (
            <ScopeDetailsPanel
              scopeSummary={scopeSummary}
              activeScopeSummary={hasTopLevelRefinementBarBlock ? null : activeScopeSummary}
              presentationMode={presentationMode}
            />
          ) : null}
        </RuntimePanel>
      ) : null}
      {!showContextSummary && !reportPresentation ? <CompactBindingChips bindingSummary={bindingSummary} /> : null}
      {topFilterBarBlocks.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: topFilterBarBlocks.length > 1 ? "repeat(auto-fit, minmax(320px, 1fr))" : "minmax(0, 1fr)",
            gap: 16,
          }}
        >
          {topFilterBarBlocks.map((block) => renderFilterBarBlock(block))}
        </div>
      ) : null}
      <HostIntentPanel hostIntent={hostIntent} runtimeHandlers={runtimeHandlers} />
      <DiagnosticsPanel diagnostics={[
        ...runtimeDiagnostics,
      ]} onRetryProviderActions={retryProviderActions} providerActionsLoading={providerActionsLoading} />
      {runtimeSections.length > 1 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {runtimeTabGroup?.title ? (
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#486579" }}>
              {runtimeTabGroup.title}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              padding: 4,
              borderRadius: 12,
              background: "#f5f8fb",
              border: "1px solid #dbe5ec",
            }}
          >
            {runtimeSections.map((section) => {
              const selected = normalizeString(section?.id) === resolvedActiveSectionId;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  style={{
                    border: selected ? "1px solid #93c5fd" : "1px solid transparent",
                    background: selected ? "#ffffff" : "transparent",
                    color: selected ? "#1d4ed8" : "#486579",
                    borderRadius: 10,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {section.navigationLabel}
                </button>
              );
            })}
          </div>
          {runtimeSections.map((section) => {
            if (normalizeString(section?.id) !== resolvedActiveSectionId) {
              return null;
            }
            return (
              <div key={section.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {section.block ? renderBlock(section.block) : null}
                {renderLayoutBlockGrid(section.items, `runtime:${section.id}`)}
              </div>
            );
          })}
        </div>
      ) : (
        renderLayoutBlockGrid(visibleRuntimeBlocks, "runtime")
      )}
    </div>
  );
}
