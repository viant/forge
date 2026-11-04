import assert from "node:assert/strict";

import {
    buildDashboardTableLayout,
    resolveDashboardTableColumnMinWidth,
} from "./dashboardTableLayout.js";
import {normalizeReportTableBlockColumn} from '../../reporting/tableVisualSpec.js';
import {withFrozenIdentifierColumn} from './tableFrozenIdentifier.js';

assert.equal(resolveDashboardTableColumnMinWidth({}, 0), 148);
assert.equal(resolveDashboardTableColumnMinWidth({}, 2), 128);
assert.equal(resolveDashboardTableColumnMinWidth({ width: 180 }, 1), 180);
assert.equal(resolveDashboardTableColumnMinWidth({ width: 20 }, 1), 112);
for (const width of [48, 52, 76, 111, 112, 180, 320]) {
    const column = normalizeReportTableBlockColumn({key: 'count', label: 'Count', width});
    assert.equal(resolveDashboardTableColumnMinWidth({...column, resolvedCompactWidth: 148}, 0), width);
}
assert.equal(resolveDashboardTableColumnMinWidth({width: 52.4}, 1), 52);
assert.equal(resolveDashboardTableColumnMinWidth({width: 600}, 1), 320);
assert.equal(resolveDashboardTableColumnMinWidth({width: 47.9, resolvedCompactWidth: 148}, 1), 112);
for (const width of [undefined, null, '', 'invalid', 0, -1, Infinity]) {
    assert.equal(resolveDashboardTableColumnMinWidth({width}, 1), 128);
    assert.equal(resolveDashboardTableColumnMinWidth({width, resolvedCompactWidth: 76}, 1), 112);
}
assert.equal(resolveDashboardTableColumnMinWidth({resolvedCompactWidth: 148}, 1), 148);
assert.equal(resolveDashboardTableColumnMinWidth({resolvedCompactWidth: 600}, 1), 320);
assert.equal(resolveDashboardTableColumnMinWidth({frozen: true}, 2), 148);

// The real legacy table decorates authored report columns before layout.
const narrowColumns = withFrozenIdentifierColumn([
    {key: 'name', label: 'A complete descriptive record label', width: 148},
    {key: 'count', label: 'Count', width: 48},
    {key: 'rate', label: 'Rate', width: 52},
    {key: 'rank', label: 'Rank', width: 48},
].map(normalizeReportTableBlockColumn));
assert.deepEqual(buildDashboardTableLayout(narrowColumns), {
    columnWidths: [148, 48, 52, 48], selectionWidth: 0, actionsWidth: 0,
    minWidth: 296, horizontallyScrollable: true,
});

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
