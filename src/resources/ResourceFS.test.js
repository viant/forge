import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ResourceFS, resolveResourcePath} from './ResourceFS.js';
const entry=(kind,id,definition)=>{const definitionText=JSON.stringify(definition);return {uri:`${kind}://example/${id}`,revision:'1',definitionText,contentFingerprint:createHash('sha256').update(definitionText).digest('hex')}};
const snapshot=(kind,entries=[])=>({schemaVersion:1,namespace:'example',kind,catalogRevision:'catalog1',complete:true,entries});
test('archives start concurrently, deduplicate, and preserve authored bindings',async()=>{
 const calls=[],release={};const fs=new ResourceFS({namespace:'example',scopeKey:'alice',loadArchive:({kind})=>{calls.push(kind);return new Promise(r=>release[kind]=r)}});
 const yaml='resources:\n  dataSources: [orders]\n  dialogs: [picker]\ndataSource:\n  orders:\n    parameters: [{name: parent, value: 7}]\nview: {content: {id: root}}\n';
 const loading=fs.loadWindow(yaml);const second=fs.read('orders',{kind:'datasource'});await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['datasource','dialog']);
 release.datasource(snapshot('datasource',[entry('datasource','orders',{schemaVersion:1,dataSource:{id:'orders',parameters:[],selectors:{data:'items'}}})]));
 release.dialog(snapshot('dialog',[entry('dialog','picker',{id:'picker',content:{items:[{lookup:{dialogId:'nested'}}]}})]));
 const window=await loading;await second;assert.deepEqual(window.dataSource.orders.parameters,[{name:'parent',value:7}]);assert.equal(window.dataSource.orders.selectors.data,'items');assert.equal(window.dialogs[0].content.items[0].lookup.dialogId,'nested');
 window.dialogs[0].id='mutated';assert.equal((await fs.read('picker',{kind:'dialog'})).id,'picker');assert.equal(calls.length,2);
});
test('missing entries warn without blocking other window content or retrying',async()=>{
 const warnings=[];let calls=0;const fs=new ResourceFS({namespace:'example',scopeKey:'alice',warn:w=>warnings.push(w),loadArchive:async({kind})=>{calls++;return snapshot(kind)}});
 const source={resources:{dialogs:['missing']},view:{content:{id:'root'}}};const loaded=await fs.loadWindow(source);await fs.read('missing',{kind:'dialog'});assert.equal(loaded.view.content.id,'root');assert.equal(warnings.length,1);assert.equal(warnings[0].code,'resource_missing');assert.equal(calls,2);assert.equal(source.dialogs,undefined);
});
test('only required archive gates loading and incomplete archives are not cached as complete',async()=>{
 const warnings=[];const fs=new ResourceFS({namespace:'example',scopeKey:'alice',warn:w=>warnings.push(w),loadArchive:({kind})=>kind==='dialog'?new Promise(()=>{}):Promise.resolve(snapshot(kind,[entry(kind,'orders',{id:'orders'})]))});
 const loaded=await fs.loadWindow({resources:{dataSources:['orders']},view:{content:{id:'root'}}});assert.equal(loaded.dataSource.orders.id,'orders');
 const broken=new ResourceFS({namespace:'example',scopeKey:'bob',warn:w=>warnings.push(w),loadArchive:async({kind})=>({...snapshot(kind),complete:false})});assert.equal(await broken.read('orders',{kind:'datasource'}),undefined);assert.equal(warnings.at(-1).code,'resource_archive_unavailable');
});
test('path resolution confines relative parents and scopes absolute reads',async()=>{
 assert.equal(resolveResourcePath('../shared/item',{kind:'dialog',namespace:'example',from:'dialog://example/forms/main'}),'dialog://example/shared/item');
 assert.throws(()=>resolveResourcePath('../../escape',{kind:'dialog',namespace:'example',from:'dialog://example/forms/main'}));
 assert.throws(()=>resolveResourcePath('%2e%2e/escape',{kind:'dialog',namespace:'example'}));
 const fs=new ResourceFS({namespace:'example',scopeKey:'alice',loadArchive:async({kind})=>snapshot(kind)});await assert.rejects(fs.read('dialog://foreign/picker'));
});
test('invalidation discards stale in-flight data; corrupt bytes produce nonfatal warning',async()=>{
 let release;const warnings=[];const fs=new ResourceFS({namespace:'example',scopeKey:'alice',warn:w=>warnings.push(w),loadArchive:()=>new Promise(r=>release=r)});const pending=fs.read('orders',{kind:'datasource'});await new Promise(r=>setImmediate(r));fs.invalidate();release(snapshot('datasource',[entry('datasource','orders',{id:'old'})]));assert.equal(await pending,undefined);
 fs.loadArchive=async({kind})=>{const e=entry(kind,'orders',{id:'old'});e.definitionText='{}';return snapshot(kind,[e])};assert.equal(await fs.read('orders',{kind:'datasource'}),undefined);assert.equal(warnings.at(-1).code,'resource_archive_unavailable');
});

