import numeral from 'numeral';

const formats = {int:'0,0',numeric:'0,0.00',precision:'0,0.00000000',usdCurrency:'$0,0.00',percent:'0.00%'};

export const isTableNumericColumn = (column = {}, value) => ['number','numeric','currency'].includes(column.type)
    || ['number','currency'].includes(column.cellProperties?.type) || !!column.numericFormat
    || (typeof value === 'number' && [undefined,'','text','link','editableText'].includes(column.type));

// The table's existing display path, shared with editable-cell reading states.
export function formatTableNumber(value, format) {
    const number = (typeof value === 'number' ? value : parseFloat(value)).toFixed(10);
    const displayed = numeral(number).format(formats[format] || format);
    return displayed === 'NaN' ? number + '' : displayed;
}
