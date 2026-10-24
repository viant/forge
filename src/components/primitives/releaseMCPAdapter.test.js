import assert from 'node:assert/strict';
import test from 'node:test';
import {createReleaseMCPAdapter,releaseCapability,releaseMethods,supportsReleaseExtension,supportsReleaseTools} from './releaseMCPAdapter.js';

const namespace='sales';
const key={tenant:'trusted-tenant',account:'trusted-account',workspace:'trusted-workspace',namespace,name:'poc'};
const root={uri:'window://sales/overview',kind:'window',version:3,hash:'a'.repeat(64)};
const policy={resource:{tenant:'trusted-tenant',kind:'policy',id:'readers',version:1},revision:2};

test('release availability requires all five exact advertised methods',()=>{
  assert.equal(supportsReleaseTools(releaseMethods.map(name=>({name}))),true);
  assert.equal(supportsReleaseTools(releaseMethods.slice(0,4).map(name=>({name}))),false);
  assert.equal(supportsReleaseTools([{name:'releases/list'}]),false);
  assert.equal(supportsReleaseExtension({experimental:{[releaseCapability]:{schemaVersion:1,methods:releaseMethods}}}),true);
  assert.equal(supportsReleaseExtension({experimental:{[releaseCapability]:{schemaVersion:1,methods:releaseMethods.slice(0,4)}}}),false);
});

test('adapter sends only namespace/name and exact references through authenticated MCP',async()=>{
  const calls=[];
  const callTool=async(method,input)=>{
    calls.push([method,input]);
    if(method==='releases/list')return {channels:[{channel:{key,description:'Review',policies:[policy],activeBundleHash:'b'.repeat(64),revision:4},bundle:{namespace,roots:[root],hash:'b'.repeat(64)},status:'active',activated:true}]};
    if(method==='releases/candidates')return {artifacts:[{root,title:'Overview'}]};
    if(method==='releases/history')return {entries:[{revision:4,bundleHash:'b'.repeat(64),status:'active',description:'Review',appliedAt:'2026-10-22T00:00:00Z'},{revision:5,bundleHash:'c'.repeat(64),status:'pending'}]};
    return {channel:{key,activeBundleHash:'b'.repeat(64),revision:5},status:'active',activated:true};
  };
  const adapter=createReleaseMCPAdapter({callTool,namespace,listPolicies:async()=>[{...policy,displayName:'Readers'}]});
  const [channel]=await adapter.list();
  assert.equal(channel.releaseStatus,'active');
  assert.deepEqual(channel.bundle.roots,[root]);
  assert.deepEqual(await adapter.candidates(),[{...root,title:'Overview'}]);
  assert.deepEqual(await adapter.policies(),[{...policy,displayName:'Readers'}]);
  assert.deepEqual(await adapter.history(key),[{hash:'b'.repeat(64),revision:4,description:'Review',activatedAt:'2026-10-22T00:00:00Z'}]);
  await adapter.publish({key,description:'Review',roots:[root],policies:[policy],expectedRevision:4});
  await adapter.promote({key,bundleHash:'b'.repeat(64),expectedRevision:4});
  assert.deepEqual(calls,[
    ['releases/list',{namespace}],
    ['releases/candidates',{namespace}],
    ['releases/history',{namespace,name:'poc'}],
    ['releases/publish',{namespace,name:'poc',description:'Review',roots:[root],policies:[policy],expectedRevision:4}],
    ['releases/promote',{namespace,name:'poc',bundleHash:'b'.repeat(64),expectedRevision:4}],
  ]);
  assert.equal(JSON.stringify(calls).includes('trusted-account'),false);
  assert.equal(JSON.stringify(calls).includes('trusted-workspace'),false);
});
