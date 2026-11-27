import assert from 'node:assert/strict';
import test from 'node:test';
import {getDialogSignal, removeSignalsForKey} from '../../core/store/signals.js';
import {visitCommandDataSourceRefs} from '../dataSourceDependencies.js';
import {executeCommand, getCommandState, resolveIndeterminateCommand} from './commandExecutor.js';

const signal = value => ({value, peek() {return this.value;}});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
};
const member = (id, options = {}) => ({command: {commandId: id, dataSourceRef: id + 'Writer', label: id,
  receiptIdentity: {field: 'id', submittedValues: 'ids'}, ...options}});
const group = (extra = {}) => ({commandId: 'submit', serializationGroup: 'writes', group: [member('one'), member('two')],
  successState: {done: true}, pendingState: {pending: true}, errorState: {pending: false},
  indeterminateState: {pending: false}, refresh: [{dataSourceRef: 'list', bypassCache: true}], ...extra});

function fixture(handlers = {}) {
  const calls = [], sources = {};
  const form = signal({}), windowForm = signal({}), authorization = signal({principal:{subject:'owner'}}), selection = signal([7]);
  const context = {identity: {windowId: 'group-test', dataSourceRef: 'draft'}, signals: {form, windowForm, authorization, selection},
    Context: ref => sources[ref], lookupHandler: name => handlers[name]};
  for (const ref of ['oneWriter','twoWriter','list','other']) {
    let parameters;
    sources[ref] = {handlers:{dataSource:{
      setInputParameters(value) {parameters = value;},
      fetchCollection(options) {
        calls.push({ref, parameters, options});
        return handlers[ref] ? handlers[ref](parameters, options) : Promise.resolve([{id:7}]);
      },
    }}};
  }
  return {context, sources, calls, windowForm};
}

test('one confirmation prepares isolated maps once; independent handles start before either receipt', async () => {
  const first=deferred(), second=deferred(), both=deferred();
  let confirmations=0, prepared=0;
  const f=fixture({byWriter: ({parameters,extras}) => {
    prepared++;
    assert.equal(parameters.scope,'fixed');assert.equal(extras.scope,'caller');
    return {one:{ids:[7]},two:{ids:[7]}};
  },oneWriter:()=>first.promise, twoWriter:()=>{both.resolve();return second.promise;}});
  const command=group({prepare:'byWriter',confirm:'Apply changes?',parameters:[{name:'scope',in:'const',location:'fixed'}],
    group:[member('one'),member('two'),{command:{commandId:'optional',dataSourceRef:'unused'}}]});
  const result=executeCommand(f.context,command,{scope:'caller'},{confirm:async()=>{confirmations++;return true;}});
  await both.promise;
  assert.equal(confirmations,1);assert.equal(prepared,1);
  assert.deepEqual(f.calls.map(x=>x.parameters),[{ids:[7]},{ids:[7]}]);
  assert.equal(new Set(f.calls.map(x=>x.options.invocationId)).size,2);
  assert.equal((await executeCommand(f.context,command)).status,'suppressed');
  second.resolve([{id:7}]);first.resolve([{id:7}]);
  const done=await result;
  assert.equal(done.status,'succeeded');assert.deepEqual(Object.values(done.members).map(x=>x.status),['succeeded','succeeded','skipped']);
  assert.deepEqual(f.calls.map(x=>x.ref),['oneWriter','twoWriter','list']);
  assert.equal(f.windowForm.value.done,true);
});

test('invalid group inputs and transport contention fail before any member dispatch',async()=>{
  for (const inputs of [{one:{ids:[7]},two:{ids:[1,1]}},{one:{ids:[true]}},{one:null},{undeclared:{}}]) {
    const f=fixture({plan:()=>inputs});
    const result=await executeCommand(f.context,group({prepare:'plan'}));
    assert.equal(result.accepted,false);assert.equal(f.calls.length,0);
  }
  const held=deferred();
  const f=fixture({twoWriter:()=>held.promise});
  const other=executeCommand(f.context,{commandId:'other',dataSourceRef:'twoWriter'});
  const result=await executeCommand(f.context,group(),{ids:[7]});
  assert.equal(result.accepted,false);assert.deepEqual(f.calls.map(x=>x.ref),['twoWriter']);
  held.resolve([{id:7}]);await other;
  assert.equal((await executeCommand(f.context,group(),{ids:[7]})).status,'succeeded');
});

test('cancel, all skipped, and invalid configuration have zero effects',async()=>{
  const f=fixture({plan:()=>({})});
  const cancelled=await executeCommand(f.context,group({confirm:'Confirm'}),{ids:[7]},{confirm:async()=>false});
  assert.equal(cancelled.status,'cancelled');
  assert.equal((await executeCommand(f.context,group({prepare:'plan'}))).status,'skipped');
  for(const command of [group({refresh:[{dataSourceRef:'oneWriter'}]}),group({group:[member('one'),member('one')]}),
    group({group:[member('one',{confirm:'extra'})]}),group({dataSourceRef:'oneWriter'}),group({group:[]})]){
    assert.equal((await executeCommand(f.context,command,{ids:[7]})).accepted,false);
  }
  assert.deepEqual(f.calls,[]);assert.deepEqual(f.windowForm.value,{});
});

