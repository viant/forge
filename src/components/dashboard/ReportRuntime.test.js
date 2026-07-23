import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ReportRuntime, { RefinementBarBlock } from "./ReportRuntime.jsx";

const reportSpec = {
  title: "Semantic Runtime Report",
  parameters: {
    viewMode: "chart",
    groupBy: "",
    pageSize: 25,
    orderField: "eventDate",
    orderDir: "asc",
  },
  scope: {
    params: [
      {
        id: "dateRange",
        label: "Reporting Window",
        description: "Approved reporting window for semantic preview.",
        value: {
          start: "2026-05-01",
          end: "2026-05-07",
        },
      },
    ],
  },
  layoutIntent: {
    blockOrder: [],
    items: [],
  },
  blocks: [],
  datasets: [],
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    modelDescription: "Governed reporting model for the report builder preview.",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    entityDescription: "Daily delivery grain approved for reporting.",
    selectedDimensions: [
      {
        id: "event_date",
        rawId: "eventDate",
        label: "Delivery Date",
        category: "Time",
        description: "Daily delivery grain",
      },
      {
        id: "channel",
        rawId: "channelV2",
        label: "Channel",
        category: "Delivery",
        definitionRef: "semantic://example/channel",
        description: "Approved buying channel",
        governance: {
          status: "deprecated",
          ownerRef: "team://example/performance",
        },
      },
    ],
    selectedMeasures: [
      {
        id: "available_impressions",
        rawId: "avails",
        label: "Available Impressions",
        category: "Metrics",
        description: "Certified available inventory",
        format: "compactNumber",
        governance: {
          status: "draft",
          certification: "certified",
          ownerRef: "team://example/performance",
        },
      },
    ],
    selectedParameters: [
      {
        id: "reporting_window",
        rawId: "dateRange",
        label: "Reporting Window",
        category: "Scope",
        definitionRef: "semantic://example/reporting_window",
        description: "Approved reporting window for semantic preview.",
      },
    ],
  },
};

const reportFill = {
  diagnostics: [
    {
      code: "semanticProviderDiagnostics",
      severity: "warning",
      blockId: "primaryChart",
      path: "reportDocument.blocks.primaryChart.targetRef",
      message: "Semantic provider rejected the current drill target mapping.",
      suggestedFix: "Update the authored target mapping or remove the missing parameter.",
    },
  ],
  datasets: [],
  blocks: [],
};

const html = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec,
    reportFill,
    title: "Runtime Preview",
    subtitle: "Compiled authored report runtime surface.",
  }),
);

assert.ok(html.includes("Runtime Preview"));
assert.ok(html.includes("Compiled authored report runtime surface."));
assert.ok(html.includes("Model Ad Delivery"));
assert.ok(html.includes("Entity Line Delivery"));
assert.ok(html.includes("Semantic Binding"));
assert.ok(html.includes("Governed model and field selections compiled into this runtime artifact."));
assert.ok(html.includes("Governed reporting model for the report builder preview."));
assert.ok(html.includes("Daily delivery grain approved for reporting."));
assert.ok(html.includes("Selected dimensions (2)"));
assert.ok(html.includes("Delivery Date"));
assert.ok(html.includes("Time"));
assert.ok(html.includes("Daily delivery grain"));
assert.ok(html.includes("semantic://example/channel"));
assert.ok(html.includes("Dimensions Delivery Date, Channel"));
assert.ok(html.includes("Measures Available Impressions"));
assert.ok(html.includes("Parameters Reporting Window"));
assert.ok(html.includes("Categories Time, Delivery +2"));
assert.ok(html.includes("Owner team://example/performance"));
assert.ok(html.includes("Lineage semantic://example/channel +1"));
assert.ok(html.includes("Selected measures (1)"));
assert.ok(html.includes("Selected parameters (1)"));
assert.ok(html.includes("Reporting Window"));
assert.ok(html.includes("Approved reporting window for semantic preview."));
assert.ok(html.includes("Baseline filters compiled into this runtime. Live keep, exclude, and drill changes appear in Active refinements."));
assert.ok(html.includes("2026-05-01 to 2026-05-07"));
assert.ok(html.includes("Certified available inventory"));
assert.ok(html.includes("Certified"));
assert.ok(html.includes("Owner team://example/performance"));
assert.ok(html.includes("1 deprecated"));
assert.ok(html.includes("1 draft"));
assert.ok(html.includes("Runtime Diagnostics"));
assert.ok(html.includes("Semantic provider rejected the current drill target mapping."));
assert.ok(html.includes("Update the authored target mapping or remove the missing parameter."));
assert.ok(html.includes("semanticProviderDiagnostics"));
assert.ok(html.includes("Block primaryChart"));
assert.ok(html.includes("reportDocument.blocks.primaryChart.targetRef"));

const hiddenContextSummaryHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec,
    reportFill,
    title: "Runtime Preview",
    subtitle: "Compiled authored report runtime surface.",
    showContextSummary: false,
  }),
);
assert.ok(!hiddenContextSummaryHtml.includes("Runtime Preview"));
assert.ok(!hiddenContextSummaryHtml.includes("Semantic Binding"));
assert.ok(!hiddenContextSummaryHtml.includes("Report Scope"));
assert.ok(hiddenContextSummaryHtml.includes("Model Ad Delivery"));
assert.ok(hiddenContextSummaryHtml.includes("Entity Line Delivery"));
assert.ok(hiddenContextSummaryHtml.includes("Dimensions Delivery Date, Channel"));
assert.ok(hiddenContextSummaryHtml.includes("Measures Available Impressions"));
assert.ok(hiddenContextSummaryHtml.includes("Runtime Diagnostics"));

const unifiedCriteriaHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Unified Filters Runtime",
      scope: {
        params: [
          {
            id: "dateRange",
            label: "Reporting Window",
            value: { start: "2026-05-01", end: "2026-05-07" },
          },
        ],
      },
      layoutIntent: {
        blockOrder: ["scopeFilters"],
        items: [{ blockId: "scopeFilters" }],
      },
      blocks: [
        {
          id: "scopeFilters",
          kind: "filterBarBlock",
          title: "Filters",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "scopeFilters",
          kind: "filterBarBlock",
          title: "Filters",
          content: {
            title: "Filters",
            params: [
              {
                id: "dateRange",
                label: "Reporting Window",
                value: { start: "2026-05-01", end: "2026-05-07" },
              },
            ],
            criteria: [
              {
                id: "include:includeSiteType:1",
                label: "Inventory · Include Site Type",
                enabled: true,
                rawValues: ["web"],
                displayValues: ["web"],
              },
              {
                id: "exclude:excludePostalCodeList:1",
                label: "Location · Exclude Postal Code List",
                enabled: false,
                rawValues: [53279, 71462],
                displayValues: ["53279", "71462"],
              },
            ],
          },
        },
      ],
    },
    presentationMode: "report",
  }),
);
assert.ok(unifiedCriteriaHtml.includes("Active Targeting"));
assert.ok(unifiedCriteriaHtml.includes("Inventory · Include Site Type"));
assert.ok(unifiedCriteriaHtml.includes("web"));
assert.ok(unifiedCriteriaHtml.includes("Location · Exclude Postal Code List"));
assert.ok(unifiedCriteriaHtml.includes("53279, 71462"));
assert.ok(unifiedCriteriaHtml.includes("Off"));

const kpiToneHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Tone Runtime",
      layoutIntent: {
        blockOrder: ["headlineKpi"],
        items: [{ blockId: "headlineKpi" }],
      },
      blocks: [
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          title: "Primary blocker family",
          datasetRef: "primary",
          valueField: "primary_blocker_family",
          valueLabel: "Primary blocker family",
          tone: "danger",
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {},
        },
      ],
    },
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "primary",
          rows: [{ primary_blocker_family: "supply" }],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          datasetRef: "primary",
          title: "Primary blocker family",
          content: {
            title: "Primary blocker family",
            tone: "danger",
            valueField: "primary_blocker_family",
            valueLabel: "Primary blocker family",
            value: "supply",
            rowCount: 1,
          },
        },
      ],
    },
  }),
);
assert.ok(kpiToneHtml.includes('data-report-runtime-kpi-tone="danger"'));
assert.ok(kpiToneHtml.includes("supply"));

const badgesBlockHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Badges Runtime",
      theme: {
        accentTone: "green",
        badgePalette: "bold",
      },
      layoutIntent: {
        blockOrder: ["statusPills"],
        items: [{ blockId: "statusPills" }],
      },
      blocks: [
        {
          id: "statusPills",
          kind: "badgesBlock",
          title: "Status Pills",
          items: [
            { id: "setup", label: "Setup", value: "Live", tone: "success" },
            { id: "pacing", label: "Pacing", value: "Behind", tone: "warning" },
          ],
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "statusPills",
          kind: "badgesBlock",
          title: "Status Pills",
          content: {
            title: "Status Pills",
            items: [
              { id: "setup", label: "Setup", value: "Live", tone: "success" },
              { id: "pacing", label: "Pacing", value: 0.0267, format: "percentFraction", tone: "warning" },
            ],
          },
        },
      ],
    },
  }),
);
assert.ok(badgesBlockHtml.includes("Status Pills"));
assert.ok(badgesBlockHtml.includes("Setup: Live"));
assert.ok(badgesBlockHtml.includes("Pacing: 2.7%"));
assert.ok(badgesBlockHtml.includes('data-report-runtime-badge-tone="success"'));
assert.ok(badgesBlockHtml.includes('data-report-runtime-badge-tone="warning"'));
assert.ok(badgesBlockHtml.includes("#d5f0dc"));
assert.ok(badgesBlockHtml.includes("#16a34a"));

const themedKpiHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Themed KPI Runtime",
      theme: {
        accentTone: "green",
      },
      layoutIntent: {
        blockOrder: ["headlineKpi"],
        items: [{ blockId: "headlineKpi" }],
      },
      blocks: [],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          title: "Headline KPI",
          content: {
            title: "Headline KPI",
            tone: "info",
            valueField: "avails",
            valueLabel: "Avails",
            value: 100,
            rowCount: 1,
          },
        },
      ],
    },
  }),
);
assert.ok(themedKpiHtml.includes("#16a34a"));

const collectionBlockHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Collection Runtime",
      layoutIntent: {
        blockOrder: ["topChannels"],
        items: [{ blockId: "topChannels" }],
      },
      blocks: [
        {
          id: "topChannels",
          kind: "collectionBlock",
          title: "Top Channels",
          datasetRef: "primary",
          itemTitleField: "channelId",
          valueField: "totalSpend",
          valueLabel: "Spend",
          secondaryField: "eventDate",
          secondaryLabel: "Date",
        },
      ],
      datasets: [{ id: "primary", request: {} }],
    },
    reportFill: {
      diagnostics: [],
      datasets: [{ id: "primary", rows: [], provenance: { diagnostics: [] } }],
      blocks: [
        {
          id: "topChannels",
          kind: "collectionBlock",
          title: "Top Channels",
          datasetRef: "primary",
          content: {
            title: "Top Channels",
            layout: "grid",
            columns: 2,
            rowCount: 2,
            rowLimit: 2,
            items: [
              {
                title: "Display",
                valueField: "totalSpend",
                valueLabel: "Spend",
                valueFormat: "currency",
                value: 40400,
                secondaryField: "eventDate",
                secondaryLabel: "Date",
                secondaryValue: "2026-05-01",
                bodyMarkdown: "**Lead channel**",
              },
              {
                title: "CTV",
                valueField: "totalSpend",
                valueLabel: "Spend",
                valueFormat: "currency",
                value: 34300,
                secondaryField: "eventDate",
                secondaryLabel: "Date",
                secondaryValue: "2026-05-02",
              },
            ],
          },
        },
      ],
    },
  }),
);
assert.ok(collectionBlockHtml.includes("Top Channels"));
assert.ok(collectionBlockHtml.includes("Display"));
assert.ok(collectionBlockHtml.includes("CTV"));
assert.ok(collectionBlockHtml.includes("Spend"));
assert.ok(collectionBlockHtml.includes("40,400"));

const invalidCollectionBlockHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Invalid Collection Runtime",
      layoutIntent: {
        blockOrder: ["findings"],
        items: [{ blockId: "findings" }],
      },
      blocks: [{
        id: "findings",
        kind: "collectionBlock",
        title: "Actionable findings",
        datasetRef: "primary",
      }],
      datasets: [{ id: "primary", request: {} }],
    },
    reportFill: {
      diagnostics: [],
      datasets: [{ id: "primary", rows: [], provenance: { diagnostics: [] } }],
      blocks: [{
        id: "findings",
        kind: "collectionBlock",
        title: "Actionable findings",
        datasetRef: "primary",
        content: {
          title: "Actionable findings",
          layout: "grid",
          columns: 2,
          rowCount: 2,
          rowLimit: 2,
          items: [{ title: null }, { title: null }],
        },
      }],
    },
  }),
);
assert.ok(invalidCollectionBlockHtml.includes("does not define a collection title field"));
assert.equal(invalidCollectionBlockHtml.includes("Item 1"), false);

const sectionRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Section Runtime",
      layoutIntent: {
        blockOrder: ["overviewSection", "topChannels", "detailsSection", "statusPills"],
        items: [
          { blockId: "overviewSection" },
          { blockId: "topChannels" },
          { blockId: "detailsSection" },
          { blockId: "statusPills" },
        ],
      },
      blocks: [
        {
          id: "overviewSection",
          kind: "sectionBlock",
          title: "Overview",
          navigationLabel: "Overview",
          subtitle: "Supply outlook",
        },
        {
          id: "topChannels",
          kind: "collectionBlock",
          title: "Top Channels",
          datasetRef: "primary",
          itemTitleField: "channelId",
        },
        {
          id: "detailsSection",
          kind: "sectionBlock",
          title: "Details",
          navigationLabel: "Details",
          description: "Detailed diagnostics and pills.",
        },
        {
          id: "statusPills",
          kind: "badgesBlock",
          title: "Status Pills",
          items: [{ id: "setup", label: "Setup", value: "Live", tone: "success" }],
        },
      ],
      datasets: [{ id: "primary", request: {} }],
    },
    reportFill: {
      diagnostics: [],
      datasets: [{ id: "primary", rows: [], provenance: { diagnostics: [] } }],
      blocks: [
        {
          id: "overviewSection",
          kind: "sectionBlock",
          title: "Overview",
          content: {
            title: "Overview",
            navigationLabel: "Overview",
            subtitle: "Supply outlook",
          },
        },
        {
          id: "topChannels",
          kind: "collectionBlock",
          title: "Top Channels",
          content: {
            title: "Top Channels",
            layout: "grid",
            columns: 2,
            rowCount: 0,
            rowLimit: 2,
            items: [],
            emptyLabel: "No collection items available.",
          },
        },
        {
          id: "detailsSection",
          kind: "sectionBlock",
          title: "Details",
          content: {
            title: "Details",
            navigationLabel: "Details",
            description: "Detailed diagnostics and pills.",
          },
        },
        {
          id: "statusPills",
          kind: "badgesBlock",
          title: "Status Pills",
          content: {
            title: "Status Pills",
            items: [{ id: "setup", label: "Setup", value: "Live", tone: "success" }],
          },
        },
      ],
    },
  }),
);
assert.ok(sectionRuntimeHtml.includes("Overview"));
assert.ok(sectionRuntimeHtml.includes("Details"));
assert.ok(sectionRuntimeHtml.includes("Supply outlook"));

const stepperRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Stepper Runtime",
      layoutIntent: {
        blockOrder: ["integrationFlow"],
        items: [{ blockId: "integrationFlow" }],
      },
      blocks: [
        {
          id: "integrationFlow",
          kind: "stepperBlock",
          title: "Direct Integration Path",
          description: "Three stages to define a direct path.",
          steps: [
            { id: "step_1", title: "Bid directly", body: "Connect bidding directly to the publisher ad server." },
            { id: "step_2", title: "Uncap QPS", body: "Enable access to the full inventory set." },
          ],
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "integrationFlow",
          kind: "stepperBlock",
          title: "Direct Integration Path",
          content: {
            title: "Direct Integration Path",
            description: "Three stages to define a direct path.",
            steps: [
              { id: "step_1", title: "Bid directly", body: "Connect bidding directly to the publisher ad server." },
              { id: "step_2", title: "Uncap QPS", body: "Enable access to the full inventory set." },
            ],
          },
        },
      ],
    },
  }),
);
assert.ok(stepperRuntimeHtml.includes("Direct Integration Path"));
assert.ok(stepperRuntimeHtml.includes("Bid directly"));
assert.ok(stepperRuntimeHtml.includes("Uncap QPS"));

const infoPanelRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Info Panel Runtime",
      layoutIntent: {
        blockOrder: ["directIntro"],
        items: [{ blockId: "directIntro" }],
      },
      blocks: [
        {
          id: "directIntro",
          kind: "infoPanelBlock",
          title: "What is a Direct Integration Path?",
          eyebrow: "What is it?",
          description: "Explains the direct path concept.",
          tone: "info",
          body: "A direct integration connects bidding directly into the publisher ad server.",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "directIntro",
          kind: "infoPanelBlock",
          title: "What is a Direct Integration Path?",
          content: {
            title: "What is a Direct Integration Path?",
            eyebrow: "What is it?",
            description: "Explains the direct path concept.",
            tone: "info",
            body: "A direct integration connects bidding directly into the publisher ad server.",
          },
        },
      ],
    },
  }),
);
assert.ok(infoPanelRuntimeHtml.includes("What is it?"));
assert.ok(infoPanelRuntimeHtml.includes("What is a Direct Integration Path?"));
assert.ok(infoPanelRuntimeHtml.includes("Explains the direct path concept."));

const kanbanRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Kanban Runtime",
      layoutIntent: {
        blockOrder: ["publisherPipeline"],
        items: [{ blockId: "publisherPipeline" }],
      },
      blocks: [
        {
          id: "publisherPipeline",
          kind: "kanbanBlock",
          title: "Publisher Pipeline",
          description: "Track publisher activations by stage.",
          columns: [
            {
              id: "signed",
              title: "Signed",
              cards: [
                { id: "tubi", title: "Tubi", body: "SpringServe integration live.", badge: "Live" },
              ],
            },
          ],
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "publisherPipeline",
          kind: "kanbanBlock",
          title: "Publisher Pipeline",
          content: {
            title: "Publisher Pipeline",
            description: "Track publisher activations by stage.",
            columns: [
              {
                id: "signed",
                title: "Signed",
                cards: [
                  { id: "tubi", title: "Tubi", body: "SpringServe integration live.", badge: "Live" },
                ],
              },
            ],
          },
        },
      ],
    },
  }),
);
assert.ok(kanbanRuntimeHtml.includes("Publisher Pipeline"));
assert.ok(kanbanRuntimeHtml.includes("Signed"));
assert.ok(kanbanRuntimeHtml.includes("Tubi"));

const timelineRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Timeline Runtime",
      layoutIntent: {
        blockOrder: ["integrationTimeline"],
        items: [{ blockId: "integrationTimeline" }],
      },
      blocks: [
        {
          id: "integrationTimeline",
          kind: "timelineBlock",
          title: "Integration Timeline",
          description: "Track the rollout milestones.",
          events: [
            { id: "event_1", date: "2026-07-15", badge: "Target", title: "Roku signed", body: "Expected signature date." },
          ],
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "integrationTimeline",
          kind: "timelineBlock",
          title: "Integration Timeline",
          content: {
            title: "Integration Timeline",
            description: "Track the rollout milestones.",
            events: [
              { id: "event_1", date: "2026-07-15", badge: "Target", title: "Roku signed", body: "Expected signature date." },
            ],
          },
        },
      ],
    },
  }),
);
assert.ok(timelineRuntimeHtml.includes("Integration Timeline"));
assert.ok(timelineRuntimeHtml.includes("2026-07-15"));
assert.ok(timelineRuntimeHtml.includes("Roku signed"));

const zeroBadgeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Zero Badge Runtime",
      layoutIntent: {
        blockOrder: ["statusPills"],
        items: [{ blockId: "statusPills" }],
      },
      blocks: [
        {
          id: "statusPills",
          kind: "badgesBlock",
          title: "Status Pills",
          items: [
            { id: "quota", label: "Quota", value: 0, tone: "warning" },
            { id: "active", label: "Active", value: false, tone: "info" },
          ],
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "statusPills",
          kind: "badgesBlock",
          title: "Status Pills",
          content: {
            title: "Status Pills",
            items: [
              { id: "quota", label: "Quota", value: 0, tone: "warning" },
              { id: "active", label: "Active", value: false, tone: "info" },
            ],
          },
        },
      ],
    },
  }),
);
assert.ok(zeroBadgeHtml.includes("Quota: 0"));
assert.ok(zeroBadgeHtml.includes("Active: false"));

const dedupedMarkdownHeadingHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Markdown Runtime",
      layoutIntent: {
        blockOrder: ["posture"],
        items: [{ blockId: "posture" }],
      },
      blocks: [
        {
          id: "posture",
          kind: "markdownBlock",
          title: "Posture",
          markdown: "## Posture\nCompact summary text.",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "posture",
          kind: "markdownBlock",
          title: "Posture",
          content: {
            title: "Posture",
            markdown: "## Posture\nCompact summary text.",
          },
        },
      ],
    },
  }),
);
assert.equal((dedupedMarkdownHeadingHtml.match(/>Posture</g) || []).length, 1);
assert.ok(dedupedMarkdownHeadingHtml.includes("Compact summary text."));

const bindingOnlyHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Binding Fallback Runtime",
      layoutIntent: {
        blockOrder: [],
        items: [],
      },
      blocks: [],
      datasets: [],
      scope: {
        params: [
          {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
            value: {
              start: "2026-05-01",
              end: "2026-05-07",
            },
          },
        ],
      },
      binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["available_impressions", "household_uniques"],
      },
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(bindingOnlyHtml.includes("Model model://example/performance/delivery@v1"));
assert.ok(bindingOnlyHtml.includes("Entity line_delivery"));
assert.ok(bindingOnlyHtml.includes("Semantic Binding"));
assert.ok(bindingOnlyHtml.includes("Selected dimensions (2)"));
assert.ok(bindingOnlyHtml.includes("Selected measures (2)"));
assert.ok(bindingOnlyHtml.includes("Dimensions event_date, channel"));
assert.ok(bindingOnlyHtml.includes("Measures available_impressions, household_uniques"));
assert.ok(bindingOnlyHtml.includes("Filters"));
assert.ok(bindingOnlyHtml.includes("Reporting Window"));
assert.ok(bindingOnlyHtml.includes("2026-05-01 to 2026-05-07"));

const emptySummaryBindingFallbackHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Binding Summary Fallback Runtime",
      layoutIntent: {
        blockOrder: [],
        items: [],
      },
      blocks: [],
      datasets: [],
      binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["available_impressions", "household_uniques"],
      },
      semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [],
        selectedMeasures: [],
      },
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(emptySummaryBindingFallbackHtml.includes("Model Ad Delivery"));
assert.ok(emptySummaryBindingFallbackHtml.includes("Entity Line Delivery"));
assert.ok(emptySummaryBindingFallbackHtml.includes("Dimensions event_date, channel"));
assert.ok(emptySummaryBindingFallbackHtml.includes("Measures available_impressions, household_uniques"));

const mixedSummaryBindingFallbackHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Binding Mixed Fallback Runtime",
      layoutIntent: {
        blockOrder: [],
        items: [],
      },
      blocks: [],
      datasets: [],
      binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["available_impressions", "household_uniques"],
      },
      semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
          {
            id: "channel",
            rawId: "channelV2",
            label: "Channel",
            governance: {
              status: "deprecated",
            },
          },
        ],
        selectedMeasures: [],
      },
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(mixedSummaryBindingFallbackHtml.includes("Model Ad Delivery"));
assert.ok(mixedSummaryBindingFallbackHtml.includes("Entity Line Delivery"));
assert.ok(mixedSummaryBindingFallbackHtml.includes("Dimensions Channel"));
assert.ok(mixedSummaryBindingFallbackHtml.includes("Measures available_impressions, household_uniques"));
assert.ok(mixedSummaryBindingFallbackHtml.includes("1 deprecated"));

const mixedMeasureSummaryBindingFallbackHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Binding Mixed Measure Fallback Runtime",
      layoutIntent: {
        blockOrder: [],
        items: [],
      },
      blocks: [],
      datasets: [],
      binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["available_impressions", "household_uniques"],
      },
      semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [],
        selectedMeasures: [
          {
            id: "available_impressions",
            rawId: "avails",
            label: "Available Impressions",
            governance: {
              status: "draft",
            },
          },
        ],
      },
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(mixedMeasureSummaryBindingFallbackHtml.includes("Model Ad Delivery"));
assert.ok(mixedMeasureSummaryBindingFallbackHtml.includes("Entity Line Delivery"));
assert.ok(mixedMeasureSummaryBindingFallbackHtml.includes("Dimensions event_date, channel"));
assert.ok(mixedMeasureSummaryBindingFallbackHtml.includes("Measures Available Impressions"));
assert.ok(mixedMeasureSummaryBindingFallbackHtml.includes("1 draft"));

const overflowBindingHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Binding Overflow Runtime",
      layoutIntent: {
        blockOrder: [],
        items: [],
      },
      blocks: [],
      datasets: [],
      binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel", "country_code"],
        selectedMeasures: ["available_impressions", "household_uniques", "reach_rate"],
      },
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(overflowBindingHtml.includes("Dimensions event_date, channel +1"));
assert.ok(overflowBindingHtml.includes("Measures available_impressions, household_uniques +1"));

const overflowSemanticSummaryHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Semantic Summary Overflow Runtime",
      layoutIntent: {
        blockOrder: [],
        items: [],
      },
      blocks: [],
      datasets: [],
      semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
          {
            id: "event_date",
            rawId: "eventDate",
            label: "Delivery Date",
          },
          {
            id: "channel",
            rawId: "channelV2",
            label: "Channel",
            governance: {
              status: "deprecated",
            },
          },
          {
            id: "country_code",
            rawId: "country",
            label: "Market",
            governance: {
              status: "deprecated",
            },
          },
        ],
        selectedMeasures: [
          {
            id: "available_impressions",
            rawId: "avails",
            label: "Available Impressions",
          },
          {
            id: "household_uniques",
            rawId: "hhUniqs",
            label: "Household Uniques",
          },
          {
            id: "reach_rate",
            rawId: "reachRate",
            label: "Reach Rate",
            governance: {
              status: "draft",
            },
          },
        ],
      },
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(overflowSemanticSummaryHtml.includes("Model Ad Delivery"));
assert.ok(overflowSemanticSummaryHtml.includes("Entity Line Delivery"));
assert.ok(overflowSemanticSummaryHtml.includes("Dimensions Delivery Date, Channel +1"));
assert.ok(overflowSemanticSummaryHtml.includes("Measures Available Impressions, Household Uniques +1"));
assert.ok(overflowSemanticSummaryHtml.includes("2 deprecated"));
assert.ok(overflowSemanticSummaryHtml.includes("1 draft"));

const overflowSemanticSummaryPlusTwoHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Semantic Summary Overflow Plus Two Runtime",
      layoutIntent: {
        blockOrder: [],
        items: [],
      },
      blocks: [],
      datasets: [],
      semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
          {
            id: "event_date",
            rawId: "eventDate",
            label: "Delivery Date",
          },
          {
            id: "channel",
            rawId: "channelV2",
            label: "Channel",
            governance: {
              status: "deprecated",
            },
          },
          {
            id: "country_code",
            rawId: "country",
            label: "Market",
            governance: {
              status: "deprecated",
            },
          },
          {
            id: "region",
            rawId: "region",
            label: "Region",
          },
        ],
        selectedMeasures: [
          {
            id: "available_impressions",
            rawId: "avails",
            label: "Available Impressions",
          },
          {
            id: "household_uniques",
            rawId: "hhUniqs",
            label: "Household Uniques",
          },
          {
            id: "reach_rate",
            rawId: "reachRate",
            label: "Reach Rate",
            governance: {
              status: "draft",
            },
          },
          {
            id: "reach_share",
            rawId: "reachShare",
            label: "Reach Share",
          },
        ],
      },
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(overflowSemanticSummaryPlusTwoHtml.includes("Model Ad Delivery"));
assert.ok(overflowSemanticSummaryPlusTwoHtml.includes("Entity Line Delivery"));
assert.ok(overflowSemanticSummaryPlusTwoHtml.includes("Dimensions Delivery Date, Channel +2"));
assert.ok(overflowSemanticSummaryPlusTwoHtml.includes("Measures Available Impressions, Household Uniques +2"));
assert.ok(overflowSemanticSummaryPlusTwoHtml.includes("2 deprecated"));
assert.ok(overflowSemanticSummaryPlusTwoHtml.includes("1 draft"));

const scopeFilterHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Scope Runtime Report",
      layoutIntent: {
        blockOrder: ["sharedFilters"],
        items: [{ blockId: "sharedFilters" }],
      },
      scope: {
        dataSourceRef: "demoReportSource",
        params: [
          {
            id: "dateRange",
            kind: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
            required: true,
            value: {
              start: "2026-05-01",
              end: "2026-05-07",
            },
          },
        ],
      },
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          title: "Filters",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          content: {
            title: "Filters",
            params: [
              {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for semantic preview.",
                value: {
                  start: "2026-05-01",
                  end: "2026-05-07",
                },
              },
            ],
          },
        },
      ],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(scopeFilterHtml.includes("Filters"));
assert.ok(scopeFilterHtml.includes("Reporting Window"));
assert.ok(scopeFilterHtml.includes("2026-05-01 to 2026-05-07"));
assert.ok(scopeFilterHtml.includes("Approved reporting window for semantic preview."));
assert.ok(!scopeFilterHtml.includes("Report Scope"));

const editableScopeFilterHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Editable Filter Runtime",
      layoutIntent: {
        blockOrder: ["sharedFilters"],
        items: [{ blockId: "sharedFilters" }],
      },
      scope: {
        dataSourceRef: "demoReportSource",
        params: [
          {
            id: "dateRange",
            kind: "dateRange",
            type: "dateRange",
            label: "Date Range",
            value: {
              start: "2026-05-01",
              end: "2026-05-07",
            },
          },
          {
            id: "channelIds",
            kind: "multiSelect",
            label: "Channels",
            multiple: true,
            presentation: "compactIconRow",
            options: [
              { value: "Display", label: "Display", icon: "media" },
              { value: "CTV", label: "CTV", icon: "video" },
            ],
            value: ["Display"],
          },
        ],
      },
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          title: "Filters",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          content: {
            title: "Filters",
            params: [
              {
                id: "dateRange",
                type: "dateRange",
                label: "Date Range",
                value: {
                  start: "2026-05-01",
                  end: "2026-05-07",
                },
              },
              {
                id: "channelIds",
                label: "Channels",
                multiple: true,
                presentation: "compactIconRow",
                options: [
                  { value: "Display", label: "Display", icon: "media" },
                  { value: "CTV", label: "CTV", icon: "video" },
                ],
                value: ["Display"],
              },
            ],
          },
        },
      ],
    },
    runtimeHandlers: {
      toggleScopeParamOption() {},
      setScopeParamDate() {},
    },
    title: "Runtime Preview",
  }),
);
assert.ok(editableScopeFilterHtml.includes(">Filters<"));
assert.ok(!editableScopeFilterHtml.includes("Filters (baseline)"));
assert.ok(editableScopeFilterHtml.includes("Change these baseline report filters here."));
assert.ok(editableScopeFilterHtml.includes('type="date"'));
assert.ok(editableScopeFilterHtml.includes("Display"));
assert.ok(editableScopeFilterHtml.includes("CTV"));

const scopedEditableFilterHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Scoped Filter Runtime",
      layoutIntent: {
        blockOrder: ["forecastFilters"],
        items: [{ blockId: "forecastFilters" }],
      },
      blocks: [
        {
          id: "forecastFilters",
          kind: "filterBarBlock",
          title: "Filters",
          datasetRef: "forecast_cube",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "forecastFilters",
          kind: "filterBarBlock",
          datasetRef: "forecast_cube",
          content: {
            title: "Filters",
            params: [
              {
                id: "forecastRegion",
                datasetRef: "forecast_cube",
                label: "Region",
                multiple: true,
                options: [
                  { value: "US/NY", label: "US/NY" },
                  { value: "US/NJ", label: "US/NJ" },
                ],
                value: ["US/NY"],
              },
            ],
          },
        },
      ],
    },
    runtimeHandlers: {
      toggleScopeParamOption() {},
    },
    title: "Runtime Preview",
  }),
);
assert.ok(scopedEditableFilterHtml.includes("Change filters for this block here. These filters apply to this data block only."));

const scopeFilterWithActiveDrillHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Scope Runtime Report With Drill",
      layoutIntent: {
        blockOrder: ["sharedFilters"],
        items: [{ blockId: "sharedFilters" }],
      },
      scope: {
        dataSourceRef: "demoReportSource",
        params: [
          {
            id: "channel",
            kind: "multiSelect",
            label: "Channels",
            value: [],
          },
        ],
      },
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          title: "Filters",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      refinements: [
        {
          id: "drill:channel:publisher",
          op: "drill",
          field: "channel",
          fieldLabel: "Channel",
          values: ["Audio"],
        },
      ],
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          content: {
            title: "Filters",
            params: [
              {
                id: "channel",
                label: "Channels",
                value: [],
              },
            ],
          },
        },
      ],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(scopeFilterWithActiveDrillHtml.includes("Filters (baseline)"));
assert.ok(scopeFilterWithActiveDrillHtml.includes("Channels"));
assert.ok(scopeFilterWithActiveDrillHtml.includes("None"));
assert.ok(scopeFilterWithActiveDrillHtml.includes("Baseline filters compiled from the live builder state. Live keep, exclude, and drill changes appear in Active refinements."));
assert.ok(scopeFilterWithActiveDrillHtml.includes("Active Refinements (1)"));
assert.ok(scopeFilterWithActiveDrillHtml.includes("Drill: Channel = Audio"));
assert.ok(scopeFilterWithActiveDrillHtml.includes('data-report-runtime-active-scope-summary="true"'));

const scopeFilterWithDedicatedRefinementBarHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Scope Runtime Report With Dedicated Refinement Bar",
      layoutIntent: {
        blockOrder: ["sharedFilters", "activeDrillPath"],
        items: [{ blockId: "sharedFilters" }, { blockId: "activeDrillPath" }],
      },
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          title: "Filters",
        },
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          title: "Active Drill Path",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      refinements: [
        {
          id: "drill:channel:publisher",
          op: "drill",
          field: "channel",
          fieldLabel: "Channel",
          values: ["Audio"],
        },
      ],
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          content: {
            title: "Filters",
            params: [
              {
                id: "channel",
                label: "Channels",
                value: [],
              },
            ],
          },
        },
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          content: {
            title: "Active Drill Path",
            refinements: [
              {
                id: "drill:channel:publisher",
                op: "drill",
                field: "channel",
                fieldLabel: "Channel",
                values: ["Audio"],
              },
            ],
          },
        },
      ],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(scopeFilterWithDedicatedRefinementBarHtml.includes("Filters (baseline)"));
assert.ok(scopeFilterWithDedicatedRefinementBarHtml.includes("Active Drill Path"));
assert.ok(scopeFilterWithDedicatedRefinementBarHtml.includes("Drill: Channel = Audio"));
assert.ok(scopeFilterWithDedicatedRefinementBarHtml.includes("This session — live keep, exclude, and drill changes layered on top of the baseline scope."));
assert.ok(!scopeFilterWithDedicatedRefinementBarHtml.includes('data-report-runtime-active-scope-summary="true"'));

const scopeFilterWithDedicatedRefinementBarAndAuthoredDrillLabelHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Scope Runtime Report With Authored Drill Label",
      layoutIntent: {
        blockOrder: ["activeDrillPath"],
        items: [{ blockId: "activeDrillPath" }],
      },
      blocks: [
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          title: "Active Drill Path",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      refinements: [],
      blocks: [
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          content: {
            title: "Active Drill Path",
            refinements: [
              {
                id: "drill:channel:publisher",
                op: "drill",
                field: "channel",
                label: "Drill to Publisher: Channel = Audio",
              },
            ],
          },
        },
      ],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(scopeFilterWithDedicatedRefinementBarAndAuthoredDrillLabelHtml.includes("Drill to Publisher: Channel = Audio"));

const scopeFilterWithoutActiveRefinementsHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Scope Runtime Report Without Drill",
      layoutIntent: {
        blockOrder: ["sharedFilters"],
        items: [{ blockId: "sharedFilters" }],
      },
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          title: "Filters",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      refinements: [],
      blocks: [
        {
          id: "sharedFilters",
          kind: "filterBarBlock",
          content: {
            title: "Filters",
            params: [],
          },
        },
      ],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(!scopeFilterWithoutActiveRefinementsHtml.includes("Active Refinements"));
assert.ok(!scopeFilterWithoutActiveRefinementsHtml.includes('data-report-runtime-active-scope-summary="true"'));

const emptyRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Refinement Runtime Report",
      layoutIntent: {
        blockOrder: ["activeDrillPath"],
        items: [{ blockId: "activeDrillPath" }],
      },
      blocks: [
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          title: "Active Refinements",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          content: {
            title: "Active Refinements",
            emptyLabel: "No active refinements",
            refinements: [],
          },
        },
      ],
    },
    title: "Runtime Preview",
  }),
);
assert.ok(!emptyRuntimeHtml.includes("Active Refinements"));
assert.ok(!emptyRuntimeHtml.includes("No active refinements"));

const unsupportedRefinementHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Unsupported Runtime Report",
      layoutIntent: {
        blockOrder: ["primaryTable"],
        items: [{ blockId: "primaryTable" }],
      },
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: [
            { key: "ageGroup", sourceKey: "ageGroup", displayKey: "ageGroup", label: "Age Group", kind: "dimension" },
          ],
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {
            dimensions: {
              ageGroup: true,
            },
          },
        },
      ],
    },
    reportFill: {
      diagnostics: [
        {
          code: "runtimeRefinementUnsupported",
          severity: "warning",
          message: "Runtime refinement actions are unavailable for Age Group because no backend runtime filter mapping is declared.",
        },
      ],
      datasets: [
        {
          id: "primary",
          rows: [{ ageGroup: "18-24" }],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {
            columns: [
              { key: "ageGroup", sourceKey: "ageGroup", displayKey: "ageGroup", label: "Age Group", kind: "dimension" },
            ],
            resolvedRows: [],
          },
        },
      ],
    },
  }),
);
assert.ok(!unsupportedRefinementHtml.includes("runtimeRefinementUnsupported"));
assert.ok(!unsupportedRefinementHtml.includes("Runtime refinement actions are unavailable for Age Group because no backend runtime filter mapping is declared."));

const emptyTableBlockHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Empty Table Runtime",
      layoutIntent: {
        blockOrder: ["detailTable"],
        items: [{ blockId: "detailTable" }],
      },
      blocks: [
        {
          id: "detailTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: [],
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {},
        },
      ],
    },
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "primary",
          rows: [{ eventDate: "2026-05-01", totalSpend: 1200 }],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "detailTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {
            columns: [],
            resolvedRows: [],
          },
        },
      ],
    },
  }),
);
assert.ok(emptyTableBlockHtml.includes("No table fields selected. Edit this table block in Design to choose at least one field."));

const malformedTableColumnsHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Malformed Table Runtime",
      layoutIntent: {
        blockOrder: ["detailTable"],
        items: [{ blockId: "detailTable" }],
      },
      blocks: [
        {
          id: "detailTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: "not-an-array",
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {},
        },
      ],
    },
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "primary",
          rows: [{ eventDate: "2026-05-01", totalSpend: 1200 }],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "detailTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {},
        },
      ],
    },
  }),
);
assert.ok(malformedTableColumnsHtml.includes("No table fields selected. Edit this table block in Design to choose at least one field."));

const singleDatasetRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Single Dataset Runtime",
      layoutIntent: {
        blockOrder: ["comparisonTable"],
        items: [{ blockId: "comparisonTable" }],
      },
      blocks: [
        {
          id: "comparisonTable",
          kind: "tableBlock",
          columns: [
            { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Date", kind: "dimension" },
            { key: "totalSpend", sourceKey: "totalSpend", displayKey: "totalSpend", label: "Spend", kind: "measure", format: "currency" },
          ],
        },
      ],
      datasets: [
        {
          id: "forecast_summary",
          request: {},
        },
      ],
    },
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "forecast_summary",
          rows: [{ eventDate: "2026-05-01", totalSpend: 1200 }],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "comparisonTable",
          kind: "tableBlock",
          content: {
            columns: [
              { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Date", kind: "dimension" },
              { key: "totalSpend", sourceKey: "totalSpend", displayKey: "totalSpend", label: "Spend", kind: "measure", format: "currency" },
            ],
            resolvedRows: [],
          },
        },
      ],
    },
  }),
);
assert.ok(singleDatasetRuntimeHtml.includes("2026-05-01"));
assert.match(singleDatasetRuntimeHtml, /(1200|1,200|\$1,200)/);

const wideHalfTableHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Wide Half Table Runtime",
      layoutIntent: {
        blockOrder: ["comparisonTable"],
        items: [{ blockId: "comparisonTable", size: "half" }],
      },
      blocks: [
        {
          id: "comparisonTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: [
            { key: "channelId", sourceKey: "channelId", displayKey: "channelId", label: "Channel", kind: "dimension" },
            { key: "totalSpend", sourceKey: "totalSpend", displayKey: "totalSpend", label: "Spend", kind: "measure", format: "currency" },
            { key: "impressions", sourceKey: "impressions", displayKey: "impressions", label: "Impressions", kind: "measure", format: "compactNumber" },
            { key: "ctr", sourceKey: "ctr", displayKey: "ctr", label: "CTR", kind: "measure", format: "percent" },
          ],
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {
            dimensions: {
              channelId: true,
            },
          },
        },
      ],
    },
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "primary",
          rows: [
            { channelId: "CTV", totalSpend: 1200, impressions: 45000, ctr: 2.5 },
          ],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "comparisonTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {
            columns: [
              { key: "channelId", sourceKey: "channelId", displayKey: "channelId", label: "Channel", kind: "dimension" },
              { key: "totalSpend", sourceKey: "totalSpend", displayKey: "totalSpend", label: "Spend", kind: "measure", format: "currency" },
              { key: "impressions", sourceKey: "impressions", displayKey: "impressions", label: "Impressions", kind: "measure", format: "compactNumber" },
              { key: "ctr", sourceKey: "ctr", displayKey: "ctr", label: "CTR", kind: "measure", format: "percent" },
            ],
            resolvedRows: [
              {
                rowIndex: 0,
                cells: [
                  { key: "channelId", sourceKey: "channelId", displayKey: "channelId", value: "CTV", displayValue: "CTV" },
                  { key: "totalSpend", sourceKey: "totalSpend", displayKey: "totalSpend", value: 1200, displayValue: 1200 },
                  { key: "impressions", sourceKey: "impressions", displayKey: "impressions", value: 45000, displayValue: 45000 },
                  { key: "ctr", sourceKey: "ctr", displayKey: "ctr", value: 2.5, displayValue: 2.5 },
                ],
              },
            ],
          },
        },
      ],
    },
  }),
);
assert.ok(wideHalfTableHtml.includes('data-report-runtime-block-id="comparisonTable"'));
assert.ok(wideHalfTableHtml.includes('data-report-runtime-layout-span="12"'));

const previousRuntimeWindow = globalThis.window;
globalThis.window = {
  innerWidth: 800,
  addEventListener() {},
  removeEventListener() {},
};
const mobileNarrativeLayoutHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Mobile Runtime Layout",
      layoutIntent: {
        blockOrder: ["narrativeIntro"],
        items: [{ blockId: "narrativeIntro", span: 5 }],
      },
      blocks: [
        {
          id: "narrativeIntro",
          kind: "markdownBlock",
          title: "Executive Summary",
          markdown: "## Executive Summary\nNarrative body.",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "narrativeIntro",
          kind: "markdownBlock",
          content: {
            markdown: "## Executive Summary\nNarrative body.",
          },
        },
      ],
    },
  }),
);
globalThis.window = previousRuntimeWindow;
assert.ok(mobileNarrativeLayoutHtml.includes('data-report-runtime-layout-columns="1"'));
assert.ok(mobileNarrativeLayoutHtml.includes('data-report-runtime-layout-span="5"'));

const datasetBackedBlockErrorHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Dataset Error Runtime",
      layoutIntent: {
        blockOrder: ["detailTable", "headlineKpi", "primaryChart"],
        items: [{ blockId: "detailTable" }, { blockId: "headlineKpi" }, { blockId: "primaryChart" }],
      },
      blocks: [
        {
          id: "detailTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: [
            { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Date", kind: "dimension" },
            { key: "totalSpend", sourceKey: "totalSpend", displayKey: "totalSpend", label: "Spend", kind: "measure", format: "currency" },
          ],
        },
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          datasetRef: "primary",
          title: "Headline KPI",
          valueField: "totalSpend",
          valueLabel: "Spend",
          emptyLabel: "No KPI value available.",
        },
        {
          id: "primaryChart",
          kind: "chartBlock",
          datasetRef: "primary",
          title: "Chart",
          chartSpec: {
            title: "Chart",
            type: "bar",
            xField: "eventDate",
            yFields: ["totalSpend"],
          },
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {},
        },
      ],
    },
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "primary",
          rows: [],
          provenance: {
            diagnostics: [
              {
                severity: "error",
                message: "The reporting service at http://steward.viantinc.com:5000/mcp did not respond in time. Try again after the service is available.",
              },
            ],
          },
        },
      ],
      blocks: [
        {
          id: "detailTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {
            columns: [
              { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Date", kind: "dimension" },
              { key: "totalSpend", sourceKey: "totalSpend", displayKey: "totalSpend", label: "Spend", kind: "measure", format: "currency" },
            ],
            resolvedRows: [],
          },
        },
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          datasetRef: "primary",
          content: {
            title: "Headline KPI",
            valueField: "totalSpend",
            valueLabel: "Spend",
            value: null,
            rowCount: 0,
            emptyLabel: "No KPI value available.",
          },
        },
        {
          id: "primaryChart",
          kind: "chartBlock",
          datasetRef: "primary",
          content: {
            chartSpec: {
              title: "Chart",
              type: "bar",
              xField: "eventDate",
              yFields: ["totalSpend"],
            },
            chartModel: {
              type: "bar",
              xAxis: { dataKey: "eventDate" },
              yAxis: { format: "currency" },
              series: {
                values: [
                  { value: "totalSpend", label: "Spend", color: "#1f77b4", type: "bar" },
                ],
                palette: ["#1f77b4"],
              },
            },
            rowCount: 0,
            resolvedChart: {
              rows: [],
            },
          },
        },
      ],
    },
  }),
);
assert.ok(datasetBackedBlockErrorHtml.includes("The reporting service at http://steward.viantinc.com:5000/mcp did not respond in time. Try again after the service is available."));
assert.ok(!datasetBackedBlockErrorHtml.includes("No data."));
assert.ok(!datasetBackedBlockErrorHtml.includes("No KPI value available."));
assert.ok(!datasetBackedBlockErrorHtml.includes("No data for the selected period."));
assert.ok(!datasetBackedBlockErrorHtml.includes("runtimePreviewError"));

const chartErrorHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Chart Error Runtime",
      layoutIntent: {
        blockOrder: ["primaryChart"],
        items: [{ blockId: "primaryChart" }],
      },
      blocks: [
        {
          id: "primaryChart",
          kind: "chartBlock",
          datasetRef: "primary",
          chartSpec: {
            title: "Chart",
            xField: "eventDate",
            yFields: ["avails"],
          },
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {
            dimensions: {
              eventDate: true,
            },
          },
        },
      ],
    },
    reportFill: {
      diagnostics: [
        {
          code: "actionProviderFailed",
          severity: "warning",
          blockId: "primaryChart",
          path: "reportRuntime.blocks.primaryChart.actions.eventDate",
          message: "Failed to load refinement actions for Date. Provider offline",
          suggestedFix: "Retry the action provider or continue without runtime refinements for this block.",
        },
        {
          code: "documentBlockChartInvalid",
          severity: "error",
          blockId: "primaryChart",
          path: "reportDocument.blocks.primaryChart.chartSpec.xField",
          message: "Primary Chart is no longer compatible with the current builder selection.",
          suggestedFix: "Edit the chart block to reselect the current breakdowns/measures or restore the missing chart fields in the builder.",
        },
      ],
      datasets: [
        {
          id: "primary",
          rows: [{ eventDate: "2026-05-01", avails: 120000 }],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "primaryChart",
          kind: "chartBlock",
          datasetRef: "primary",
          content: {
            chartSpec: {
              title: "Chart",
              xField: "eventDate",
              yFields: ["avails"],
            },
          },
        },
      ],
    },
  }),
);
assert.equal((chartErrorHtml.match(/Primary Chart is no longer compatible with the current builder selection\./g) || []).length, 2);
assert.equal((chartErrorHtml.match(/Failed to load refinement actions for Date\. Provider offline/g) || []).length, 2);
assert.ok(chartErrorHtml.includes("Edit the chart block to reselect the current breakdowns/measures or restore the missing chart fields in the builder."));
assert.ok(chartErrorHtml.includes("Retry the action provider or continue without runtime refinements for this block."));
assert.equal((chartErrorHtml.match(/Retry action provider/g) || []).length, 2);
assert.ok(chartErrorHtml.includes("Block primaryChart"));
assert.ok(chartErrorHtml.includes("reportDocument.blocks.primaryChart.chartSpec.xField"));

const blockWarningHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Provider Warning Runtime",
      layoutIntent: {
        blockOrder: ["primaryTable"],
        items: [{ blockId: "primaryTable" }],
      },
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: [
            { key: "channelV2", sourceKey: "channelV2", displayKey: "channel.channel", label: "Channel", kind: "dimension" },
          ],
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {
            dimensions: {
              channelV2: true,
            },
          },
        },
      ],
    },
    reportFill: {
      diagnostics: [
        {
          code: "actionProviderFailed",
          severity: "warning",
          blockId: "primaryTable",
          path: "reportRuntime.blocks.primaryTable.actions.channelV2",
          message: "Failed to load refinement actions for Channel. Provider offline",
          suggestedFix: "Retry the action provider or continue without runtime refinements for this block.",
        },
      ],
      datasets: [
        {
          id: "primary",
          rows: [{ channelV2: "Display" }],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {
            columns: [
              { key: "channelV2", sourceKey: "channelV2", displayKey: "channel.channel", label: "Channel", kind: "dimension" },
            ],
            resolvedRows: [{ channelV2: "Display" }],
          },
        },
      ],
    },
  }),
);
assert.equal((blockWarningHtml.match(/Failed to load refinement actions for Channel\. Provider offline/g) || []).length, 2);
assert.ok(blockWarningHtml.includes("Retry the action provider or continue without runtime refinements for this block."));
assert.equal((blockWarningHtml.match(/Retry action provider/g) || []).length, 2);
assert.ok(blockWarningHtml.includes("Block primaryTable"));
assert.ok(blockWarningHtml.includes("reportRuntime.blocks.primaryTable.actions.channelV2"));

const displayValueRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Display Value Runtime",
      layoutIntent: {
        blockOrder: ["primaryTable"],
        items: [{ blockId: "primaryTable" }],
      },
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: [
            { key: "channelId", sourceKey: "channelId", displayKey: "channel.channel", label: "Channel", kind: "dimension" },
            { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", kind: "measure" },
          ],
        },
      ],
      datasets: [{ id: "primary", request: { dimensions: { channelId: true }, measures: { avails: true } } }],
    },
    reportFill: {
      datasets: [
        {
          id: "primary",
          rows: [{ channelId: 1, avails: 120000 }],
          provenance: { diagnostics: [] },
        },
      ],
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {
            columns: [
              { key: "channelId", sourceKey: "channelId", displayKey: "channel.channel", label: "Channel", kind: "dimension" },
              { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", kind: "measure" },
            ],
            resolvedRows: [
              {
                rowIndex: 0,
                cells: [
                  { key: "channelId", sourceKey: "channelId", displayKey: "channel.channel", value: 1, displayValue: "Display" },
                  { key: "avails", sourceKey: "avails", displayKey: "avails", value: 120000, displayValue: 120000 },
                ],
              },
            ],
          },
        },
      ],
    },
  }),
);
assert.ok(displayValueRuntimeHtml.includes("Display"));
assert.ok(!displayValueRuntimeHtml.includes(">1<"));

const geoWarningHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Geo Warning Runtime",
      layoutIntent: {
        blockOrder: ["primaryGeo"],
        items: [{ blockId: "primaryGeo" }],
      },
      blocks: [
        {
          id: "primaryGeo",
          kind: "geoMapBlock",
          title: "Geo Overview",
        },
      ],
      datasets: [],
    },
    reportFill: {
      diagnostics: [
        {
          code: "actionProviderFailed",
          severity: "warning",
          blockId: "primaryGeo",
          path: "reportRuntime.blocks.primaryGeo.actions.country",
          message: "Failed to load refinement actions for Market. Provider offline",
          suggestedFix: "Retry the action provider or continue without runtime refinements for this block.",
        },
      ],
      datasets: [],
      blocks: [
        {
          id: "primaryGeo",
          kind: "geoMapBlock",
          content: {
            geo: {
              shape: "us-states",
              metric: {
                label: "Available Impressions",
              },
            },
            resolvedGeo: {
              shape: "us-states",
              metricLabel: "Available Impressions",
              summary: {
                regionCount: 0,
                totalValue: "0",
                topKey: "-",
              },
              regions: [],
              ranking: [],
            },
          },
        },
      ],
    },
  }),
);
assert.equal((geoWarningHtml.match(/Failed to load refinement actions for Market\. Provider offline/g) || []).length, 2);
assert.ok(geoWarningHtml.includes("Retry the action provider or continue without runtime refinements for this block."));
assert.equal((geoWarningHtml.match(/Retry action provider/g) || []).length, 2);
assert.ok(geoWarningHtml.includes("Block primaryGeo"));
assert.ok(geoWarningHtml.includes("reportRuntime.blocks.primaryGeo.actions.country"));

function collectReactElements(node, predicate, matches = []) {
  if (node == null || typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return matches;
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => {
      collectReactElements(entry, predicate, matches);
    });
    return matches;
  }
  if (!React.isValidElement(node)) {
    return matches;
  }
  if (predicate(node)) {
    matches.push(node);
  }
  collectReactElements(node.props?.children, predicate, matches);
  return matches;
}

const refinementBlock = {
  id: "activeDrillPath",
  kind: "refinementBarBlock",
  content: {
    title: "Active Drill Path",
    actionKinds: ["remove", "clearAll"],
    emptyLabel: "No active market drill path",
    refinements: [
      {
        id: "drill:country:reachRateTrend",
        op: "drill",
        field: "country",
        values: ["US"],
        sourceBlockId: "reachRateTrend",
        label: "Market = US",
      },
      {
        id: "keep:channelV2:reachRateTable",
        op: "keep",
        field: "channelV2",
        values: ["Display"],
        sourceBlockId: "reachRateTable",
        label: "Keep Channel = Display",
      },
    ],
  },
};

const removeCalls = [];
let clearCalls = 0;
let undoCalls = 0;
let redoCalls = 0;
const refinementTree = RefinementBarBlock({
  block: refinementBlock,
  runtimeHandlers: {
    removeRefinement(refinementId) {
      removeCalls.push(refinementId);
    },
    clearRefinements() {
      clearCalls += 1;
    },
    undoRefinements() {
      undoCalls += 1;
    },
    redoRefinements() {
      redoCalls += 1;
    },
    canUndoRefinements: true,
    canRedoRefinements: true,
  },
});
const buttons = collectReactElements(refinementTree, (element) => element.type === "button");

const removeDrillButton = buttons.find((button) => button.props?.["aria-label"] === "Remove refinement Market = US") || null;
assert.ok(removeDrillButton);
removeDrillButton.props.onClick();
assert.deepEqual(removeCalls, ["drill:country:reachRateTrend"]);

