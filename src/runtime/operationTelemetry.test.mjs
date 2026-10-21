import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationTelemetry} from './operationTelemetry.js';
test('nested and concurrent spans retain their intervals without summing phases',async()=>{
 let now=0;const records=[],t=createOperationTelemetry({clock:()=>now,observers:[r=>records.push(r)]}),root=t.start('window.open');now=10;const a=t.start('metadata.read',{parentId:root.id});now=20;const b=t.start('style.read',{parentId:root.id});now=40;a.end();now=60;b.end();now=75;root.end();root.end();assert.deepEqual(records.map(r=>[r.name,r.durationMs]),[['metadata.read',30],['style.read',40],['window.open',75]]);assert.equal(records[0].parentId,root.id);assert.equal(records.length,3);
});
test('observer failures and rejected observer promises cannot change sync or async results',async()=>{
 const t=createOperationTelemetry({observers:[()=>{throw Error('observer');},async()=>{throw Error('observer');}]});assert.equal(t.measure('sync.run',()=>7),7);assert.equal(await t.measure('async.run',async()=>9),9);const error=Error('private operation detail');await assert.rejects(t.measure('async.fail',async()=>{throw error;}),e=>e===error);
});
test('disabled telemetry does not read the clock and subscription is reversible',()=>{
 let reads=0;const records=[],t=createOperationTelemetry({clock:()=>++reads});assert.equal(t.measure('runtime.run',()=>1),1);assert.equal(reads,0);const off=t.subscribe(r=>records.push(r));t.measure('runtime.run',()=>2);off();t.measure('runtime.run',()=>3);assert.equal(records.length,1);assert.deepEqual(Object.keys(records[0]),['id','parentId','name','startedAt','endedAt','durationMs','outcome']);
});
test('unsafe labels and broken clocks do not emit data or break the operation',()=>{
 const records=[],t=createOperationTelemetry({observers:[r=>records.push(r)]});assert.equal(t.measure('https://host/?token=secret',()=>5),5);assert.equal(records.length,0);const broken=createOperationTelemetry({clock:()=>{throw Error('clock');},observers:[r=>records.push(r)]});assert.equal(broken.measure('runtime.run',()=>6),6);assert.equal(records.length,0);
});
