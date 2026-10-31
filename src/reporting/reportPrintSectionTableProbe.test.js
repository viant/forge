import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildReportSpecHash} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';

// Independently authored neutral layouts. Digests retain the complete output of
// the original full-table section probe, including later column bands/pages.
const baseline = {
  narrow: 'da0ada449a3e4ec72ff9949479256672a75ca8402c391765ef7f3e0ff1cf42c6',
  bands: '2c5b5e116721fb5c70df6c5a38661e0f0d778300267c965a642beba1691538cb',
  empty: '1bba4e00a73a762a4dd606c7190227268e6befc31cd25a05fb79a7cddee13abc',
  wrapped: 'b751ca32545e1de89e75cea24e4f7c735dd07f2e1dc4f35ef8258759b8274a59',
};
for (const variant of ['narrow', 'bands', 'empty', 'wrapped']) {
  const count = variant === 'empty' ? 0 : 90;
  const columnCount = variant === 'bands' ? 12 : 3;
  const columns = Array.from({length: columnCount}, (_, i) => ({key: `field_${i}`, label: variant === 'wrapped' ? `Detailed measurement ${i} with a wrapped column heading` : `Measurement ${i}`}));
  const rows = Array.from({length: count}, (_, rowIndex) => ({rowIndex, cells: columns.map((column, i) => ({key: column.key, value: variant === 'wrapped' && rowIndex === 0 ? 'Extended first row evidence '.repeat(9) : `Observation ${rowIndex + 1}, measurement ${i + 1}`}))}));
  const blocks = [
    {id: 'preface', kind: 'markdownBlock', title: 'Introduction', content: {markdown: 'Introductory context.\n\n'.repeat(12)}},
    {id: 'section', kind: 'sectionBlock', title: 'Evidence'},
    {id: 'table', kind: 'tableBlock', title: 'Measurements', content: {columns, resolvedRows: rows}},
  ];
  const source = {kind: 'reportBuilder', containerId: 'section-table', stateKey: 'section-table', dataSourceRef: 'primary'};
  const reportSpec = {version: 1, kind: 'reportSpec', title: 'Section table regression', source, blocks, layoutIntent: {blockOrder: blocks.map(block => block.id)}};
  const reportFill = {version: 1, kind: 'reportFill', specVersion: 1, specHash: buildReportSpecHash(reportSpec), source, blocks, datasets: []};
  const fixture = {reportSpec, reportFill};
  const before = JSON.stringify(fixture);
  const print = buildReportPrintFromReportFill(fixture);
  assert.ok(print);
  assert.equal(JSON.stringify(fixture), before);
  const cells = print.pages.flatMap(page => page.elements).filter(element => element.kind === 'tableCellText');
  for (let row = 1; row <= count; row += 1) {
    for (const column of columns) {
      assert.ok(cells.some(cell => cell.rowKey === `row_${row}` && cell.columnKey === column.key),
        `${variant}: retain row ${row}, column ${column.key}`);
    }
  }
  const digest = createHash('sha256').update(JSON.stringify(print)).digest('hex');
  assert.equal(digest, baseline[variant], `${variant}: complete pagination/element output must stay identical`);
}
