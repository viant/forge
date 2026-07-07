import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import DashboardTableContent from "./DashboardTableContent.jsx";

function createContext(rows = []) {
  return {
    signals: {
      collection: { value: rows },
      control: { value: { loading: false, error: null } },
      selection: { value: null },
    },
    identity: {
      dataSourceRef: "demoSource",
    },
  };
}

const rows = [
  {
    channelId: "Display",
    channel: { channel: "Display" },
    avails: 120000,
  },
];

const columns = [
  { key: "channelId", sourceKey: "channelId", displayKey: "channel.channel", label: "Channel" },
  { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", align: "right" },
];

const rowActions = [
  { id: "keep_channel", kind: "keep", label: "Keep Channel" },
  { id: "exclude_channel", kind: "exclude", label: "Exclude Channel" },
  { id: "drill_publisher", kind: "drill", label: "Drill to Publisher" },
  { id: "detail_channel", kind: "detail", label: "Show channel details" },
];

const defaultHtml = renderToStaticMarkup(
  React.createElement(DashboardTableContent, {
    container: {
      id: "comparisonTable",
      dashboard: {
        table: {
          columns,
          rowActions,
        },
      },
    },
    context: createContext(rows),
  }),
);

assert.ok(defaultHtml.includes("forge-dashboard-row-actions forge-dashboard-row-actions--compact"));
assert.ok(defaultHtml.includes('forge-dashboard-table__actions-head-icon'));
assert.ok(defaultHtml.includes('forge-dashboard-row-action__label">Channel details<'));
assert.ok(!defaultHtml.includes('forge-dashboard-row-action__label">Show channel details<'));

const compactHtml = renderToStaticMarkup(
  React.createElement(DashboardTableContent, {
    container: {
      id: "comparisonTable",
      dashboard: {
        table: {
          columns,
          rowActionDisplay: "compact",
          rowActions,
        },
      },
    },
    context: createContext(rows),
  }),
);

assert.ok(compactHtml.includes("forge-dashboard-row-actions forge-dashboard-row-actions--compact"));
assert.ok(compactHtml.includes("forge-dashboard-row-action forge-dashboard-row-action--compact forge-dashboard-row-action--keep"));
assert.ok(compactHtml.includes('aria-label="Show channel details"'));
assert.ok(compactHtml.includes('data-testid="report-runtime-row-action"'));
assert.ok(compactHtml.includes('data-action-id="drill_publisher"'));
assert.ok(compactHtml.includes('forge-dashboard-row-action__label">Channel details<'));
assert.ok(compactHtml.includes('forge-dashboard-row-action__sr-label">Show channel details<'));
assert.ok(compactHtml.includes('forge-dashboard-row-action__label">Drill to Publisher<'));
assert.ok(compactHtml.includes('forge-dashboard-row-action__label">Keep Channel<'));
assert.ok(compactHtml.includes('forge-dashboard-row-action__label">Exclude Channel<'));

const fullHtml = renderToStaticMarkup(
  React.createElement(DashboardTableContent, {
    container: {
      id: "comparisonTable",
      dashboard: {
        table: {
          columns,
          rowActionDisplay: "full",
          rowActions,
        },
      },
    },
    context: createContext(rows),
  }),
);

assert.ok(fullHtml.includes('forge-dashboard-row-action__label">Show channel details<'));
assert.ok(fullHtml.includes('forge-dashboard-row-action__label">Drill to Publisher<'));
assert.ok(!fullHtml.includes("forge-dashboard-row-actions--compact"));

console.log("DashboardTableContentVisual ✓ renders compact runtime action chips with short visible labels and full hidden labels");
