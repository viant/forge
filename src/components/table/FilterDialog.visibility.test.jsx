import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import FilterDialog from './FilterDialog.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../ThemeBoundary.jsx';
let root,host;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
const condition={source:'authorization',field:'principal.features',contains:'TYPE_FILTER'};
const field={id:'Type',label:'Type',options:[{value:1,label:'Standard'},{value:2,label:'Extended',visibleWhen:condition}],visibleWhen:condition};
const button=text=>[...document.querySelectorAll('button')].find(e=>e.textContent===text);
it('hides an unexposed predicate and omits its previous value when applying',async()=>{
 const apply=vi.fn(),context={signals:{authorization:signal({principal:{features:[]}})}};
 await act(async()=>root.render(<FilterDialog isOpen context={context} onClose={()=>{}} filterSets={[{name:'quick',default:true,template:[{id:'Name',label:'Name'},field]}]} filter={{Name:'kept',Type:2}} onApplyFilters={apply}/>));
 expect(document.querySelector('#forge-filter-Type')).toBeNull();
 await act(async()=>button('OK').click());expect(apply.mock.calls[0][0].filter).toEqual({Name:'kept'});
});
it('responds to display-hint changes while open and retains unrelated draft values',async()=>{
 const apply=vi.fn(),authorization=signal({principal:{features:['TYPE_FILTER']}}),context={signals:{authorization}};
 await act(async()=>root.render(<FilterDialog isOpen context={context} onClose={()=>{}} filterSets={[{name:'quick',default:true,template:[{id:'Name',label:'Name'},field]}]} filter={{Name:'kept',Type:2}} onApplyFilters={apply}/>));
 expect(document.querySelector('#forge-filter-Type')).toBeTruthy();
 await act(async()=>{authorization.value={principal:{features:[]}};});
 expect(document.querySelector('#forge-filter-Type')).toBeNull();expect(document.querySelector('#forge-filter-Name').value).toBe('kept');
 await act(async()=>button('OK').click());expect(apply.mock.calls[0][0].filter).toEqual({Name:'kept'});
});
it('applies conditions to sets and options without submitting a hidden option',async()=>{
 const apply=vi.fn(),context={signals:{authorization:signal({principal:{features:[]}})}};
 const sets=[{name:'private',default:true,visibleWhen:condition,template:[{id:'Private',label:'Private'}]},{name:'public',template:[{...field,visibleWhen:undefined}]}];
 await act(async()=>root.render(<FilterDialog isOpen context={context} onClose={()=>{}} filterSets={sets} filter={{Type:2}} onApplyFilters={apply}/>));
 expect(document.querySelector('#forge-filter-Private')).toBeNull();expect([...document.querySelectorAll('#forge-filter-Type option')].map(o=>o.textContent)).toEqual(['All','Standard']);
 await act(async()=>button('OK').click());expect(apply.mock.calls[0][0].filter).toEqual({});
});

