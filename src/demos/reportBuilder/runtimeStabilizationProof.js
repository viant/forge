import React from "react";
import { createRoot } from "react-dom/client";

import ReportRuntime from "../../components/dashboard/ReportRuntime.jsx";

const rows = Array.from({ length: 8 }, (_, index) => ({
  category: `Category ${index + 1}`,
  value: 800 - index * 75,
  impressions: 120000 + index * 10000,
  spend: 9000 + index * 750,
  conversions: 80 + index * 7,
  rate: 0.04 + index * 0.005,
  status: index % 2 === 0 ? "On track" : "Watch",
  note: `Evidence note ${index + 1}`,
  reportDate: `2026-08-${String(20 + index).padStart(2, "0")}`,
  controlValue: 720 - index * 60,
}));

const columns = [
  { key: "category", label: "Category", frozen: true },
  { key: "value", label: "Value", format: "compactNumber" },
  { key: "impressions", label: "Impressions", format: "compactNumber" },
  { key: "spend", label: "Spend", format: "currency" },
  { key: "conversions", label: "Conversions", format: "compactNumber" },
  { key: "rate", label: "Rate", format: "percentFraction" },
  { key: "status", label: "Status" },
  { key: "note", label: "Evidence Note" },
];

export function buildRuntimeStabilizationProofProps() {
  const refreshDiagnostic = { code: "runtimePreviewDatasetFetchFailed", severity: "error", message: "internal named dataset refresh failure" };
  const ownedBlockIds = ["headline", "ranking", "categorical", "singleLine", "multiLine", "donut", "geo", "evidence"];
  const unownedStarterBlocks = [
    { id: "starterTable", kind: "markdownBlock", title: "Table" },
    { id: "starterChart", kind: "markdownBlock", title: "Avails by Date" },
    { id: "starterKpi", kind: "markdownBlock", title: "Headline KPI" },
    { id: "starterComparison", kind: "markdownBlock", title: "Delivery Comparison" },
  ];
  return {
    presentationMode: "report",
    showContextSummary: false,
    reportSpec: {
      title: "Runtime stabilization proof",
      layoutIntent: { blockOrder: ["tabs", "proofSection", ...ownedBlockIds, ...unownedStarterBlocks.map((block) => block.id)], items: ["tabs", "proofSection", ...ownedBlockIds, ...unownedStarterBlocks.map((block) => block.id)].map((blockId) => ({ blockId })) },
      datasets: [{ id: "saved_evidence", request: {} }],
      blocks: [
        { id: "tabs", kind: "tabGroupBlock", title: "Proof sections", sectionIds: ["proofSection"], defaultSectionId: "proofSection", includeUnlistedSections: false },
        { id: "proofSection", kind: "sectionBlock", title: "Proof", navigationLabel: "Proof", blockIds: ownedBlockIds },
        { id: "headline", kind: "kpiBlock", title: "Saved KPI", datasetRef: "saved_evidence", valueField: "value" },
        { id: "ranking", kind: "chartBlock", title: "Saved ranking", datasetRef: "saved_evidence", rowLimit: 4 },
        { id: "categorical", kind: "chartBlock", title: "Categorical distribution", datasetRef: "saved_evidence", rowLimit: 4 },
        { id: "singleLine", kind: "chartBlock", title: "Single-series daily trend", datasetRef: "saved_evidence" },
        { id: "multiLine", kind: "chartBlock", title: "Multi-series daily trend", datasetRef: "saved_evidence" },
        { id: "donut", kind: "chartBlock", title: "Channel contribution", datasetRef: "saved_evidence" },
        { id: "geo", kind: "geoMapBlock", title: "Geographic distribution", datasetRef: "saved_evidence" },
        { id: "evidence", kind: "tableBlock", title: "Evidence table", datasetRef: "saved_evidence", columns },
        ...unownedStarterBlocks,
      ],
    },
    reportFill: {
      diagnostics: [refreshDiagnostic],
      datasets: [{ id: "saved_evidence", rows, provenance: { rowCount: rows.length, diagnostics: [refreshDiagnostic] } }],
      blocks: [
        { id: "tabs", kind: "tabGroupBlock", title: "Proof sections", sectionIds: ["proofSection"], defaultSectionId: "proofSection", includeUnlistedSections: false, content: { title: "Proof sections", sectionIds: ["proofSection"], defaultSectionId: "proofSection", includeUnlistedSections: false, tabs: [{ id: "proofSection", title: "Proof", navigationLabel: "Proof" }] } },
        { id: "proofSection", kind: "sectionBlock", title: "Proof", navigationLabel: "Proof", blockIds: ownedBlockIds, content: { title: "Proof", navigationLabel: "Proof", blockIds: ownedBlockIds } },
        { id: "headline", kind: "kpiBlock", title: "Saved KPI", datasetRef: "saved_evidence", content: { title: "Saved KPI", valueField: "value", valueLabel: "Value", value: rows[0].value, rowCount: rows.length } },
        {
          id: "ranking", kind: "chartBlock", title: "Saved ranking", datasetRef: "saved_evidence", rowLimit: 4,
          content: {
            title: "Saved ranking", rowLimit: 4,
            chartSpec: { title: "Saved ranking", type: "horizontal_bar", xField: "category", yFields: ["value"] },
            chartModel: {
              type: "horizontal_bar",
              xAxis: { dataKey: "category", categoryLabel: { lines: 2, maxCharacters: 20 } },
              yAxis: { label: "Value", format: "compactNumber" },
              series: { values: [{ value: "value", label: "Value", color: "#2f6de1", type: "horizontal_bar" }] },
            },
            rowCount: rows.length,
          },
        },
        {
          id: "singleLine", kind: "chartBlock", title: "Single-series daily trend", datasetRef: "saved_evidence",
          content: {
            title: "Single-series daily trend",
            chartSpec: { title: "Single-series daily trend", type: "line", xField: "reportDate", yFields: ["value"] },
            chartModel: {
              type: "line",
              xAxis: { dataKey: "reportDate", label: "Report Date" },
              yAxis: { label: "Value", format: "compactNumber" },
              series: { values: [{ value: "value", label: "Value", color: "#2f6de1", type: "line" }] },
            },
            rowCount: rows.length,
          },
        },
        {
          id: "multiLine", kind: "chartBlock", title: "Multi-series daily trend", datasetRef: "saved_evidence",
          content: {
            title: "Multi-series daily trend",
            chartSpec: { title: "Multi-series daily trend", type: "line", xField: "reportDate", yFields: ["value", "controlValue"] },
            chartModel: {
              type: "line",
              xAxis: { dataKey: "reportDate", label: "Report Date" },
              yAxis: { label: "Value", format: "compactNumber" },
              series: { values: [
                { value: "value", label: "Measured", color: "#2f6de1", type: "line" },
                { value: "controlValue", label: "Control", color: "#f97316", type: "line", strokeDasharray: "8 4" },
              ] },
            },
            rowCount: rows.length,
          },
        },
        {
          id: "donut", kind: "chartBlock", title: "Channel contribution", datasetRef: "saved_evidence",
          content: {
            title: "Channel contribution",
            chartSpec: { title: "Channel contribution", type: "donut", xField: "category", yFields: ["value"] },
            chartModel: {
              type: "donut",
              xAxis: { dataKey: "category" },
              yAxis: { format: "compactNumber" },
              series: {
                nameKey: "category",
                valueKey: "value",
                values: [{ value: "value", label: "Contribution", color: "#2f6de1", type: "donut" }],
                palette: ["#2f6de1", "#7c3aed", "#db2777", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#4f46e5"],
              },
            },
            rowCount: rows.length,
          },
        },
        {
          id: "categorical", kind: "chartBlock", title: "Categorical distribution", datasetRef: "saved_evidence", rowLimit: 4,
          content: {
            title: "Categorical distribution", rowLimit: 4,
            chartSpec: { title: "Categorical distribution", type: "bar", xField: "category", yFields: ["value"] },
            chartModel: {
              type: "bar",
              xAxis: { dataKey: "category", label: "Exposure Device", categoryLabel: { lines: 2, maxCharacters: 20 } },
              yAxis: { label: "Value", format: "compactNumber" },
              series: { values: [{ value: "value", label: "Value", color: "#2f6de1", type: "bar" }] },
            },
            rowCount: rows.length,
          },
        },
        {
          id: "geo", kind: "geoMapBlock", title: "Geographic distribution", datasetRef: "saved_evidence",
          content: {
            geo: { shape: "us-state-tiles", metric: { label: "Value" } },
            resolvedGeo: {
              shape: "us-state-tiles",
              metricLabel: "Value",
              summary: { regionCount: 4, totalValue: "2.7K", topKey: "CA" },
              activeRegion: { key: "CA", label: "California", rawValue: 800, displayValue: "800", color: "#167d68" },
              regions: [
                { key: "CA", label: "California", rawValue: 800, displayValue: "800", color: "#167d68" },
                { key: "TX", label: "Texas", rawValue: 725, displayValue: "725", color: "#40a58d" },
                { key: "FL", label: "Florida", rawValue: 650, displayValue: "650", color: "#73c1ae" },
                { key: "WA", label: "Washington", rawValue: 575, displayValue: "575", color: "#a9d9cc" },
              ],
              ranking: [
                { key: "CA", rawValue: 800, displayValue: "800", color: "#167d68" },
                { key: "TX", rawValue: 725, displayValue: "725", color: "#40a58d" },
                { key: "FL", rawValue: 650, displayValue: "650", color: "#73c1ae" },
                { key: "WA", rawValue: 575, displayValue: "575", color: "#a9d9cc" },
              ],
              legend: { min: "575", max: "800", palette: ["#a9d9cc", "#73c1ae", "#40a58d", "#167d68"] },
            },
          },
        },
        { id: "evidence", kind: "tableBlock", title: "Evidence table", datasetRef: "saved_evidence", content: { title: "Evidence table", columns, rowCount: rows.length, resolvedRows: [] } },
        ...unownedStarterBlocks.map((block) => ({ ...block, content: { title: block.title, markdown: "This unowned starter remains in the contract but must not render." } })),
      ],
    },
  };
}

export function mountRuntimeStabilizationProof(element) {
  if (!element) throw new Error("A proof mount element is required.");
  const root = createRoot(element);
  root.render(React.createElement(ReportRuntime, buildRuntimeStabilizationProofProps()));
  return () => root.unmount();
}
