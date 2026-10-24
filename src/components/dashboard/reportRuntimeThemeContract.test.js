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
assert.ok(tabStyles.includes('border-bottom-color: var(--forge-tab-active-color, var(--forge-report-action, #215db0))'));
assert.ok(tabStyles.includes('box-shadow: none'));

console.log('report runtime semantic theme contract passed');
const documentStyles=fs.readFileSync(new URL('./reportDocument.css',import.meta.url),'utf8');
assert.match(runtime,/normalizeReportViewerSettings\(reportSpec\?\.viewer \?\? reportDocument\?\.viewer\)\?\.appearance === 'document'/);
assert.match(runtime,/tablePresentation:\{variant:'document',recordTitleField:authoredBlock.recordTitleField\}/);
for(const role of ['title','section','body','metadata','metric'])assert.ok(runtime.includes(`typeRole="${role}"`)||runtime.includes(`'${role}'`),`Document report must apply ${role}`);
assert.doesNotMatch(documentStyles,/!important|#[0-9a-f]{3,8}\b|font-size:\s*\d|font-weight:\s*\d|line-height:\s*\d|letter-spacing:\s*[\d.-]/i);

for(const functionName of ['TimelineBlock','GeoMapBlock','BlockDiagnosticsCallout','BlockErrorCallout']) {
    const functionBody=runtime.split(`function ${functionName}(`)[1]?.split('\nfunction ')[0] || '';
    const documentBranch=functionBody.split('if (documentPresentation)')[1]?.split('\n  return (')[0] || '';
    assert.ok(documentBranch,`${functionName} needs its real document branch`);
    assert.doesNotMatch(documentBranch,/fontSize:|fontFamily:|fontWeight:|lineHeight:|letterSpacing:/,`${functionName}: use complete typography roles`);
}

const reviewTable = fs.readFileSync(new URL('./ReviewTable.jsx', import.meta.url),'utf8');
const reviewStyles = fs.readFileSync(new URL('./reviewTable.css', import.meta.url),'utf8');
assert.match(reviewTable,/<DashboardTableContent/);
assert.match(reviewTable,/<Typography typeRole="metadata"/);
assert.match(reviewTable,/<Button variant="secondary"/);
assert.doesNotMatch(reviewTable,/style=|#[0-9a-f]{3,8}\b|fontSize:|fontFamily:/i,'Review composition cannot bypass shared roles');
assert.doesNotMatch(reviewStyles,/#[0-9a-f]{3,8}\b|font-size:|font-family:|(?:padding|gap):\s*\d/i,'Review CSS uses shared spacing and typography');
