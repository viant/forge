import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ReportBuilderArtifactEntryCard,
  buildFilterCategoryChipViewModel,
  InlineStaticFilterControl,
  ReportBuilderInspectorNotice,
  ReportBuilderInlineNotice,
  ReportBuilderScopeSummary,
  ReportBuilderSemanticBindingChips,
  ReportBuilderSemanticFieldGroups,
  ReportBuilderSummaryNotice,
  StaticFilterSection,
} from "./reportBuilderComponents.jsx";

const dateRangeHtml = renderToStaticMarkup(
  <StaticFilterSection
    filter={{
      id: "dateRange",
      label: "Date Range",
      description: "Approved reporting window for the semantic preview scope.",
      type: "dateRange",
      required: true,
    }}
    context={{}}
    value={{ start: "2026-05-01", end: "2026-05-07" }}
    onToggle={() => {}}
    onDateRange={() => {}}
  />,
);

assert.ok(dateRangeHtml.includes("Date Range"));
assert.ok(dateRangeHtml.includes("Approved reporting window for the semantic preview scope."));
assert.ok(dateRangeHtml.includes("2026-05-01"));
assert.ok(dateRangeHtml.includes("2026-05-07"));

const multiSelectHtml = renderToStaticMarkup(
  <StaticFilterSection
    filter={{
      id: "channelsFilter",
      label: "Channels",
      description: "Approved channel scope applied across the authored report preview.",
      multiple: true,
      options: [
        { label: "Display", value: "Display" },
        { label: "CTV", value: "CTV" },
      ],
    }}
    context={{}}
    value={["Display"]}
    onToggle={() => {}}
    onDateRange={() => {}}
  />,
);

assert.ok(multiSelectHtml.includes("Channels"));
assert.ok(multiSelectHtml.includes("Approved channel scope applied across the authored report preview."));
assert.ok(multiSelectHtml.includes("Display"));
assert.ok(multiSelectHtml.includes("CTV"));

const invalidFilterHtml = renderToStaticMarkup(
  <StaticFilterSection
    filter={{
      id: "channelsFilter",
      label: "Channels",
      description: "Approved channel scope applied across the authored report preview.",
      multiple: true,
      options: [
        { label: "Display", value: "Display" },
        { label: "CTV", value: "CTV" },
      ],
    }}
    context={{}}
    value={["Display"]}
    issue={{
      id: "channelsFilter",
      message: "Channels is not mapped to the current semantic model.",
    }}
    onToggle={() => {}}
    onDateRange={() => {}}
  />,
);

assert.ok(invalidFilterHtml.includes("is-semantic-invalid"));
assert.ok(invalidFilterHtml.includes("Channels is not mapped to the current semantic model."));

const providerInvalidFilterHtml = renderToStaticMarkup(
  <StaticFilterSection
    filter={{
      id: "dateRange",
      label: "Date Range",
      description: "Approved reporting window for the semantic preview scope.",
      type: "dateRange",
      required: true,
    }}
    context={{}}
    value={{ start: "2026-05-01", end: "2026-05-07" }}
    providerDiagnostics={[
      {
        code: "invalidParameter",
        severity: "error",
        path: "selection.parameters.reporting_window",
        message: "Reporting Window is outside the supported semantic window.",
      },
    ]}
    onToggle={() => {}}
    onDateRange={() => {}}
  />,
);

assert.ok(providerInvalidFilterHtml.includes("is-semantic-provider-invalid"));
assert.ok(providerInvalidFilterHtml.includes("Reporting Window is outside the supported semantic window."));

const inlineInvalidHtml = renderToStaticMarkup(
  <InlineStaticFilterControl
    filter={{
      id: "dateRange",
      label: "Date Range",
      description: "Approved reporting window for the semantic preview scope.",
      type: "dateRange",
    }}
    value={{ start: "2026-05-07", end: "2026-05-01" }}
    issue={{
      id: "dateRange",
      message: "Date Range is not mapped to the current semantic model.",
    }}
    onToggle={() => {}}
    onDateRange={() => {}}
  />,
);

assert.ok(inlineInvalidHtml.includes("forge-report-builder__inline-filter-control"));
assert.ok(inlineInvalidHtml.includes("is-semantic-invalid"));
assert.ok(inlineInvalidHtml.includes("Date Range is not mapped to the current semantic model."));

