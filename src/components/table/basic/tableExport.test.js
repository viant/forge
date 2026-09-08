import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertTableExportBounds, assertTableExportPracticalBounds, buildTableCsv, buildTableXlsx, createTableExport, tableExportByteLimit, tableExportColumns, tableExportFormats, tableExportRows} from './tableExport.js';

const columns = [
    {id: '__select__', multiSelect: true, name: ''},
    {id: 'name', name: 'Name'},
    {id: 'spend', displayName: 'Spend'},
    {id: 'hidden', name: 'Hidden', visible: false},
    {id: 'approved', name: 'Approved'},
    {id: 'action', name: 'Action', type: 'button'},
];
const rows = [{name: 'Alpha, "A"', spend: 12.5, hidden: 'secret', approved: true, action: 'Open'}];

assert.deepEqual(tableExportColumns(columns).map((column) => column.id), ['name', 'spend', 'approved']);
assert.equal(buildTableCsv(rows, columns), '"Name","Spend","Approved"\n"Alpha, ""A""","12.5","true"');
assert.deepEqual(tableExportFormats(['XLSX', 'invalid', 'csv', 'xlsx']), ['xlsx', 'csv']);
assert.deepEqual(tableExportFormats(['invalid']), ['csv', 'xlsx']);
assert.deepEqual(tableExportRows({filteredSortedRows: [3, 2, 1], pageRows: [3], scope: 'filtered'}), [3, 2, 1]);
assert.deepEqual(tableExportRows({filteredSortedRows: [3, 2, 1], pageRows: [3], scope: 'page'}), [3]);

for (const dangerous of ['=WEBSERVICE("https://example.test")', '+1+1', '-2+3', '@SUM(A1:A2)', ' \t=CMD()']) {
    const safe = buildTableCsv([{value: dangerous}], [{id: 'value', name: dangerous}]);
    assert.ok(safe.startsWith(`"'${dangerous.replace(/"/g, '""')}"`));
    assert.ok(safe.endsWith(`"'${dangerous.replace(/"/g, '""')}"`));
}
assert.equal(buildTableCsv([{value: -12.5}], [{id: 'value', name: 'Value'}]), '"Value"\n"-12.5"');
assert.equal(buildTableCsv([{value: '-2+3'}], [{id: 'value', name: 'Value'}]), '"Value"\n"\'-2+3"');

assert.throws(() => buildTableCsv([{}], [{id: '__select__', multiSelect: true}]), /at least one visible data column/);
assert.doesNotThrow(() => assertTableExportBounds(1048575, 16384));
assert.throws(() => assertTableExportBounds(1048576, 1), /row limit/);
assert.throws(() => assertTableExportBounds(1, 16385), /column limit/);
assert.doesNotThrow(() => assertTableExportPracticalBounds(49999, 10));
assert.throws(() => assertTableExportPracticalBounds(50001, 1), /practical row limit/);
assert.throws(() => assertTableExportPracticalBounds(50000, 10), /practical cell limit/);
assert.doesNotThrow(() => assertTableExportPracticalBounds(100, 10, {maxRows: 100, maxCells: 1010}));
assert.throws(() => buildTableXlsx(new Array(50001), [{id: 'id', name: 'ID'}]), /practical row limit/);
assert.equal(tableExportByteLimit({}), 16 * 1024 * 1024);
assert.equal(tableExportByteLimit({maxBytes: 1024 * 1024 * 1024}), 64 * 1024 * 1024, 'metadata may not raise the hard browser-memory ceiling');
const nearMaxCell = 'x'.repeat(32767);
assert.throws(() => buildTableXlsx(Array.from({length: 30}, () => ({value: nearMaxCell})), [{id: 'value', name: 'Value'}]), /practical byte limit/, 'aggregate payload must fail before worksheet and ZIP allocation');
assert.throws(() => buildTableXlsx(Array.from({length: 100}, () => ({value: nearMaxCell})), [{id: 'value', name: 'Value'}], {maxBytes: 1024 * 1024 * 1024}), /practical byte limit of 67108864/, 'hard byte ceiling must override authored metadata');

