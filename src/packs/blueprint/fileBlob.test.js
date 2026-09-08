import assert from 'node:assert/strict';
import {fileToMCPBlob} from './fileBlob.js';

const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
const value = await fileToMCPBlob({
    name: 'sample.xlsx',
    size: bytes.length,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    async arrayBuffer() {
        return bytes.buffer;
    },
});

assert.deepEqual(value, {
    name: 'sample.xlsx',
    size: 4,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    data: 'UEsDBA==',
    filename: 'sample.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});
assert.equal(await fileToMCPBlob(null), null);
await assert.rejects(() => fileToMCPBlob({name: 'bad.xlsx'}), /arrayBuffer/);

console.log('fileBlob tests passed');
