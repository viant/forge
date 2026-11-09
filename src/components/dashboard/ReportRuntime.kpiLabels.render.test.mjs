import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import ReportRuntime from './ReportRuntime.jsx';
import {kpiWidthReport} from '../../demos/theme/KpiWidthSpecimen.jsx';

// Invented metric metadata exercises the existing browser visibility contract.
for (const appearance of ['dashboard', 'document']) {
  for (const presentationMode of ['card', 'both', 'body']) {
    for (const valueLabel of ['Capacity', 'cApAcItY', 'Available']) {
      const block = {id: 'metric', kind: 'kpiBlock', title: 'Capacity', content: {
        valueLabel, value: 42, rowCount: 1, presentationMode,
        sparkline: {values: [1, null, 3], labels: ['A', 'B', 'C']},
      }};
      const html = renderToStaticMarkup(React.createElement(ReportRuntime, {
        reportSpec: {title: 'Summary', viewer: appearance === 'document' ? {appearance} : undefined, blocks: [block]},
        reportFill: {blocks: [block], datasets: [], diagnostics: []},
      }));
      const document = new JSDOM(html).window.document;
      const metric = document.querySelector(appearance === 'document'
        ? '.forge-report-document-metric' : '.forge-report-runtime-kpi-panel');
      assert.ok(metric);
      if (presentationMode !== 'body') {
        const visible = metric.cloneNode(true);
        visible.querySelectorAll('svg').forEach(node => node.remove());
        assert.equal(visible.textContent.split(valueLabel).length - 1,
          valueLabel === 'Capacity' ? 1 : valueLabel === 'Available' ? 1 : 0);
        assert.ok(metric.textContent.includes('42'));
        assert.equal(metric.querySelector('svg[role="img"]').getAttribute('aria-label'),
          'Capacity trend over the selected period');
        if (appearance === 'document') {
          assert.equal(metric.querySelector('dt').textContent, 'Capacity');
          assert.equal(metric.querySelector('dd').textContent, '42');
        }
      } else {
        assert.ok(metric.textContent.includes(`${valueLabel}: 42`));
        assert.equal(metric.querySelector('svg[role="img"]'), null);
      }
    }
  }
}
console.log('KPI labels preserve browser headings, document dt/dd values, and body fallbacks.');

// The real materialized KPI path preserves producer formatting at narrow widths.
for (const appearance of ['dashboard', 'document']) {
  const reportSpec = {...kpiWidthReport, viewer: appearance === 'document' ? {appearance} : undefined};
  const html = renderToStaticMarkup(React.createElement(ReportRuntime, {
    reportSpec, reportFill: {blocks: kpiWidthReport.blocks, datasets: [], diagnostics: []},
  }));
  const document = new JSDOM(html).window.document;
  const cards = document.querySelectorAll(appearance === 'document'
    ? '.forge-report-document-metric' : '.forge-report-runtime-kpi-panel');
  assert.equal(cards.length, 6);
  for (const [index, value] of ['2,847,391', '$58,264.93', '17,203.64829', '-$938,264.57', '-18,364.28579%'].entries()) {
    assert.ok(cards[index].textContent.includes(value), `${appearance}: complete ${value}`);
  }
  assert.ok(cards[0].textContent.includes('+3498672.15%'));
  assert.ok(cards[3].textContent.includes('-3498672.15%'));
  assert.ok(cards[4].textContent.includes('0.00%'));
  assert.ok(cards[2].textContent.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
  assert.ok(cards[5].textContent.includes('No measurement is available for this selected interval.'));
}
console.log('KPI cards preserve complete precision, signs, currency, percentages, long titles and unavailable copy.');
