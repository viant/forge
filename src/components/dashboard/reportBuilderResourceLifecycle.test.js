import assert from "node:assert/strict";
import {buildReportBuilderResourceSaveRequest,buildReportResourceRunRequest,validateReportResourceRunResult,resourceEditorDocument,resourceEditorDefinition} from "./reportBuilderResourceLifecycle.js";
const pin={uri:"report://steward/performance",kind:"working",contentFingerprint:"a".repeat(64),authorityBinding:"alice-account"};
const request={reportDocument:{title:"New title"},reportSpec:{title:"New title"},reportId:"old-local-id",artifactRef:"old-local-alias",title:"New title"};
const current={resource:pin,rowEtag:8,draftRevision:3,resourceDefinition:{schemaVersion:1,format:"forge.authoredReport",reportDocument:{title:"Old"},builderDefinition:{id:"trusted"},dependencies:[{id:"source",contentFingerprint:"b".repeat(64)}]}};
const update=buildReportBuilderResourceSaveRequest(request,{current,idempotencyKey:"update-one"});
assert.equal(update.reportId,pin.uri);assert.equal(update.artifactRef,pin.uri);assert.equal(update.expectedRowEtag,8);assert.equal(update.expectedDraftRevision,3);assert.deepEqual(update.definition.builderDefinition,current.resourceDefinition.builderDefinition);assert.deepEqual(update.definition.dependencies,current.resourceDefinition.dependencies);
assert.throws(()=>buildReportBuilderResourceSaveRequest(request,{idempotencyKey:"new"}),/namespace and workspace/);
const create=buildReportBuilderResourceSaveRequest(request,{defaults:{namespace:"personal",workspaceId:"workspace"},idempotencyKey:"save-one"});assert.match(create.resource.uri,/^report:\/\/personal\//);assert.equal(create.workspaceId,"workspace");assert.equal(create.resource.revision,undefined);
const run=buildReportResourceRunRequest(pin,{prefill:{orderIds:[123]},reportDocument:{forged:true}});assert.deepEqual(run.parameters,{orderIds:[123]});assert.equal(run.reportDocument,undefined);
const result={resource:{...pin},reportSpec:{title:"Trusted"},reportFill:{},reportPrint:{}};assert.equal(validateReportResourceRunResult(result,pin),result);
assert.throws(()=>validateReportResourceRunResult({...result,resource:{...pin,authorityBinding:"new-account"}},pin),/selected/);
assert.throws(()=>validateReportResourceRunResult({...result,reportFill:null},pin),/selected/);
console.log("reportBuilderResourceLifecycle ✓ explicit destination, draft CAS, authored closure and server run pin");

const complete={...current,resourceDefinition:{...current.resourceDefinition,reportDocument:{title:"Sales",blocks:[{id:"text",kind:"markdownBlock",markdown:"Original"}]},builderDefinition:{dataSourceRef:"approved-source",reportBuilder:{fields:[{id:"approved"}]}},state:{selectedMeasures:["approved"]}}};
const editor=resourceEditorDocument(complete);assert.equal(editor.blocks[0].source.dataSourceRef,"approved-source");
editor.blocks[1].markdown="Edited";editor.blocks[0].state.selectedMeasures=["new-measure"];
const edited=resourceEditorDefinition(complete,editor);assert.equal(edited.reportDocument.blocks.length,1);assert.equal(edited.reportDocument.blocks[0].markdown,"Edited");assert.deepEqual(edited.state.selectedMeasures,["new-measure"]);assert.deepEqual(edited.builderDefinition,complete.resourceDefinition.builderDefinition);assert.deepEqual(edited.dependencies,complete.resourceDefinition.dependencies);
