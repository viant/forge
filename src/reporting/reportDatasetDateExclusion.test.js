import assert from 'node:assert/strict';
import {buildReportBuilderPublishedDatasetDeclarations} from './reportSpecModel.js';
const source={id:'summary',dataSourceRef:'cube',request:{measures:{spend:true},filters:{},limit:1},scopeParamOptions:[{id:'period',kind:'dateRange',paramPath:'filters.period',startParamPath:'filters.From',endParamPath:'filters.To'},{id:'entities',paramPath:'filters.entityIds'}]};
const primary={dataSourceRef:'cube',request:{filters:{From:'2026-01-01',To:'2026-01-31',period:'legacy',entityIds:[101],region:'west'}}};
const build=scope=>buildReportBuilderPublishedDatasetDeclarations({dataSources:[{...source,scope}]},{scopeParams:{}},new Set(['summary']),null,primary)[0].request;
assert.deepEqual(build({mode:'exclude',exclude:['period']}).filters,{entityIds:[101],region:'west'},'explicit date exclusion removes all declared bindings and only those bindings');
assert.deepEqual(build({mode:'exclude',exclude:['unrelated']}).filters,primary.request.filters,'unknown excluded ID cannot erase dates or broaden scope');
assert.deepEqual(build({mode:'exclude',exclude:['period'],local:{filters:{From:'2026-02-01',To:'2026-02-28'}}}).filters,{entityIds:[101],region:'west',From:'2026-02-01',To:'2026-02-28'},'authored local override is applied after inherited date exclusion');
console.log('dataset date scope exclusion preserves unrelated bindings and local-policy precedence');
