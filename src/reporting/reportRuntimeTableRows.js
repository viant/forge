import {buildTableHierarchy,hierarchyRows,materializeAnalyticalTable} from './reportTableAnalytics.js';
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
    }, block.pivot ? {} : cloneValue(originalRows[sourceIndex]) || {});
  });
}

// Runtime filters still operate on admitted source records. Resolve hierarchy
// identity against the full source, and aggregate pivot values only afterward.
export function buildAnalyticalRuntimeTableRows(block,sourceRows,filteredRows){
 const canonical=buildRuntimeTableRows(block,{rows:sourceRows});
 if(block.hierarchy){
  const model=buildTableHierarchy(canonical,{...block.hierarchy,totals:{mode:'producer'}});
  return hierarchyRows(model,{matchedKeys:new Set(filteredRows.map(row=>row[block.hierarchy.keyField]))}).nodes.map(node=>node.row);
 }
 if(block.pivot){
  const identity=row=>JSON.stringify(block.pivot.rowFields.map(field=>row[field]));
  const refreshed=new Map(materializeAnalyticalTable(block,filteredRows).rows.map(row=>[identity(row),row]));
  return canonical.map(row=>refreshed.get(identity(row))).filter(Boolean);
 }
 return canonical;
}
