import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./Chart.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./Chart.css', import.meta.url), 'utf8');

assert.doesNotMatch(source, /@blueprintjs\/table|<BpTable|<BpColumn/);
assert.match(source, /className="forge-chart-table"/);
assert.match(source, /chartTableColumnMeta[\s\S]*label:\s*xAxis\?\.label \|\| 'Date'/);
assert.match(source, /formatChartTableCell[\s\S]*formatChartXAxisValue/);
assert.match(source, /Intl\.NumberFormat\('en-US',[\s\S]*currency/);
assert.match(source, /isAnimationActive:\s*chart\?\.animate === true/);
assert.match(source, /value:\s*embedded \? "" : \(xAxis\.label \|\| ""\)/);
assert.match(styles, /\.forge-chart-table th[\s\S]*position:\s*sticky/);

console.log('chart table contract ✓ semantic formatted table and stable chart labels');
