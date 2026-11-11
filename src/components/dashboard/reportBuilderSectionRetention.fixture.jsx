import React, { useMemo, useState } from "react";
import ReportRuntime from "./ReportRuntime.jsx";
import SectionTabRail from "../SectionTabRail.jsx";
import { reportRuntimeSectionNavigation } from "./reportRuntimeSectionDatasets.js";
import { useReportRuntimePreviewDatasetPayloads } from "./useReportRuntimePreviewDatasetPayloads.js";
import { buildReportBuilderRuntimePreview } from "./reportBuilderRuntimePreview.js";
import nativeFixture from "../../../backend/reporting/materializer/testdata/empty-chart-report.json";
const base = nativeFixture.reportSpec;
const chart = (id, title) => ({
  ...base.blocks[2],
  id,
  title,
  datasetRef: "daily",
  chartModel: {
    ...base.blocks[2].chartModel,
    series: {
      palette: ["#426b85"],
      values: base.blocks[2].chartModel.series.values.map((value) => ({
        ...value,
        color: "#426b85",
      })),
    },
  },
});
export const sectionFixtureSpec = {
  ...base,
  title: "Example delivery",
  layoutIntent: {
    kind: "stack",
    resultPanePosition: "left",
    blockOrder: [
      "tabs",
      "overview",
      "total",
      "trend",
      "breakdown",
      "pacing",
      "paceTrend",
    ],
  },
  datasets: [
    base.datasets[0],
    ...["summary", "daily", "buckets"].map((id) => ({
      id,
      dataSourceRef: "example",
      request: { filters: { fixtureDataset: id }, limit: 10, offset: 0 },
      resultContract: { rowPath: "data" },
    })),
  ],
  blocks: [
    {
      id: "tabs",
      kind: "tabGroupBlock",
      title: "Example delivery",
      sectionIds: ["overview", "pacing"],
      defaultSectionId: "overview",
      includeUnlistedSections: false,
    },
    {
      id: "overview",
      kind: "sectionBlock",
      title: "Overview",
      navigationLabel: "Overview",
      blockIds: ["total", "trend", "breakdown"],
    },
    {
      id: "total",
      kind: "kpiBlock",
      datasetRef: "summary",
      title: "Total",
      valueField: "amount",
      valueLabel: "Units",
    },
    chart("trend", "Daily trend"),
    {
      ...base.blocks[0],
      id: "breakdown",
      title: "Breakdown",
      datasetRef: "buckets",
    },
    {
      id: "pacing",
      kind: "sectionBlock",
      title: "Pacing",
      navigationLabel: "Pacing",
      blockIds: ["paceTrend"],
    },
    chart("paceTrend", "Pacing evidence"),
  ],
};
export const sectionFixtureRows = {
  summary: [{ amount: 5 }],
  daily: [
    { category: "One", amount: 2 },
    { category: "Two", amount: 3 },
  ],
  buckets: [{ category: "Example", amount: 5 }],
};
export function SectionRetentionFixture({
  owner,
  scope = "one",
  filter = "all",
  run = 0,
}) {
  const [section, setSection] = useState("overview");
  const full = useMemo(
    () =>
      sectionFixtureSpec.datasets
        .filter((d) => d.id !== "primary")
        .map((d) => ({
          ...d,
          request: {
            ...d.request,
            filters: { ...d.request.filters, fixtureFilter: filter },
          },
        })),
    [filter]
  );
  const datasets =
    section === "pacing" ? full.filter((d) => d.id === "daily") : full;
  const scopeKey = JSON.stringify([scope, filter, run, full]);
  const state = useReportRuntimePreviewDatasetPayloads({
    enabled: true,
    builderContext: owner,
    datasets,
    requestKey: JSON.stringify([scopeKey, section]),
    retainResolvedRequests: true,
    retentionScopeKey: scopeKey,
    fetcherOptions: { concurrentRequestScope: scopeKey },
  });
  const model = useMemo(
    () => ({
      reportSpec: sectionFixtureSpec,
      document: {
        version: 1,
        kind: "reportDocument",
        id: "example",
        title: "Example delivery",
        blocks: [],
      },
    }),
    []
  );
  const artifact = buildReportBuilderRuntimePreview({
    model,
    datasetPayloads: state.payloads,
    loading: state.loading,
    error: state.error,
  });
  return (
    <>
      <output data-retention-state>
        {JSON.stringify({
          section,
          loading: state.loading,
          payloadIds: Object.keys(state.payloads),
          error: state.error?.message,
          ready: !!artifact?.reportFill,
          exportReady: !!artifact?.exportRequest,
        })}
      </output>
      {!artifact?.reportFill ? (
        <>
          <SectionTabRail
            items={reportRuntimeSectionNavigation({
              blocks: sectionFixtureSpec.blocks,
            })}
            selectedId={section}
            onChange={setSection}
          />
          <div role="status">{state.error?.message || "Loading report"}</div>
        </>
      ) : (
        <ReportRuntime
          reportSpec={artifact.reportSpec}
          reportFill={artifact.reportFill}
          selectedSectionId={section}
          onSectionChange={setSection}
          presentationMode="report"
        />
      )}
    </>
  );
}
