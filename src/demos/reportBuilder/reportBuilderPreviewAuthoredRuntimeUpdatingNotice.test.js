import assert from "node:assert/strict";
import {buildReportBuilderAuthoredRuntimePreviewState} from "../../components/dashboard/reportBuilderResultFrame.js";

const artifact = {runtimeBlock:{dashboard:{reportRuntime:{reportFill:{datasets:[{id:"primary",rows:[{value:1}]}]}}}}};
for (const [presentationMode,message] of [["preview","Updating results…"],["report","Updating this report with the latest results…"]]) {
 const state=buildReportBuilderAuthoredRuntimePreviewState({runtimePreviewEnabled:true,runtimePreviewArtifact:artifact,runtimePreviewRowsSource:{loading:true},canRunReport:true,presentationMode});
 assert.equal(state.loadingState,null);
 assert.equal(state.canRenderRuntime,true);
 assert.deepEqual(state.updatingNotice,{level:"info",message});
 const settled=buildReportBuilderAuthoredRuntimePreviewState({runtimePreviewEnabled:true,runtimePreviewArtifact:artifact,runtimePreviewRowsSource:{loading:false},canRunReport:true,presentationMode});
 assert.equal(settled.updatingNotice,null);
}
console.log("Authored preview and report retain rows and show update notices until loading settles.");
