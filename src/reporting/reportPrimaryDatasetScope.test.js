import assert from 'node:assert/strict';
import {buildReportBuilderReportSpec} from './reportSpecModel.js';
import {buildReportBuilderDefaultState} from '../components/dashboard/reportBuilderUtils.js';
import {buildReportBuilderReportDocument,lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {validateReportSpec} from './schema/reportSchemas.js';

// Independently authored synthetic controls share a producer destination.
const container={id:'records',stateKey:'records',dataSourceRef:'records'};
const config={title:'Records',measures:[{id:'quantity',key:'quantity',paramPath:'measures.quantity',default:true}],request:{baseParameters:{filters:{account:17}}},predicates:[
 {id:'overviewTag',kind:'value',pinned:true,multiple:true,paramPath:'filters.tag',default:['alpha']},
 {id:'detailTag',kind:'value',pinned:true,multiple:true,paramPath:'filters.tag',default:['beta']},
]};
const project=(scope,patch={})=>{
 const effective={...config,...patch,scope};
 return buildReportBuilderReportSpec({container,config:effective,state:buildReportBuilderDefaultState(effective)});
};
for(const [scope,want] of [
 [undefined,['beta']],[{mode:'inherit'},['beta']],
 [{mode:'exclude',exclude:['overviewTag']},['beta']],
 [{mode:'exclude',exclude:['detailTag']},['alpha']],
 [{mode:'exclude',exclude:['overviewTag','detailTag']},undefined],
 [{mode:'exclude',exclude:['unknown']},['beta']],
]){
 const spec=project(scope),request=spec.datasets[0].request;
 assert.deepEqual(request.filters.tag,want);
 assert.equal(request.filters.account,17);
 assert.deepEqual(spec.scope.params.map(p=>p.value),[['alpha'],['beta']]);
 assert.equal(validateReportSpec(spec).valid,true);
}
const excluded={mode:'exclude',exclude:['overviewTag','detailTag']};
assert.deepEqual(project(excluded,{request:{baseParameters:{filters:{account:17,tag:['fixed']}}}}).datasets[0].request.filters,{account:17,tag:['fixed']});
assert.deepEqual(project({...excluded,local:{filters:{tag:['local']}}}).datasets[0].request.filters,{account:17,tag:['local']});
assert.deepEqual(project({mode:'append',local:{filters:{tag:['local'],region:'west'}}}).datasets[0].request.filters,{account:17,tag:['beta'],region:'west'});
assert.deepEqual(project({mode:'override',local:{filters:{tag:['local'],region:'west'}}}).datasets[0].request.filters,{account:17,tag:['local'],region:'west'});

const dateConfig={predicates:[{id:'period',kind:'dateRange',pinned:true,startParamPath:'filters.from',endParamPath:'filters.to',default:{start:'2031-04-01',end:'2031-04-30'}}],request:{baseParameters:{filters:{account:17,from:'2031-01-01'}}}};
assert.deepEqual(project({mode:'exclude',exclude:['period']},dateConfig).datasets[0].request.filters,{account:17,from:'2031-01-01'});
const semanticConfig={binding:{mode:'semantic',modelRef:'recordsModel',entity:'record'},predicates:config.predicates.map(p=>({...p,semanticRef:'tag.member'}))};
const semantic=project({mode:'exclude',exclude:['detailTag']},semanticConfig);
assert.deepEqual(semantic.datasets[0].request.semanticSelection.parameters,{'tag.member':['alpha']});
assert.deepEqual(project(excluded,semanticConfig).datasets[0].request.semanticSelection.parameters,{});
assert.deepEqual(project(excluded,semanticConfig).datasets[0].request.semanticSelection.selection.measures,[]);

const customPredicates=config.predicates.map(p=>({...p,paramPath:'customFilters.tag'}));
const custom=project(excluded,{predicates:customPredicates});
assert.equal(Object.hasOwn(custom.datasets[0].request,'customFilters'),false);
assert.equal(validateReportSpec(custom).valid,true);
// Fixed producer arguments remain authoritative even when a generated binding is excluded.
assert.deepEqual(project(excluded,{predicates:customPredicates,request:{baseParameters:{filters:{account:17},customFilters:{tag:['fixed']}}}}).datasets[0].request.customFilters,{tag:['fixed']});

const publishedConfig={...config,scope:excluded,dataSources:[{id:'detail',dataSourceRef:'records',request:{filters:{},limit:10,offset:0},scopeParamOptions:[{id:'overviewTag',paramPath:'filters.tag'},{id:'detailTag',paramPath:'filters.tag'}],scope:{mode:'exclude',exclude:['overviewTag']}}]};
const state={...buildReportBuilderDefaultState(publishedConfig),reportDocumentBlocks:[{id:'detailTable',kind:'tableBlock',datasetRef:'detail',columns:[{key:'quantity',label:'Quantity'}]}]};
const spec=buildReportBuilderReportSpec({container,config:publishedConfig,state});
assert.equal(spec.datasets[0].request.filters.tag,undefined);
assert.deepEqual(spec.datasets.find(d=>d.id==='detail').request.filters.tag,['beta']);
const before=JSON.stringify({config:publishedConfig,state});
const document=buildReportBuilderReportDocument({container,config:publishedConfig,state});
const lowered=lowerReportDocumentToReportSpec(document);
assert.equal(lowered.datasets.find(d=>d.id==='primary').request.filters.tag,undefined);
assert.deepEqual(lowered.datasets.find(d=>d.id==='detail').request.filters.tag,['beta']);
assert.equal(JSON.stringify({config:publishedConfig,state}),before);
console.log('primary dataset scope preserves fixed requests, independent aliases, dates and semantic bindings');
