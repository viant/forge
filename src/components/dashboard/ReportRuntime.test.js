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
assert.ok(html.includes("Shared scope parameters compiled into this runtime artifact."));
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
assert.ok(bindingOnlyHtml.includes("Report Scope"));
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
          title: "Report Scope",
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
            title: "Report Scope",
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
assert.ok(scopeFilterHtml.includes("Report Scope"));
assert.ok(scopeFilterHtml.includes("Reporting Window"));
assert.ok(scopeFilterHtml.includes("2026-05-01 to 2026-05-07"));
assert.ok(scopeFilterHtml.includes("Approved reporting window for semantic preview."));
assert.equal((scopeFilterHtml.match(/Report Scope/g) || []).length, 1);

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
        label: "Drill to Region = US",
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

const removeDrillButton = buttons.find((button) => button.props?.["aria-label"] === "Remove refinement Drill to Region = US") || null;
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
assert.ok(refinementHtml.includes("Drill to Region = US"));
assert.ok(refinementHtml.includes("Keep Channel = Display"));
assert.ok(refinementHtml.includes("Clear all"));
assert.ok(!refinementHtml.includes("Generic refinement trail compiled from the authored report contract."));
assert.ok(!refinementHtml.includes(">remove<"));
assert.ok(!refinementHtml.includes(">clearAll<"));

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
