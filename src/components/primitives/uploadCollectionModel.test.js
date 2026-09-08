import assert from 'node:assert/strict';
import {encodeUploadFiles} from './uploadCollectionModel.js';

const payload = await encodeUploadFiles([{name: 'one.txt', type: 'text/plain', size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer}], {blobField: 'File', multiple: false});
assert.equal(payload.transport, 'mcpBlob');
assert.equal(payload.File.name, 'one.txt');
assert.equal(payload.File.mimeType, 'text/plain');
assert.equal(payload.File.data, 'AQID');
await assert.rejects(() => encodeUploadFiles([{name: 'bad'}]), /arrayBuffer/);
await assert.rejects(() => encodeUploadFiles([], {transport: 'multipart'}), /Unsupported upload transport/);
const duplicateNames = await encodeUploadFiles([
  {name: 'same.txt', size: 1, arrayBuffer: async () => new Uint8Array([1]).buffer},
  {name: 'same.txt', size: 1, arrayBuffer: async () => new Uint8Array([2]).buffer},
]);
assert.deepEqual(duplicateNames.files.map((file) => file.data), ['AQ==', 'Ag==']);
console.log('upload collection MCP blob proof passed');
