import assert from 'node:assert/strict';
import {compileWindowSource} from './testCompiler.mjs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','MutationObserver','Window','Document','Node','Range','DOMRect','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
window.Range.prototype.getClientRects=()=>[];window.Range.prototype.getBoundingClientRect=()=>new window.DOMRect();globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {act}=React;const {createRoot}=await import('react-dom/client');const {EditorView}=await import('@codemirror/view');
await import('../../public/window-editor/wasm_exec.js');
const fs=await import('node:fs/promises');const go=new globalThis.Go();
const {instance}=await WebAssembly.instantiate(await fs.readFile(new URL('../../public/window-editor/canonical.wasm',import.meta.url)),go.importObject);go.run(instance);
const {default:WindowYamlEditor}=await import('./WindowYamlEditor');
const initial={version:1,binding:{windowKey:'named',uri:'window://example/named'},files:{
  'extension/forge/windows/named/main.yaml':'# preserve comment\nwindowKey: named\nactionRefs: [hooks]\nresources: {dataSources: [rows]}\nview:\n  content: {id: list, dataSourceRef: rows}\n',
  'extension/forge/windows/hooks.js':"(() => ({ changed() { return 'before'; } }))()",
  'extension/forge/datasources/rows.yaml':'id: rows\nparameters: [{name: term, location: Before}]\nbackend: {kind: inline, rows: []}\n'
}};
const output=[],states=[],calls=[];
let canonicalCalls=0;const canonicalizer=(...args)=>{canonicalCalls++;return globalThis.forgeWindowCanonicalize(...args);};
function Host(){const [source,setSource]=React.useState(initial);const [value,setValue]=React.useState('{}');return <WindowYamlEditor canonicalizer={canonicalizer} value={value} defaultMode="yaml" sourceManifest={source} onSourceManifestChange={setSource} onChange={value=>{output.push(value);setValue(value);}} onStateChange={state=>states.push(state)} compileSourceManifest={async manifest=>{calls.push(manifest);const raw=compileWindowSource(manifest);const value=JSON.parse(raw);return {...value,definition:JSON.stringify(value.definition)};}}/>;}
const root=createRoot(document.getElementById('root'));await act(()=>root.render(<Host/>));
assert.doesNotMatch(document.querySelector('.cm-editor').textContent,/fingerprint|schemaVersion|variants:/);
assert.equal(canonicalCalls,0,'named-source opening does not canonicalize assembled variants');
assert.equal(document.querySelector('.fwe-status'),null,'assembled editor is not mounted while opening named files');
const select=async name=>act(()=>{const node=document.querySelector('select');node.value=name;node.dispatchEvent(new window.Event('change',{bubbles:true}));});
const edit=async next=>act(()=>{const view=EditorView.findFromDOM(document.querySelector('.cm-editor'));view.dispatch({changes:{from:0,to:view.state.doc.length,insert:next}});});
await select('extension/forge/datasources/rows.yaml');await edit(initial.files['extension/forge/datasources/rows.yaml'].replace('Before','After'));
assert.equal(states.at(-1).canCommit,false);assert.equal(output.length,0);
const namedView=EditorView.findFromDOM(document.querySelector('.cm-editor'));
await act(()=>[...document.querySelectorAll('button')].find(node=>node.textContent==='Tree').click());
assert.ok(document.querySelector('.fwe-status'),'assembled editor mounts on first Tree request');
await act(()=>[...document.querySelectorAll('button')].find(node=>node.textContent==='YAML').click());
assert.equal(EditorView.findFromDOM(document.querySelector('.cm-editor')),namedView,'switching modes preserves the source editor and its draft');
assert.match(namedView.state.doc.toString(),/After/);
assert.equal(states.at(-1).canCommit,false,'switching modes cannot make an unapplied source draft committable');
await act(async()=>[...document.querySelectorAll('button')].find(node=>node.textContent==='Apply source changes').click());
assert.equal(calls.length,1);assert.equal(output.length,1);assert.match(output[0],/location["']?\s*:\s*["']?After/);assert.match(calls[0].files['extension/forge/windows/named/main.yaml'],/# preserve comment/);assert.equal(states.at(-1).canCommit,true);
await select('extension/forge/windows/hooks.js');await edit(initial.files['extension/forge/windows/hooks.js'].replace('before','after'));
await act(async()=>[...document.querySelectorAll('button')].find(node=>node.textContent==='Apply source changes').click());
assert.equal(calls.length,2);assert.match(output[1],/after/);assert.match(output[1],/location["']?\s*:\s*["']?After/);
await act(()=>root.unmount());console.log('Rendered named-file datasource/JS edits invoke original Go loader once per Apply, preserve files/comments and emit complete recompiled runtime.');process.exit(0);
