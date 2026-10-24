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
