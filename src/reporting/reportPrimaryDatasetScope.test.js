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

// Documents capture generated requests; an old capture must not revive excluded defaults.
const noBaseFilters={...config,scope:excluded,request:{baseParameters:{resultSet:'summary'}}};
const noBaseState=buildReportBuilderDefaultState(noBaseFilters);
const captured=buildReportBuilderReportDocument({container,config:noBaseFilters,state:noBaseState});
assert.equal(captured.datasets.find(d=>d.id==='primary').request.filters?.tag,undefined);
const oldCapture=structuredClone(captured);
oldCapture.datasets.find(d=>d.id==='primary').request.filters={tag:['beta']};
assert.equal(lowerReportDocumentToReportSpec(oldCapture).datasets.find(d=>d.id==='primary').request.filters?.tag,undefined);
const fixedConfig={...noBaseFilters,request:{baseParameters:{filters:{account:17,tag:['fixed']}}}};
const fixedDocument=buildReportBuilderReportDocument({container,config:fixedConfig,state:buildReportBuilderDefaultState(fixedConfig)});
assert.deepEqual(lowerReportDocumentToReportSpec(fixedDocument).datasets.find(d=>d.id==='primary').request.filters,{account:17,tag:['fixed']});

const aliases= config.predicates.map(p=>({id:p.id,paramPath:p.paramPath}));
const independent={...noBaseFilters,dataSources:[
 {id:'overview',dataSourceRef:'records',request:{limit:10},scopeParamOptions:aliases,scope:{mode:'exclude',exclude:['detailTag']}},
 {id:'detail',dataSourceRef:'records',request:{limit:10},scopeParamOptions:aliases,scope:{mode:'exclude',exclude:['overviewTag']}},
]};
for(const [values,overview,detail] of [
 [{},['alpha'],['beta']],
 [{overviewTag:[],detailTag:['gamma']},undefined,['gamma']],
 [{overviewTag:null,detailTag:['gamma']},undefined,['gamma']],
 [{overviewTag:['gamma'],detailTag:[]},['gamma'],undefined],
 [{overviewTag:[],detailTag:[]},undefined,undefined],
]){
 const effectiveState={...buildReportBuilderDefaultState(independent),scopeParams:{...buildReportBuilderDefaultState(independent).scopeParams,...values},reportDocumentBlocks:[
  {id:'overviewTable',kind:'tableBlock',datasetRef:'overview',columns:[{key:'quantity',label:'Quantity'}]},
  {id:'detailTable',kind:'tableBlock',datasetRef:'detail',columns:[{key:'quantity',label:'Quantity'}]},
 ]};
 const result=lowerReportDocumentToReportSpec(buildReportBuilderReportDocument({container,config:independent,state:effectiveState}));
 assert.equal(result.datasets.find(d=>d.id==='primary').request.filters?.tag,undefined);
 assert.deepEqual(result.datasets.find(d=>d.id==='overview').request.filters?.tag,overview);
 assert.deepEqual(result.datasets.find(d=>d.id==='detail').request.filters?.tag,detail);
 assert.equal(validateReportSpec(result).valid,true);
}
const clearDateConfig={...config,predicates:dateConfig.predicates,scope:{mode:'inherit'},request:{baseParameters:{filters:{account:17}}}};
const clearDateState={...buildReportBuilderDefaultState(clearDateConfig),scopeParams:{period:null}};
assert.deepEqual(buildReportBuilderReportSpec({container,config:clearDateConfig,state:clearDateState}).datasets[0].request.filters,{account:17});
