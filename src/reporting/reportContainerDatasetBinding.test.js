import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeReportBuilderDocumentBlocks, lowerReportDocumentToReportSpec } from './reportDocumentModel.js';
import { buildReportFillFromReportSpec } from './reportFillModel.js';
import { buildReportPrintFromReportFill } from './reportPrintModel.js';
import { isReportRuntimeBlockVisible } from './reportBlockRuntimeModel.js';
import { reportSpecSchema, reportFillSchema } from './schema/reportSchemas.js';
import { validateReportSchema } from './schema/reportSchemaValidator.js';

const condition = { source: 'metrics', field: 'studyCount', equals: 1 };
const authored = [
  { id: 'section', kind: 'sectionBlock', title: 'Question section', datasetRef: ' studyScope ', runtime: { visibleWhen: condition }, blockIds: ['group'] },
  { id: 'group', kind: 'compositeBlock', title: 'Question panel', datasetRef: ' studyScope ', runtime: { visibleWhen: condition }, childBlockIds: ['metric'] },
  { id: 'metric', kind: 'kpiBlock', title: 'Impressions', datasetRef: 'primary', valueField: 'impressions', valueLabel: 'Impressions' },
];
const blocks = normalizeReportBuilderDocumentBlocks(authored);

for (const kind of ['sectionBlock', 'compositeBlock']) {
  test(`${kind} preserves explicit dataset binding through source normalization and lowering`, () => {
    const block = blocks.find(entry => entry.kind === kind);
    assert.equal(block.datasetRef, 'studyScope');
    assert.deepEqual(block.runtime.visibleWhen, condition);
    assert.equal(reportSpecSchema.$defs[kind].properties.datasetRef.type, 'string');
    assert.equal(reportFillSchema.$defs[kind].properties.datasetRef.type, 'string');
    assert.deepEqual(validateReportSchema({ ...reportSpecSchema.$defs[kind], $defs: reportSpecSchema.$defs }, block), { valid: true, errors: [] });
    const lowered = lowerReportDocumentToReportSpec({ id: 'report', title: 'Bound report', blocks: [
      { id: 'builder', kind: 'reportBuilderBlock', source: { containerId: 'report', stateKey: 'report', dataSourceRef: 'approved' },
        config: { measures: [{ id: 'impressions', key: 'impressions', default: true }], dimensions: [], result: {} }, state: {} },
      ...authored,
    ] }, { includePrimaryBlocks: false });
    assert.equal(lowered.blocks.find(entry => entry.kind === kind).datasetRef, 'studyScope');
    assert.equal(normalizeReportBuilderDocumentBlocks([{ ...authored.find(entry => entry.kind === kind), datasetRef: ' ' }])[0].datasetRef, undefined,
      'omitted/blank binding retains the existing primary-dataset fallback');
  });
}

for (const count of [0, 1, 2]) {
  test(`runtime and print use bound container metrics for study count ${count}`, () => {
    const spec = { version: 1, kind: 'reportSpec', title: 'Bound containers',
      source: { kind: 'report', containerId: 'report', stateKey: 'report', dataSourceRef: 'approved' },
      parameters: { viewMode: 'table', groupBy: '', pageSize: 25, orderField: '', orderDir: 'asc' },
      layoutIntent: { kind: 'stack', resultPanePosition: 'bottom', blockOrder: blocks.map(block => block.id), items: [] },
      refinements: [], calculatedFields: [], datasets: [{ id: 'primary', dataSourceRef: 'approved', request: {} }, { id: 'studyScope', dataSourceRef: 'approved', request: {} }], blocks };
    const fill = buildReportFillFromReportSpec(spec, { primary: { rows: [{ impressions: 1900, studyCount: 99 }] }, studyScope: { rows: [{ studyCount: count }] } });
    for (const kind of ['sectionBlock', 'compositeBlock']) {
      const block = fill.blocks.find(entry => entry.kind === kind);
      assert.equal(block.datasetRef, 'studyScope');
      assert.deepEqual(validateReportSchema({ ...reportFillSchema.$defs[kind], $defs: reportFillSchema.$defs }, block), { valid: true, errors: [] });
      const dataset = fill.datasets.find(entry => entry.id === block.datasetRef);
      assert.equal(isReportRuntimeBlockVisible(block, { metrics: dataset.rows[0] }), count === 1);
    }
    const print = buildReportPrintFromReportFill({ reportSpec: spec, reportFill: fill });
    const elements = print.pages.flatMap(page => page.elements);
    assert.equal(elements.some(element => element.id === 'metric__card'), count === 1,
      'children render only when their bound composite condition is satisfied');
    assert.equal(elements.some(element => element.id === 'section__title_0'), count === 1);
  });
}