test('MCP adapter makes one standard read per archive with no window or business calls',async()=>{
 const {createMCPResourceFS}=await import('./ResourceFS.js');const calls=[];
 const fs=createMCPResourceFS({namespace:'example',scopeKey:'alice',readResource:async({uri})=>{calls.push(uri);const kind=uri.endsWith('/dialogs')?'dialog':'datasource';return {contents:[{uri,text:JSON.stringify(snapshot(kind))}]}}});
 await fs.preload();await fs.preload();
 assert.deepEqual(calls.sort(),['resource-archive://example/datasources','resource-archive://example/dialogs']);
});
test('exact revisions coexist with one provider-selected default',async()=>{
 const old={...entry('datasource','orders',{id:'orders',value:'old'}),selected:false};
 const current={...entry('datasource','orders',{id:'orders',value:'current'}),revision:'2',selected:true};
 const fs=new ResourceFS({namespace:'example',scopeKey:'alice',loadArchive:async()=>snapshot('datasource',[old,current])});
 assert.equal((await fs.read('orders',{kind:'datasource'})).value,'current');
 assert.equal((await fs.read('orders',{kind:'datasource',revision:'1'})).value,'old');
 assert.equal(JSON.parse(await fs.readFile('orders',{kind:'datasource',revision:'1'})).value,'old');
 assert.equal(await fs.read('orders',{kind:'datasource',revision:'3'}),undefined);
});
test('conflicting defaults and duplicate revisions reject the snapshot',async()=>{
 for(const entries of [[{...entry('dialog','pick',{id:'pick'}),selected:true},{...entry('dialog','pick',{id:'pick'}),revision:'2',selected:true}],[entry('dialog','pick',{id:'pick'}),entry('dialog','pick',{id:'pick'})]]){
  const fs=new ResourceFS({namespace:'example',scopeKey:'alice',loadArchive:async()=>snapshot('dialog',entries)});
  assert.equal(await fs.ensure('dialog'),false);assert.equal(fs.indexes.has('dialog'),false);
 }
});
test('complete supplied definitions do not wait for archives or create missing warnings',async()=>{
 const fs=new ResourceFS({namespace:'example',scopeKey:'alice',loadArchive:async({kind})=>snapshot(kind,[])});
 const original={resources:{dataSources:['orders'],dialogs:['picker']},dataSource:{orders:{service:{uri:'/existing'},parameters:[{name:'ID'}]}},dialogs:[{id:'picker',content:{id:'body'}}]};
 const loaded=await fs.loadWindow(original);
 assert.deepEqual(loaded.dataSource,original.dataSource);assert.deepEqual(loaded.dialogs,original.dialogs);
 assert.equal(loaded.resourceWarnings?.length||0,0);
});
