import assert from 'node:assert/strict';
import {windowCloseDecision,preventDirtyWindowUnload} from './windowCloseDecision.js';
const sources={properties:{signals:{formStatus:{peek:()=>({dirty:true})}}},events:{handlers:{dataSource:{isFormDirty:()=>false}}},parameters:{handlers:{dataSource:{isFormDirty:()=>true}}}};
const context={Context:ref=>sources[ref]},settings={confirmDiscardOnClose:'Discard unsaved changes?',dirtyDataSourceRefs:['properties','events','parameters','properties','absent']};
assert.deepEqual(windowCloseDecision(context,settings),{requiresConfirmation:true,dirtySources:['properties','parameters'],message:'Discard unsaved changes?'});
assert.equal(windowCloseDecision(context,{}).requiresConfirmation,false);
assert.equal(windowCloseDecision({Context:()=>({signals:{formStatus:{value:{dirty:false}}}})},settings).requiresConfirmation,false);
assert.equal(windowCloseDecision(context,{confirmDiscardOnClose:' ',dirtyDataSourceRefs:['properties']}).requiresConfirmation,false);
console.log('User-close decision is opt-in, scope-specific, and preserves clean closes');

let prevented=0;const event={preventDefault(){prevented++;}};
assert.equal(preventDirtyWindowUnload(event,[{...context,metadata:{window:settings}}]),true);
assert.equal(prevented,1);assert.equal(event.returnValue,'');
assert.equal(preventDirtyWindowUnload(event,[{}]),false);assert.equal(prevented,1);
