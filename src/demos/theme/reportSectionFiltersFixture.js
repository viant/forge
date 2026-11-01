import {signal} from '@preact/signals-react';

// Independently authored synthetic controls, without external data or transport.
export const sectionFilterParams = [
 {id:'period',label:'Observation period',type:'dateRange',kind:'dateRange',required:true,value:{start:'2026-01-01',end:'2026-01-31'}},
 ...['mode','quality'].map(id=>({id,label:id==='mode'?'Operation mode':'Quality level',type:'select',kind:'select',required:true,value:1,options:[{label:'First '+id,value:1},{label:'Second '+id,value:2}]})),
];
export const sectionFilterBlocks = [
 {id:'tabs',kind:'tabGroupBlock',sectionIds:['operations','inventory','qualitySection','empty'],defaultSectionId:'operations',includeUnlistedSections:false},
 {id:'periodBar',kind:'filterBarBlock',title:'Period',paramIds:['period']},
 {id:'modeBar',kind:'filterBarBlock',title:'Operations controls',paramIds:['mode']},
 {id:'qualityBar',kind:'filterBarBlock',title:'Quality controls',paramIds:['quality']},
 {id:'operations',kind:'sectionBlock',title:'Operations',blockIds:['modeBar','operationsBody']},
 {id:'operationsBody',kind:'markdownBlock',markdown:'Operations observations'},
 {id:'inventory',kind:'sectionBlock',title:'Inventory',blockIds:['modeBar']},
 {id:'qualitySection',kind:'sectionBlock',title:'Quality',blockIds:['qualityBar']},
 {id:'empty',kind:'sectionBlock',title:'Empty',blockIds:[]},
];

export function createSectionFilterBuilderFixture() {
 const state={reportDocumentBlocks:sectionFilterBlocks,staticFilters:{mode:2,quality:1,period:{start:'2026-01-01',end:'2026-01-31'}},selectedMeasures:['amount'],selectedDimensions:[],primaryMeasure:'amount',viewMode:'table'};
 const context={signals:{windowForm:signal({sectionFilters:state}),collection:signal([{amount:5}]),control:signal({loaded:true}),collectionInfo:signal({hasMore:false}),input:signal({parameters:{}}),form:signal({}),metrics:signal({}),selection:signal({}),message:signal(null)},handlers:{dataSource:{getFormData:()=>({}),setWindowFormData:({values})=>{context.signals.windowForm.value={...context.signals.windowForm.value,...values};},setInputParameters:()=>{},fetchRecords:async()=>({rows:[]})}},lookupHandler:()=>args=>args?.state||args?.request||null,Context:()=>context};
 const container={id:'sectionFilters',stateKey:'sectionFilters',dataSourceRef:'readings',reportBuilder:{filterPresentation:'left',staticFilters:sectionFilterParams,measures:[{id:'amount',key:'amount',label:'Amount',default:true}],result:{defaultMode:'table',viewModes:['table'],runtimePreview:{enabled:true}}}};
 return {context,container};
}
