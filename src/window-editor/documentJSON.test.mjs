import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readDocument } from './windowDocument';
import { documentJSON } from './documentJSON';
import { canonicalBundleMetadata, loadBundleCanonicalizer } from './bundleCanonical';
import { sample } from './demoSample';
await import('../../public/window-editor/wasm_exec.js');
const go=new globalThis.Go();
const {instance}=await WebAssembly.instantiate(await fs.readFile(new URL('../../public/window-editor/canonical.wasm',import.meta.url)),go.importObject);go.run(instance);
const compare=(source)=>{
  const document=readDocument(source).document;
  const json=documentJSON(document);assert.ok(json,'ordinary source uses precise JSON transport');
  const yamlResult=globalThis.forgeWindowCanonicalize(source);
  const jsonResult=globalThis.forgeWindowCanonicalize(json);
  assert.deepEqual(jsonResult,yamlResult,'exact Go fingerprint/complete validation results must match');
  return json;
};
compare(sample);
// Unknown descriptor fields exercise decimal precision, aliases and merges
// while the backend retains authority for authored Window defaults and types.
const numericSample=sample.replace('rows: []', 'rows:\n          - &metrics\n            large: 9007199254740993\n            decimal: 1.234567890123456789\n            enabled: true\n          - <<: *metrics\n            enabled: false');
compare(numericSample);
const plain=readDocument('base: &shared\n  precise: 9007199254740993\n  decimal: 1.234567890123456789\n  enabled: true\ncopy: *shared\nmerged:\n  <<: [*shared, {other: kept, enabled: false}]\n  enabled: false\n').document;
const json=documentJSON(plain);
assert.match(json,/9007199254740993/);assert.match(json,/1\.234567890123456789/);
assert.equal(JSON.parse(json).copy.enabled,true);
assert.equal(JSON.parse(json).merged.enabled,false);
assert.equal(JSON.parse(json).merged.other,'kept');
assert.equal(JSON.parse(json).merged.decimal,JSON.parse(json).base.decimal);
for(const source of ['date: 2020-01-01\n','value: !!str 42\n','value: 0xff\n','value: .inf\n','root: &r {self: *r}\n'])assert.equal(documentJSON(readDocument(source).document),null,'ambiguous/unsupported YAML retains exact Go YAML path');
const doc=readDocument(sample).document;let received;
canonicalBundleMetadata(sample,(source)=>{received=source;return JSON.parse(globalThis.forgeWindowCanonicalize(source).result);},doc);
assert.equal(received,sample,'optional host canonicalizer still receives exact authored YAML');
assert.ok(globalThis.forgeWindowCanonicalize('{"schemaVersion":2,"schemaVersion":3}').error,'Go JSON fastpath still rejects duplicate keys');
// Bounded memoization is restricted to the loaded immutable Go adapter, and
// cached metadata cannot be corrupted by an accidental caller mutation.
const binary=await fs.readFile(new URL('../../public/window-editor/canonical.wasm',import.meta.url));
globalThis.forgeWindowCanonicalize=undefined;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength)});
await loadBundleCanonicalizer(new URL('http://no-network.invalid/'));
globalThis.fetch=originalFetch;
const fresh=canonicalBundleMetadata(sample,undefined,doc);
const expectedKey=fresh.keys['web-desktop'];fresh.keys['web-desktop']='caller mutation';
assert.equal(canonicalBundleMetadata(sample,undefined,doc).keys['web-desktop'],expectedKey);
let hookCalls=0;
const hook=(source)=>{hookCalls++;return JSON.parse(globalThis.forgeWindowCanonicalize(source).result);};
canonicalBundleMetadata(sample,hook,doc);canonicalBundleMetadata(sample,hook,doc);
assert.equal(hookCalls,2,'custom host validation never uses the native metadata cache');
console.log('Precise CST JSON, merge/alias semantics, YAML fallbacks, duplicate rejection and exact custom-hook source passed.');
process.exit(0);
