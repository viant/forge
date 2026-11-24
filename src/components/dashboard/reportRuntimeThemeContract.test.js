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
assert.match(runtime, /var\(--forge-report-surface(?:\s*,|\))/);
assert.ok(runtime.includes('forge-report-runtime-kpi-value'));
assert.match(runtime, /var\(--forge-report-status-danger-foreground(?:\s*,|\))/);
assert.doesNotMatch(runtime, /fontSize:\s*(?:\d|\.\d)/);
assert.doesNotMatch(runtime, /borderLeft:\s*[`"](?:[3-9]|[1-9]\d+)px\s+solid/);

const unthemedRuntimeColorLines = runtime
    .split('\n')
    .filter((line) => /#[0-9a-f]{3,8}\b/i.test(line) && !line.includes('var(--forge-report-'));
assert.deepEqual(unthemedRuntimeColorLines, [], `unthemed report runtime colors:\n${unthemedRuntimeColorLines.join('\n')}`);

assert.match(dashboardStyles, /background:\s*var\(--forge-report-canvas(?:\s*,|\))/);
assert.match(dashboardStyles, /font\-size:\s*var\(--forge-report-type-metric-size(?:\s*,|\))/);
assert.match(dashboardStyles, /var\(--forge-report-status-success-background(?:\s*,|\))/);
assert.match(tabStyles, /var\(--forge-report-text-muted(?:\s*,|\))/);
assert.match(tabStyles, /var\(--forge-report-selected(?:\s*,|\))/);
assert.match(tabStyles, /border\-bottom\-color:\s*var\(--forge-tab-active-color(?:\s*,|\))/);

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
