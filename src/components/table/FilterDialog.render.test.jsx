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
const render=async(open=true,filterSet=set,current={Name:'old',Status:'Active'})=>act(()=>root.render(<FilterDialog isOpen={open} onClose={()=>{}} filterSets={[filterSet]} filter={current} context={{dataSource:{filterMode:'server'}}} onApplyFilters={value=>applied.push(value)}/>));
const click=async label=>act(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent?.trim()===label);assert.ok(button,label);button.click();});
await render();
assert.equal(document.querySelector('#forge-filter-Name').value,'old');
await click('Cancel');assert.equal(applied.length,0);
await click('Clear filters');assert.deepEqual(applied.at(-1).filter,{});
await render(false);await render();
await click('OK');assert.deepEqual(applied.at(-1).filter,{Name:'old',Status:'Active'});
const pixelSet={name:'quick',default:true,template:[{id:'PixelType',label:'Pixel type',type:'string[]',operator:'in'}]};
await render(false,pixelSet,{});await render(true,pixelSet,{});
const pixelInput=document.querySelector('#forge-filter-PixelType');
await act(()=>{
 const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
 setter.call(pixelInput,'Universal Pixel,Retargeting Pixel');
 pixelInput.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
});
await click('OK');assert.deepEqual(applied.at(-1).filter,{PixelType:['Universal Pixel','Retargeting Pixel']});
const choiceSet={name:'choices',default:true,template:[{id:'PixelType',label:'Pixel type',type:'string[]',options:[{value:'First, Kind',label:'First, Kind'}]}]};
await render(false,choiceSet,{});await render(true,choiceSet,{});
const choice=document.querySelector('#forge-filter-PixelType');
await act(()=>{choice.value='First, Kind';choice.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
await click('OK');assert.deepEqual(applied.at(-1).filter,{PixelType:['First, Kind']});
await act(()=>root.unmount());
console.log('Filter dialog Cancel leaves filters unchanged, Clear submits an empty set, and OK restores current fields.');
process.exit(0);
