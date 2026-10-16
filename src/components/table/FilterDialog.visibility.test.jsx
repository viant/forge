import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import FilterDialog from './FilterDialog.jsx';
let root,host;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
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
