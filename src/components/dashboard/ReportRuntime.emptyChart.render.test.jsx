import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import ReportRuntime from './ReportRuntime.jsx';

const compileWarning = 'does not compile to a runtime chart model';
const noData = 'No data for the selected scope.';
const chartSpec = {type: 'bar', xField: 'eventType', yFields: ['conversions']};

// Reproduces a successful producer completion with zero rows: compilation
// intentionally returned chartModel:null, not a malformed authored chart.
const fixture = () => ({
  reportSpec: {
    title: 'Event performance',
    blocks: [{id: 'eventsChart', kind: 'chartBlock', title: 'Conversions by event', datasetRef: 'events', chartSpec}],
    datasets: [{id: 'events', request: {}}],
  },
  reportFill: {
    diagnostics: [],
    datasets: [{id: 'events', rows: [], provenance: {rowCount: 0, hasMore: false, truncated: false, diagnostics: []}}],
    blocks: [{id: 'eventsChart', kind: 'chartBlock', title: 'Conversions by event', datasetRef: 'events', content: {chartSpec, chartModel: null, rowCount: 0, resolvedChart: null}}],
  },
});
const render = (input) => renderToStaticMarkup(<ReportRuntime {...input} />);

describe('missing chart model states', () => {
  it('keeps the chart panel and presents a successful empty result honestly', () => {
    const html = render(fixture());
    expect(html).toContain('Conversions by event');
    expect(html).toContain('forge-report-runtime-chart-panel');
    expect(html).toContain('forge-report-runtime-chart-empty');
    expect(html).toContain(noData);
    expect(html).not.toContain(compileWarning);
    expect(html).not.toContain('Loading chart');
  });

  it.each(['dataset page', 'section'])('keeps %s loading distinct from completed empty', (source) => {
    const input = fixture();
    if (source === 'dataset page') input.datasetPages = {events: {loading: true}};
    else input.sectionLoading = true;
    const html = render(input);
    expect(html).toContain('Loading chart');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(noData);
    expect(html).not.toContain(compileWarning);
  });

  it('preserves a producer failure even when its returned rows are empty', () => {
    const input = fixture();
    input.reportFill.datasets[0].provenance.diagnostics = [{severity: 'error', code: 'readerFailed', message: 'Reader could not execute.'}];
    const html = render(input);
    expect(html).toContain('Reader could not execute.');
    expect(html).not.toContain(noData);
    expect(html).not.toContain('Loading chart');
  });

  it.each(['error', 'warning'])('preserves authored compile %s diagnostics', (severity) => {
    const input = fixture();
    input.reportFill.diagnostics = [{severity, blockId: 'eventsChart', code: 'documentBlockChartInvalid', message: 'The selected measure is incompatible.'}];
    const html = render(input);
    expect(html).toContain('The selected measure is incompatible.');
    expect(html).not.toContain(noData);
    if (severity === 'warning') expect(html).toContain(compileWarning);
  });

  it('does not mislabel a report-level compile diagnostic as empty data', () => {
    const input = fixture();
    input.reportFill.diagnostics = [{severity: 'error', code: 'compileFailed', message: 'Report compilation failed.'}];
    const html = render(input);
    expect(html).toContain('Report compilation failed.');
    expect(html).toContain(compileWarning);
    expect(html).not.toContain(noData);
  });

  it('retains the compile warning for populated data with no model', () => {
    const input = fixture();
    input.reportFill.datasets[0].rows = [{eventType: 'Invented event', conversions: 0}];
    input.reportFill.datasets[0].provenance.rowCount = 1;
    const html = render(input);
    expect(html).toContain(compileWarning);
    expect(html).not.toContain(noData);
  });

  it.each(['missing dataset', 'missing rows', 'positive source count', 'positive block count', 'resolved chart rows', 'partial result', 'truncated result', 'section error'])('does not classify %s as a successful empty chart', (state) => {
    const input = fixture();
    const dataset = input.reportFill.datasets[0];
    const content = input.reportFill.blocks[0].content;
    if (state === 'missing dataset') input.reportFill.datasets = [];
    if (state === 'missing rows') delete dataset.rows;
    if (state === 'positive source count') dataset.provenance.rowCount = 12;
    if (state === 'positive block count') content.rowCount = 12;
    if (state === 'resolved chart rows') content.resolvedChart = {rows: [{eventType: 'Invented event', conversions: 1}]};
    if (state === 'partial result') dataset.provenance.hasMore = true;
    if (state === 'truncated result') dataset.provenance.truncated = true;
    if (state === 'section error') input.sectionError = 'Section could not refresh.';
    const html = render(input);
    expect(html).toContain(state === 'section error' ? input.sectionError : compileWarning);
    expect(html).not.toContain(noData);
  });
});

it('shows declared pending navigation without rendering missing datasets as completed empty content',()=>{
  const input=fixture();
  input.reportSpec.blocks=[
    {id:'tabs',kind:'tabGroupBlock',sectionIds:['overview'],defaultSectionId:'overview',includeUnlistedSections:false},
    {id:'overview',kind:'sectionBlock',title:'Overview',blockIds:['eventsChart']},
    ...input.reportSpec.blocks,
  ];
  input.sectionNavigation=[{id:'overview',label:'Overview'},{id:'detail',label:'Detail'}];
  input.selectedSectionId='detail';input.sectionLoading=true;
  const html=render(input);
  expect(html).toContain('Overview');expect(html).toContain('Detail');
  expect(html).toContain('Loading section');expect(html).toContain('aria-busy="true"');
  expect(html).not.toContain(noData);expect(html).not.toContain('No data.');
  expect(html).not.toContain('Conversions by event');
});
