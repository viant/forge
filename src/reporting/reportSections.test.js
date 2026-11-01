import assert from'node:assert/strict';import{test}from'node:test';import{buildRuntimeSections}from'./reportSections.js';import{buildReportPrintFromReportFill}from'./reportPrintModel.js';import{buildReportFillFromReportSpec}from'./reportFillModel.js';
const blocks=[{id:'tabs',kind:'tabGroupBlock',title:'Report',sectionIds:['dashboard'],includeUnlistedSections:false},{id:'metric',kind:'kpiBlock',title:'Amount',datasetRef:'primary',valueField:'amount',valueLabel:'Amount',content:{title:'Amount',valueField:'amount',valueLabel:'Amount',value:42,rowCount:1,sparkline:{labels:['one','two'],values:[10,32]}}},{id:'unlisted',kind:'markdownBlock',title:'Not owned',content:{markdown:'Must not print'}},{id:'dashboard',kind:'sectionBlock',title:'Dashboard',blockIds:['metric'],content:{blockIds:['metric']}}];
test('explicit section membership retains KPI cards before their heading',()=>{
 const sections=buildRuntimeSections(blocks);assert.deepEqual(sections.map(s=>({id:s.id,items:s.items.map(b=>b.id)})),[{id:'dashboard',items:['metric']}]);
 assert.deepEqual(buildRuntimeSections(blocks,new Set(['metric']))[0].items,[]);
});
test('print shares explicit ownership and includes the populated KPI and its sparkline',()=>{
 const spec={version:1,kind:'reportSpec',title:'Report',source:{kind:'report',containerId:'report',stateKey:'report',dataSourceRef:'approved'},parameters:{viewMode:'table',groupBy:'',pageSize:25,orderField:'',orderDir:'asc'},layoutIntent:{kind:'stack',resultPanePosition:'bottom',blockOrder:blocks.map(b=>b.id),items:[{blockId:'metric',span:3},{blockId:'dashboard'}]},refinements:[],calculatedFields:[],datasets:[{id:'primary',dataSourceRef:'approved',request:{}},{id:'daily',dataSourceRef:'approved',request:{}}],blocks:blocks.map(({content,...block})=>({...block,...(block.kind==='kpiBlock'?{sparkline:{datasetRef:'daily',categoryField:'day',valueField:'amount'}}:{}),...(block.kind==='markdownBlock'?{markdown:'Must not print'}:{})}))};
 const fill=buildReportFillFromReportSpec(spec,{primary:{rows:[{amount:42}]},daily:{rows:[{day:'one',amount:10},{day:'two',amount:32}]}});
 const output=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});const elements=output.pages.flatMap(p=>p.elements);
 assert.ok(elements.some(e=>e.id==='metric__sparkline'));assert.ok(elements.some(e=>e.text==='42'));assert.ok(!elements.some(e=>String(e.text).includes('Must not print')));
 const ids=elements.map(e=>e.id);assert.ok(ids.indexOf('dashboard__title_0')<ids.indexOf('metric__card'));
});


test('exclusive section filter ownership preserves global and legacy bars',async()=>{
 const {resolveRuntimeSectionFilterBars}=await import('./reportSections.js');
 const controls=[
  {id:'tabs',kind:'tabGroupBlock',sectionIds:['operations','quality','empty'],includeUnlistedSections:false},
  {id:'date',kind:'filterBarBlock'}, {id:'shared',kind:'filterBarBlock'}, {id:'qualityBar',kind:'filterBarBlock'},
  {id:'operations',kind:'sectionBlock',blockIds:['shared']},
  {id:'quality',kind:'sectionBlock',blockIds:['shared','qualityBar']},
  {id:'empty',kind:'sectionBlock',blockIds:[]},
 ];
 const ids=(selected,options)=>resolveRuntimeSectionFilterBars(controls,selected,options).map(block=>block.id);
 assert.deepEqual(ids('operations'),['date','shared']);
 assert.deepEqual(ids('quality'),['date','shared','qualityBar']);
 assert.deepEqual(ids('empty'),['date']);
 assert.deepEqual(ids('empty',{tabbed:false}),['date','shared','qualityBar']);
 assert.deepEqual(ids('quality',{visibleSectionIds:new Set(['empty'])}),['date']);
 const legacy=controls.map(block=>block.id==='tabs'?{...block,includeUnlistedSections:true}:block);
 assert.deepEqual(resolveRuntimeSectionFilterBars(legacy,'empty').map(block=>block.id),['date','shared','qualityBar']);
 // Recursive ownership matches the existing Go section dependency closure.
 controls.find(block=>block.id==='operations').blockIds=['group'];
 controls.push({id:'group',kind:'compositeBlock',childBlockIds:['shared']});
 assert.deepEqual(ids('operations'),['date','shared']);
});
