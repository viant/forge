import assert from "node:assert/strict";
import { buildReportBuilderHostServices } from "./reportBuilderHostServices.js";
const prior=globalThis.fetch;
const calls=[];
const id="12345678-1234-1234-1234-123456789ABC", ref=" opaque/ref ";
const input={uiRunRequestId:id,reportAdmissionRef:ref,requestedParams:{scope:[7]},effectiveParams:{scope:[7]}};
let wrong=false;
globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,options,body});
  assert.equal(options.credentials,"include");
  return {ok:true,status:200,text:async()=>JSON.stringify(url.includes("compile_fenced_report")
    ? {result:JSON.stringify({reportSpec:{server:1},reportFill:{server:2},reportPrint:{server:3}})}
    : {run:{reportRunId:"run",revision:1,status:"running",requestedParams:{scope:[wrong?8:7],_agentlyForecastCommand:{version:1,ref,requestId:id}}}})};
};
try {
  const services=buildReportBuilderHostServices({endpoints:{appAPI:{baseURL:"/v1/api"}},endpointName:"appAPI",conversationId:"conversation"});
  const begun=await services.reportRuns.begin(input);
  assert.equal(begun.reportAdmissionRef,ref);
  assert.equal(calls[0].body.reportAdmissionRef,ref);
  assert.equal(Object.hasOwn(calls[0].body.requestedParams,"_agentlyForecastCommand"),false);
  wrong=true;await assert.rejects(()=>services.reportRuns.begin(input),/identity and request/);
  const fences=[{kind:"forge-data",payload:{data:[{zero:0}],sourceBindings:{opaque:"preserved"}}}];
  await services.reportRuns.compile({conversationId:"conversation",reportAdmissionRef:ref,reportId:id,fences,invocation:{source:{id:"source"}}});
  assert.equal(calls.at(-1).body.reportAdmissionRef,ref);assert.deepEqual(calls.at(-1).body.fences,fences);
  assert.equal(Object.hasOwn(calls.at(-1).body,"conversationId"),false);
} finally {globalThis.fetch=prior;}
console.log("reportRunCommandHostServices: validated linkage and scoped compiler connector passed");
