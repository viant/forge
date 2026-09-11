import assert from "node:assert/strict";

import {
    buildDashboardTableLayout,
    resolveDashboardTableColumnMinWidth,
} from "./dashboardTableLayout.js";

assert.equal(resolveDashboardTableColumnMinWidth({}, 0), 148);
assert.equal(resolveDashboardTableColumnMinWidth({}, 2), 128);
assert.equal(resolveDashboardTableColumnMinWidth({ width: 180 }, 1), 180);
assert.equal(resolveDashboardTableColumnMinWidth({ width: 20 }, 1), 112);

assert.deepEqual(buildDashboardTableLayout([
    { key: "creative", frozen: true },
    { key: "impressions" },
    { key: "spend" },
    { key: "sales" },
]), {
    columnWidths: [148, 128, 128, 128],
    selectionWidth: 0,
    actionsWidth: 0,
    minWidth: 532,
    horizontallyScrollable: true,
});

assert.equal(buildDashboardTableLayout([{ key: "name" }]).minWidth, 240);
assert.equal(buildDashboardTableLayout([{ key: "name" }]).horizontallyScrollable, false);
assert.equal(buildDashboardTableLayout([{ key: "name" }], { multiSelect: true, hasRowActions: true }).minWidth, 490);

console.log("dashboardTableLayout ✓ preserves meaningful column widths and horizontal overflow");
