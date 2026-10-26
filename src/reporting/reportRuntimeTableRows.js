import {setSelector} from "../utils/selector.js";
const normalizeString = value => String(value || "").trim();
const cloneValue = value => value == null ? value : JSON.parse(JSON.stringify(value));

export function buildRuntimeTableRows(block = {}, dataset = {}) {
  const resolvedRows = Array.isArray(block?.content?.resolvedRows) ? block.content.resolvedRows : null;
  const originalRows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  if (resolvedRows === null) {
    return originalRows;
  }
  return resolvedRows.map((resolvedRow, rowIndex) => {
    const sourceIndex = Number.isInteger(resolvedRow.rowIndex) && resolvedRow.rowIndex >= 0 ? resolvedRow.rowIndex : rowIndex;
    const cells = Array.isArray(resolvedRow?.cells) ? resolvedRow.cells : [];
    return cells.reduce((acc, cell) => {
      const sourceKey = normalizeString(cell?.sourceKey || cell?.key);
      const displayKey = normalizeString(cell?.displayKey || cell?.key);
      const next = sourceKey
        ? setSelector(acc, sourceKey, cloneValue(cell?.value))
        : acc;
      return displayKey && displayKey !== sourceKey
        ? setSelector(next, displayKey, cloneValue(cell?.displayValue))
        : next;
    }, cloneValue(originalRows[sourceIndex]) || {});
  });
}
