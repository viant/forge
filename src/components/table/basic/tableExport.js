import {resolveKey} from '../../../utils/selector.js';
import {resolveTableCellText} from '../../../utils/tableLink.js';

const encoder = new TextEncoder();

const xmlEscape = (value) => String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const csvSafeValue = (value) => {
    if (typeof value !== 'string') return value;
    return /^[\u0000-\u0020]*[=+\-@]/.test(value) ? `'${value}` : value;
};

const csvEscape = (value) => `"${String(csvSafeValue(value) ?? '').replace(/"/g, '""')}"`;

const exportLabel = (column = {}) => column.exportLabel || column.displayName || column.name || column.id || '';

export function tableExportColumns(columns = []) {
    return (Array.isArray(columns) ? columns : []).filter((column) => (
        column
        && column.visible !== false
        && column.multiSelect !== true
        && String(column.id || '') !== '__select__'
        && String(column.type || '').toLowerCase() !== 'button'
    ));
}

export function tableExportFormats(formats = null) {
    const requested = Array.isArray(formats) ? formats : [];
    const supported = [...new Set(requested.map((value) => String(value || '').trim().toLowerCase()).filter((value) => value === 'csv' || value === 'xlsx'))];
    return supported.length > 0 ? supported : ['csv', 'xlsx'];
}

export function tableExportRows({filteredSortedRows = [], pageRows = [], scope = 'filtered'} = {}) {
    return String(scope || '').trim().toLowerCase() === 'page'
        ? (Array.isArray(pageRows) ? pageRows : [])
        : (Array.isArray(filteredSortedRows) ? filteredSortedRows : []);
}

export function assertTableExportBounds(rowCount, columnCount) {
    if (columnCount < 1) throw new RangeError('table export requires at least one visible data column');
    if (columnCount > 16384) throw new RangeError('table export exceeds the XLSX column limit of 16384');
    if (rowCount + 1 > 1048576) throw new RangeError('table export exceeds the XLSX row limit of 1048576 including the header');
}

export function assertTableExportPracticalBounds(rowCount, columnCount, limits = {}) {
    const configuredRows = Number(limits?.maxRows);
    const configuredCells = Number(limits?.maxCells);
    const maxRows = Number.isFinite(configuredRows) && configuredRows > 0 ? Math.floor(configuredRows) : 50000;
    const maxCells = Number.isFinite(configuredCells) && configuredCells > 0 ? Math.floor(configuredCells) : 500000;
    if (rowCount > maxRows) throw new RangeError(`table export exceeds the practical row limit of ${maxRows}`);
    if ((rowCount + 1) * columnCount > maxCells) throw new RangeError(`table export exceeds the practical cell limit of ${maxCells}`);
}

export function tableExportByteLimit(limits = {}) {
    const hardMaximum = 64 * 1024 * 1024;
    const configured = Number(limits?.maxBytes);
    const requested = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 16 * 1024 * 1024;
    return Math.min(requested, hardMaximum);
}

function estimatedExportBytes(value) {
    if (typeof value === 'number') return 32;
    if (typeof value === 'boolean') return 8;
    // Conservatively covers UTF-8 encoding, XML entity expansion and cell markup.
    return 64 + (String(value ?? '').length * 24);
}

export function tableExportValue(row = {}, column = {}) {
    const raw = resolveKey(row, column.id);
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'boolean') return raw;
    return resolveTableCellText({row, column, value: raw});
}

export function tableExportMatrix(rows = [], columns = [], limits = {}) {
    const resolvedColumns = tableExportColumns(columns);
    const resolvedRows = Array.isArray(rows) ? rows : [];
    if (resolvedColumns.length < 1) throw new RangeError('table export requires at least one visible data column');
    assertTableExportPracticalBounds(resolvedRows.length, resolvedColumns.length, limits);
    const maxBytes = tableExportByteLimit(limits);
    let estimatedBytes = 0;
    const values = [];
    const append = (row) => {
        for (const value of row) estimatedBytes += estimatedExportBytes(value);
        if (estimatedBytes > maxBytes) throw new RangeError(`table export exceeds the practical byte limit of ${maxBytes}`);
        values.push(row);
    };
    append(resolvedColumns.map(exportLabel));
    for (const row of resolvedRows) append(resolvedColumns.map((column) => tableExportValue(row, column)));
    return {
        columns: resolvedColumns,
        values,
    };
}

