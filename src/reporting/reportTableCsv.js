// Use the same authored column order and resolved display values as the native
// ReportFill CSV renderer. Browser pagination is not part of this contract.
const text = value => String(value ?? '').trim();

export function authoredReportCsvTables(reportDocument, reportFill) {
  const authored = (reportDocument?.blocks || []).filter(block => block?.kind === 'tableBlock');
  const filled = new Map((reportFill?.blocks || []).map(block => [block.id, block]));
  const datasets = new Map((reportFill?.datasets || []).map(dataset => [dataset.id, dataset]));
  return authored.map(block => {
    const table = filled.get(block.id);
    const dataset = datasets.get(table?.datasetRef || block.datasetRef || 'primary');
    let unavailable = '';
    if (!table || !Array.isArray(table.content?.resolvedRows) || !table.content?.columns?.length) {
      unavailable = 'The table has not finished loading.';
    } else if (!dataset || dataset.provenance?.hasMore || dataset.provenance?.truncated) {
      unavailable = 'Complete table data is required for export.';
    } else if ([...(table.diagnostics || []), ...(dataset.provenance?.diagnostics || [])]
      .some(diagnostic => diagnostic?.severity === 'error')) {
      unavailable = 'Resolve the table data error before exporting.';
    }
    return {id: block.id, label: text(block.title) || 'Table', table, unavailable};
  });
}

function csvValue(value) {
  if (value == null) return '';
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('The table contains a non-finite value.');
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function escape(value) {
  const result = csvValue(value);
  return /[",\r\n]/.test(result) ? `"${result.replaceAll('"', '""')}"` : result;
}

export function renderReportTableCsv(table) {
  const columns = table?.content?.columns;
  const rows = table?.content?.resolvedRows;
  if (!Array.isArray(columns) || !columns.length || !Array.isArray(rows)) throw new Error('A loaded report table is required.');
  const keys = columns.map(column => text(column.key));
  if (keys.some(key => !key) || new Set(keys).size !== keys.length) throw new Error('The table has ambiguous columns.');
  const lines = [columns.map(column => escape(text(column.label))).join(',')];
  for (const row of rows) {
    const cells = new Map();
    for (const cell of row.cells || []) {
      const key = text(cell.key);
      if (cells.has(key)) throw new Error('The table has ambiguous cells.');
      cells.set(key, cell);
    }
    lines.push(columns.map(column => {
      const cell = cells.get(text(column.key));
      if (!cell) throw new Error(`The table is missing a cell for ${text(column.label) || text(column.key)}.`);
      const value = cell.displayValue;
      if (column.format === 'id' && typeof value === 'number' && !Number.isSafeInteger(value)) {
        throw new Error('An ID cannot be exported without losing precision.');
      }
      return escape(value);
    }).join(','));
  }
  return `${lines.join('\n')}\n`;
}
