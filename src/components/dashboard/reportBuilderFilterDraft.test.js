import assert from 'node:assert/strict';
import {draftReportFilters, applyReportFilterDraft} from './reportBuilderFilterDraft.js';
import {lowerReportBuilderPredicates} from './reportBuilderPredicates.js';
import {buildReportBuilderRequest} from './reportBuilderUtils.js';
const config = lowerReportBuilderPredicates({predicates: [
    {id:'dates',kind:'dateRange',startParamPath:'filters.from',endParamPath:'filters.to'},
    {id:'path',label:'SPO Path',paramPath:'filters.pathStatuses'},
    {id:'exchange',label:'Exchange',paramPath:'filters.exchangeIds',manualValueType:'int'},
]});
const state = {scopeParams:{dates:{start:'2026-09-01',end:'2026-09-07'}},dynamicGroups:{},reportDocumentTitle:'Original',page:3};
const draft = draftReportFilters({...state,scopeParams:{dates:{start:'2026-09-10',end:'2026-09-12'}},
    dynamicGroups:{scope:[{id:'one',filterId:'path',selections:[],manualValue:'DIRECT'}]}});
assert.equal(state.scopeParams.dates.start,'2026-09-01');
assert.deepEqual(state.dynamicGroups,{});
assert.equal(draft.reportDocumentTitle,undefined);
const result = applyReportFilterDraft({...state,reportDocumentTitle:'Latest'},draft,config.dynamicFilterGroups);
assert.equal(result.error,'');
assert.equal(result.state.reportDocumentTitle,'Latest');
assert.equal(result.state.page,1);
assert.equal(result.state.dynamicGroups.scope[0].manualValue,undefined);
const request = buildReportBuilderRequest(config,result.state);
assert.equal(request.filters.from,'2026-09-10');
assert.equal(request.filters.to,'2026-09-12');
assert.deepEqual(request.filters.pathStatuses,['DIRECT']);
assert.equal(config.dynamicFilterGroups[0].filters[0].manualEntry,true);
const invalid = applyReportFilterDraft(state,{dynamicGroups:{scope:[{id:'two',filterId:'exchange',manualValue:'bad',selections:[]}]}},config.dynamicFilterGroups);
assert.match(invalid.error,/Exchange/);
const numeric = applyReportFilterDraft(state,{dynamicGroups:{scope:[{id:'two',filterId:'exchange',manualValue:'42',selections:[]}]}},config.dynamicFilterGroups);
assert.equal(numeric.state.dynamicGroups.scope[0].selections[0].value,42);
const restricted = lowerReportBuilderPredicates({predicates:[{id:'locked',manualEntry:false},{id:'picker',dialogId:'lookup'}]});
assert.equal(restricted.dynamicFilterGroups[0].filters[0].manualEntry,false);
assert.equal(restricted.dynamicFilterGroups[0].filters[1].manualEntry,undefined);
console.log('Filter drafts preserve applied requests until Apply, validate input, and preserve picker restrictions');
const scoped = applyReportFilterDraft(state,draftReportFilters({...state,filterDatasetScopeParams:{secondary:{dates:{start:'2026-09-01',end:'2026-09-02'}}}}),[]);
assert.deepEqual(scoped.datasetScopeParams,{secondary:{dates:{start:'2026-09-01',end:'2026-09-02'}}});
assert.equal(scoped.state.filterDatasetScopeParams,undefined);
