import assert from "node:assert/strict";

// Independently compare each compiled catalog with the owning authored dataset.
// Check absent bindings too, so a sibling dataset cannot supply a binding.
export function assertFixtureDeclaredRefinementFields({ reportDocument, reportSpec }) {
  for (const block of reportSpec.blocks.filter(block => ["tableBlock", "chartBlock"].includes(block.kind))) {
    const dataset = reportDocument.datasets.find(dataset => dataset.id === block.datasetRef);
    assert.ok(dataset, `owning dataset for ${block.id}`);
    const dimensions = dataset.dimensions || dataset.columnOptions?.filter(field => field.kind === "dimension") || [];
    const references = block.kind === "tableBlock"
      ? block.columns.map(column => column.sourceKey || column.displayKey || column.key)
      : [block.chartSpec?.xField, block.chartSpec?.seriesField, block.chartSpec?.heatmap?.rowField, block.chartSpec?.heatmap?.columnField];
    const authored = reportDocument.blocks.find(authored => authored.id === block.id);
    const explicit = authored?.runtime?.refinementFields;
    if (!dimensions.some(field => field.runtimeFilter) && explicit === undefined) {
      assert.equal(block.runtime?.refinementFields, undefined, block.id);
      continue;
    }
    const expected = [...new Set(references.filter(Boolean))].flatMap(reference => {
      const matches = dimensions.filter(field => [field.id, field.key, field.displayKey].includes(reference));
      if (matches.length !== 1 || !matches[0].runtimeFilter) return [];
      const field = matches[0];
      return [{
        key: field.key || field.id,
        sourceKey: field.key || field.id,
        displayKey: field.displayKey || field.key || field.id,
        label: field.label || field.key || field.id,
        runtimeFilter: field.runtimeFilter,
      }];
    });
    assert.deepEqual(block.runtime?.refinementFields, explicit?.length === 0 ? [] : expected,
      `${reportDocument.id}/${block.id}/${dataset.id}`);
  }
}