test('known partial and unknown outcomes preserve each cause and receipt; resolution releases both writers',async()=>{
  let mode='partial';const error=Object.assign(new Error('value rejected'),{status:400});
  const f=fixture({oneWriter:()=>Promise.resolve(mode==='unknown'?[]:[{id:7}]),
    twoWriter:()=>mode==='ok'?Promise.resolve([{id:7}]):mode==='partial'?Promise.reject(error):Promise.resolve([{id:99}])});
  const command=group();
  const partial=await executeCommand(f.context,command,{ids:[7]});
  assert.equal(partial.status,'partial_failure');assert.equal(partial.members.one.status,'succeeded');
  assert.equal(partial.members.two.error,error);assert.match(getCommandState(f.context,command).message,/two.*value rejected/);
  assert.equal(f.calls.filter(x=>x.ref==='list').length,1);
  assert.equal((await executeCommand(f.context,command,{ids:[7]})).status,'suppressed');
  assert.equal(resolveIndeterminateCommand(f.context,command),true);
  mode='unknown';
  const unknown=await executeCommand(f.context,command,{ids:[7]});
  assert.equal(unknown.status,'indeterminate');assert.deepEqual(Object.values(unknown.members).map(x=>x.status),['indeterminate','indeterminate']);
  assert.equal(f.calls.filter(x=>x.ref==='list').length,1);
  assert.equal(resolveIndeterminateCommand(f.context,command),true);
  mode='ok';assert.equal((await executeCommand(f.context,command,{ids:[7]})).status,'succeeded');
});

test('a replacement dialog or actor receives no old status, refresh, close or callback',async()=>{
  for(const replacement of ['dialog','actor']){
    const started=deferred(),finish=deferred();const f=fixture({oneWriter:()=>{started.resolve();return finish.promise;}});
    const dlg=getDialogSignal('group-testDialogedit');dlg.value={open:true,props:{id:1}};
    let effects=0;const spec=group();const done=executeCommand(f.context,spec,{ids:[7]},
      {dialogId:'edit',onSettled:()=>{effects++;},closeOnSuccess:()=>{effects++;}});
    await started.promise;
    if(replacement==='dialog')dlg.value={open:true,props:{id:2}};
    else f.context.signals.authorization.value={principal:{subject:'replacement'}};
    finish.resolve([{id:7}]);assert.equal((await done).status,'succeeded');
    assert.equal(f.windowForm.value.done,undefined);assert.equal(effects,0);
    assert.deepEqual(getCommandState(f.context,spec).members,{});assert.equal(f.calls.filter(x=>x.ref==='list').length,0);
    removeSignalsForKey('group-testDialogedit');
  }
});

test('a group may clear its own selection and refresh the remaining owners once',async()=>{
  const f=fixture(),spec=group({refresh:[{dataSourceRef:'list',clearSelection:true},{dataSourceRef:'other'}]});
  f.sources.list.signals={selection:f.context.signals.selection};
  f.sources.list.handlers.dataSource.resetSelection=()=>{f.context.signals.selection.value=[];};
  assert.equal((await executeCommand(f.context,spec,{ids:[7]})).status,'succeeded');
  assert.deepEqual(f.calls.map(x=>x.ref),['oneWriter','twoWriter','list','other']);
  const refs=[];visitCommandDataSourceRefs(spec,ref=>{if(ref)refs.push(ref);});
  assert.deepEqual(refs,['oneWriter','twoWriter','list','other']);
});

test('all definite rejections allow correction, with distinct causes and no refresh until receipt',async()=>{
  const denied=Object.assign(new Error('One denied'),{status:403});
  let reject=true;
  const f=fixture({oneWriter:()=>reject?Promise.reject(denied):Promise.resolve([{id:7}]),
    twoWriter:()=>reject?Promise.resolve([{rejected:true,message:'Two denied'}]):Promise.resolve([{id:7,rejected:false}])});
  const command=group({group:[member('one'),member('two',{rejectedWhen:{source:'collection',field:'0.rejected',equals:true}})]});
  const first=await executeCommand(f.context,command,{ids:[7]});assert.equal(first.status,'failed');
  assert.equal(first.members.one.error,denied);assert.equal(first.members.two.message,'Two denied');
  assert.equal(getCommandState(f.context,command).guarded,false);
  assert.deepEqual(f.calls.map(x=>x.ref),['oneWriter','twoWriter']);
  reject=false;assert.equal((await executeCommand(f.context,command,{ids:[7]})).status,'succeeded');
});

test('group checks current presentation between refreshes and withholds an old result',async()=>{
  const started=deferred(),finish=deferred(),dlg=getDialogSignal('group-testDialogreport');
  dlg.value={open:true,props:{id:1}};
  try{
    const f=fixture({list:()=>{started.resolve();return finish.promise;}});let close=0;
    const command=group({refresh:[{dataSourceRef:'list'},{dataSourceRef:'other'}]});
    const done=executeCommand(f.context,command,{ids:[7]},{dialogId:'report',closeOnSuccess:()=>{close++;}});
    await started.promise;dlg.value={open:true,props:{id:2}};finish.resolve([]);
    const result=await done;assert.equal(result.status,'succeeded');assert.equal(close,0);
    assert.equal(f.calls.filter(x=>x.ref==='other').length,0);
    assert.deepEqual(getCommandState(f.context,command).members,{});
  }finally{removeSignalsForKey('group-testDialogreport');}
});

test('group members without a root prepare resolve their bindings and use invocation extras',async()=>{
  const f=fixture(),command=group({parameters:[{name:'scope',in:'const',location:'root'},{name:'fixed',in:'const',location:'yes'}],
    group:[member('one',{parameters:[{name:'own',in:'const',location:'bound'}]}),
      {when:{source:'windowForm',field:'enableOther',equals:true},command:member('two').command}]});
  const result=await executeCommand(f.context,command,{scope:'caller',ids:[7]});
  assert.equal(result.status,'succeeded');assert.equal(result.members.two.status,'skipped');
  assert.deepEqual(f.calls[0].parameters,{fixed:'yes',own:'bound',scope:'caller',ids:[7]});
});
