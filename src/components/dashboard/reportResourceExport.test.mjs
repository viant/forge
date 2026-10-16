import test from "node:test";
import assert from "node:assert/strict";
import {exportSelectedReport, reportResourceControls} from "./reportResourceExport.js";
import {buildReportResourceRunRequest, hostedReportParameters, hostedReportResource, validateReportResourceRunResult} from "./reportBuilderResourceLifecycle.js";
const pin = {uri:"report://owned/revenue",kind:"working",contentFingerprint:"exact",authorityBinding:"owned",validUntil:"2030-01-01T00:00:00Z"};
test("canonical export preserves original pin and obtains only public artifact bytes", async () => {
    const calls = [];
    const services = {
        async submitResource(request) {calls.push(request);return {jobId:"job"};},
        async getStatus(request) {calls.push(request);return {status:"succeeded",artifactId:"artifact"};},
        async getArtifact(request) {calls.push(request);return {jobId:"job",artifactRef:pin.uri,format:"csv",data:"YWJj"};}
    };
    await exportSelectedReport({pin,parameters:{prefill:{account:"owned"}},format:"csv",services,isCurrent:()=>true});
    assert.deepEqual(calls[0], {...buildReportResourceRunRequest(pin,{prefill:{account:"owned"}}),format:"csv"});
    assert.deepEqual(calls[2],{artifactId:"artifact",includeData:true});
});
test("source drift, failed export and mismatched artifact never produce download", async () => {
    assert.throws(()=>validateReportResourceRunResult({resource:{...pin,contentFingerprint:"changed"},reportSpec:{},reportFill:{},reportPrint:{}},pin));
    const services={submitResource:async()=>({jobId:"job"}),getStatus:async()=>({status:"failed",error:"source drift denied"})};
    await assert.rejects(exportSelectedReport({pin,format:"pdf",services,isCurrent:()=>true}),/source drift/);
    services.getStatus=async()=>({status:"succeeded",artifactId:"other"});
    services.getArtifact=async()=>({jobId:"foreign",artifactRef:pin.uri,format:"pdf",data:"YWJj"});
    await assert.rejects(exportSelectedReport({pin,format:"pdf",services,isCurrent:()=>true}),/selected report artifact/);
});
test("pending export is distinct and superseded selection stops retrieval", async () => {
    let polls=0,current=true;
    const services={submitResource:async()=>({jobId:"job"}),getStatus:async()=>{polls++;return {status:"queued"};},getArtifact:async()=>{throw new Error("must not retrieve");}};
    assert.equal(await exportSelectedReport({pin,format:"xlsx",services,isCurrent:()=>current,wait:async()=>{current=false;}}),null);
    assert.equal(polls,1);
});
test("run result rejects provider, authority, revision and lease substitution", () => {
    const complete={resource:{...pin},reportSpec:{},reportFill:{},reportPrint:{}};
    assert.equal(validateReportResourceRunResult(complete,pin),complete);
    for (const field of ["providerIdentity","authorityBinding","revision","validUntil"]) {
        assert.throws(()=>validateReportResourceRunResult({...complete,resource:{...pin,[field]:"substitution"}},pin));
    }
});

test("canonical Print and export controls require capability, completed run and idle state", () => {
    assert.equal(reportResourceControls({canRun:true,canExport:false,result:{}}).exportDisabled,true);
    assert.equal(reportResourceControls({canRun:true,canExport:true,result:null}).exportDisabled,true);
    assert.equal(reportResourceControls({canRun:true,canExport:true,result:{},progress:"exporting"}).exportDisabled,true);
    assert.deepEqual(reportResourceControls({canRun:true,canExport:true,result:{}}),{runDisabled:false,exportDisabled:false});
});

test("authored binding outranks caller pin/capabilities and preserves existing scope args", () => {
    const container={dashboard:{reportBuilder:{reportResource:pin,reportCapabilities:{run:true,export:false}}},parameters:{reportResource:{...pin,uri:"report://foreign/other"},reportCapabilities:{export:true},prefill:{region:"owned"}}};
    assert.deepEqual(hostedReportResource(container),pin);
    assert.deepEqual(hostedReportParameters(container).reportCapabilities,{run:true,export:false});
    assert.deepEqual(buildReportResourceRunRequest(hostedReportResource(container),hostedReportParameters(container)).parameters,{region:"owned"});
});
