import assert from "node:assert/strict";

import { resolveDashboardRowActionPresentation } from "./dashboardRowActionPresentation.js";

assert.deepEqual(resolveDashboardRowActionPresentation({ kind: "keep" }), {
  kind: "keep",
  icon: "tick",
  className: "forge-dashboard-row-action--keep",
  shortLabel: "Keep",
});

assert.deepEqual(resolveDashboardRowActionPresentation({ kind: "exclude" }), {
  kind: "exclude",
  icon: "small-cross",
  className: "forge-dashboard-row-action--exclude",
  shortLabel: "Exclude",
});

assert.deepEqual(resolveDashboardRowActionPresentation({ kind: "drill", label: "Drill to Publisher" }), {
  kind: "drill",
  icon: "arrow-right",
  className: "forge-dashboard-row-action--drill",
  shortLabel: "Publisher",
});

assert.deepEqual(resolveDashboardRowActionPresentation({ kind: "detail", label: "Show channel details" }), {
  kind: "detail",
  icon: "eye-open",
  className: "forge-dashboard-row-action--detail",
  shortLabel: "Channel",
});

assert.deepEqual(resolveDashboardRowActionPresentation({ kind: "other", label: "Open action" }), {
  kind: "other",
  icon: "more",
  className: "",
  shortLabel: "Open action",
});

console.log("DashboardTableContentRowActions ✓ maps authored runtime action kinds to styled dashboard pill variants");
