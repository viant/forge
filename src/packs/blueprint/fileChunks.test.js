import assert from 'node:assert/strict';
import {transferFileChunks} from './fileChunks.js';

const bytes = new Uint8Array([0,1,2,3,4,5,255]);
const slices = [], parts = [], progress = [];
const file = {size: bytes.length, arrayBuffer: () => {throw Error('whole-file read');}, slice: (start,end) => {
  slices.push([start,end]); const data = bytes.slice(start,end);
  return {size: data.length, arrayBuffer: async () => data.buffer};
}};
const sent = await transferFileChunks(file, {chunkBytes: 3, append: async ({offset,data}) => {
  const decoded = Buffer.from(data,'base64'); parts.push(...decoded); return {nextOffset: offset+decoded.length};
}, onProgress: value => progress.push(value)});
assert.deepEqual(parts,[...bytes]);assert.deepEqual(slices,[[0,3],[3,6],[6,7]]);
assert.deepEqual(sent,{sentBytes:7,totalBytes:7});assert.deepEqual(progress.map(value=>value.sentBytes),[0,3,6,7]);

let started, finish;
const began = new Promise(resolve=>{started=resolve;});
let reads = 0;
const sequential = {size: 2, slice: () => {reads++; return {size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer};}};
const pending = transferFileChunks(sequential,{chunkBytes:1,append:async({offset})=>{
  if(offset===0){started();await new Promise(resolve=>{finish=resolve;});}return {nextOffset:offset+1};
}});
await began;assert.equal(reads,1,'next part must wait for acknowledgement');finish();await pending;assert.equal(reads,2);

const controller = new AbortController();let largest = 0, acknowledged = 0;
await assert.rejects(()=>transferFileChunks({size:4_096_000_000,slice:(start,end)=>{
  largest=Math.max(largest,end-start);return {size:end-start,arrayBuffer:async()=>new Uint8Array(end-start).buffer};
}}, {chunkBytes:1024,signal:controller.signal,append:async({offset})=>{acknowledged++;controller.abort();return {nextOffset:offset+1024};}}),error=>error.name==='AbortError');
assert.equal(largest,1024);assert.equal(acknowledged,1);
await assert.rejects(()=>transferFileChunks(file,{chunkBytes:3,append:async()=>({nextOffset:0})}),/acknowledgement/);
await assert.rejects(()=>transferFileChunks({size:3,slice:()=>({size:3,arrayBuffer:async()=>new Uint8Array([1]).buffer})},{chunkBytes:3,append:async()=>({nextOffset:3})}),/part size/);
for(const chunkBytes of [0,-1,NaN,1.5,9*1024*1024])await assert.rejects(()=>transferFileChunks(file,{chunkBytes,append:async()=>{}}),/Chunk size/);
assert.deepEqual(await transferFileChunks({size:0,slice:()=>{throw Error('empty slice');}},{chunkBytes:1,append:async()=>{throw Error('empty append');}}),{sentBytes:0,totalBytes:0});
console.log('Bounded file slices, binary fidelity, sequential acknowledgements, cancellation and invalid ranges passed.');