const inlineProviderInvalidHtml = renderToStaticMarkup(
  <InlineStaticFilterControl
    filter={{
      id: "channelsFilter",
      label: "Channels",
      description: "Approved channel scope applied across the authored report preview.",
      multiple: true,
      options: [
        { label: "Display", value: "Display" },
        { label: "CTV", value: "CTV" },
      ],
    }}
    value={["Display"]}
    providerDiagnostics={[
      {
        code: "unsupportedParameterValue",
        severity: "error",
        path: "selection.parameters.delivery_channels_filter",
        message: "Channels contains unsupported values: Roku.",
      },
    ]}
    onToggle={() => {}}
    onDateRange={() => {}}
  />,
);

assert.ok(inlineProviderInvalidHtml.includes("is-semantic-provider-invalid"));
assert.ok(inlineProviderInvalidHtml.includes("Channels contains unsupported values: Roku."));

assert.deepEqual(buildFilterCategoryChipViewModel({
  label: "Channels",
  active: false,
  configuredCount: 2,
  issue: {
    message: "Channels is not mapped to the current semantic model.",
  },
}), {
  className: "forge-report-builder__category-chip is-inactive has-configured-state is-semantic-invalid",
  title: "Channels • 2 configured • available • Channels is not mapped to the current semantic model.",
  stateLabel: "2",
  diagnosticSummary: "Channels is not mapped to the current semantic model.",
});

assert.deepEqual(buildFilterCategoryChipViewModel({
  label: "Date Range",
  active: true,
  configuredCount: 1,
  providerDiagnostics: [
    {
      code: "invalidParameter",
      severity: "error",
      path: "selection.parameters.reporting_window",
      message: "Date Range start date must be on or before the end date.",
      suggestedFix: "Adjust the date range so the start date is not after the end date.",
    },
  ],
}), {
  className: "forge-report-builder__category-chip is-active has-configured-state is-semantic-provider-invalid",
  title: "Date Range • 1 configured • shown • Date Range start date must be on or before the end date. Adjust the date range so the start date is not after the end date.",
  stateLabel: "1",
  diagnosticSummary: "Date Range start date must be on or before the end date. Adjust the date range so the start date is not after the end date.",
});

const inlineNoticeHtml = renderToStaticMarkup(
  <ReportBuilderInlineNotice
    notice={{
      level: "danger",
      message: "Semantic validation: Semantic provider unavailable.",
      actionLabel: "Retry validation",
    }}
    onAction={() => {}}
  />,
);

assert.ok(inlineNoticeHtml.includes("Semantic validation: Semantic provider unavailable."));
assert.ok(inlineNoticeHtml.includes("Retry validation"));
assert.ok(inlineNoticeHtml.includes("forge-report-builder__chart-inline-notice--danger"));

const inlineNoticeWithoutActionHtml = renderToStaticMarkup(
  <ReportBuilderInlineNotice
    notice={{
      level: "info",
      message: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      actionLabel: "Retry model load",
    }}
  />,
);

