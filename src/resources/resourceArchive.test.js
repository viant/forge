import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readResourceTar, decodeResourceArchive} from './resourceArchive.js';
import {createMCPResourceFS} from './ResourceFS.js';
function tar(files) {
 const blocks=[];
 for(const [name,value,type=48] of files){const raw=Buffer.from(value),h=Buffer.alloc(512);h.write(name);h.write('0000644\0',100);h.write('0000000\0',108);h.write('0000000\0',116);h.write(raw.length.toString(8).padStart(11,'0')+'\0',124);h.write('00000000000\0',136);h.fill(32,148,156);h[156]=type;h.write('ustar\0',257);h.write('00',263);let sum=h.reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,'0')+'\0 ',148);blocks.push(h,raw,Buffer.alloc((512-raw.length%512)%512));}
 return Buffer.concat([...blocks,Buffer.alloc(1024)]);
}
const raw='{"id":"picker","content":{"id":"nested"}}';const hash=createHash('sha256').update(raw).digest('hex');const path=`resources/${hash}.json`;
const manifest={schemaVersion:1,namespace:'example',kind:'dialog',catalogRevision:'1',complete:true,entries:[{uri:'dialog://example/picker',revision:'1',path,contentFingerprint:hash}]};
const files=[['manifest.json',JSON.stringify(manifest)],[path,raw]];
test('real gzip tar roundtrip retains exact bytes and loads through MCP adapter',async()=>{
 const bytes=tar(files),content={mimeType:'application/gzip',blob:gzipSync(bytes).toString('base64')};
 const decoded=await decodeResourceArchive(content);assert.equal(decoded.entries[0].definitionText,raw);
 let calls=0;const fs=createMCPResourceFS({namespace:'example',scopeKey:'alice',archiveFormat:'tar.gz',readResource:async({uri})=>{calls++;assert.equal(uri,'resource-archive://example/dialogs.tar.gz');return {contents:[{uri,...content}]}}});
 assert.equal((await fs.read('picker',{kind:'dialog'})).id,'picker');assert.equal(await fs.readFile('picker',{kind:'dialog'}),raw);assert.equal(calls,1);
});
test('rejects unsafe paths, links, duplicate files, truncated data and wrong checksums',()=>{
 for(const bad of [tar([...files,['../escape','bad']]),tar([...files,[path,raw]]),tar([['manifest.json',JSON.stringify(manifest)],[path,raw,50]]),tar(files).subarray(0,700)])assert.throws(()=>readResourceTar(bad));
 const corrupt=tar(files);corrupt[0]^=1;assert.throws(()=>readResourceTar(corrupt),/checksum/);
 assert.throws(()=>readResourceTar(tar([files[0]])),/missing/);
});
test('allows multiple revision identities to share one content-addressed tar file',()=>{
 const duplicate={...manifest,entries:[...manifest.entries,{...manifest.entries[0],uri:'dialog://example/other',revision:'2'}]};
 const decoded=readResourceTar(tar([['manifest.json',JSON.stringify(duplicate)],[path,raw]]));assert.equal(decoded.entries.length,2);assert.equal(decoded.entries[1].definitionText,raw);
});
