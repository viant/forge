import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assignmentPlan} from './releaseAssignments.js';
const root={uri:'window://demo/records',kind:'window',version:2,hash:'exact-two'};
const connection={uri:'mcp://demo/producer',kind:'mcp',version:7,hash:'connection-seven'};
const unrelated={uri:'report://demo/summary',kind:'report',version:3,hash:'summary-three'};
const policies=[{resource:{tenant:'team',kind:'policy',id:'readers',version:'logical'},revision:4}];
const channel=(name,roots)=>({key:{namespace:'demo',name},revision:6,description:'Retain description',policies,bundle:{roots},releaseStatus:'active',activated:true});
test('assignment updates only the exact selected family while retaining policies, connections and other revisions',()=>{
 const older={...root,version:1,hash:'exact-one'};
 const input=channel('main',[connection,older,unrelated]);
 const [change]=assignmentPlan([input],root,['main']);
 assert.deepEqual(change.roots,[connection,unrelated,root]);assert.equal(change.policies,policies);assert.equal(change.expectedRevision,6);assert.equal(input.bundle.roots[1],older);
});
test('deselect and reassign use both original channel revisions without fabricating roots',()=>{
 const changes=assignmentPlan([channel('preview',[connection,root]),channel('main',[unrelated])],root,['main']);
 assert.deepEqual(changes.map(item=>[item.key.name,item.roots]),[['preview',[connection]],['main',[unrelated,root]]]);
});
test('unknown roots, missing inventories, inactive channels and last artifact removal fail closed',()=>{
 assert.throws(()=>assignmentPlan([],{},[]),/exact/);
 assert.throws(()=>assignmentPlan([channel('main',[root])],root,[]),/empty/);
 assert.throws(()=>assignmentPlan([{...channel('main',[root]),bundle:undefined}],root,[]),/unavailable/);
 assert.throws(()=>assignmentPlan([{...channel('main',[connection]),activated:false}],root,['main']),/not active/);
 assert.throws(()=>assignmentPlan([],root,['invented']),/no longer exists/);
});
