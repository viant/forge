import assert from 'node:assert/strict';
import {applyWindowPermissionMetadata} from './WindowContent.jsx';
const canonical={resource:{uri:'window://workspace/records'},view:{content:{id:'root'}}};
const calls=[],admitted={...canonical,authorizationSnapshot:{presentation:{open:true}}};
assert.equal(await applyWindowPermissionMetadata(canonical,{services:{applyPermission:async input=>{calls.push(input);return admitted;}},windowKey:'records',resource:{RecordId:[42]},windowParams:{RecordId:[42]},conversationId:'proof',targetContext:{platform:'web'}}),admitted);
assert.equal(calls.length,1);assert.equal(calls[0].completeMetadata,canonical);assert.deepEqual(calls[0].resource,{RecordId:[42]});assert.equal(calls[0].windowKey,'records');
await assert.rejects(()=>applyWindowPermissionMetadata(canonical),error=>error.status===503);
const businessAuthorized={authorization:{scope:'resource'},view:{content:{id:'root'}}};await assert.rejects(()=>applyWindowPermissionMetadata(businessAuthorized),error=>error.status===503);
for(const metadata of [{view:{content:{id:'local'}}},{resource:{uri:'datasource://workspace/records'}},{resource:{uri:42}}]) {assert.equal(await applyWindowPermissionMetadata(metadata,{services:{applyPermission(){throw new Error('Local metadata must retain existing behavior.');}}}),metadata);}
console.log('Main admission: canonical no-auth windows call original OPEN service; local metadata and declared business authorization retain their contracts.');
