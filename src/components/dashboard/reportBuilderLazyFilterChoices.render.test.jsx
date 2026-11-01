// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {StaticFilterSection} from './reportBuilderComponents.jsx';

let root,host;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});

it('loads report filter choices on focus and retains the selected value',async()=>{
 const collection=signal([]),control=signal({loading:false,error:null}),selected=vi.fn();
 const fetchCollection=vi.fn(async()=>{control.value={loading:true,error:null};collection.value=[{value:12,label:'Campaign Twelve'}];control.value={loading:false,error:null};});
 const context={Context:id=>id==='campaign_choices'?{signals:{collection,control},handlers:{dataSource:{fetchCollection}}}:null};
 const filter={id:'campaignIds',label:'Campaign',multiple:true,optionsDataSourceRef:'campaign_choices',optionsFetchMode:'onFocus',optionValueField:'value',optionLabelField:'label'};
 await act(async()=>root.render(<StaticFilterSection filter={filter} context={context} value={[]} onToggle={selected} onDateRange={()=>{}}/>));
 expect(fetchCollection).not.toHaveBeenCalled();
 const load=host.querySelector('.forge-report-builder__load-filter-options');
 expect(load?.textContent).toContain('Choose Campaign');
 await act(async()=>{load.focus();await Promise.resolve();});
 expect(fetchCollection).toHaveBeenCalledTimes(1);
 const option=Array.from(host.querySelectorAll('button')).find(button=>button.textContent.includes('Campaign Twelve'));
 expect(option).toBeTruthy();
 await act(async()=>option.click());
 expect(selected).toHaveBeenCalledWith(12);
 expect(fetchCollection).toHaveBeenCalledTimes(1);
});

it('uses authored section ownership for the actual Builder sidebar without clearing values',async()=>{
 const {default:ReportBuilder}=await import('./ReportBuilder.jsx');
 const {createSectionFilterBuilderFixture}=await import('../../demos/theme/reportSectionFiltersFixture.js');
 const {container,context}=createSectionFilterBuilderFixture();
 window.localStorage.setItem('reportBuilder.workspaceMode.desktop.sectionFilters',JSON.stringify('report'));
 try {
  await act(async()=>root.render(<ReportBuilder container={container} context={context}/>));
  const filterToggle=host.querySelector('[aria-label="Open report filters and options"]');expect(filterToggle).toBeTruthy();
  await act(async()=>filterToggle.click());
  expect(host.textContent).toContain('Operation mode');expect(host.textContent).not.toContain('Quality level');
  const tab=[...host.querySelectorAll('[role="tab"]')].find(node=>node.textContent==='Quality');expect(tab).toBeTruthy();
  await act(async()=>tab.click());
  expect(host.textContent).not.toContain('Operation mode');expect(host.textContent).toContain('Quality level');
  const select=async name=>{const tab=[...host.querySelectorAll('[role="tab"]')].find(node=>node.textContent===name);expect(tab).toBeTruthy();await act(async()=>tab.click());};
  await select('Empty');expect(host.textContent).not.toContain('Operation mode');expect(host.textContent).not.toContain('Quality level');expect(host.textContent).toContain('Observation period');
  await select('Inventory');expect(host.textContent).toContain('Operation mode');expect(host.textContent).not.toContain('Quality level');
  expect([...host.querySelectorAll('.forge-report-builder__panel-title')].filter(node=>node.textContent==='Operation mode')).toHaveLength(1);
  expect(context.signals.windowForm.value.sectionFilters.staticFilters.mode).toBe(2);
 } finally {window.localStorage.removeItem('reportBuilder.workspaceMode.desktop.sectionFilters');}
});

it.each(['hidden default','hidden selection','all hidden'])('keeps the actual Builder sidebar on the Runtime fallback: %s',async scenario=>{
 const {default:ReportBuilder}=await import('./ReportBuilder.jsx');
 const {createSectionFilterBuilderFixture}=await import('../../demos/theme/reportSectionFiltersFixture.js');
 const {container,context}=createSectionFilterBuilderFixture();
 const option=scenario==='all hidden'?'showSections':'showOperations';
 const form=context.signals.windowForm.value.sectionFilters;
 form.reportOptions={[option]:scenario!=='hidden default'};
 container.reportBuilder.reportOptions=[{name:option,label:'Show relevant sections',type:'boolean',default:scenario!=='hidden default'}];
 form.reportDocumentBlocks=form.reportDocumentBlocks.map(block=>{
  if(block.id==='inventory')block={...block,blockIds:[]}; // mode belongs only to Operations
  if(block.id==='tabs' && scenario==='hidden selection')block={...block,defaultSectionId:'inventory'};
  if(block.id==='operations' || scenario==='all hidden' && block.kind==='sectionBlock') {
   block={...block,runtime:{visibleWhen:{source:'filters',field:option,equals:true}}};
  }
  return block;
 });
 const inputBefore=JSON.stringify(context.signals.input.value);
 const {getScopeParamValue}=await import('../../reporting/scopeStateModel.js');
 const scopeValues=state=>Object.fromEntries(['mode','quality','period'].map(id=>[id,getScopeParamValue(state,id)]));
 const scopeBefore=JSON.stringify(scopeValues(form));
 const setInput=vi.spyOn(context.handlers.dataSource,'setInputParameters');
 const fetch=vi.spyOn(context.handlers.dataSource,'fetchRecords');
 window.localStorage.setItem('reportBuilder.workspaceMode.desktop.sectionFilters',JSON.stringify('report'));
 try {
  await act(async()=>root.render(<ReportBuilder container={container} context={context}/>));
  await act(async()=>host.querySelector('[aria-label="Open report filters and options"]').click());
  if(scenario==='hidden selection') {
   expect(host.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Inventory');
   const operations=[...host.querySelectorAll('[role="tab"]')].find(node=>node.textContent==='Operations');
   await act(async()=>operations.click());
  }
  if(scenario!=='hidden default') {
   expect(host.textContent).toContain('Operation mode');
   setInput.mockClear();fetch.mockClear();
   const toggle=host.querySelector(`#report-builder-option-${option}`);expect(toggle.checked).toBe(true);
   await act(async()=>toggle.click());
   expect(context.signals.windowForm.value.sectionFilters.reportOptions[option]).toBe(false);
   expect(setInput).not.toHaveBeenCalled();
   // Existing option refreshes still run with the complete, retained scope.
   for(const [request] of fetch.mock.calls)expect(request.parameters.filters).toEqual({mode:2,quality:1});
  }
  const active=host.querySelector('[role="tab"][aria-selected="true"]');
  if(scenario==='all hidden')expect(active).toBeNull();else expect(active?.textContent).toBe('Inventory');
  expect(host.textContent).not.toContain('Operation mode');expect(host.textContent).not.toContain('Quality level');
  expect(host.textContent).toContain('Observation period');
  expect(JSON.stringify(scopeValues(context.signals.windowForm.value.sectionFilters))).toBe(scopeBefore);
  expect(JSON.stringify(context.signals.input.value)).toBe(inputBefore);
 } finally {window.localStorage.removeItem('reportBuilder.workspaceMode.desktop.sectionFilters');}
});
