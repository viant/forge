function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildMarketBriefTemplate() {
  return {
    id: "market_brief",
    label: "Market Brief",
    description: "Market-first authored report starter with scope, narrative, and KPI context.",
    statePatch: {
      selectedDimensions: ["country"],
      selectedMeasures: ["avails", "hhUniqs"],
      primaryMeasure: "avails",
      viewMode: "chart",
      chartSpec: {
        title: "Market Coverage",
        type: "horizontal_bar",
        xField: "country",
        yFields: ["avails"],
      },
      orderField: "avails",
      orderDir: "desc",
      staticFilters: {
        dateRange: { start: "2026-05-01", end: "2026-05-03" },
        channelsFilter: ["Display"],
      },
    },
    documentPatch: {
      title: "Market Brief",
      subtitle: "Q2 Coverage",
      description: "Template-seeded authored market brief.",
      blocks: [
        {
          id: "scopeFilters",
          kind: "filterBarBlock",
          title: "Scope",
          paramIds: ["dateRange", "channelsFilter"],
        },
        {
          id: "narrativeIntro",
          kind: "markdownBlock",
          title: "Executive Summary",
          markdown: "## Executive Summary\nTemplate-authored market context.",
        },
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          title: "Headline KPI",
          datasetRef: "primary",
          valueField: "avails",
          valueLabel: "Avails",
          secondaryField: "country",
          secondaryLabel: "Country",
          description: "Highlights the leading market result.",
          emptyLabel: "No headline KPI value available.",
        },
      ],
      layout: {
        type: "stack",
        items: [
          { blockId: "scopeFilters" },
          { blockId: "primaryBuilder" },
          { blockId: "narrativeIntro" },
          { blockId: "headlineKpi" },
        ],
      },
    },
  };
}

function buildMarketEfficiencyBriefTemplate() {
  return {
    id: "market_efficiency_brief",
    label: "Market Efficiency Brief",
    description: "Market-first authored starter with derived chart, table, and KPI blocks.",
    statePatch: {
      selectedDimensions: ["country"],
      selectedMeasures: ["avails"],
      primaryMeasure: "avails",
      viewMode: "chart",
      chartSpec: {
        title: "Market Coverage",
        type: "horizontal_bar",
        xField: "country",
        yFields: ["avails"],
      },
      orderField: "avails",
      orderDir: "desc",
      staticFilters: {
        dateRange: { start: "2026-05-01", end: "2026-05-03" },
      },
    },
    documentPatch: {
      title: "Market Efficiency Brief",
      subtitle: "Q2 Efficiency",
      description: "Template-seeded authored report starter with derived chart, table, and KPI context.",
      blocks: [
        {
          id: "scopeFilters",
          kind: "filterBarBlock",
          title: "Scope",
          paramIds: ["dateRange"],
        },
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          title: "Active Drill Path",
          actionKinds: ["remove", "clearAll"],
          emptyLabel: "No active market drill path",
        },
        {
          id: "reachRateTrend",
          kind: "chartBlock",
          title: "Reach Rate by Market",
          datasetRef: "primary",
          chartSpec: {
            title: "Reach Rate by Market",
            type: "line",
            xField: "country",
            yFields: ["reachRate"],
            seriesField: "channelV2",
          },
        },
        {
          id: "narrativeIntro",
          kind: "markdownBlock",
          title: "Efficiency Summary",
          markdown: "## Efficiency Summary\nReach Rate is authored directly into chart, table, and KPI blocks without selecting it in the base builder state.",
        },
        {
          id: "reachRateTable",
          kind: "tableBlock",
          title: "Reach Rate Table",
          datasetRef: "primary",
          columns: [
            { key: "country", label: "Market" },
            { key: "channelV2", label: "Channel" },
            { key: "reachRate", label: "Reach Rate", format: "percent" },
          ],
        },
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          title: "Reach Rate KPI",
          datasetRef: "primary",
          valueField: "reachRate",
          valueLabel: "Reach Rate",
          secondaryField: "country",
          secondaryLabel: "Country",
          description: "Highlights the leading market reach rate without selecting the derived field in the base builder state.",
          emptyLabel: "No reach rate KPI value available.",
        },
      ],
      layout: {
        type: "stack",
        items: [
          { blockId: "scopeFilters" },
          { blockId: "activeDrillPath" },
          { blockId: "primaryBuilder" },
          { blockId: "reachRateTrend" },
          { blockId: "narrativeIntro", size: "half" },
          { blockId: "reachRateTable", size: "half" },
          { blockId: "headlineKpi" },
        ],
      },
    },
  };
}