const removeKeepButton = buttons.find((button) => button.props?.["aria-label"] === "Remove refinement Keep Channel = Display") || null;
assert.ok(removeKeepButton);
removeKeepButton.props.onClick();
assert.deepEqual(removeCalls, [
  "drill:country:reachRateTrend",
  "keep:channelV2:reachRateTable",
]);

const clearAllButton = buttons.find((button) => button.props?.["aria-label"] === "Clear all refinements") || null;
assert.ok(clearAllButton);
clearAllButton.props.onClick();
assert.equal(clearCalls, 1);

const refinementHtml = renderToStaticMarkup(
  React.createElement(RefinementBarBlock, {
    block: refinementBlock,
    runtimeHandlers: {
      removeRefinement() {},
      clearRefinements() {},
    },
  }),
);
assert.ok(refinementHtml.includes("Market = US"));
assert.ok(refinementHtml.includes("Keep Channel = Display"));
assert.ok(refinementHtml.includes("Clear all"));
assert.ok(refinementHtml.includes("Active Drill Path"));
assert.ok(refinementHtml.includes("This session — live keep, exclude, and drill changes layered on top of the baseline scope."));
assert.ok(!refinementHtml.includes("Generic refinement trail compiled from the authored report contract."));
assert.ok(!refinementHtml.includes(">remove<"));
assert.ok(!refinementHtml.includes(">clearAll<"));

const defaultTitleRefinementHtml = renderToStaticMarkup(
  React.createElement(RefinementBarBlock, {
    block: {
      id: "activeDrillPath",
      kind: "refinementBarBlock",
      content: {
        refinements: refinementBlock.content.refinements,
      },
    },
    runtimeHandlers: {
      removeRefinement() {},
      clearRefinements() {},
    },
  }),
);
assert.ok(defaultTitleRefinementHtml.includes("Active Refinements"));
assert.ok(defaultTitleRefinementHtml.includes("This session — live keep, exclude, and drill changes layered on top of the baseline scope."));

const emptyRefinementHtml = renderToStaticMarkup(
  React.createElement(RefinementBarBlock, {
    block: {
      id: "activeDrillPath",
      kind: "refinementBarBlock",
      content: {
        title: "Active Drill Path",
        actionKinds: ["remove", "clearAll"],
        emptyLabel: "No active market drill path",
        refinements: [],
      },
    },
    runtimeHandlers: {
      removeRefinement() {},
      clearRefinements() {},
    },
  }),
);
assert.equal(emptyRefinementHtml, "");

const fallbackEmptyRefinementHtml = renderToStaticMarkup(
  React.createElement(RefinementBarBlock, {
    block: {
      id: "activeDrillPath",
      kind: "refinementBarBlock",
      content: {
        refinements: [],
      },
    },
    runtimeHandlers: null,
  }),
);
assert.equal(fallbackEmptyRefinementHtml, "");

const fallbackActionTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      title: "Active Drill Path",
      emptyLabel: "No active market drill path",
      refinements: refinementBlock.content.refinements,
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
  },
});
const fallbackActionButtons = collectReactElements(fallbackActionTree, (element) => element.type === "button");
assert.equal(fallbackActionButtons.filter((button) => typeof button.props?.["aria-label"] === "string" && button.props["aria-label"].startsWith("Remove refinement ")).length, 2);
assert.equal(fallbackActionButtons.some((button) => button.props?.["aria-label"] === "Clear all refinements"), true);

const fallbackHistoryTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      title: "Active Drill Path",
      emptyLabel: "No active market drill path",
      refinements: refinementBlock.content.refinements,
    },
  },
  runtimeHandlers: {
    undoRefinements() {
      undoCalls += 1;
    },
    redoRefinements() {
      redoCalls += 1;
    },
    canUndoRefinements: true,
    canRedoRefinements: false,
  },
});
const fallbackHistoryButtons = collectReactElements(fallbackHistoryTree, (element) => element.type === "button");
const fallbackUndoButton = fallbackHistoryButtons.find((button) => button.props?.["aria-label"] === "Undo refinement changes") || null;
assert.ok(fallbackUndoButton);
assert.equal(fallbackUndoButton.props.disabled, false);
const fallbackRedoButton = fallbackHistoryButtons.find((button) => button.props?.["aria-label"] === "Redo refinement changes") || null;
assert.ok(fallbackRedoButton);
assert.equal(fallbackRedoButton.props.disabled, true);

const noHandlerTree = RefinementBarBlock({
  block: refinementBlock,
  runtimeHandlers: null,
});
const noHandlerButtons = collectReactElements(noHandlerTree, (element) => element.type === "button");
assert.equal(noHandlerButtons.length, 0);

const idlessRefinementTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      refinements: [
        {
          op: "keep",
          field: "channelV2",
          values: ["Display"],
          label: "Keep Channel = Display",
        },
      ],
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
  },
});
const idlessButtons = collectReactElements(idlessRefinementTree, (element) => element.type === "button");
assert.equal(idlessButtons.filter((button) => typeof button.props?.["aria-label"] === "string" && button.props["aria-label"].startsWith("Remove refinement ")).length, 0);
assert.equal(idlessButtons.some((button) => button.props?.["aria-label"] === "Clear all refinements"), true);

const clearOnlyTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      actionKinds: ["clearAll"],
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
  },
});
const clearOnlyButtons = collectReactElements(clearOnlyTree, (element) => element.type === "button");
assert.equal(clearOnlyButtons.filter((button) => typeof button.props?.["aria-label"] === "string" && button.props["aria-label"].startsWith("Remove refinement ")).length, 0);
assert.equal(clearOnlyButtons.some((button) => button.props?.["aria-label"] === "Clear all refinements"), true);

const removeOnlyTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      actionKinds: ["remove"],
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
  },
});
const removeOnlyButtons = collectReactElements(removeOnlyTree, (element) => element.type === "button");
assert.equal(removeOnlyButtons.filter((button) => typeof button.props?.["aria-label"] === "string" && button.props["aria-label"].startsWith("Remove refinement ")).length, 2);
assert.equal(removeOnlyButtons.some((button) => button.props?.["aria-label"] === "Clear all refinements"), false);

const disabledActionsTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      actionKinds: [],
    },
  },
  runtimeHandlers: {
    removeRefinement() {},
    clearRefinements() {},
    undoRefinements() {},
    redoRefinements() {},
    canUndoRefinements: true,
    canRedoRefinements: true,
  },
});
const disabledActionButtons = collectReactElements(disabledActionsTree, (element) => element.type === "button");
assert.equal(disabledActionButtons.length, 0);

const historyActionTree = RefinementBarBlock({
  block: {
    ...refinementBlock,
    content: {
      ...refinementBlock.content,
      actionKinds: ["undo", "redo"],
    },
  },
  runtimeHandlers: {
    undoRefinements() {
      undoCalls += 1;
    },
    redoRefinements() {
      redoCalls += 1;
    },
    canUndoRefinements: true,
    canRedoRefinements: false,
  },
});
const historyButtons = collectReactElements(historyActionTree, (element) => element.type === "button");
const undoButton = historyButtons.find((button) => button.props?.["aria-label"] === "Undo refinement changes") || null;
assert.ok(undoButton);
assert.equal(undoButton.props.disabled, false);
undoButton.props.onClick();
assert.equal(undoCalls, 1);

const redoButton = historyButtons.find((button) => button.props?.["aria-label"] === "Redo refinement changes") || null;
assert.ok(redoButton);
assert.equal(redoButton.props.disabled, true);
redoButton.props.onClick();
assert.equal(redoCalls, 0);

const readOnlyImportedRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Imported Runtime Report",
      layoutIntent: {
        blockOrder: ["primaryTable", "primaryChart"],
        items: [{ blockId: "primaryTable" }, { blockId: "primaryChart" }],
      },
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          columns: [
            { key: "channelV2", sourceKey: "channelV2", displayKey: "channelV2", label: "Channel", kind: "dimension" },
            { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", kind: "measure" },
          ],
        },
        {
          id: "primaryChart",
          kind: "chartBlock",
          datasetRef: "primary",
          chartSpec: {
            title: "Channel Trend",
            type: "line",
            xField: "eventDate",
            yFields: ["avails"],
          },
          chartModel: {
            type: "line",
            xAxis: {
              dataKey: "eventDate",
            },
            yAxis: {},
            series: {
              valueKey: "avails",
              values: [{ value: "avails", label: "Avails", type: "line" }],
            },
          },
        },
      ],
      datasets: [
        {
          id: "primary",
          request: {
            dimensions: {
              channelV2: true,
              eventDate: true,
            },
          },
        },
      ],
    },
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "primary",
          rows: [
            { channelV2: "Display", eventDate: "2026-05-01", avails: 120000 },
          ],
          provenance: {
            diagnostics: [],
          },
        },
      ],
      blocks: [
        {
          id: "primaryTable",
          kind: "tableBlock",
          datasetRef: "primary",
          content: {
            columns: [
              { key: "channelV2", sourceKey: "channelV2", displayKey: "channelV2", label: "Channel", kind: "dimension" },
              { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", kind: "measure" },
            ],
            resolvedRows: [
              {
                rowIndex: 0,
                cells: [
                  { key: "channelV2", displayKey: "channelV2", value: "Display", displayValue: "Display" },
                  { key: "avails", displayKey: "avails", value: 120000, displayValue: 120000 },
                ],
              },
            ],
          },
        },
        {
          id: "primaryChart",
          kind: "chartBlock",
          datasetRef: "primary",
          content: {
            chartSpec: {
              title: "Channel Trend",
              type: "line",
              xField: "eventDate",
              yFields: ["avails"],
            },
            chartModel: {
              type: "line",
              xAxis: {
                dataKey: "eventDate",
              },
              yAxis: {},
              series: {
                valueKey: "avails",
                values: [{ value: "avails", label: "Avails", type: "line" }],
              },
            },
          },
        },
      ],
    },
    title: "Imported Runtime Preview",
    runtimeHandlers: null,
  }),
);
assert.ok(readOnlyImportedRuntimeHtml.includes("Chart actions are unavailable because this runtime preview is read-only."));
assert.ok(!readOnlyImportedRuntimeHtml.includes("Click a chart mark to apply authored runtime actions."));
assert.ok(!readOnlyImportedRuntimeHtml.includes(">Actions<"));
assert.ok(!readOnlyImportedRuntimeHtml.includes("Keep Channel"));
assert.ok(!readOnlyImportedRuntimeHtml.includes("Exclude Channel"));

const authoredReportHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec,
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "primary",
          dataSourceRef: "demoSource",
          rows: [
            { eventDate: "2026-05-01", channelId: "Display", avails: 1200 },
            { eventDate: "2026-05-02", channelId: "CTV", avails: 900 },
          ],
        },
      ],
      blocks: [
        {
          id: "trendChart",
          kind: "chartBlock",
          title: "Trend Chart",
          datasetRef: "primary",
          content: {
            chartSpec: {
              title: "Trend Chart",
              type: "line",
              xField: "eventDate",
              yFields: ["avails"],
              seriesField: "channelId",
            },
            chartModel: {
              type: "line",
              xAxis: { dataKey: "eventDate" },
              yAxis: {},
              series: {
                nameKey: "channelId",
                valueKey: "avails",
                values: [{ value: "avails", label: "Avails", type: "line" }],
              },
            },
          },
        },
      ],
    },
    title: "Audience Report",
    presentationMode: "report",
  }),
);
assert.ok(!authoredReportHtml.includes("Semantic Binding"));
assert.ok(!authoredReportHtml.includes("Governed model and field selections compiled into this runtime artifact."));
assert.ok(!authoredReportHtml.includes("Chart actions are unavailable because this runtime preview is read-only."));
assert.ok(!authoredReportHtml.includes('aria-label="Chart series selector"'));
assert.ok(authoredReportHtml.includes("Filters"));
assert.ok(!authoredReportHtml.includes("Baseline filters authored for this report. Live keep, exclude, and drill changes appear in Active refinements."));

const sectionTabsRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Sectioned Runtime Spec",
      layoutIntent: {
        blockOrder: ["overviewSection", "sectionTabs", "summaryMarkdown", "detailsSection", "detailsMarkdown"],
        items: [
          { blockId: "overviewSection" },
          { blockId: "sectionTabs" },
          { blockId: "summaryMarkdown" },
          { blockId: "detailsSection" },
          { blockId: "detailsMarkdown" },
        ],
      },
      blocks: [],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "overviewSection",
          kind: "sectionBlock",
          title: "Overview",
          content: {
            title: "Overview",
            navigationLabel: "Overview",
          },
        },
        {
          id: "sectionTabs",
          kind: "tabGroupBlock",
          title: "Forecast views",
          sectionIds: ["detailsSection", "overviewSection"],
          defaultSectionId: "detailsSection",
          content: {
            title: "Forecast views",
            sectionIds: ["detailsSection", "overviewSection"],
            defaultSectionId: "detailsSection",
            tabs: [
              { id: "detailsSection", title: "Details", navigationLabel: "Details" },
              { id: "overviewSection", title: "Overview", navigationLabel: "Overview" },
            ],
          },
        },
        {
          id: "summaryMarkdown",
          kind: "markdownBlock",
          title: "Summary",
          content: {
            title: "Summary",
            markdown: "Overview content",
          },
        },
        {
          id: "detailsSection",
          kind: "sectionBlock",
          title: "Details",
          content: {
            title: "Details",
            navigationLabel: "Details",
          },
        },
        {
          id: "detailsMarkdown",
          kind: "markdownBlock",
          title: "Details body",
          content: {
            title: "Details body",
            markdown: "Detailed content",
          },
        },
      ],
    },
    title: "Audience Report",
    presentationMode: "report",
  }),
);
assert.ok(sectionTabsRuntimeHtml.includes("Forecast views"));
assert.ok(sectionTabsRuntimeHtml.includes(">Details<"));
assert.ok(sectionTabsRuntimeHtml.includes(">Overview<"));
assert.ok(!sectionTabsRuntimeHtml.includes("Unsupported Block"));

const compositeRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Composite Runtime Spec",
      layoutIntent: {
        blockOrder: ["summaryPanel", "summaryMarkdown", "headlineKpi"],
        items: [
          { blockId: "summaryPanel" },
          { blockId: "summaryMarkdown", span: 6 },
          { blockId: "headlineKpi", span: 6 },
        ],
      },
      blocks: [],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [
        {
          id: "primary",
          dataSourceRef: "demoSource",
          rows: [{ totalSpend: 40400 }],
        },
      ],
      blocks: [
        {
          id: "summaryPanel",
          kind: "compositeBlock",
          title: "Summary panel",
          content: {
            title: "Summary panel",
            description: "Groups the opening narrative and KPI.",
            childBlockIds: ["summaryMarkdown", "headlineKpi"],
          },
        },
        {
          id: "summaryMarkdown",
          kind: "markdownBlock",
          title: "Summary child",
          content: {
            title: "Summary child",
            markdown: "Overview context",
          },
        },
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          title: "Headline child KPI",
          datasetRef: "primary",
          content: {
            title: "Headline child KPI",
            valueField: "totalSpend",
            valueLabel: "Spend",
            value: 40400,
            rowCount: 1,
          },
        },
      ],
    },
    title: "Audience Report",
    presentationMode: "report",
  }),
);
assert.ok(compositeRuntimeHtml.includes("Summary panel"));
assert.ok(compositeRuntimeHtml.includes("Summary child"));
assert.ok(compositeRuntimeHtml.includes("Headline child KPI"));
assert.equal((compositeRuntimeHtml.match(/Summary child/g) || []).length, 1);
assert.equal((compositeRuntimeHtml.match(/Headline child KPI/g) || []).length, 1);
assert.ok(!compositeRuntimeHtml.includes("Unsupported Block"));

const calloutRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Callout Runtime Spec",
      layoutIntent: {
        blockOrder: ["launchCallout"],
        items: [{ blockId: "launchCallout" }],
      },
      blocks: [],
      datasets: [],
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [
        {
          id: "launchCallout",
          kind: "calloutBlock",
          title: "Launch update",
          content: {
            title: "Launch update",
            icon: "warning-sign",
            description: "Important rollout note.",
            tone: "warning",
            badges: ["Executive", "Launch Ready"],
            body: "Publisher activation is staged for Friday.",
          },
        },
      ],
    },
    title: "Audience Report",
    presentationMode: "report",
  }),
);
assert.ok(calloutRuntimeHtml.includes("Launch update"));
assert.ok(calloutRuntimeHtml.includes("Executive"));
assert.ok(calloutRuntimeHtml.includes("Launch Ready"));
assert.ok(calloutRuntimeHtml.includes("Publisher activation is staged for Friday."));

const documentBackedRuntimeHtml = renderToStaticMarkup(
  React.createElement(ReportRuntime, {
    reportSpec: {
      title: "Thin Runtime Spec",
      layoutIntent: {
        blockOrder: [],
        items: [],
      },
      blocks: [],
      datasets: [],
      scope: {
        params: [],
      },
      semanticSummary: {
        kind: "semantic",
        selectedDimensions: [],
        selectedMeasures: [],
      },
    },
    reportDocument: {
      title: "Document Backed Runtime",
      semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/audience/performance@v1",
        modelLabel: "Audience Performance",
        entity: "audience_segment",
        entityLabel: "Audience Segment",
        selectedDimensions: [
          {
            id: "audience_segment",
            rawId: "audienceSegment",
            label: "Audience Segment",
          },
        ],
        selectedMeasures: [
          {
            id: "audience_index",
            rawId: "audienceIndex",
            label: "Audience Index",
          },
        ],
        selectedParameters: [
          {
            id: "reporting_window",
            rawId: "dateRange",
            label: "Reporting Window",
          },
        ],
      },
      scope: {
        params: [
          {
            id: "dateRange",
            label: "Reporting Window",
            description: "Recovered from the embedded runtime document.",
            value: {
              start: "2026-06-01",
              end: "2026-06-07",
            },
          },
        ],
      },
    },
    reportFill: {
      diagnostics: [],
      datasets: [],
      blocks: [],
    },
  }),
);
assert.ok(documentBackedRuntimeHtml.includes("Document Backed Runtime"));
assert.ok(documentBackedRuntimeHtml.includes("Model Audience Performance"));
assert.ok(documentBackedRuntimeHtml.includes("Entity Audience Segment"));
assert.ok(documentBackedRuntimeHtml.includes("Dimensions Audience Segment"));
assert.ok(documentBackedRuntimeHtml.includes("Measures Audience Index"));
assert.ok(documentBackedRuntimeHtml.includes("Parameters Reporting Window"));
assert.ok(documentBackedRuntimeHtml.includes("Recovered from the embedded runtime document."));
assert.ok(documentBackedRuntimeHtml.includes("2026-06-01 to 2026-06-07"));

console.log("ReportRuntime ✓ renders semantic binding chips and actionable runtime diagnostics");
