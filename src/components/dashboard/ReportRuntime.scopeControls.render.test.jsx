import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect, it, vi} from 'vitest';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';
import {DashboardReportRuntime} from './DashboardBlocks.jsx';
import ReportRuntime from './ReportRuntime.jsx';

it('mounts native controls, refreshes through the datasource, resets pages and hides stale rows', async () => {
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let input={page:3,parameters:{actor:'fixed',query:{offset:50,limit:25,filters:{mode:1,threshold:10,fixed:7}}}};
 const control=signal({loaded:true,loading:false});const collection=signal([{name:'Old evidence',amount:10}]);let fetches=0;
 const source={signals:{control,collection},handlers:{dataSource:{peekInput:()=>input,setLoading:loading=>{control.value={...control.value,loading};},setError:error=>{control.value={...control.value,error};},setInputParameters:parameters=>{input={...input,parameters};},setPage:page=>{input={...input,page};},fetchCollection:()=>{fetches++;}}}};
 const scope={dataSourceRef:'reader',params:[{id:'mode',kind:'select',label:'Mode',required:true,value:1,options:[{label:'First mode',value:1},{label:'Second mode',value:2}],filterBindings:[{datasetRef:'primary',path:'mode'}]},{id:'threshold',kind:'integer',label:'Threshold',required:true,value:10,filterBindings:[{datasetRef:'primary',path:'threshold'}]}]};
 const reportSpec={title:'Synthetic readings',scope,datasets:[{id:'primary',request:input.parameters.query}],layoutIntent:{blockOrder:['filters','evidence']},blocks:[{id:'filters',kind:'filterBarBlock',title:'Inputs',paramIds:['mode','threshold']},{id:'evidence',kind:'tableBlock',title:'Evidence',datasetRef:'primary',columns:[{key:'name',label:'Name'},{key:'amount',label:'Amount',dataType:'number'}]}]};
 const container={reportRuntime:{reportSpec,datasetBindings:{primary:{dataSourceRef:'reader',queryPath:'query'}},presentationMode:'report'}};
 const context={Context:()=>source};
 reportSpec.viewer={appearance:'document'};
 scope.params.push({id:'period',kind:'dateRange',label:'Period',required:true,value:{start:'2026-01-01',end:'2026-01-31'},filterBindings:[{datasetRef:'primary',path:'from',valuePath:'start'},{datasetRef:'primary',path:'to',valuePath:'end'}]},
  {id:'requiredKinds',kind:'select',label:'Required kinds',required:true,multiple:true,value:['a'],options:[{label:'Required alpha',value:'a'},{label:'Required beta',value:'b'}],filterBindings:[{datasetRef:'primary',path:'requiredKinds'}]},
  {id:'optionalKinds',kind:'select',label:'Optional kinds',required:false,multiple:true,value:['x'],options:[{label:'Optional gamma',value:'x'}],filterBindings:[{datasetRef:'primary',path:'optionalKinds'}]});
 reportSpec.blocks[0].paramIds.push('period','requiredKinds','optionalKinds');
 scope.params.push({id:'optionalCount',kind:'integer',label:'Optional count',required:false,value:5,filterBindings:[{datasetRef:'primary',path:'optionalCount'}]},
  {id:'optionalAmount',kind:'number',label:'Optional amount',required:false,value:1.5,filterBindings:[{datasetRef:'primary',path:'optionalAmount'}]});
 reportSpec.blocks[0].paramIds.push('optionalCount','optionalAmount');
 const render=()=>root.render(<DashboardReportRuntime container={container} context={context}/>);
 try {
  await act(async()=>render());expect(host.textContent).toContain('Old evidence');
  expect(host.querySelector('[aria-label="Toggle report filters"]').getAttribute('aria-pressed')).toBe('false');
  await act(async()=>host.querySelector('[aria-label="Toggle report filters"]').click());
  expect(host.querySelector('[data-report-runtime-block-id="filters"]')).toBeTruthy();
  const choose=[...host.querySelectorAll('button')].find(b=>b.textContent==='Second mode');expect(choose).toBeTruthy();
  await act(async()=>choose.click());
  expect(fetches).toBe(1);expect(input.page).toBe(1);expect(input.parameters.actor).toBe('fixed');
  expect(input.parameters.query).toEqual({offset:0,limit:25,filters:{mode:2,threshold:10,fixed:7}});
  expect(host.textContent).toContain('Loading report');expect(host.textContent).not.toContain('No data');expect(host.textContent).not.toContain('Old evidence');
  expect(choose.isConnected).toBe(true);
  expect(host.querySelector('[aria-label="Toggle report filters"]').getAttribute('aria-pressed')).toBe('true');
  await act(async()=>{collection.value=[{name:'New evidence',amount:3}];control.value={loaded:true,loading:false};});
  expect(host.textContent).toContain('New evidence');expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Second mode').getAttribute('aria-pressed')).toBe('true');
  const field=host.querySelector('input[type="number"]');expect(field).toBeTruthy();
  await act(async()=>{field.value='25';field.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));});
  expect(input.parameters.query.filters.threshold).toBe(25);expect(fetches).toBe(2);
  await act(async()=>{control.value={loaded:true,loading:false,error:{status:403}};});
  expect(host.querySelector('[role="alert"]')).toBeTruthy();expect(host.textContent).not.toContain('No data');expect(host.textContent).not.toContain('New evidence');
  await act(async()=>{collection.value=[];control.value={loaded:true,loading:false};});
  expect(host.textContent).toContain('No data');expect(host.textContent).not.toContain('New evidence');
  const endDate=host.querySelector('input[aria-label="End date or relative expression"]');
  await act(async()=>{endDate.value='2026-02-28';endDate.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(fetches).toBe(2); // Editing a date does not unmount its field mid-keystroke.
  await act(async()=>endDate.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
  expect(fetches).toBe(3);expect(input.parameters.query.filters.from).toBe('2026-01-01');expect(input.parameters.query.filters.to).toBe('2026-02-28');
  await act(async()=>{control.value={loaded:true,loading:false};});
  const button=label=>[...host.querySelectorAll('button')].find(b=>b.textContent===label);
  await act(async()=>button('Required alpha').click());expect(fetches).toBe(3);
  expect(button('Required alpha').getAttribute('aria-pressed')).toBe('true');
  await act(async()=>button('Required beta').click());expect(fetches).toBe(4);expect(input.parameters.query.filters.requiredKinds).toEqual(['a','b']);
  await act(async()=>{control.value={loaded:true,loading:false};});
  await act(async()=>button('Optional gamma').click());expect(fetches).toBe(5);expect(input.parameters.query.filters.optionalKinds).toEqual([]);
  expect(input.page).toBe(1);expect(input.parameters.query.offset).toBe(0);expect(input.parameters.actor).toBe('fixed');expect(input.parameters.query.filters.fixed).toBe(7);
  const effective=structuredClone(input.parameters.query);
  const edit=async(label,value)=>act(async()=>{
    const field=host.querySelector(`input[aria-label="${label}"]`);
    field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
  });
  await edit('Threshold','');expect(host.textContent).toContain('A value is required.');expect(fetches).toBe(5);
  await edit('Threshold','9007199254740993');expect(host.textContent).toContain('Enter a whole number between');expect(fetches).toBe(5);
  expect(host.querySelector('input[aria-label="Threshold"]').getAttribute('aria-invalid')).toBe('true');
  await edit('Threshold','25');
  for(const [draft,message] of [['not-a-date','Enter a valid date'],['2026-03-01','Start date must be on or before end date.'],['2026-02-30','Enter a valid date']]){
    await edit('Start date or relative expression',draft);expect(host.textContent).toContain(message);expect(fetches).toBe(5);expect(input.parameters.query).toEqual(effective);
  }
  await edit('Start date or relative expression','2026-01-01');expect(host.querySelector('p[role="alert"]')).toBeNull();
  await edit('Optional count','');expect(input.parameters.query.filters.optionalCount).toBeNull();expect(fetches).toBe(6);
  await edit('Optional amount','');expect(input.parameters.query.filters.optionalAmount).toBeNull();expect(fetches).toBe(7);
  expect(input.parameters.query.filters.threshold).toBe(25);expect(input.parameters.query.filters.from).toBe('2026-01-01');expect(input.parameters.query.filters.fixed).toBe(7);
  expect(host.querySelector('p[role="alert"]')).toBeNull();
 } finally {await act(async()=>root.unmount());host.remove();}
});

it('retains the selected tab and open filters while resetting local table pages to the new first page', async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let input={page:4,parameters:{query:{offset:75,limit:1000,filters:{mode:1,fixed:9}}}};
 const control=signal({loaded:true});
 const rows=(base,label)=>Array.from({length:60},(_,i)=>({id:base+i,label:`${label} ${i}`}));
 const collection=signal(rows(1,'Old reading'));
 const source={signals:{control,collection},handlers:{dataSource:{peekInput:()=>input,setLoading:loading=>{control.value={...control.value,loading};},setError:error=>{control.value={...control.value,error};},setInputParameters:parameters=>{input={...input,parameters};},setPage:page=>{input={...input,page};},fetchCollection:()=>{}}}};
 const spec={title:'Sections',viewer:{appearance:'document'},scope:{dataSourceRef:'reader',params:[{id:'mode',kind:'select',label:'Mode',required:true,value:1,options:[{label:'First',value:1},{label:'Second',value:2}],filterBindings:[{datasetRef:'primary',path:'mode'}]}]},datasets:[{id:'primary',request:input.parameters.query}],layoutIntent:{blockOrder:['filters','introSection','intro','details','records']},blocks:[
  {id:'filters',kind:'filterBarBlock',title:'Filters',paramIds:['mode']},
  {id:'introSection',kind:'sectionBlock',title:'Overview',navigationLabel:'Overview',blockIds:['intro']},
  {id:'intro',kind:'markdownBlock',markdown:'Select details to inspect readings.'},
  {id:'details',kind:'sectionBlock',title:'Details',navigationLabel:'Details',blockIds:['records']},
  {id:'records',kind:'tableBlock',title:'Readings',datasetRef:'primary',collapsible:true,defaultCollapsed:true,columns:[{key:'id',label:'ID',dataType:'number'},{key:'label',label:'Label'}]},
 ]};
 const container={reportRuntime:{reportSpec:spec,datasetBindings:{primary:{dataSourceRef:'reader',queryPath:'query'}},presentationMode:'report'}};
 const click=async selector=>act(async()=>host.querySelector(selector).click());
 const tableRows=()=>[...host.querySelectorAll('.forge-report-runtime-table-panel tbody tr')];
 try{
  await act(async()=>root.render(<DashboardReportRuntime container={container} context={{Context:()=>source}}/>));
  await act(async()=>[...host.querySelectorAll('[role="tab"]')].find(tab=>tab.textContent==='Details').click());
  await click('[aria-label="Toggle report filters"]');
  await click('[aria-label="Paginate Readings"]');
  await click('[aria-label="Sort by ID"]');await click('[aria-label="Sort by ID"]');
  await click('.forge-dashboard-table-pager button:last-child');
  expect(host.textContent).toContain('Rows 26–50 of 60');
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Second').click());
  expect(input.page).toBe(1);expect(input.parameters.query.offset).toBe(0);
  expect(host.querySelector('[data-forge-report-active-section]').getAttribute('data-forge-report-active-section')).toBe('details');
  expect(host.querySelector('[aria-label="Toggle report filters"]').getAttribute('aria-pressed')).toBe('true');
  expect(host.textContent).not.toContain('Old reading');expect(tableRows()).toHaveLength(0);
  expect(host.textContent).not.toContain('No data');
  await act(async()=>{control.value={loaded:true,loading:false,error:'denied'};});
  expect(host.textContent).toContain('This report could not be loaded');
  expect(host.textContent).not.toContain('No data');expect(host.textContent).not.toContain('Old reading');
  expect(host.querySelector('[aria-label="Toggle report filters"]').getAttribute('aria-pressed')).toBe('true');
  await act(async()=>{collection.value=rows(101,'New reading');control.value={loaded:true,loading:false};});
  expect(host.querySelector('[data-forge-report-active-section]').getAttribute('data-forge-report-active-section')).toBe('details');
  expect(host.textContent).toContain('Rows 1–25 of 60');expect(tableRows()).toHaveLength(25);
  expect(tableRows()[0].cells[0].textContent).toBe('160');
  expect(host.textContent).not.toContain('Old reading');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it.each([undefined, 'missing-binding', {signals:{control:{value:{loaded:true}},collection:{value:[{name:'Stale reading'}]}}}, {signals:{control:{value:{error:'denied'}},collection:{value:[{name:'Stale reading'}]}},handlers:{dataSource:{peekInput:()=>({})}}}])('renders neutral unavailable state for missing or incomplete bound sources', async source=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const reportSpec={title:'Readings',viewer:{appearance:'document'},scope:{params:[{id:'mode',kind:'text',label:'Mode',value:'all',filterBindings:[{datasetRef:'primary',path:'mode'}]}]},datasets:[{id:'primary'}],blocks:[{id:'filters',kind:'filterBarBlock',paramIds:['mode']},{id:'records',kind:'tableBlock',datasetRef:'primary',columns:[{key:'name',label:'Name'}]}]};
 try{
  await act(async()=>root.render(<DashboardReportRuntime container={{reportRuntime:{reportSpec,datasetBindings:source==='missing-binding'?{}:{primary:{dataSourceRef:'reader',queryPath:'query'}},presentationMode:'report'}}} context={{Context:()=>source,handlers:{reportRuntime:{canEditScopeParam:()=>true,clearScopeParams:()=>{throw new Error('Unavailable control cleared');},setScopeParamValue:()=>{throw new Error('Unavailable control edited');},setScopeParamEnabled:()=>{throw new Error('Unavailable control toggled');}}}}}/>));
  expect(host.textContent).toContain('This report could not be loaded');
  expect(host.textContent).not.toContain('Stale reading');expect(host.textContent).not.toContain('No data');
  await act(async()=>host.querySelector('[aria-label="Toggle report filters"]').click());
  expect(host.querySelector('[aria-label="Clear all report filters"]')).toBeNull();
  expect(host.querySelector('input[aria-label="Mode"]')).toBeNull();
  expect(host.querySelector('[aria-label="Disable Mode filter"]')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it.each([false,true])('distinguishes loading, denial and true empty for charts/tables/metrics (sections: %s)', async sectioned=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const control=signal({loaded:true});const collection=signal([{name:'Prior scope record',amount:987654}]);
 const blocks=[
  {id:'records',kind:'tableBlock',datasetRef:'primary',columns:[{key:'name',label:'Name'},{key:'amount',label:'Amount'}]},
  {id:'chart',kind:'chartBlock',datasetRef:'primary',chartSpec:{type:'bar',xField:'name',yFields:['amount']}},
  {id:'metric',kind:'kpiBlock',datasetRef:'primary',valueField:'amount',valueLabel:'Amount'},
 ];
 const reportSpec={title:'Readings',viewer:{appearance:'document'},datasets:[{id:'primary'}],blocks:sectioned?[{id:'readings',kind:'sectionBlock',title:'Readings',blockIds:['records','chart','metric']},...blocks,{id:'other',kind:'sectionBlock',title:'Other',blockIds:['notes']},{id:'notes',kind:'markdownBlock',markdown:'Notes'}]:blocks};
 try{
  await act(async()=>root.render(<DashboardReportRuntime container={{reportRuntime:{reportSpec,datasetBindings:{primary:{}},presentationMode:'report'}}} context={{signals:{control,collection}}}/>));
  expect(host.textContent).toContain('Prior scope record');
  for(const state of [{loading:true},{error:'denied'}]){
   await act(async()=>{control.value=state;});
   expect(host.textContent).not.toContain('No data');
   expect(host.textContent).not.toContain('Prior scope record');
   expect(host.textContent.replaceAll(',','')).not.toContain('987654');
   expect(host.querySelectorAll('tbody tr')).toHaveLength(0);
   expect(host.textContent).toContain(state.error?'This report could not be loaded':'Loading');
  }
  await act(async()=>{collection.value=[];control.value={loaded:true};});
  expect(host.querySelector('.forge-report-runtime-chart-empty')?.textContent).toContain('No data for the selected scope');
  expect(host.querySelector('.forge-report-runtime-table-panel')?.textContent).toContain('No data.');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it.each([true,false])('renders explicit static fill and preserves legacy host edits only for unbound scope (bound: %s)', async bound=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const param={id:'mode',kind:'text',label:'Mode',value:'all',...(bound?{filterBindings:[{datasetRef:'primary',path:'mode'}]}:{})};
 const reportSpec={title:'Static readings',viewer:{appearance:'document'},scope:{params:[param]},datasets:[{id:'primary'}],blocks:[{id:'filters',kind:'filterBarBlock',paramIds:['mode']},{id:'records',kind:'tableBlock',datasetRef:'primary',columns:[{key:'name',label:'Name'}]}]};
 const reportFill=buildReportFillFromReportSpec(reportSpec,{primary:{rows:[{name:'Static preview reading'}]}});
 let edits=0;
 try{
  await act(async()=>root.render(<DashboardReportRuntime container={{reportRuntime:{reportSpec,reportFill,datasetBindings:{},presentationMode:'report'}}} context={{handlers:{reportRuntime:{canEditScopeParam:()=>true,setScopeParamValue:()=>{edits++;},setScopeParamEnabled:()=>{edits++;}}}}}/>));
  expect(host.textContent).toContain('Static preview reading');expect(host.textContent).not.toContain('could not be loaded');
  await act(async()=>host.querySelector('[aria-label="Toggle report filters"]').click());
  const field=host.querySelector('input[aria-label="Mode"]');
  if(bound){expect(field).toBeNull();expect(host.querySelector('[aria-label="Disable Mode filter"]')).toBeNull();expect(edits).toBe(0);}
  else {expect(field).toBeTruthy();await act(async()=>host.querySelector('[aria-label="Disable Mode filter"]').click());expect(edits).toBe(1);}
 }finally{await act(async()=>root.unmount());host.remove();}
});

it.each([false,true])('routes host clear/toggle only to legacy scope in mixed static/unavailable previews (unavailable: %s)',async unavailable=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const reportSpec={title:'Mixed scope',viewer:{appearance:'document'},scope:{params:[
  {id:'bound',kind:'text',label:'Bound',value:'fixed',filterBindings:[{datasetRef:'primary',path:'mode'}]},
  {id:'legacy',kind:'text',label:'Legacy',value:'active'},
 ]},datasets:[{id:'primary'}],blocks:[{id:'filters',kind:'filterBarBlock',paramIds:['bound','legacy']}]};
 const reportFill=buildReportFillFromReportSpec(reportSpec,{primary:{rows:[]}});
 const cleared=[];const toggled=[];
 try{
  await act(async()=>root.render(<DashboardReportRuntime container={{reportRuntime:{reportSpec,reportFill,datasetBindings:unavailable?{primary:{dataSourceRef:'missing',queryPath:'query'}}:{},presentationMode:'report'}}} context={{handlers:{reportRuntime:{canEditScopeParam:()=>false,setScopeParamEnabled:filter=>toggled.push(filter.id),clearScopeParams:filters=>{if(filters.some(filter=>filter.id==='bound'))throw new Error('Protected bound scope cleared');cleared.push(filters.map(filter=>filter.id));}}}}}/>));
  await act(async()=>host.querySelector('[aria-label="Toggle report filters"]').click());
  expect(host.querySelector('[aria-label="Disable Bound filter"]')).toBeNull();
  await act(async()=>host.querySelector('[aria-label="Disable Legacy filter"]').click());
  expect(toggled).toEqual(['legacy']);
  await act(async()=>host.querySelector('[aria-label="Clear all report filters"]').click());
  expect(cleared).toEqual([['legacy']]);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it.each(['report','preview'])('keeps typed choices distinct in multiple addressable filter bars in %s mode', async presentationMode=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const warnings=vi.spyOn(console,'error').mockImplementation(()=>{});
 const params=['left','right'].map((id,index)=>({id,kind:'select',label:id,value:index?'1':1,options:[{label:id+' numeric',value:1},{label:id+' text',value:'1'}],filterBindings:[{datasetRef:'primary',path:id}]}));
 const reportSpec={title:'Neutral filters',scope:{params},datasets:[{id:'primary'}],layoutIntent:{blockOrder:['leftBar','rightBar']},blocks:params.map(param=>({id:param.id+'Bar',kind:'filterBarBlock',title:param.label,paramIds:[param.id]}))};
 function Fixture(){
  const [spec,setSpec]=React.useState(reportSpec);
  return <ReportRuntime reportSpec={spec} reportFill={buildReportFillFromReportSpec(spec,{primary:{rows:[]}})} runtimeHandlers={{canEditScopeParam:()=>true,toggleScopeParamOption:(param,value)=>setSpec(current=>({...current,scope:{params:current.scope.params.map(entry=>entry.id===param.id?{...entry,value}:entry)}}))}} presentationMode={presentationMode}/>;
 }
 try{
  await act(async()=>root.render(<Fixture/>));
  const toggle=host.querySelector('[aria-label="Toggle report filters"]');
  if(presentationMode==='report' && toggle.getAttribute('aria-pressed')==='false') await act(async()=>toggle.click());
  const bar=id=>host.querySelector(`[data-report-runtime-block-id="${id}Bar"]`);
  for(const param of params){
   expect(host.querySelectorAll(`[data-report-runtime-block-id="${param.id}Bar"]`)).toHaveLength(1);
   expect(bar(param.id).querySelectorAll('button[title]')).toHaveLength(2);
   expect(bar(param.id).querySelector('button[aria-pressed="true"]').title).toBe(param.id+(param.id==='left'?' numeric':' text'));
   for(const kind of ['text','numeric']){
    await act(async()=>bar(param.id).querySelector(`button[title="${param.id} ${kind}"]`).click());
    expect(bar(param.id).querySelectorAll('button[aria-pressed="true"]')).toHaveLength(1);
    expect(bar(param.id).querySelector('button[aria-pressed="true"]').title).toBe(param.id+' '+kind);
    expect(bar(param.id).querySelectorAll('button[title]')).toHaveLength(2);
   }
  }
  expect(warnings).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());warnings.mockRestore();host.remove();}
});

it('sorts a partial standalone report through its bound producer query',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let parameters={actor:'fixed',query:{filters:{region:'east'},limit:2,offset:2,orderBy:['id asc']},other:{offset:80}};
 const collection=signal([{id:40},{id:30}]),control=signal({loaded:true}),collectionInfo=signal({hasMore:true});
 const population=[40,30,1,99,2,98],fetches=vi.fn(()=>{
  const ordered=[...population].sort((a,b)=>parameters.query.orderBy[0].endsWith('desc')?b-a:a-b);
  collection.value=ordered.slice(0,2).map(id=>({id}));control.value={loaded:true};
 });
 const source={signals:{collection,control,collectionInfo},handlers:{dataSource:{setSort:({parameter,value})=>{parameters={...parameters,[parameter]:value};fetches();},peekInput:()=>({parameters}),setInputParameters:next=>{parameters=next;},setPage:vi.fn(),setLoading:loading=>{control.value={loaded:true,loading};},setError:()=>{},fetchCollection:fetches}}};
 const config={reportSpec:{title:'Inventory',datasets:[{id:'records',request:parameters.query}],blocks:[{id:'items',kind:'tableBlock',datasetRef:'records',columns:[{key:'id',label:'ID'}]}]},datasetBindings:{records:{dataSourceRef:'reader',queryPath:'query'}}};
 const values=()=>[...host.querySelectorAll('tbody tr')].map(row=>Number(row.querySelector('td').textContent));
 try {
  await act(async()=>root.render(<DashboardReportRuntime container={{reportRuntime:config}} context={{Context:()=>source}}/>));
  expect(values()).toEqual([40,30]);
  await act(async()=>host.querySelector('[aria-label="Sort by ID"]').click());expect(values()).toEqual([1,2]);
  await act(async()=>host.querySelector('[aria-label="Sort by ID"]').click());expect(values()).toEqual([99,98]);
  expect(parameters.query.offset).toBe(0);expect(parameters.query.filters).toEqual({region:'east'});expect(parameters.other).toEqual({offset:80});expect(parameters.actor).toBe('fixed');expect(fetches).toHaveBeenCalledTimes(2);
 } finally {await act(async()=>root.unmount());host.remove();}
});

it('reports the actually displayed section on initial render and selection',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const changed=vi.fn();
 const reportSpec={title:'Example',blocks:[
  {id:'tabs',kind:'tabGroupBlock',sectionIds:['summary','detail'],defaultSectionId:'summary',includeUnlistedSections:false},
  {id:'summary',kind:'sectionBlock',title:'Summary',blockIds:['summaryBody']},{id:'summaryBody',kind:'markdownBlock',markdown:'Summary body'},
  {id:'detail',kind:'sectionBlock',title:'Detail',blockIds:['detailBody']},{id:'detailBody',kind:'markdownBlock',markdown:'Detail body'}]};
 try{await act(async()=>root.render(<ReportRuntime reportSpec={reportSpec} reportFill={buildReportFillFromReportSpec(reportSpec,{})} onActiveSectionChange={changed}/>));
 expect(changed).toHaveBeenLastCalledWith('summary');
 const tab=[...host.querySelectorAll('[role="tab"]')].find(node=>node.textContent==='Detail');expect(tab).toBeTruthy();
 await act(async()=>tab.click());expect(changed).toHaveBeenLastCalledWith('detail');expect(host.textContent).toContain('Detail body');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it.each(['removed','hidden'])('resolves a %s controlled section against visible Forge sections',async state=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const changed=vi.fn();
 const blocks=[
  {id:'tabs',kind:'tabGroupBlock',sectionIds:['summary','detail'],defaultSectionId:'detail',includeUnlistedSections:true},
  {id:'intro',kind:'markdownBlock',markdown:'Introduction'},
  {id:'summary',kind:'sectionBlock',title:'Summary'},
  {id:'summaryBody',kind:'markdownBlock',markdown:'Summary body'},
  {id:'detail',kind:'sectionBlock',title:'Detail',runtime:{visibleWhen:{source:'filters',field:'showDetails',equals:true}}},
  {id:'detailBody',kind:'markdownBlock',markdown:'Detail body'},
 ];
 const render=(nextBlocks,showDetails)=>{
  const reportSpec={title:'Example',blocks:nextBlocks};
  root.render(<ReportRuntime reportSpec={reportSpec} reportFill={buildReportFillFromReportSpec(reportSpec,{})} selectedSectionId="detail" conditionValues={{showDetails}} onActiveSectionChange={changed}/>);
 };
 try{
  await act(async()=>render(blocks,true));expect(changed).toHaveBeenLastCalledWith('detail');
  expect(host.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Detail');
  await act(async()=>render(state==='removed'?blocks.filter(block=>!['detail','detailBody'].includes(block.id)):blocks,false));
  expect(changed).toHaveBeenLastCalledWith('summary');
  expect(host.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Summary');
  expect(host.textContent).toContain('Summary body');
  expect(host.querySelector('[role="tab"][data-section-id="detail"]')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('does not resurrect an uncontrolled clicked section after hide and restore',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const changed=vi.fn();
 const blocks=[{id:'tabs',kind:'tabGroupBlock',sectionIds:['summary','detail'],defaultSectionId:'summary',includeUnlistedSections:false},{id:'summary',kind:'sectionBlock',title:'Summary'},{id:'summaryBody',kind:'markdownBlock',markdown:'Summary body'},{id:'detail',kind:'sectionBlock',title:'Detail',runtime:{visibleWhen:{source:'filters',field:'showDetails',equals:true}}},{id:'detailBody',kind:'markdownBlock',markdown:'Detail body'}];
 const reportSpec={title:'Example',blocks};const reportFill=buildReportFillFromReportSpec(reportSpec,{});
 const render=showDetails=>root.render(<ReportRuntime reportSpec={reportSpec} reportFill={reportFill} conditionValues={{showDetails}} onActiveSectionChange={changed}/>);
 try{
 await act(async()=>render(true));
 await act(async()=>host.querySelector('[role="tab"][data-section-id="detail"]').click());
 expect(changed).toHaveBeenLastCalledWith('detail');
 await act(async()=>render(false));expect(changed).toHaveBeenLastCalledWith('summary');
 await act(async()=>render(true));expect(changed).toHaveBeenLastCalledWith('summary');
 }finally{await act(async()=>root.unmount());host.remove();}
});
