import assert from 'node:assert/strict';
import {injectActions} from './action.js';
const metadata={namespace:'Example',schemas:{record:{type:'object',identity:['id'],properties:{id:{type:'integer'},label:{type:'string'}}}},resourceModels:{patch:{schemaRef:'record',write:{inputPath:'Records',collection:true},fields:{id:{write:'Id'},label:{write:'Label'}}}},actions:{code:`({
 check: value => validation.controlValue(value,{item:{type:'email'},props:{}}),
 payload: () => resources.prepare(context,{modelRef:'patch',source:{scope:'extras',selector:'draft'},baseline:{scope:'extras',selector:'before'}},{draft:{id:1,label:'Revised'},before:{id:1,label:'Original'}}),
 save: () => mutations.execute(context,{commandId:'example',dataSourceRef:'patch',validateWhen:{source:'windowForm',field:'allowed',equals:true}}),
 state: () => mutations.state(context,{commandId:'example'})
})`}};
const context={metadata,signals:{windowForm:{peek:()=>({allowed:false})}}};injectActions(metadata);const actions=metadata.actions.import(context).Example;
assert.equal(actions.check('valid@example.com'),null);assert.equal(actions.check('bad'),'valid email address required');
assert.deepEqual(actions.payload(),{Records:[{Id:1,Label:'Revised'}]});
assert.equal((await actions.save()).status,'invalid');assert.equal(actions.state().writerStatus,'not_invoked');
console.log('Authored actions reuse native validation, sparse preparation and command admission.');