const xlsx = buildTableXlsx(rows, columns);
assert.equal(new DataView(xlsx.buffer, xlsx.byteOffset, xlsx.byteLength).getUint32(0, true), 0x04034B50);
const crc32 = (bytes) => {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
};
const parseStoredZip = (bytes) => {
    const entries = new Map();
    const localOffsets = new Map();
    let offset = 0;
    while (offset + 30 <= bytes.length && new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true) === 0x04034B50) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
        const expectedCrc = view.getUint32(14, true);
        const size = view.getUint32(18, true);
        const nameLength = view.getUint16(26, true);
        const extraLength = view.getUint16(28, true);
        const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
        const start = offset + 30 + nameLength + extraLength;
        const data = bytes.slice(start, start + size);
        assert.equal(crc32(data), expectedCrc, `${name} local CRC`);
        entries.set(name, data);
        localOffsets.set(name, offset);
        offset = start + size;
    }
    let centralCount = 0;
    while (offset + 46 <= bytes.length && new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true) === 0x02014B50) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
        const expectedCrc = view.getUint32(16, true);
        const nameLength = view.getUint16(28, true);
        const extraLength = view.getUint16(30, true);
        const commentLength = view.getUint16(32, true);
        const localOffset = view.getUint32(42, true);
        const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
        assert.ok(entries.has(name), `${name} central entry must match a local entry`);
        assert.equal(localOffsets.get(name), localOffset, `${name} local offset`);
        assert.equal(crc32(entries.get(name)), expectedCrc, `${name} central CRC`);
        centralCount += 1;
        offset += 46 + nameLength + extraLength + commentLength;
    }
    const eocdOffset = bytes.length - 22;
    const eocd = new DataView(bytes.buffer, bytes.byteOffset + eocdOffset);
    assert.equal(eocd.getUint32(0, true), 0x06054B50);
    assert.equal(eocd.getUint16(10, true), entries.size);
    assert.equal(centralCount, entries.size);
    return entries;
};
const zipEntries = parseStoredZip(xlsx);
assert.deepEqual([...zipEntries.keys()], ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml']);
const sheet = new TextDecoder().decode(zipEntries.get('xl/worksheets/sheet1.xml'));
assert.match(sheet, /<c r="A2" t="inlineStr"><is><t>Alpha, &quot;A&quot;<\/t><\/is><\/c>/);
assert.match(sheet, /<c r="B2"><v>12\.5<\/v><\/c>/);
assert.match(sheet, /<c r="C2" t="b"><v>1<\/v><\/c>/);
const unicodeSheet = new TextDecoder().decode(zipEntries.get('xl/worksheets/sheet1.xml'));
assert.doesNotMatch(unicodeSheet, /secret|Open/);

const specialXlsx = buildTableXlsx([{value: 'Café\nline\u0001\uFFFE\uFFFF'}], [{id: 'value', name: 'Label'}]);
const specialSheet = new TextDecoder().decode(parseStoredZip(specialXlsx).get('xl/worksheets/sheet1.xml'));
assert.match(specialSheet, /Café\nline/);
assert.doesNotMatch(specialSheet, /\u0001/);
assert.doesNotMatch(specialSheet, /[\uFFFE\uFFFF]/);
assert.doesNotThrow(() => buildTableXlsx([{value: 'x'.repeat(32767)}], [{id: 'value', name: 'Label'}]));
assert.throws(() => buildTableXlsx([{value: 'x'.repeat(32768)}], [{id: 'value', name: 'Label'}]), /XLSX string limit/);

const basicSource = readFileSync(new URL('../Basic.jsx', import.meta.url), 'utf8');
assert.match(basicSource, /exportRows=\{sortedCollection\}/, 'default export scope must use all filtered and sorted loaded rows');
assert.match(basicSource, /exportPageRows=\{renderedCollection\}/, 'page export scope must use only the rendered page');
assert.match(basicSource, /exportColumns=\{columnsToUse\}/, 'export must use current user-visible columns');

const csvResult = createTableExport({rows, columns, format: 'csv', filename: 'sample.xlsx'});
assert.equal(csvResult.filename, 'sample.csv');
assert.equal(csvResult.mimeType, 'text/csv;charset=utf-8');
const xlsxResult = createTableExport({rows, columns, format: 'xlsx', filename: 'sample.csv'});
assert.equal(xlsxResult.filename, 'sample.xlsx');
assert.equal(xlsxResult.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
assert.ok(xlsxResult.bytes.length > 500);

console.log('tableExport ✓ CSV and real XLSX archives');
