import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    chartSeriesColor,
    resolveThemeAwareChartColor,
    resolveThemeAwareChartPalette,
    resolveChartTypography,
} from './chartTheme.js';

assert.equal(chartSeriesColor(8, '#123456'), 'var(--forge-chart-series-2, #123456)');
assert.equal(resolveThemeAwareChartColor('#1F77B4'), 'var(--forge-chart-series-1, #1F77B4)');
assert.equal(resolveThemeAwareChartColor('#abcdef'), '#abcdef');
assert.equal(resolveThemeAwareChartColor('#abcdef', 3, {forceRole: true}), 'var(--forge-chart-series-4, #abcdef)');
assert.deepEqual(resolveThemeAwareChartPalette(['#1f77b4', '#ff7f0e']), [
    'var(--forge-chart-series-1, #1f77b4)',
    'var(--forge-chart-series-2, #ff7f0e)',
]);
assert.deepEqual(resolveChartTypography(null), {
    family: 'system-ui, sans-serif',
    captionSize: 11,
    captionLineHeight: 16,
    smallSize: 12,
    smallLineHeight: 18,
});

const chartSource = fs.readFileSync(new URL('./Chart.jsx', import.meta.url), 'utf8');
const chartStyles = fs.readFileSync(new URL('./Chart.css', import.meta.url), 'utf8');

assert.ok(!chartSource.includes('Arial, sans-serif'));
assert.ok(chartSource.includes('--forge-chart-grid'));
assert.ok(chartSource.includes('--forge-type-caption-size'));
assert.ok(chartStyles.includes('--forge-chart-text'));
assert.ok(chartStyles.includes('--forge-type-code-size'));

console.log('chart semantic theme helpers passed');
