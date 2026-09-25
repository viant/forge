import assert from 'node:assert/strict';
import { buildSelectedBlockPreview } from './reportBuilderBlockPreview.js';
import { buildReportBuilderRuntimePreviewModel, buildReportBuilderRuntimePreview } from './reportBuilderRuntimePreview.js';
const model = buildReportBuilderRuntimePreviewModel({
    container: { id: 'preview', dataSourceRef: 'sales' },
    config: { dimensions: [{ id: 'region', key: 'region', label: 'Region' }], measures: [{ id: 'revenue', key: 'revenue', label: 'Revenue' }] },
    state: { selectedDimensions: ['region'], selectedMeasures: ['revenue'], primaryMeasure: 'revenue',
        reportDocumentBlocks: [
            { id: 'group', kind: 'compositeBlock', title: 'Totals', childBlockIds: ['kpi'] },
            { id: 'kpi', kind: 'kpiBlock', title: 'Revenue', valueField: 'revenue' },
            { id: 'table', kind: 'tableBlock', title: 'Regions', columns: [{ key: 'region', label: 'Region' }] },
        ] },
    includePrimaryBlocks: false,
});
const artifact = buildReportBuilderRuntimePreview({ model, rows: [{ region: 'West', revenue: 120 }] });
const selected = buildSelectedBlockPreview({ ...artifact, blockId: 'group' });
assert.deepEqual(selected.reportSpec.blocks.map((block) => block.id).sort(), ['group', 'kpi']);
assert.ok(!selected.reportFill.blocks.some((block) => block.id === 'table'));
const draft = buildSelectedBlockPreview({ ...artifact, blockId: 'table', draft: { id: 'table', kind: 'tableBlock', title: 'Edited regions', columns: [{ key: 'region', label: 'Market' }, { key: 'revenue', label: 'Revenue' }] } });
assert.equal(draft.reportSpec.blocks.length, 1);
assert.equal(draft.reportFill.blocks[0].title, 'Edited regions');
assert.equal(draft.reportFill.blocks[0].content.columns.length, 2);
assert.equal(draft.reportFill.datasets[0].rows[0].revenue, 120);
assert.equal(artifact.reportFill.blocks.find((block) => block.id === 'table').title, 'Regions');
assert.equal(buildSelectedBlockPreview({ ...artifact, blockId: 'missing' }), null);
console.log('reportBuilderBlockPreview ✓ isolates nested blocks and updates drafts using existing results without mutations');