assert.ok(inlineNoticeWithoutActionHtml.includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
assert.ok(!inlineNoticeWithoutActionHtml.includes("Retry model load"));

const inlineNoticeWithChildrenHtml = renderToStaticMarkup(
  <ReportBuilderInlineNotice
    notice={{
      level: "warning",
      message: "Applied Delivery Grid. Run to refresh results.",
      actionLabel: "Run now",
    }}
    onAction={() => {}}
  >
    <div className="forge-report-builder__result-meta">
      <span className="forge-report-builder__result-meta-chip">1 measure</span>
    </div>
  </ReportBuilderInlineNotice>,
);

assert.ok(inlineNoticeWithChildrenHtml.includes("Applied Delivery Grid. Run to refresh results."));
assert.ok(inlineNoticeWithChildrenHtml.includes("Run now"));
assert.ok(inlineNoticeWithChildrenHtml.includes("1 measure"));
assert.ok(inlineNoticeWithChildrenHtml.includes("forge-report-builder__chart-inline-notice--warning"));

const inspectorNoticeHtml = renderToStaticMarkup(
  <ReportBuilderInspectorNotice
    level="info"
    ariaLabel="Saved export request summary"
    metaChips={["saved_payload", "PDF", "reportPrint"]}
    content={'{\n  "kind": "reportExportRequest"\n}'}
    actions={(
      <>
        <button type="button">Hide export request</button>
        <button type="button">Download export request</button>
      </>
    )}
  >
    <div className="forge-report-builder__semantic-binding-field-groups">semantic details</div>
  </ReportBuilderInspectorNotice>,
);

assert.ok(inspectorNoticeHtml.includes("Saved export request summary"));
assert.ok(inspectorNoticeHtml.includes("saved_payload"));
assert.ok(inspectorNoticeHtml.includes("reportPrint"));
assert.ok(inspectorNoticeHtml.includes("semantic details"));
assert.ok(inspectorNoticeHtml.includes("Hide export request"));
assert.ok(inspectorNoticeHtml.includes("Download export request"));
assert.ok(inspectorNoticeHtml.includes("reportExportRequest"));
assert.ok(inspectorNoticeHtml.includes("forge-report-builder__chart-inline-notice--info"));

const warningInspectorNoticeHtml = renderToStaticMarkup(
  <ReportBuilderInspectorNotice
    level="warning"
    ariaLabel="Reopen diagnostic summary"
    metaChips={["reopenDiagnostic", "missingReportSpec", "warning"]}
    content={'{\n  "code": "missingReportSpec"\n}'}
    contentStyle={{ background: "#fff9f5", color: "#5f3411" }}
  >
    <div style={{ color: "#5f3411" }}>warning details</div>
  </ReportBuilderInspectorNotice>,
);

assert.ok(warningInspectorNoticeHtml.includes("Reopen diagnostic summary"));
assert.ok(warningInspectorNoticeHtml.includes("missingReportSpec"));
assert.ok(warningInspectorNoticeHtml.includes("warning details"));
assert.ok(warningInspectorNoticeHtml.includes("fff9f5"));
assert.ok(warningInspectorNoticeHtml.includes("5f3411"));
assert.ok(warningInspectorNoticeHtml.includes("forge-report-builder__chart-inline-notice--warning"));

const summaryNoticeHtml = renderToStaticMarkup(
  <ReportBuilderSummaryNotice
    level="info"
    label="Create ReportDocument payload"
    value="Capacity Trend Q3"
    subtitle="Semantic builder payload"
    description="Ready to persist the authored report document."
    supplemental={<span><strong>Template:</strong> Landscape</span>}
    footer={(
      <div className="forge-report-builder__result-header-actions">
        <span className="forge-report-builder__result-meta-chip">capacityTrendQ3</span>
        <button type="button">Inspect create payload</button>
      </div>
    )}
  >
    <div className="forge-report-builder__semantic-binding-field-groups">summary semantic details</div>
  </ReportBuilderSummaryNotice>,
);

assert.ok(summaryNoticeHtml.includes("Create ReportDocument payload"));
assert.ok(summaryNoticeHtml.includes("Capacity Trend Q3"));
assert.ok(summaryNoticeHtml.includes("Semantic builder payload"));
assert.ok(summaryNoticeHtml.includes("Ready to persist the authored report document."));
assert.ok(summaryNoticeHtml.includes("Template:"));
assert.ok(summaryNoticeHtml.includes("Landscape"));
assert.ok(summaryNoticeHtml.includes("capacityTrendQ3"));
assert.ok(summaryNoticeHtml.includes("Inspect create payload"));
assert.ok(summaryNoticeHtml.includes("summary semantic details"));
assert.ok(summaryNoticeHtml.includes("forge-report-builder__chart-inline-notice--info"));

const warningSummaryNoticeHtml = renderToStaticMarkup(
  <ReportBuilderSummaryNotice
    level="warning"
    label="Update conflict diagnostic"
    value="Version mismatch detected"
    subtitle="Current report version does not match the expected version."
    description="Inspect the conflict diagnostic before retrying the update."
    footer={(
      <div className="forge-report-builder__result-header-actions">
        <span className="forge-report-builder__result-meta-chip">capacityTrendQ3</span>
        <button type="button">Inspect conflict diagnostic</button>
      </div>
    )}
  >
    <div className="forge-report-builder__semantic-binding-field-groups">warning summary semantic details</div>
  </ReportBuilderSummaryNotice>,
);

assert.ok(warningSummaryNoticeHtml.includes("Update conflict diagnostic"));
assert.ok(warningSummaryNoticeHtml.includes("Version mismatch detected"));
assert.ok(warningSummaryNoticeHtml.includes("Current report version does not match the expected version."));
assert.ok(warningSummaryNoticeHtml.includes("Inspect the conflict diagnostic before retrying the update."));
assert.ok(warningSummaryNoticeHtml.includes("capacityTrendQ3"));
assert.ok(warningSummaryNoticeHtml.includes("Inspect conflict diagnostic"));
assert.ok(warningSummaryNoticeHtml.includes("warning summary semantic details"));
assert.ok(warningSummaryNoticeHtml.includes("forge-report-builder__chart-inline-notice--warning"));

const semanticBindingChipsHtml = renderToStaticMarkup(
  <ReportBuilderSemanticBindingChips
    bindingState={{
      semanticBindingTitle: "Semantic Binding",
      semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
      ],
    }}
  />,
);