it.each(['light','dark'])('searches native checkbox choices and submits stable values only after Apply (%s)',async mode=>{
 const apply=vi.fn(),close=vi.fn();
 const options=[{value:11,label:'First record'},{value:22,label:'Second record with a deliberately long name'}];
 await act(async()=>root.render(<ForgeThemeProvider themeId="design-system-2" mode={mode}><ForgeThemeBoundary><FilterDialog isOpen presentation="drawer" onClose={close} onApplyFilters={apply} filterSets={[{name:'records',default:true,template:[{id:'recordIds',label:'Record name',field:'id',operator:'in',type:'number[]',options}]}]}/></ForgeThemeBoundary></ForgeThemeProvider>));
 await act(async()=>button('Record name').click());
 const search=document.querySelector('input[aria-label="Search filter options"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,'Second');search.dispatchEvent(new Event('input',{bubbles:true}));});
 const checks=[...document.querySelectorAll('.forge-drawer-choice-list input[type=checkbox]')];
 expect(checks).toHaveLength(2); // Select all and the matching option.
 expect(document.querySelector('.forge-drawer-choice-label').textContent).toBe('Select all');
 await act(async()=>checks[1].click());expect(apply).not.toHaveBeenCalled();
 await act(async()=>button('Apply').click());expect(apply.mock.calls[0][0].filter).toEqual({recordIds:[22]});
 expect(close).toHaveBeenCalledOnce();
});

it('retains the legacy checkbox label composition outside DS2',async()=>{
 await act(async()=>root.render(<ForgeThemeProvider themeId="baseline"><ForgeThemeBoundary><FilterDialog isOpen presentation="drawer" onClose={()=>{}} onApplyFilters={()=>{}} filterSets={[{name:'records',default:true,template:[{id:'ids',label:'Record name',operator:'in',type:'number[]',options:[{value:1,label:'First record'}]}]}]}/></ForgeThemeBoundary></ForgeThemeProvider>));
 await act(async()=>button('Record name').click());
 expect(document.querySelector('.forge-drawer-choice-label')).toBeNull();
 expect([...document.querySelectorAll('label')].some(label=>label.textContent==='First record')).toBe(true);
});

it.each(['light','dark'])('uses the option source for Skeleton, retry, and preserved draft choices (%s)',async mode=>{
 const apply=vi.fn(),notify=vi.fn(),control=signal({loading:true,loaded:false}),input=signal({fetch:false});
 const choices={id:'ids',label:'Record name',operator:'in',type:'number[]',options:[],optionsDataSourceRef:'record_choices'};
 const fetchCollection=vi.fn(async()=>{control.value={loading:false,loaded:false,error:'Unavailable'};throw Error('Unavailable');});
 const source={signals:{control,input},handlers:{dataSource:{peekLoading:()=>control.peek().loading,fetchCollection}}};
 const context={Context:vi.fn(()=>source),handlers:{notifications:{show:notify}}};
 await act(async()=>root.render(<ForgeThemeProvider themeId="design-system-2" mode={mode}><ForgeThemeBoundary><FilterDialog isOpen context={context} presentation="drawer" onClose={()=>{}} onApplyFilters={apply} filterSets={[{name:'records',default:true,template:[choices]}]}/></ForgeThemeBoundary></ForgeThemeProvider>));
 await act(async()=>button('Record name').click());
 expect(document.querySelector('[aria-busy=true]')).toBeTruthy();
 expect(document.querySelectorAll('.forge-filter-options-skeleton__row')).toHaveLength(6);
 expect(document.querySelector('.forge-filter-options-skeleton').getAttribute('aria-hidden')).toBe('true');
 expect(document.querySelector('[role=status]').getAttribute('aria-label')).toBe('Loading filter options');
 expect(button('Apply').disabled).toBe(true);
 await act(async()=>{control.value={loading:false,loaded:false,error:'Unavailable'};});
 expect(document.querySelector('.forge-filter-options-skeleton')).toBeNull();
 expect(document.body.textContent).not.toContain('Unavailable');
 await act(async()=>{button('Try again').focus();button('Try again').click();});
 expect(document.activeElement).toBe(document.querySelector('input[aria-label="Search filter options"]'));
 expect(fetchCollection).toHaveBeenCalledWith(expect.objectContaining({result:'records',invocationId:expect.any(String),cache:{bypassCache:true}}));
 expect(notify).toHaveBeenCalledWith('Filter options could not be loaded. Please try again.',expect.objectContaining({intent:'danger',ttlMs:4000}));
 await act(async()=>{choices.options=[{value:7,label:'First record'},{value:9,label:'Second record'}];control.value={loading:false,loaded:true,error:null};});
 const checks=()=>[...document.querySelectorAll('.forge-drawer-choice-list input[type=checkbox]')];
 expect(checks()).toHaveLength(3);
 await act(async()=>checks()[1].click());
 expect(button('Apply').disabled).toBe(false);
 await act(async()=>{control.value={loading:true,loaded:true,error:null};});
 expect(document.querySelector('.forge-filter-options-skeleton')).toBeNull();
 expect(checks()[1].checked).toBe(true);expect(button('Apply').disabled).toBe(true);
 await act(async()=>document.querySelector('button[aria-label="Back to filters"]').click());
 expect(button('Apply').disabled).toBe(true);
 await act(async()=>button('Record name').click());
 expect(checks()[1].checked).toBe(true);
 await act(async()=>{control.value={loading:false,loaded:true,error:null};});
 await act(async()=>button('Apply').click());
 expect(apply.mock.calls[0][0].filter).toEqual({ids:[7]});
});

it('does not bind DS2 option loading or retry to a legacy drawer',async()=>{
 const context={Context:vi.fn(()=>{throw Error('DS2 option source must not bind');})};
 await act(async()=>root.render(<ForgeThemeProvider themeId="baseline"><ForgeThemeBoundary><FilterDialog isOpen context={context} presentation="drawer" onClose={()=>{}} onApplyFilters={()=>{}} filterSets={[{name:'records',default:true,template:[{id:'ids',label:'Record name',type:'number[]',operator:'in',options:[{value:1,label:'First record'}],optionsDataSourceRef:'record_choices'}]}]}/></ForgeThemeBoundary></ForgeThemeProvider>));
 await act(async()=>button('Record name').click());
 expect(context.Context).not.toHaveBeenCalled();
 expect(document.querySelector('.forge-filter-options-skeleton')).toBeNull();
 expect(document.body.textContent).toContain('First record');
});
