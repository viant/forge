import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ReportBuilderRuntimeActionStrip from "./ReportBuilderRuntimeActionStrip.jsx";

const html = renderToStaticMarkup(
  React.createElement(ReportBuilderRuntimeActionStrip, {
    ariaLabel: "Row actions",
    actions: [
      { id: "keep", kind: "keep", label: "Keep Channel" },
      { id: "exclude", kind: "exclude", label: "Exclude Channel" },
      { id: "drill", kind: "drill", label: "Drill to Publisher" },
      { id: "detail", kind: "detail", label: "Show channel details" },
    ],
    onExecute: () => {},
  }),
);

assert.ok(html.includes('role="group"'));
assert.ok(html.includes('aria-label="Row actions"'));
assert.ok(html.includes("forge-dashboard-row-actions--leading"));
assert.ok(html.includes("forge-dashboard-row-action--compact forge-dashboard-row-action--keep"));
assert.ok(html.includes('data-testid="report-runtime-row-action"'));
assert.ok(html.includes('data-action-id="drill"'));
assert.ok(html.includes('forge-dashboard-row-action__label">Keep Channel<'));
assert.ok(html.includes('forge-dashboard-row-action__label">Exclude Channel<'));
assert.ok(html.includes('forge-dashboard-row-action__label">Drill to Publisher<'));
assert.ok(html.includes('forge-dashboard-row-action__label">Channel details<'));
assert.ok(html.includes('forge-dashboard-row-action__sr-label">Show channel details<'));

console.log("ReportBuilderRuntimeActionStrip ✓ renders compact runtime action pills for selected row and chart actions");
