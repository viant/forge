import React from 'react';
import {isTableNumericColumn} from './tableNumericFormat.js';

// Table cells own column alignment and horizontal scrolling; no parallel grid
// or scroll-position listener is needed for producer-supplied summary values.
export default function TableSummary({columns, rows, info, label, renderCell, fillerWidth = 0, ready}) {
    const values = columns.map(column => ready ? renderCell({column, rows, info}) : null);
    const firstValue = values.findIndex(value => value != null && value !== false);
    const frozen = columns.findIndex(column => String(column.sticky || '').toLowerCase() !== 'left');
    const frozenCount = frozen < 0 ? columns.length : frozen;
    const labelSpan = Math.max(1, Math.min(frozenCount || (firstValue > 0 ? firstValue : columns.length), firstValue > 0 ? firstValue : columns.length));
    return <tfoot className="forge-table-summary"><tr>
        <td colSpan={labelSpan} className={frozenCount ? 'is-sticky-left' : undefined} style={frozenCount ? {left:0} : undefined}><span role="status" aria-live="polite">{label}</span>{values.slice(0,labelSpan)}</td>
        {columns.slice(labelSpan).map((column,index)=><td key={column.id} data-summary-column={column.id} data-forge-value-type={isTableNumericColumn(column) ? 'number' : undefined} data-type={column.type} data-align={column.align || 'left'} style={{textAlign:column.align || 'left'}}>{values[index+labelSpan]}</td>)}
        {fillerWidth > 0 ? <td aria-hidden="true"/> : null}
    </tr></tfoot>;
}
