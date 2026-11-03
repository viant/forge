import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {reportFillSchema} from './schema/reportFillSchema.js';
import {validateReportSchema} from './schema/reportSchemaValidator.js';

// Independently invented public fixture shared with the Goja/XLSX regression.
const fixture = JSON.parse(readFileSync(new URL('../../backend/reporting/materializer/testdata/empty-geo-table-report.json', import.meta.url)));
const fill = buildReportFillFromReportSpec(fixture.reportSpec, fixture.datasets);
const geo = fill.blocks[1].content.resolvedGeo;
assert.deepEqual(geo.geometry.features.map(feature => feature.key), ['A', 'B']);
assert.deepEqual(geo.regions.map(region => [region.rawValue, region.rowCount, region.displayValue]), [[null, 0, 'No row'], [null, 0, 'No row']]);
assert.deepEqual(geo.ranking, []);
assert.equal(geo.summary.topKey, '');
assert.equal(JSON.parse(JSON.stringify(geo)).summary.topKey, '');
assert.deepEqual(fill.datasets[1].rows, []);
assert.deepEqual(fill.blocks[0].content.resolvedRows.map(row => row.cells.map(cell => cell.value)), [['Alpha', 7.25], ['Beta', null]]);
assert.deepEqual(validateReportSchema({...reportFillSchema.$defs.resolvedGeo, $defs: reportFillSchema.$defs}, geo).errors, []);
console.log('reportEmptyGeoTable ✓ empty geometry retains null values and an empty top key');