assert.ok(semanticBindingChipsHtml.includes("Semantic Binding"));
assert.ok(semanticBindingChipsHtml.includes("Model Ad Delivery"));
assert.ok(semanticBindingChipsHtml.includes("Entity Line Delivery"));

const semanticBindingFieldGroupsHtml = renderToStaticMarkup(
  <ReportBuilderSemanticFieldGroups
    bindingState={{
      semanticBindingFieldGroups: [
        {
          id: "dimensions",
          title: "Selected dimensions (1)",
          fields: [
            {
              id: "channel",
              label: "Channel",
              rawId: "channelV2",
              description: "Approved delivery channel dimension.",
              category: "dimension",
              definitionRef: "semantic://delivery/channel",
              governance: {
                classification: "public",
                certified: true,
              },
            },
          ],
        },
      ],
    }}
  />,
);

assert.ok(semanticBindingFieldGroupsHtml.includes("Selected dimensions (1)"));
assert.ok(semanticBindingFieldGroupsHtml.includes("Channel"));
assert.ok(semanticBindingFieldGroupsHtml.includes("channelV2"));
assert.ok(semanticBindingFieldGroupsHtml.includes("semantic://delivery/channel"));
assert.ok(semanticBindingFieldGroupsHtml.includes("Approved delivery channel dimension."));
assert.ok(semanticBindingFieldGroupsHtml.includes("dimension"));
assert.ok(semanticBindingFieldGroupsHtml.includes("public"));

const scopeSummaryHtml = renderToStaticMarkup(
  <ReportBuilderScopeSummary
    summaryState={{
      scopeSummaryTitle: "Report Scope",
      scopeSummaryItems: [
        {
          id: "dateRange",
          label: "Reporting Window",
          description: "Approved reporting window for imported runtime previews.",
        },
      ],
    }}
  />,
);

assert.ok(scopeSummaryHtml.includes("Report Scope"));
assert.ok(scopeSummaryHtml.includes("Reporting Window"));
assert.ok(scopeSummaryHtml.includes("Approved reporting window for imported runtime previews."));

const artifactEntryCardHtml = renderToStaticMarkup(
  <ReportBuilderArtifactEntryCard
    entry={{
      id: "record-1",
      title: "Capacity Trend Q3",
      active: true,
      activateLabel: "Use Capacity Trend Q3",
      notice: {
        level: "warning",
        message: "Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
      },
      metaChips: ["capacityTrendQ3", "v6"],
      authoredBlockSummaryText: "4 authored blocks: 1 Filter Bar, 1 Kpi, 1 Refinement Bar, 1 Table",
      drillSummaryText: "2 drill hierarchies • 6 levels • 2 detail targets • 3 field actions",
      semanticBindingFieldGroups: [
        {
          id: "measures",
          title: "Selected measures (1)",
          fields: [{ id: "spend", label: "Spend" }],
        },
      ],
    }}
    renderSemanticBindingChips={() => <div>binding chips</div>}
    renderSemanticBindingFieldGroups={() => <div>field groups</div>}
    renderScopeSummaryItems={() => <div>scope summary</div>}
    renderAuthoredDocumentProgress={() => <div>authored progress</div>}
    onActivate={() => {}}
    onRemove={() => {}}
  />,
);

assert.ok(artifactEntryCardHtml.includes("Capacity Trend Q3"));
assert.ok(artifactEntryCardHtml.includes("binding chips"));
assert.ok(artifactEntryCardHtml.includes("field groups"));
assert.ok(artifactEntryCardHtml.includes("scope summary"));
assert.ok(artifactEntryCardHtml.includes("authored progress"));
assert.ok(artifactEntryCardHtml.includes("Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief."));
assert.ok(artifactEntryCardHtml.includes("forge-report-builder__chart-inline-notice--warning"));
assert.ok(artifactEntryCardHtml.includes("capacityTrendQ3"));
assert.ok(artifactEntryCardHtml.includes("v6"));
assert.ok(artifactEntryCardHtml.includes("Use"));
assert.ok(artifactEntryCardHtml.includes("Remove"));

console.log("reportBuilderComponents ✓ renders semantic scope descriptions and diagnostics across static, inline, and category filter controls");
