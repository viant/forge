import assert from 'node:assert/strict';
import test from 'node:test';
import {buildReportResourceRunRequest, buildReportBuilderResourceSaveRequest} from './reportBuilderResourceLifecycle.js';
import {buildHostedReportActivationRequest} from './reportBuilderHostedReportActivation.js';
import {readReportCatalogResource} from './reportCatalogResources.js';

const pin = {uri:'report://example/summary',kind:'published',contentFingerprint:'a'.repeat(64),authorityBinding:'local-cohort-selection',validUntil:'2099-01-01T00:00:00Z'};
test('cohort report activation and run use URI plus selected hash, never a revision', async () => {
 const run=buildReportResourceRunRequest(pin,{prefill:{region:'north'}});
 assert.deepEqual(run.resource,{uri:pin.uri});assert.deepEqual(run.resolvedResource,pin);
 const activation=buildHostedReportActivationRequest(pin.uri,'',pin);
 assert.deepEqual(activation.resource,{uri:pin.uri});
 const result=await readReportCatalogResource({resourceUri:pin.uri,resource:pin},{getReport:async()=>({resource:pin})});
 assert.equal(result.resource.kind,'published');
});
test('cohort report cannot independently select a revision or mutate the publication',()=>{
 const revision={...pin,revision:'7'};
 assert.throws(()=>buildReportResourceRunRequest(revision));
 assert.throws(()=>buildHostedReportActivationRequest(pin.uri,'',revision));
 assert.throws(()=>buildReportBuilderResourceSaveRequest({}, {current:{resource:pin},idempotencyKey:'synthetic-request'}));
});
