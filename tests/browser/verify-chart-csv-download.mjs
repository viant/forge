import assert from 'node:assert/strict';
import {mkdir, readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout} from 'node:timers/promises';
const directory = process.argv[2];
if (process.argv[3] === '--prepare') {
    await mkdir(directory, {recursive: true});
    assert.deepEqual(await readdir(directory), [], 'download destination must be empty before the click');
    process.exit(0);
}
let files = [];
const deadline = Date.now() + 10000;
do {
    files = await readdir(directory);
    if (files.length === 1 && /^chart-table-.*\.csv$/.test(files[0])) break;
    await setTimeout(100);
} while (Date.now() < deadline);
assert.equal(files.length, 1, 'actual chart click must create exactly one download');
assert.match(files[0], /^chart-table-.*\.csv$/);
const content = await readFile(join(directory, files[0]), 'utf8');
assert.equal(content, '\ufeff"Category, ""label""",Amount\nPlain,0\n"Comma, quote "" and café",-1234.125\n"Two\nlines",9007199254740991\n"Carriage\rreturn",1e-8');
console.log('Chart CSV browser download: exact UTF-8 BOM, labels, quoted strings, CR/LF and unrounded numbers passed.');
