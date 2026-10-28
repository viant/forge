import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';

// Independently authored neutral collection fixture; no application data.
const fixture = JSON.parse(fs.readFileSync(new URL('../../doc/examples/legend-conversion-preview.json', import.meta.url), 'utf8'));
const fill = buildReportFillFromReportSpec(fixture.reportSpec, fixture.datasets);
const render = () => buildReportPrintFromReportFill({reportSpec: fixture.reportSpec, reportFill: fill}).pages.flatMap(page => page.elements);
const titles = render().filter(element => element.kind === 'text' && /__card_.*__title_/.test(element.id));
assert.ok(titles.length >= 2);
for (const title of titles) assert.equal(title.color, '#101828', 'collection labels must not inherit pale border colors');
for (const block of fill.blocks) for (const item of block.content?.items ?? []) item.textColor = '#24613a';
const authored = render().filter(element => element.kind === 'text' && /__card_.*__title_/.test(element.id));
for (const title of authored) assert.equal(title.color, '#24613a', 'explicit authored text color remains authoritative');
console.log('Collection print headings use readable default text color and preserve authored color.');
