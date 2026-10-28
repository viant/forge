import assert from 'node:assert/strict';
import {test} from 'node:test';
import {freshReportActionPin, reportActionNeedsMetadataRefresh, ReportMetadataRefreshError} from './reportResourceFreshness.js';

const now=Date.parse('2026-01-01T00:00:00Z');
const pin={providerIdentity:'sample-owner',uri:'report://example/sample',kind:'stamped',revision:'2',contentFingerprint:'a'.repeat(64),authorityBinding:'sample-binding',validUntil:new Date(now+300_000).toISOString()};
const expired={...pin,validUntil:new Date(now-1).toISOString()};
test('action freshness is cache expiry only, with a60second freshness budget and no background renewal',async()=>{
 assert.equal(reportActionNeedsMetadataRefresh(pin,now),false);
 assert.equal(reportActionNeedsMetadataRefresh({...pin,validUntil:new Date(now+3_000).toISOString()},now),true);
 assert.equal(reportActionNeedsMetadataRefresh(expired,now),true);
 for(const validUntil of [undefined,'0001-01-01T00:00:00Z'])assert.equal(reportActionNeedsMetadataRefresh({...pin,validUntil},now),false);
 let calls=0;
 const get=async request=>{calls++;assert.deepEqual(request,{resource:{uri:pin.uri,revision:pin.revision},resolvedResource:expired,refreshMetadata:true});return {resource:pin};};
 assert.equal(await freshReportActionPin(pin,get,{now:()=>now}),pin);
 assert.equal(calls,0);
 assert.deepEqual(await freshReportActionPin(expired,get,{now:()=>now}),pin);
 assert.equal(calls,1);
 assert.equal(expired.validUntil,new Date(now-1).toISOString(),'old pin is never extended locally');
});
test('changed identity, expired grants and failed metadata reads never silently select a new definition',async()=>{
 for(const field of ['providerIdentity','uri','kind','revision','contentFingerprint','authorityBinding']){
  let calls=0;
  await assert.rejects(freshReportActionPin(expired,async()=>{calls++;return {resource:{...pin,[field]:'different'}};},{now:()=>now}),/changed while it was open/);
  assert.equal(calls,1);
 }
 let calls=0;
 await assert.rejects(freshReportActionPin(expired,async()=>{calls++;return {resource:expired};},{now:()=>now}),/expired or invalid/);
 assert.equal(calls,1);
 await assert.rejects(freshReportActionPin(expired,async()=>{throw new Error('upstream details');},{now:()=>now}),error=>error instanceof ReportMetadataRefreshError&&!error.message.includes('upstream details'));
});
test('metadata settling after action cancellation cannot dispatch or substitute its pin',async()=>{
 let current=true,resolve;
 const pending=new Promise(yes=>{resolve=yes;});
 const fresh=freshReportActionPin(expired,()=>pending,{now:()=>now,isCurrent:()=>current});
 current=false;resolve({resource:pin});
 assert.equal(await fresh,null);
});

test('one trusted refresh accepts short unexpired grants without applying the cache budget again',async()=>{
 for(const remaining of [3_000,30_000,59_000]){
  const short={...pin,validUntil:new Date(now+remaining).toISOString()};let calls=0;
  assert.equal(reportActionNeedsMetadataRefresh(short,now),true);
  const selected=await freshReportActionPin(expired,async()=>{calls++;return {resource:short};},{now:()=>now});
  assert.deepEqual(selected,short);assert.equal(calls,1);
  assert.equal(selected.validUntil,short.validUntil,'the browser cannot extend the new server deadline');
 }
 for(const validUntil of [undefined,'0001-01-01T00:00:00Z']){
  let calls=0;
  const selected=await freshReportActionPin(expired,async()=>{calls++;return {resource:{...pin,validUntil}};},{now:()=>now});
  assert.equal(selected.validUntil,validUntil);assert.equal(calls,1);
 }
});
test('expired and malformed fresh deadlines stop after one metadata read',async()=>{
 for(const validUntil of [new Date(now-1).toISOString(),new Date(now).toISOString(),'invalid','2030','',now+30_000]){
  let calls=0;
  await assert.rejects(freshReportActionPin(expired,async()=>{calls++;return {resource:{...pin,validUntil}};},{now:()=>now}),/expired or invalid/);
  assert.equal(calls,1);
 }
});
