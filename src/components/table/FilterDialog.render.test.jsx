import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','Element','MutationObserver','Node','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');
const {act}=React;
const {createRoot}=await import('react-dom/client');
const {default:FilterDialog}=await import('./FilterDialog.jsx');

const applied=[];
const root=createRoot(document.getElementById('root'));
const set={name:'quick',default:true,template:[{id:'Name',label:'Name',operator:'contains'},{id:'Status',label:'Status',operator:'equal'}]};
const render=async(open=true)=>act(()=>root.render(<FilterDialog isOpen={open} onClose={()=>{}} filterSets={[set]} filter={{Name:'old',Status:'Active'}} onApplyFilters={value=>applied.push(value)}/>));
const click=async label=>act(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent?.trim()===label);assert.ok(button,label);button.click();});
await render();
assert.equal(document.querySelector('#forge-filter-Name').value,'old');
await click('Cancel');assert.equal(applied.length,0);
await click('Clear filters');assert.deepEqual(applied.at(-1).filter,{});
await render(false);await render();
await click('OK');assert.deepEqual(applied.at(-1).filter,{Name:'old',Status:'Active'});
await act(()=>root.unmount());
console.log('Filter dialog Cancel leaves filters unchanged, Clear submits an empty set, and OK restores current fields.');
process.exit(0);
