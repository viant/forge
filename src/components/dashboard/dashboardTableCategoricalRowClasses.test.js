import assert from "node:assert/strict";

import { categoricalRowClassNames } from "./DashboardTableContent.jsx";

assert.deepEqual(categoricalRowClassNames(
  { spoPathStatus: "Preferred - Primary", exchangeName: "Example" },
  [{ key: "spoPathStatus" }, { key: "exchangeName" }],
), ["forge-table-row--spo-path-status--preferred-primary"]);

assert.deepEqual(categoricalRowClassNames(
  { publisherScope: "Multi-Publisher" },
  [{ key: "publisherScope" }],
), ["forge-table-row--publisher-scope--multi-publisher"]);

console.log("dashboardTableCategoricalRowClasses ✓");