export function buildTableCsv(rows = [], columns = [], limits = {}) {
    return tableExportMatrix(rows, columns, limits).values
        .map((values) => values.map(csvEscape).join(','))
        .join('\n');
}

function columnName(index) {
    let value = Number(index) + 1;
    let result = '';
    while (value > 0) {
        value -= 1;
        result = String.fromCharCode(65 + (value % 26)) + result;
        value = Math.floor(value / 26);
    }
    return result;
}

function worksheetXml(values = []) {
    const rows = values.map((row, rowIndex) => {
        const cells = row.map((value, columnIndex) => {
            const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
            if (typeof value === 'number' && Number.isFinite(value)) {
                return `<c r="${ref}"><v>${value}</v></c>`;
            }
            if (typeof value === 'boolean') {
                return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
            }
            const rawText = String(value ?? '');
            if (rawText.length > 32767) throw new RangeError('table export cell exceeds the XLSX string limit of 32767 characters');
            const text = xmlEscape(rawText);
            const preserve = /^\s|\s$|\n/.test(String(value ?? '')) ? ' xml:space="preserve"' : '';
            return `<c r="${ref}" t="inlineStr"><is><t${preserve}>${text}</t></is></c>`;
        }).join('');
        return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
}

let crcTable;
function crc32(bytes) {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let index = 0; index < 256; index += 1) {
            let value = index;
            for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
            crcTable[index] = value >>> 0;
        }
    }
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
}

function u32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
}

function concatBytes(parts = []) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

function zipStore(files = []) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    for (const file of files) {
        const name = encoder.encode(file.name);
        const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
        const crc = crc32(data);
        const local = concatBytes([
            u32(0x04034B50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
            u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
        ]);
        localParts.push(local);
        centralParts.push(concatBytes([
            u32(0x02014B50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
            u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
            u32(0), u32(localOffset), name,
        ]));
        localOffset += local.length;
    }
    const central = concatBytes(centralParts);
    return concatBytes([
        ...localParts,
        central,
        u32(0x06054B50), u16(0), u16(0), u16(files.length), u16(files.length),
        u32(central.length), u32(localOffset), u16(0),
    ]);
}

export function buildTableXlsx(rows = [], columns = [], limits = {}) {
    assertTableExportBounds(Array.isArray(rows) ? rows.length : 0, tableExportColumns(columns).length);
    const values = tableExportMatrix(rows, columns, limits).values;
    return zipStore([
        {name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
        {name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
        {name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>'},
        {name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
        {name: 'xl/worksheets/sheet1.xml', data: worksheetXml(values)},
    ]);
}

function normalizedFilename(filename, format) {
    const extension = format === 'xlsx' ? '.xlsx' : '.csv';
    const base = String(filename || 'table-export').trim().replace(/\.(csv|xlsx)$/i, '') || 'table-export';
    return `${base}${extension}`;
}

export function createTableExport({rows = [], columns = [], format = 'csv', filename = 'table-export', limits = {}} = {}) {
    const normalized = String(format || 'csv').trim().toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
    if (normalized === 'xlsx') {
        return {filename: normalizedFilename(filename, normalized), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: buildTableXlsx(rows, columns, limits)};
    }
    return {filename: normalizedFilename(filename, normalized), mimeType: 'text/csv;charset=utf-8', text: buildTableCsv(rows, columns, limits)};
}

export function downloadTableExport(options = {}) {
    const result = createTableExport(options);
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') return result;
    const payload = result.bytes || result.text || '';
    const href = URL.createObjectURL(new Blob([payload], {type: result.mimeType}));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = result.filename;
    anchor.style.display = 'none';
    document.body?.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
    return result;
}
