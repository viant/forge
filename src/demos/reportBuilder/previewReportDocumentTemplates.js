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
          presentationMode: "both",
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

function buildMarketOperationsBriefTemplate() {
  return {
    id: "market_operations_brief",
    label: "Market Operations Brief",
    description: "Market-first authored starter that showcases richer sectioned, narrative, and workflow primitives.",
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
      title: "Market Operations Brief",
      subtitle: "Q2 Narrative + Workflow",
      description: "Template-seeded authored report starter that highlights the newer report builder primitives.",
      blocks: [
        {
          id: "scopeFilters",
          kind: "filterBarBlock",
          title: "Scope",
          paramIds: ["dateRange", "channelsFilter"],
        },
        {
          id: "sectionTabs",
          kind: "tabGroupBlock",
          title: "Report Sections",
          sectionIds: ["overviewSection", "executionSection"],
          defaultSectionId: "overviewSection",
        },
        {
          id: "overviewSection",
          kind: "sectionBlock",
          title: "Overview",
          subtitle: "Executive summary and market snapshot",
          navigationLabel: "Overview",
          description: "Summarizes the current market view with richer authored narrative blocks.",
        },
        {
          id: "summaryComposite",
          kind: "compositeBlock",
          title: "Executive Snapshot",
          description: "Bundles the context panel, status callout, and market collection into one opening panel.",
          childBlockIds: ["contextPanel", "statusCallout", "marketSnapshot"],
        },
        {
          id: "contextPanel",
          kind: "infoPanelBlock",
          title: "What changed?",
          eyebrow: "Context",
          description: "Reader-facing setup for the current market view.",
          tone: "info",
          bodyFormat: "markdown",
          body: "Coverage remains concentrated in the leading market while channel mix stays stable enough to compare execution paths.",
        },
        {
          id: "statusCallout",
          kind: "calloutBlock",
          title: "Attention point",
          icon: "warning-sign",
          description: "Operator handoff note for the next planning cycle.",
          tone: "warning",
          badges: ["Executive", "Action needed"],
          bodyFormat: "markdown",
          body: "Review the trailing market before scaling the next regional activation wave.",
        },
        {
          id: "marketSnapshot",
          kind: "collectionBlock",
          title: "Top Markets",
          datasetRef: "primary",
          itemTitleField: "country",
          itemTitleLabel: "Market",
          valueField: "avails",
          valueLabel: "Avails",
          valueFormat: "compactNumber",
          layout: "grid",
          columns: 2,
          rowLimit: 3,
          bodyTemplate: "**HH Uniques:** ${fmt.compact(row.hhUniqs)}",
          emptyLabel: "No market snapshot rows available.",
        },
        {
          id: "executionSection",
          kind: "sectionBlock",
          title: "Execution",
          subtitle: "Workflow, operations, and milestones",
          navigationLabel: "Execution",
          description: "Captures delivery sequencing and current work-in-progress.",
        },
        {
          id: "deliveryFlow",
          kind: "stepperBlock",
          title: "Delivery Flow",
          description: "Three checkpoints for moving from summary to action.",
          steps: [
            {
              id: "flow_scope",
              title: "Confirm scope",
              body: "Validate the active date range and market focus before escalating changes.",
            },
            {
              id: "flow_mix",
              title: "Review mix",
              body: "Compare the lead market against supporting channels and households.",
            },
            {
              id: "flow_action",
              title: "Assign action",
              body: "Escalate the lagging market and track the next activation milestone.",
            },
          ],
        },
        {
          id: "activationBoard",
          kind: "kanbanBlock",
          title: "Activation Board",
          description: "Shows how current work is moving across operational stages.",
          columns: [
            {
              id: "planned",
              title: "Planned",
              cards: [
                { id: "ca_followup", title: "CA follow-up", body: "Review saturation and confirm next audience expansion.", badge: "Queued" },
              ],
            },
            {
              id: "active",
              title: "Active",
              cards: [
                { id: "us_mix", title: "US mix review", body: "Validate the leading market mix before the next handoff.", badge: "In progress" },
              ],
            },
          ],
        },
        {
          id: "milestoneTimeline",
          kind: "timelineBlock",
          title: "Milestones",
          description: "Pins the immediate checkpoints that matter for the next review.",
          events: [
            {
              id: "milestone_review",
              date: "2026-05-04",
              badge: "Review",
              title: "Market review complete",
              body: "Confirm the updated market snapshot and publish the next summary.",
            },
            {
              id: "milestone_rollout",
              date: "2026-05-05",
              badge: "Rollout",
              title: "Activation handoff",
              body: "Move the approved market actions into the next delivery cycle.",
            },
          ],
        },
      ],
      layout: {
        type: "stack",
        items: [
          { blockId: "scopeFilters" },
          { blockId: "sectionTabs" },
          { blockId: "overviewSection" },
          { blockId: "summaryComposite" },
          { blockId: "primaryBuilder" },
          { blockId: "executionSection" },
          { blockId: "deliveryFlow", size: "half" },
          { blockId: "activationBoard", size: "half" },
          { blockId: "milestoneTimeline" },
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

function buildCapacityInventoryBriefTemplate() {
  return {
    id: "capacity_inventory_brief",
    label: "Capacity Inventory Brief",
    description: "Capacity-first authored starter aligned with Channel -> Publisher -> Site Type drill ladders.",
    statePatch: {
      selectedDimensions: ["channelV2"],
      selectedMeasures: ["avails", "hhUniqs"],
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
      title: "Capacity Inventory Brief",
      subtitle: "Q2 Channel Ladder",
      description: "Capacity-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
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

function buildForecastCountryDashboardBriefTemplate() {
  return {
    id: "forecast_country_dashboard_brief",
    label: "Forecast Country Dashboard Brief",
    description: "Mixed authored starter that pairs the current forecast scope with a country snapshot dataset.",
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
      title: "Forecast Country Dashboard Brief",
      subtitle: "Q2 Country Snapshot",
      description: "Template-seeded authored dashboard that combines the primary forecast view with a country snapshot dataset.",
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
          title: "Country Summary",
          markdown: "## Country Summary\nCompare the current forecast scope with a country-level snapshot of avails and household uniques.",
        },
        {
          id: "primaryHeadline",
          kind: "kpiBlock",
          title: "Primary Headline",
          datasetRef: "primary",
          valueField: "avails",
          valueLabel: "Avails",
          secondaryField: "channelV2",
          secondaryLabel: "Channel",
          description: "Highlights the leading primary-scope channel before comparing country mix.",
          emptyLabel: "No primary KPI value available.",
        },
        {
          id: "countrySnapshotChart",
          kind: "chartBlock",
          title: "Country Avails Snapshot",
          datasetRef: "forecast_country_snapshot",
          chartSpec: {
            title: "Country Avails Snapshot",
            type: "horizontal_bar",
            xField: "country",
            yFields: ["avails"],
          },
        },
        {
          id: "countrySnapshotKpi",
          kind: "kpiBlock",
          title: "Country Snapshot KPI",
          datasetRef: "forecast_country_snapshot",
          valueField: "avails",
          valueLabel: "Avails",
          secondaryField: "country",
          secondaryLabel: "Country",
          description: "Highlights the leading country row from the snapshot dataset.",
          emptyLabel: "No country snapshot KPI value available.",
        },
        {
          id: "countrySnapshotTable",
          kind: "tableBlock",
          title: "Country Snapshot Table",
          datasetRef: "forecast_country_snapshot",
          columns: [
            { key: "country", label: "Country" },
            { key: "avails", label: "Avails", format: "compactNumber" },
            { key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
          ],
        },
      ],
      layout: {
        type: "stack",
        items: [
          { blockId: "scopeFilters" },
          { blockId: "primaryBuilder" },
          { blockId: "narrativeIntro" },
          { blockId: "primaryHeadline", size: "half" },
          { blockId: "countrySnapshotKpi", size: "half" },
          { blockId: "countrySnapshotChart" },
          { blockId: "countrySnapshotTable" },
        ],
      },
    },
  };
}

function buildCapacityLocationBriefTemplate() {
  return {
    id: "capacity_location_brief",
    label: "Capacity Location Brief",
    description: "Capacity-first authored starter aligned with Market -> Region -> Metro Area drill ladders.",
    statePatch: {
      selectedDimensions: ["country"],
      selectedMeasures: ["avails", "hhUniqs"],
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
      title: "Capacity Location Brief",
      subtitle: "Q2 Market Ladder",
      description: "Capacity-first authored report starter seeded for Market -> Region -> Metro Area drill flows.",
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
    buildMarketOperationsBriefTemplate(),
    buildCapacityInventoryBriefTemplate(),
    buildCapacityLocationBriefTemplate(),
    buildForecastInventoryBriefTemplate(),
    buildForecastLocationBriefTemplate(),
    buildForecastCountryDashboardBriefTemplate(),
  ]);
}
