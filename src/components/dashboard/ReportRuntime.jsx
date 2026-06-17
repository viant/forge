import React, { useEffect, useMemo, useState } from "react";

import Chart from "../Chart.jsx";
import DashboardTableContent from "./DashboardTableContent.jsx";
import {
  formatReportRuntimeRefinement,
  formatReportRuntimeScopeValue,
  resolveReportRuntimeChartActionFields,
  resolveReportRuntimeBindingSummary,
  resolveReportRuntimeRefinementFields,
  resolveReportRuntimePrimaryBlocks,
} from "./reportRuntimeModel.js";
import { resolveReportRuntimeChartInteractionSupport } from "./reportRuntimeChartInteractions.js";
import {
  buildReportRuntimeDiagnosticsViewModel,
  buildReportRuntimeHostIntentViewModel,
} from "./reportRuntimeOverlayViewModel.js";
import { buildReportRuntimeChartInteractionState } from "./reportRuntimeChartInteractionState.js";
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

function normalizeString(value = "") {
  return String(value || "").trim();
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

function resolveRuntimeLayoutSize(block = {}) {
  return normalizeString(block?.layoutItem?.size).toLowerCase() === "half" ? "half" : "full";
}

function resolveRuntimeLayoutGridColumn(block = {}) {
  return resolveRuntimeLayoutSize(block) === "half" ? "span 1" : "1 / -1";
}

function formatKpiValue(value) {
  if (value == null) {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatKpiValue(entry)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  const normalized = normalizeString(value);
  return normalized || String(value);
}

function resolveRuntimeFieldActionKey(blockId = "", valueKey = "") {
  return `${normalizeString(blockId)}:${normalizeString(valueKey)}`;
}

function ChartSelectionPanel({
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
  if (!bindingSummary) {
    return null;
  }
  const summarizeSelectedLabels = (title, fields = []) => {
    const labels = (Array.isArray(fields) ? fields : [])
      .map((field) => normalizeString(field?.label))
      .filter(Boolean);
    if (labels.length === 0) {
      return title === "Dimensions"
        ? `${bindingSummary.dimensionCount} dimensions`
        : `${bindingSummary.measureCount} measures`;
    }
    if (labels.length <= 2) {
      return `${title} ${labels.join(", ")}`;
    }
    return `${title} ${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  };
  const chips = [
    normalizeString(bindingSummary.modelLabel || bindingSummary.modelRef)
      ? `Model ${normalizeString(bindingSummary.modelLabel || bindingSummary.modelRef)}`
      : "",
    normalizeString(bindingSummary.entityLabel || bindingSummary.entity)
      ? `Entity ${normalizeString(bindingSummary.entityLabel || bindingSummary.entity)}`
      : "",
    summarizeSelectedLabels("Dimensions", bindingSummary.selectedDimensions),
    summarizeSelectedLabels("Measures", bindingSummary.selectedMeasures),
    Number(bindingSummary.governanceCounts?.deprecated || 0) > 0
      ? `${Number(bindingSummary.governanceCounts.deprecated)} deprecated`
      : "",
    Number(bindingSummary.governanceCounts?.draft || 0) > 0
      ? `${Number(bindingSummary.governanceCounts.draft)} draft`
      : "",
  ].filter(Boolean);
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

function DiagnosticsPanel({ diagnostics = [] }) {
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

function MarkdownBlock({ block = {} }) {
  const markdown = String(block?.content?.markdown || block?.markdown || "");
  const lines = markdown.split(/\n+/).filter((line) => line.length > 0);
  return (
    <RuntimePanel title={normalizeString(block?.title || block?.content?.title)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.map((line, index) => {
          if (line.startsWith("## ")) {
            return <h4 key={index} style={{ margin: 0, fontSize: 16, color: "#182026" }}>{line.slice(3)}</h4>;
          }
          if (line.startsWith("# ")) {
            return <h3 key={index} style={{ margin: 0, fontSize: 18, color: "#182026" }}>{line.slice(2)}</h3>;
          }
          return <p key={index} style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#30404d" }}>{line}</p>;
        })}
      </div>
    </RuntimePanel>
  );
}

function KpiBlock({ block = {}, diagnostics = [] }) {
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const rowCount = Math.max(0, Number(content?.rowCount || 0) || 0);
  const hasPrimaryValue = content?.value !== undefined && content?.value !== null;
  const hasSecondaryValue = !!content?.secondaryField
    && content?.secondaryValue !== undefined
    && content?.secondaryValue !== null;
  const invalidDiagnostic = (Array.isArray(diagnostics) ? diagnostics : [])
    .find((diagnostic) => normalizeString(diagnostic?.severity || "info").toLowerCase() === "error")
    || null;
  return (
    <RuntimePanel
      className="forge-report-runtime-kpi-panel"
      title={normalizeString(block?.title || content?.title || "KPI")}
      subtitle={normalizeString(content?.description)}
    >
      {invalidDiagnostic ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#a82a2a", lineHeight: 1.5 }}>
            {invalidDiagnostic.message}
          </div>
          {invalidDiagnostic.suggestedFix ? (
            <div style={{ fontSize: 11, color: "#8a5d00", lineHeight: 1.5 }}>
              {invalidDiagnostic.suggestedFix}
            </div>
          ) : null}
        </div>
      ) : rowCount === 0 || !hasPrimaryValue ? (
        <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
          {normalizeString(content?.emptyLabel || "No KPI value available.")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5f6b7c" }}>
              {normalizeString(content?.valueLabel || content?.valueField || "Value")}
            </span>
            <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: "#182026" }}>
              {formatKpiValue(content?.value)}
            </span>
          </div>
          {hasSecondaryValue ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#30404d" }}>
              <strong style={{ color: "#182026" }}>
                {normalizeString(content?.secondaryLabel || content?.secondaryField)}
              </strong>
              <span>{formatKpiValue(content?.secondaryValue)}</span>
            </div>
          ) : null}
        </div>
      )}
    </RuntimePanel>
  );
}

function TableBlock({ block = {}, diagnostics = [], dataset = {}, reportSpec = {}, providerActionsByField = new Map(), runtimeHandlers = null, locale = "en-US" }) {
  const invalidDiagnostic = (Array.isArray(diagnostics) ? diagnostics : [])
    .find((diagnostic) => normalizeString(diagnostic?.severity || "info").toLowerCase() === "error")
    || null;
  if (invalidDiagnostic) {
    return (
      <RuntimePanel
        className="forge-report-runtime-table-panel"
        title={normalizeString(block?.title || "Table")}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#a82a2a", lineHeight: 1.5 }}>
            {invalidDiagnostic.message}
          </div>
          {invalidDiagnostic.suggestedFix ? (
            <div style={{ fontSize: 11, color: "#8a5d00", lineHeight: 1.5 }}>
              {invalidDiagnostic.suggestedFix}
            </div>
          ) : null}
        </div>
      </RuntimePanel>
    );
  }
  const refinementFields = resolveReportRuntimeRefinementFields(reportSpec, block);
  const tableInteractionState = buildReportRuntimeTableInteractionState({
    blockId: block.id,
    fields: refinementFields,
    providerActionsByField,
  });
  const rowActions = tableInteractionState.actions.map((action) => ({
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
      <DashboardTableContent
        container={{
          id: block.id,
          kind: "dashboard.table",
          title: normalizeString(block?.title || "Table"),
          dataSourceRef: normalizeString(dataset?.dataSourceRef || block?.datasetRef),
          dashboard: {
            table: {
              columns: Array.isArray(block?.content?.columns) ? block.content.columns : (block?.columns || []),
              density: "compact",
              limit: Math.max(1, Number(dataset?.provenance?.rowCount || reportSpec?.parameters?.pageSize || 50) || 50),
              rowActions,
            },
          },
        }}
        context={createRuntimeContext(dataset, locale)}
        locale={locale}
      />
    </RuntimePanel>
  );
}

function FilterBarBlock({ block = {}, scopeParams = new Map() }) {
  const params = Array.isArray(block?.content?.params) ? block.content.params : [];
  return (
    <RuntimePanel
      title={normalizeString(block?.content?.title || block?.title || "Report Scope")}
      subtitle="Shared scope parameters compiled from the live builder state."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {params.map((param) => {
          const metadata = scopeParams.get(normalizeString(param?.id)) || {};
          const label = normalizeString(metadata?.label || param?.id);
          return (
            <span
              key={param?.id}
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
              <strong style={{ color: "#182026" }}>{label}</strong>
              <span>{formatReportRuntimeScopeValue({ ...metadata, value: param?.value })}</span>
            </span>
          );
        })}
        {params.length === 0 ? <span style={{ fontSize: 12, color: "#5f6b7c" }}>No shared scope parameters.</span> : null}
      </div>
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
  return (
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
        const refinementLabel = formatReportRuntimeRefinement(refinement);
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
  );
}

function shouldRenderRefinementBarBlock(block = {}, runtimeHandlers = null) {
  const refinements = Array.isArray(block?.content?.refinements) ? block.content.refinements : [];
  if (refinements.length > 0) {
    return true;
  }
  return runtimeHandlers?.canUndoRefinements === true || runtimeHandlers?.canRedoRefinements === true;
}

function GeoMapBlock({ block = {} }) {
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

  return (
    <RuntimePanel
      className="forge-report-runtime-geo-panel"
      title={normalizeString(block?.title || "Geo Map")}
      subtitle={normalizeString(resolvedGeo?.metricLabel || geo?.metric?.label)
        ? `${normalizeString(resolvedGeo?.metricLabel || geo?.metric?.label)} across ${shape}`
        : `Resolved geographic rollup (${shape})`}
    >
      {!supportedShape ? (
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
  reportFill = {},
  title = "",
  subtitle = "",
  locale = "en-US",
  runtimeHandlers = null,
  hostIntent = null,
}) {
  const datasetIndex = useMemo(() => new Map(
    (Array.isArray(reportFill?.datasets) ? reportFill.datasets : [])
      .map((dataset) => [normalizeString(dataset?.id), dataset])
      .filter(([id]) => !!id),
  ), [reportFill]);
  const scopeParamIndex = useMemo(() => new Map(
    (Array.isArray(reportSpec?.scope?.params) ? reportSpec.scope.params : [])
      .map((param) => [normalizeString(param?.id), param])
      .filter(([id]) => !!id),
  ), [reportSpec]);
  const bindingSummary = useMemo(() => resolveReportRuntimeBindingSummary(reportSpec), [reportSpec]);
  const { primary, beforePrimary, afterPrimary } = useMemo(
    () => resolveReportRuntimePrimaryBlocks(reportSpec, reportFill),
    [reportSpec, reportFill],
  );
  const allRuntimeBlocks = useMemo(
    () => [...beforePrimary, ...primary, ...afterPrimary],
    [beforePrimary, primary, afterPrimary],
  );
  const [selectedChartSelectionsByBlock, setSelectedChartSelectionsByBlock] = useState({});
  const [providerActionsByField, setProviderActionsByField] = useState(new Map());
  const [providerDiagnostics, setProviderDiagnostics] = useState([]);
  const drillMetadataProvider = useMemo(
    () => resolveReportRuntimeDrillMetadataProvider({ reportSpec, runtimeHandlers }),
    [reportSpec, runtimeHandlers],
  );

  useEffect(() => {
    setSelectedChartSelectionsByBlock({});
  }, [reportFill?.specHash]);

  useEffect(() => {
    let cancelled = false;
    async function loadProviderActions() {
      const provider = drillMetadataProvider;
      if (!provider || typeof provider.listAvailableRefinements !== "function") {
        if (!cancelled) {
          setProviderActionsByField(new Map());
          setProviderDiagnostics([]);
        }
        return;
      }
      const nextMap = new Map();
      const nextDiagnostics = [];
      const supportedBlocks = allRuntimeBlocks.filter((block) => ["tableBlock", "chartBlock"].includes(normalizeString(block?.kind)));
      for (const block of supportedBlocks) {
        const fields = normalizeString(block?.kind) === "chartBlock"
          ? resolveReportRuntimeChartActionFields(reportSpec, block)
          : resolveReportRuntimeRefinementFields(reportSpec, block);
        for (const field of fields) {
          try {
            const actions = await provider.listAvailableRefinements(block.kind, field.valueKey, {
              reportSpec,
              block,
            });
            nextMap.set(resolveRuntimeFieldActionKey(block.id, field.valueKey), Array.isArray(actions) ? actions : []);
          } catch (error) {
            nextDiagnostics.push({
              code: "actionProviderFailed",
              severity: "warning",
              message: `Failed to load refinement actions for ${field.label}. ${String(error?.message || error || "")}`.trim(),
            });
          }
        }
      }
      if (cancelled) {
        return;
      }
      setProviderActionsByField(nextMap);
      setProviderDiagnostics(nextDiagnostics);
    }
    loadProviderActions();
    return () => {
      cancelled = true;
    };
  }, [drillMetadataProvider, allRuntimeBlocks, reportSpec]);

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

  const renderBlock = (block) => {
    const kind = normalizeString(block?.kind);
    if (kind === "markdownBlock") {
      return <MarkdownBlock key={block.id} block={block} />;
    }
    if (kind === "kpiBlock") {
      return <KpiBlock key={block.id} block={block} diagnostics={blockDiagnosticsIndex.get(normalizeString(block?.id)) || []} />;
    }
    if (kind === "filterBarBlock") {
      return <FilterBarBlock key={block.id} block={block} scopeParams={scopeParamIndex} />;
    }
    if (kind === "refinementBarBlock") {
      if (!shouldRenderRefinementBarBlock(block, runtimeHandlers)) {
        return null;
      }
      return <RefinementBarBlock key={block.id} block={block} runtimeHandlers={runtimeHandlers} />;
    }
    if (kind === "tableBlock") {
      const dataset = datasetIndex.get(normalizeString(block?.datasetRef)) || { id: block?.datasetRef, rows: [] };
      return (
        <TableBlock
          key={block.id}
          block={block}
          diagnostics={blockDiagnosticsIndex.get(normalizeString(block?.id)) || []}
          dataset={dataset}
          reportSpec={reportSpec}
          providerActionsByField={providerActionsByField}
          runtimeHandlers={runtimeHandlers}
          locale={locale}
        />
      );
    }
    if (kind === "chartBlock") {
      const dataset = datasetIndex.get(normalizeString(block?.datasetRef)) || { id: block?.datasetRef, rows: [] };
      const chartFields = resolveReportRuntimeChartActionFields(reportSpec, block);
      const selectedDatum = selectedChartSelectionsByBlock[normalizeString(block?.id)] || null;
      const chartSpec = block?.content?.chartSpec || block?.chartSpec || {};
      const chartModel = block?.content?.chartModel || block?.chartModel || null;
      const chartInteractionSupport = resolveReportRuntimeChartInteractionSupport(chartSpec);
      const chartInteractionEnabled = chartInteractionSupport.enabled;
      const chartInteractionState = buildReportRuntimeChartInteractionState({
        blockId: block?.id,
        blockTitle: block?.title,
        fields: chartFields,
        selection: selectedDatum,
        providerActionsByField,
        interactionSupport: chartInteractionSupport,
        canClearSelection: chartInteractionEnabled,
      });
      const chartExecutionsById = new Map(
        chartInteractionState.executions.map((execution) => [normalizeString(execution?.id), execution]),
      );
      return (
        <RuntimePanel
          className="forge-report-runtime-chart-panel"
          key={block.id}
          title={normalizeString(block?.title || block?.content?.chartSpec?.title || block?.chartSpec?.title || "Chart")}
        >
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
              onDatumSelect={chartInteractionEnabled ? ((selection) => setSelectedChartSelection(block.id, selection)) : null}
              onLegendItemSelect={chartInteractionSupport.legendEnabled ? ((selection) => setSelectedChartSelection(block.id, selection)) : null}
            />
          ) : (
            <div style={{ fontSize: 12, color: "#5f6b7c", lineHeight: 1.5 }}>
              Chart actions are unavailable because this authored chart does not compile to a runtime chart model.
            </div>
          )}
          <ChartSelectionPanel
            viewModel={chartInteractionState.viewModel}
            onAction={(actionId) => executeReportRuntimeAction(chartExecutionsById.get(normalizeString(actionId)), runtimeHandlers)}
            onClearSelection={chartInteractionEnabled ? (() => clearSelectedChartSelection(block.id)) : null}
          />
        </RuntimePanel>
      );
    }
    if (kind === "geoMapBlock") {
      return <GeoMapBlock key={block.id} block={block} />;
    }
    return <UnsupportedBlock key={block?.id || kind} block={block} />;
  };

  const renderLayoutBlockGrid = (blocks = [], keyPrefix = "runtime") => {
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return null;
    }
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {blocks.map((block) => (
          <div
            key={`${keyPrefix}:${block?.id || "block"}`}
            data-report-runtime-block-id={normalizeString(block?.id)}
            data-report-runtime-layout-size={resolveRuntimeLayoutSize(block)}
            style={{
              minWidth: 0,
              gridColumn: resolveRuntimeLayoutGridColumn(block),
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
      <RuntimePanel
        title={normalizeString(title || reportSpec?.title || "Report Runtime Preview")}
        subtitle={normalizeString(subtitle)}
      >
        <BindingChips bindingSummary={bindingSummary} />
      </RuntimePanel>
      <HostIntentPanel hostIntent={hostIntent} runtimeHandlers={runtimeHandlers} />
      <DiagnosticsPanel diagnostics={[
        ...runtimeDiagnostics,
      ]} />
      {renderLayoutBlockGrid(beforePrimary, "beforePrimary")}
      {primary.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: primary.length > 1 ? "repeat(auto-fit, minmax(320px, 1fr))" : "minmax(0, 1fr)",
            gap: 16,
          }}
        >
          {primary.map((block) => renderBlock(block))}
        </div>
      ) : null}
      {renderLayoutBlockGrid(afterPrimary, "afterPrimary")}
    </div>
  );
}
