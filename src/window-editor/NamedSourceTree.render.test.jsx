import assert from 'node:assert/strict';
import {compileWindowSource} from './testCompiler.mjs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','MutationObserver','Window','Document','Node','Range','DOMRect','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
window.Range.prototype.getClientRects=()=>[];window.Range.prototype.getBoundingClientRect=()=>new window.DOMRect();globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {act}=React;const {createRoot}=await import('react-dom/client');const {EditorView}=await import('@codemirror/view');
const {default:WindowYamlEditor}=await import('./WindowYamlEditor');
import fs from 'node:fs/promises';
import '../../public/window-editor/wasm_exec.js';
const go=new globalThis.Go();const {instance}=await WebAssembly.instantiate(await fs.readFile(new URL('../../public/window-editor/canonical.wasm',import.meta.url)),go.importObject);go.run(instance);
const initial={version:1,binding:{windowKey:'named',uri:'window://example/named'},files:{
'extension/forge/windows/named/main.yaml':'$import(shared/main.yaml)\n',
'extension/forge/windows/named/web/main.yaml':'$import(../shared/main.yaml)\n',
'extension/forge/windows/named/shared/main.yaml':'# preserve original import\nwindowKey: named\nnamespace: Original\nview:\n  content: $import(content.yaml)\n',
'extension/forge/windows/named/shared/content.yaml':'id: list\ntitle: Original content\n'
}};
const compile=source=>JSON.parse(compileWindowSource(source));const emitted=[],sources=[],calls=[],states=[];
const stale=structuredClone(compile(initial).definition);
stale.variants[Object.keys(stale.variants)[0]].window.namespace='Authored compiled edit';
function Host(){const [source,setSource]=React.useState(initial),[value,setValue]=React.useState(JSON.stringify(stale));return <WindowYamlEditor value={value} sourceManifest={source} canonicalizer={globalThis.forgeWindowCanonicalize} onStateChange={next=>states.push(next)} onSourceManifestChange={next=>{sources.push(next);setSource(next);}} onChange={next=>{emitted.push(next);setValue(next);}} compileSourceManifest={async next=>{calls.push(next);return {definition:JSON.stringify(compile(next).definition)};}}/>;}
const root=createRoot(document.getElementById('root'));await act(()=>root.render(<Host/>));assert.ok(document.querySelector('[role="tree"]'));assert.ok(document.querySelector('.cm-editor').closest('[hidden]'));
assert.equal(states.at(-1).canCommit,false,'stale compiled fingerprints block the host');
await act(()=>[...document.querySelectorAll('button')].find(n=>n.textContent==='Apply YAML changes').click());
assert.equal(states.at(-1).canCommit,true,'one canonical repair makes the compiled definition committable');
assert.equal(calls.length,0,'derived repair does not recompile unchanged named files');
assert.equal(sources.length,0,'derived repair leaves original named files untouched');
assert.equal(emitted.length,1);assert.match(emitted[0],/Authored compiled edit/);
const input=document.querySelector('[aria-label="namespace"]');assert.ok(input);await act(()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'Changed');input.dispatchEvent(new window.Event('input',{bubbles:true}));});await act(async()=>input.dispatchEvent(new window.FocusEvent('focusout',{bubbles:true})));await act(async()=>{});
assert.equal(calls.length,1,'normal Tree edit compiles exactly once');assert.equal(emitted.length,2);assert.match(sources[0].files['extension/forge/windows/named/shared/main.yaml'],/namespace: Changed/);assert.equal(sources[0].files['extension/forge/windows/named/web/main.yaml'],initial.files['extension/forge/windows/named/web/main.yaml']);assert.equal(sources[0].files['extension/forge/windows/named/shared/content.yaml'],initial.files['extension/forge/windows/named/shared/content.yaml']);assert.match(emitted[1],/Changed/);
await act(()=>[...document.querySelectorAll('button')].find(n=>n.textContent==='YAML').click());assert.ok(document.querySelector('[aria-label="Source file"]'));await act(()=>root.unmount());console.log('Canonical repair commits compiled metadata without recompiling or changing named files; subsequent Tree edit follows real import and invokes original Go compiler exactly once.');process.exit(0);
