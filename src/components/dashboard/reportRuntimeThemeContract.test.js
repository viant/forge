import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('./ReportRuntime.jsx', import.meta.url), 'utf8');
const dashboardStyles = fs.readFileSync(new URL('./Dashboard.css', import.meta.url), 'utf8');
const tabStyles = fs.readFileSync(new URL('../SectionTabRail.css', import.meta.url), 'utf8');
const theme = fs.readFileSync(new URL('../../packs/blueprint/theme.css', import.meta.url), 'utf8');

for (const role of [
    'surface',
    'surface-subtle',
    'border',
    'text',
    'text-secondary',
    'text-muted',
    'action',
    'selected',
    'control-surface',
    'control-border',
    'type-caption-size',
    'type-small-size',
    'type-body-size',
    'type-section-size',
    'type-heading-size',
    'type-title-size',
    'type-metric-size',
    'status-info-background',
    'status-success-background',
    'status-warning-background',
    'status-danger-background',
    'accent-blue',
    'accent-rose',
]) {
    assert.ok(theme.includes(`--forge-report-${role}:`), `missing report runtime role: ${role}`);
}

assert.ok(runtime.includes('forge-report-runtime-panel'));
assert.ok(runtime.includes('var(--forge-report-surface, #ffffff)'));
assert.ok(runtime.includes('var(--forge-report-type-metric-size, 28px)'));
assert.ok(runtime.includes('var(--forge-report-status-danger-foreground, #a82a2a)'));
assert.doesNotMatch(runtime, /fontSize:\s*(?:10|11|12|13|14|15|16|18|24|28)\b/);
assert.doesNotMatch(runtime, /borderLeft:\s*[`"](?:[3-9]|[1-9]\d+)px\s+solid/);

const unthemedRuntimeColorLines = runtime
    .split('\n')
    .filter((line) => /#[0-9a-f]{3,8}\b/i.test(line) && !line.includes('var(--forge-report-'));
assert.deepEqual(unthemedRuntimeColorLines, [], `unthemed report runtime colors:\n${unthemedRuntimeColorLines.join('\n')}`);

assert.ok(dashboardStyles.includes('background: var(--forge-report-canvas, #f3f6f9)'));
assert.ok(dashboardStyles.includes('font-size: var(--forge-report-type-metric-size, 25px)'));
assert.ok(dashboardStyles.includes('var(--forge-report-status-success-background, #e7f7ef)'));
assert.ok(tabStyles.includes('var(--forge-report-text-muted, #486579)'));
assert.ok(tabStyles.includes('var(--forge-report-selected, rgba(47, 109, 225, 0.045))'));
assert.ok(tabStyles.includes('box-shadow: inset 0 -3px 0 var(--forge-tab-active-color, var(--forge-report-action, #215db0))'));

console.log('report runtime semantic theme contract passed');
