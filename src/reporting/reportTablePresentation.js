import {resolveTableLink} from '../utils/tableLink.js';
import {buildRuntimeTableRows} from './reportRuntimeTableRows.js';
import {compareDashboardTableValues} from '../components/dashboard/dashboardTableSort.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fields = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
const cellValue = cell => own(cell || {}, 'displayValue') ? cell.displayValue : cell?.value;

// Presentation changes only table rows. Datasets, chart totals, authored columns
// and the report's authorization inputs remain those of the trusted execution.
export function applyReportTablePresentations(reportFill, presentations = null) {
  if (presentations == null) return reportFill;
  if (!object(presentations) || Object.keys(presentations).length > 128) throw Error('Invalid report table presentation map.');
  const blocks = new Map((reportFill?.blocks || []).map(block => [block.id, block]));
  const replacements = new Map();
  for (const [id, state] of Object.entries(presentations)) {
    const block = blocks.get(id);
    if (!block || block.kind !== 'tableBlock') throw Error(`Unknown report table: ${id}.`);
    if (!object(state) || !fields(state, ['filter', 'sort'])) throw Error(`Invalid presentation for table ${id}.`);
    const filter = state.filter ?? '';
    if (typeof filter !== 'string' || filter.length > 4096) throw Error(`Invalid filter for table ${id}.`);
    const columns = block.content?.columns;
    const rows = block.content?.resolvedRows;
    if (!Array.isArray(columns) || !Array.isArray(rows)) throw Error(`Report table ${id} is not materialized.`);
    const sort = state.sort;
    let sortColumn;
    if (sort != null) {
      if (!object(sort) || !fields(sort, ['key', 'direction']) || typeof sort.key !== 'string' || !['asc', 'desc'].includes(sort.direction)) throw Error(`Invalid sort for table ${id}.`);
      sortColumn = columns.find(column => column.key === sort.key);
      if (!sortColumn) throw Error(`Unknown sort column for table ${id}.`);
    }
    const dataset = reportFill.datasets?.find(dataset => dataset.id === (block.datasetRef || 'primary')) || {};
    const runtimeRows = buildRuntimeTableRows(block, dataset);
    const values = new Map(rows.map((row, index) => [row, new Map(columns.map(column => {
      const value = cellValue(row.cells?.find(cell => cell.key === column.key));
      const link = resolveTableLink({row:runtimeRows[index],column,value});
      return [column.key,link ? link.text : value];
    }))]));
    const query = filter.trim().toLowerCase();
    const selected = query ? rows.filter(row => (row.cells || []).some(cell =>
      columns.some(column => column.key === cell.key) && String(values.get(row).get(cell.key) ?? '').toLowerCase().includes(query))) : rows.slice();
    if (sortColumn) selected.sort((a, b) => compareDashboardTableValues(
      values.get(a).get(sort.key),
      values.get(b).get(sort.key), sortColumn, sort.direction));
    replacements.set(id, {...block, content: {...block.content, rowCount: selected.length, resolvedRows: selected}});
  }
  return {...reportFill, blocks: reportFill.blocks.map(block => replacements.get(block.id) || block)};
}
