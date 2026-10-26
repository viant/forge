import assert from 'node:assert/strict';
import {injectActions} from './action.js';

const metadata = {namespace: 'upload', actions: {code: '({send(file, append) { return utilities.files.transferChunks(file, {chunkBytes: 2, append}); }})'}};
injectActions(metadata);
const {send} = metadata.actions.import({}).upload;
const data = new Uint8Array([1,2,3]);
let slices = 0;
const file = {size: data.length, arrayBuffer: () => {throw Error('whole file');}, slice(start,end) {
  slices++; const bytes = data.slice(start,end); return {size: bytes.length, arrayBuffer: async () => bytes.buffer};
}};
const received = [];
const result = await send(file, async ({offset, data}) => {const part = Buffer.from(data,'base64'); received.push(...part); return {nextOffset: offset+part.length};});
assert.deepEqual(received,[1,2,3]);assert.equal(slices,2);assert.equal(result.sentBytes,3);
console.log('Native window actions can use bounded file transfer through the standard utilities binding.');
