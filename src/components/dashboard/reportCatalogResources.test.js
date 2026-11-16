import assert from "node:assert/strict";
import {
    buildReportCatalogListRequest,
    formatReportCatalogDate,
    buildReportCatalogMutationRequest,
    buildReportCatalogResourceRequest,
    reportCatalogContext,
    normalizeReportCatalogResources,
    readReportCatalogResource,
} from "./reportCatalogResources.js";

const pin = {uri:"report://analytics/performance",kind:"working",providerIdentity:"sample-owner",contentFingerprint:"a".repeat(64),authorityBinding:"account:user:policy",validUntil:"2026-10-09T00:00:00Z"};
const reports = normalizeReportCatalogResources({reports:[
    {resourceUri:pin.uri,resource:pin,ownedByCurrentUser:true,ownerId:"same-browser-user",capabilities:{open:true,run:false}},
    {resourceUri:"report://shared/performance",ownedByCurrentUser:false,ownerId:"same-browser-user",capabilities:{open:"true",edit:true}},
    {reportId:"legacy",artifactId:"legacy"},
    {resourceUri:"report://analytics/.."},
    {resourceUri:"report://analytics/wrong",namespace:"other"},
    {resourceUri:"report://analytics/mismatch",resource:pin},
]});
assert.equal(reports.length,2,"canonical entries need no report/artifact IDs; legacy/mismatched entries are excluded");
assert.equal(reports[0].resource,pin,"keep the entire server pin");
assert.equal(reports[1].capabilities.open,false,"capabilities require explicit server booleans");
assert.equal(reports[1].capabilities.delete,false);
assert.deepEqual(buildReportCatalogListRequest("user"),{limit:0,currentUserOnly:true});
assert.deepEqual(buildReportCatalogListRequest("all"),{limit:0,currentUserOnly:false});
const nested = "report://users/owner/copies/example";
assert.equal(normalizeReportCatalogResources([{resourceUri:nested}])[0].name,"owner/copies/example");
for (const suffix of ["/", "/./child", "/../child", "//child"]) assert.deepEqual(normalizeReportCatalogResources([{resourceUri:nested+suffix}]),[]);
const binding=reportCatalogContext({scope:{label:"Current collection",key:"category",parameters:["selected"]}},{resourceRef:{uri:"window://sample/catalog"}},{selected:[false,0]});
assert.deepEqual(binding,{namespace:"sample",scope:{key:"category",value:[false,0]}});
assert.deepEqual(buildReportCatalogListRequest("context",binding),{namespace:"sample",scope:binding.scope,limit:0,currentUserOnly:false});
assert.equal(buildReportCatalogListRequest("context",{}),null);
const request = buildReportCatalogResourceRequest(reports[0]);
assert.deepEqual(request.resource,{uri:pin.uri,revision:"working"});
assert.equal(request.resolvedResource,pin);
assert.deepEqual(buildReportCatalogResourceRequest({...reports[1],resource:{uri:reports[1].resourceUri,kind:"stamped",revision:"release-1"}}).resource,{uri:reports[1].resourceUri,revision:"release-1"});
let received;
const read = await readReportCatalogResource(reports[0],{getReport:async request=>{received=request;return {resource:{...pin}};}});
assert.deepEqual(received,{...request,sourceProvider:pin.providerIdentity});
assert.equal(read.resource.contentFingerprint,pin.contentFingerprint);
for (const changed of [{uri:"report://shared/performance"},{kind:"stamped",revision:"release-1"},{contentFingerprint:"b".repeat(64)},{authorityBinding:"different-account"}]) {
    await assert.rejects(readReportCatalogResource(reports[0],{getReport:async ()=>({resource:{...pin,...changed}})}),/selected resource|selected report changed/);
}
await assert.rejects(readReportCatalogResource(reports[0],{}),/unavailable/);
console.log("reportCatalogResources ✓ canonical identity, server ownership/capabilities, pinned action refs and read preflight");

const editable = {...reports[0],rowEtag:8,draftRevision:3,workspaceId:"trusted-workspace"};
const mutation = buildReportCatalogMutationRequest(editable,"update","operation-123");
assert.equal(mutation.expectedRowEtag,8);
assert.equal(mutation.expectedDraftRevision,3);
assert.equal(mutation.expectedContentFingerprint,pin.contentFingerprint);
assert.equal(mutation.resolvedResource,pin);
const clone = buildReportCatalogMutationRequest(editable,"duplicate","operation-123");
assert.equal(clone.targetWorkspaceId,undefined);
assert.equal(clone.targetUri,undefined);
assert.throws(()=>buildReportCatalogMutationRequest(reports[0],"update","op"),/Refresh/);
assert.throws(()=>buildReportCatalogMutationRequest({...editable,resource:{...pin,kind:"stamped",revision:"1"}},"update","op"),/draft/);

for (const missing of ["",null,undefined,"invalid","0001-01-01T00:00:00Z","0001-01-01T00:00:00.000000000Z"]) assert.equal(formatReportCatalogDate(missing),"—");
for (const actual of ["1960-06-15T12:00:00Z","1970-01-01T00:00:00Z","2026-10-07T12:00:00Z"]) assert.notEqual(formatReportCatalogDate(actual),"—");

await assert.rejects(readReportCatalogResource(reports[0],{getReport:async input=>{
    assert.equal(input.sourceProvider,pin.providerIdentity);
    return {resource:{...pin,providerIdentity:"another-publisher"}};
}}),/changed/);

const personalCopy = buildReportCatalogMutationRequest({resourceUri:pin.uri,resource:pin,title:"Sample"},"duplicate","copy-attempt");
assert.equal(personalCopy.resolvedResource,pin);
assert.equal(personalCopy.title,"Copy of Sample");
assert.ok(!Object.hasOwn(personalCopy,"targetUri") && !Object.hasOwn(personalCopy,"targetWorkspaceId"));
