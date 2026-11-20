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
