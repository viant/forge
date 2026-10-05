import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const referenceRoot=process.argv[2] || new URL('../',import.meta.url).pathname;
const {buildReportBuilderPublishedDatasetDeclarations}=await import(pathToFileURL(path.join(referenceRoot,'src/reporting/reportSpecModel.js')));
process.env.TZ='UTC';
const RealDate=Date;const now='2026-10-04T12:00:00.000Z';
globalThis.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return new RealDate(now).getTime();}};
const identity={windowId:'window-a',builderRef:'scoped-builder',formRevision:2,stateRevision:3};
const primary={measures:{spend:true},dimensions:{},filters:{From:'2026-09-27',To:'2026-10-04',entityIds:[101]},limit:1,offset:0};
const options=[{id:'entities',kind:'multiSelect',paramPath:'filters.entityIds'},{id:'dateRange',kind:'dateRange',startParamPath:'filters.From',endParamPath:'filters.To'}];
const base={id:'summary',dataSourceRef:'cube',scope:{mode:'inherit'},scopeParamOptions:options,request:{measures:{spend:true},dimensions:{},filters:{},limit:1,offset:0}};
const cases=[];
function add(name,patch={}) {
 const input={identity,preparedIdentity:identity,status:'ready',hookStatus:'completed',primaryDataSourceRef:'cube',primaryRequest:primary,state:{scopeParams:{}},source:base,...patch};
 let expected;
 if(input.status!=='ready')expected={status:input.status};
 else if(JSON.stringify(input.identity)!==JSON.stringify(input.preparedIdentity))expected={status:'pending',reason:'stale-preparation'};
 else if(input.hookStatus==='unsupported')expected={status:'error',reason:'unsupported-hook'};
 else if((input.requiredBindings||[]).some(b=>JSON.stringify(b.path.split('.').reduce((v,k)=>v?.[k],input.primaryRequest))!==JSON.stringify(b.value)))expected={status:'error',reason:'unbound-intent'};
 else if(!input.source.request || typeof input.source.request!=='object' || Array.isArray(input.source.request))expected={status:'error',reason:'missing-request'};
 else {
  try {
   const result=buildReportBuilderPublishedDatasetDeclarations({dataSources:[input.source]},input.state,new Set([input.source.id]),input.datasetScopeParams||null,{dataSourceRef:input.primaryDataSourceRef,request:input.primaryRequest});
   expected={status:'ready',request:result[0]?.request};
   if(!expected.request)throw Error('No request');
  }catch(e){expected={status:'error',reason:'invalid-scope-policy'};}
 }
 cases.push({name,...input,expected});
}
add('inherit-scoped-primary');
add('pending-initialization-does-not-fetch',{status:'pending',primaryRequest:{}});
add('ready-global-is-valid',{primaryRequest:{measures:{spend:true},dimensions:{},filters:{},limit:1,offset:0}});
add('ready-empty-primary-explicit-global',{primaryRequest:{}});
add('missing-bound-intent-is-error',{primaryRequest:{...primary,filters:{}},requiredBindings:[{path:'filters.entityIds',value:[101]}]});
add('changed-bound-intent-is-error',{primaryRequest:{...primary,filters:{entityIds:[999]}},requiredBindings:[{path:'filters.entityIds',value:[101]}]});
add('variant-switch-stale-preparation',{identity:{...identity,builderRef:'alternate-builder'}});
add('form-change-stale-preparation',{identity:{...identity,formRevision:3}});
add('declared-hook-unavailable',{hookStatus:'unsupported'});
add('override-local-entity',{source:{...base,scope:{mode:'override',local:{filters:{entityIds:[202]}}}}});
add('append-inherited-entity-wins',{source:{...base,scope:{mode:'append',local:{filters:{entityIds:[202],region:'west'}}}}});
add('exclude-one-param',{source:{...base,scope:{mode:'exclude',exclude:['entities']}}});
add('exclude-all-declared-concrete-paths-global',{source:{...base,scopeParamOptions:[options[0],{id:'from',paramPath:'filters.From'},{id:'to',paramPath:'filters.To'}],scope:{mode:'exclude',exclude:['entities','from','to']}}});
add('exclude-date-range-all-declared-paths',{source:{...base,scope:{mode:'exclude',exclude:['dateRange']}}});
add('exclude-date-then-local-replacement',{source:{...base,scope:{mode:'exclude',exclude:['dateRange'],local:{filters:{From:'2026-08-01',To:'2026-08-31'}}}}});
add('exclude-unknown-preserves-scope',{source:{...base,scope:{mode:'exclude',exclude:['unknown']}}});
add('override-relative-today',{source:{...base,scope:{mode:'override',relativeDateRange:{preset:'today',startParamPath:'filters.From',endParamPath:'filters.To'}}}});
add('override-relative-last-seven-days',{source:{...base,scope:{mode:'override',relativeDateRange:{preset:'last7days',startParamPath:'filters.From',endParamPath:'filters.To'}}}});
add('dataset-scoped-value',{datasetScopeParams:{summary:{entities:[303]}}});
add('state-scope-param',{state:{scopeParams:{entities:[404]}}});
add('different-source-only-declared-scope',{primaryDataSourceRef:'other-cube'});
add('different-source-no-declared-inheritance',{primaryDataSourceRef:'other-cube',source:{...base,scopeParamOptions:[]}});
add('missing-request-is-not-inferred-from-fields',{source:{id:'summary',dataSourceRef:'cube',fields:[{key:'spend'}]}});
add('unknown-scope-policy-rejected',{source:{...base,scope:{mode:'guess'}}});
add('empty-exclusion-rejected',{source:{...base,scope:{mode:'exclude',exclude:[]}}});
fs.writeFileSync(new URL('../testdata/native-report-preparation/published-requests.json',import.meta.url),JSON.stringify({version:1,generatedBy:'src/reporting/reportSpecModel.js buildReportBuilderPublishedDatasetDeclarations',now,timeZone:'UTC',cases},null,2)+'\n');
console.log(`Wrote ${cases.length} native preparation cases from the canonical web publisher.`);