function buildForecastInventoryBriefTemplate() {
  return {
    id: "forecast_inventory_brief",
    label: "Forecast Inventory Brief",
    description: "Forecast-first authored starter aligned with Channel -> Publisher -> Site Type drill ladders.",
    statePatch: {
      selectedDimensions: ["channelV2"],
      selectedMeasures: ["avails", "hhUniqs", "reachRate"],
      primaryMeasure: "avails",
      viewMode: "table",
      chartSpec: {
        title: "Inventory by Channel",
        type: "horizontal_bar",
        xField: "channelV2",
        yFields: ["avails"],
      },
      orderField: "avails",
      orderDir: "desc",
      pageSize: 12,
      staticFilters: {
        dateRange: { start: "2026-05-01", end: "2026-05-04" },
      },
    },
    documentPatch: {
      title: "Forecast Inventory Brief",
      subtitle: "Q2 Channel Ladder",
      description: "Forecast-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
      blocks: [
        {
          id: "scopeFilters",
          kind: "filterBarBlock",
          title: "Scope",
          paramIds: ["dateRange", "channelsFilter"],
        },
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          title: "Active Drill Path",
          actionKinds: ["remove", "clearAll"],
          emptyLabel: "No active inventory drill path",
        },
        {
          id: "narrativeIntro",
          kind: "markdownBlock",
          title: "Inventory Outlook",
          markdown: "## Inventory Outlook\nStart at Channel, then drill deeper through Publisher and Site Type.",
        },
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          title: "Top Channel KPI",
          datasetRef: "primary",
          valueField: "avails",
          valueLabel: "Avails",
          secondaryField: "channelV2",
          secondaryLabel: "Channel",
          description: "Highlights the leading channel row before drilling deeper.",
          emptyLabel: "No inventory KPI value available.",
        },
      ],
      layout: {
        type: "stack",
        items: [
          { blockId: "scopeFilters" },
          { blockId: "activeDrillPath" },
          { blockId: "primaryBuilder" },
          { blockId: "narrativeIntro", size: "half" },
          { blockId: "headlineKpi", size: "half" },
        ],
      },
    },
  };
}

function buildForecastLocationBriefTemplate() {
  return {
    id: "forecast_location_brief",
    label: "Forecast Location Brief",
    description: "Forecast-first authored starter aligned with Market -> Region -> Metro Area drill ladders.",
    statePatch: {
      selectedDimensions: ["country"],
      selectedMeasures: ["avails", "hhUniqs", "reachRate"],
      primaryMeasure: "avails",
      viewMode: "table",
      chartSpec: {
        title: "Inventory by Market",
        type: "horizontal_bar",
        xField: "country",
        yFields: ["avails"],
      },
      orderField: "avails",
      orderDir: "desc",
      pageSize: 12,
      staticFilters: {
        dateRange: { start: "2026-05-01", end: "2026-05-04" },
      },
    },
    documentPatch: {
      title: "Forecast Location Brief",
      subtitle: "Q2 Market Ladder",
      description: "Forecast-first authored report starter seeded for Market -> Region -> Metro Area drill flows.",
      blocks: [
        {
          id: "scopeFilters",
          kind: "filterBarBlock",
          title: "Scope",
          paramIds: ["dateRange"],
        },
        {
          id: "activeDrillPath",
          kind: "refinementBarBlock",
          title: "Active Drill Path",
          actionKinds: ["remove", "clearAll"],
          emptyLabel: "No active location drill path",
        },
        {
          id: "narrativeIntro",
          kind: "markdownBlock",
          title: "Location Outlook",
          markdown: "## Location Outlook\nStart at Market, then drill deeper through Region and Metro Area.",
        },
        {
          id: "headlineKpi",
          kind: "kpiBlock",
          title: "Top Market KPI",
          datasetRef: "primary",
          valueField: "avails",
          valueLabel: "Avails",
          secondaryField: "country",
          secondaryLabel: "Market",
          description: "Highlights the leading market row before drilling deeper.",
          emptyLabel: "No location KPI value available.",
        },
      ],
      layout: {
        type: "stack",
        items: [
          { blockId: "scopeFilters" },
          { blockId: "activeDrillPath" },
          { blockId: "primaryBuilder" },
          { blockId: "narrativeIntro", size: "half" },
          { blockId: "headlineKpi", size: "half" },
        ],
      },
    },
  };
}

export function buildPreviewReportDocumentTemplates() {
  return cloneValue([
    buildMarketBriefTemplate(),
    buildMarketEfficiencyBriefTemplate(),
    buildForecastInventoryBriefTemplate(),
    buildForecastLocationBriefTemplate(),
  ]);
}
