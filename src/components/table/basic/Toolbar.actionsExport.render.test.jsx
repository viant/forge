// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {Context} from '../../../core/context/Context.jsx';
import {SettingProvider} from '../../../core/context/Setting.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../../ThemeBoundary.jsx';
import Toolbar from './Toolbar.jsx';

let root,host,owner,sequence=0;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
afterEach(async()=>{if(root)await act(async()=>root.unmount());owner?.dispose();host?.remove();root=host=owner=null;vi.restoreAllMocks();});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const action=label=>[...document.querySelectorAll('button,.bp6-menu-item')].find(e=>e.textContent===label);
async function mount(mode='light',theme='design-system-2',items){
 const archive=vi.fn(),period=vi.fn();
 owner=Context(`toolbar-export-${++sequence}`,{dataSource:{rows:{autoFetch:false,selectionMode:'multi',uniqueKey:[{field:'id'}]}},actions:{import:()=>({example:{archive,period,hidden:()=>false}})}},'rows');owner.init();
 const context=owner.Context('rows'),rows=[{id:1,name:'One'},{id:2,name:'Two'}];context.handlers.dataSource.setCollection(rows);context.signals.control.value={loaded:true,inactive:false};
 const toolbarItems=items||[{id:'actions',type:'menu',label:'Actions',hideLabel:false,enableWhenSelection:true,menuItems:[{id:'archive',label:'Archive',on:[{event:'onClick',handler:'example.archive'}]}]},{id:'export',type:'tableExport',label:'Export',properties:{formats:['csv','xlsx'],filename:'records',scope:'page'}}];
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{}} services={{}}><ForgeThemeProvider themeId={theme} mode={mode}><ForgeThemeBoundary><Toolbar context={context} className="forge-list-page__actions" toolbarItems={toolbarItems} exportRows={rows} exportPageRows={rows.slice(0,1)} exportColumns={[{id:'id',name:'Record ID'},{id:'name',name:'Name'}]}/></ForgeThemeBoundary></ForgeThemeProvider></SettingProvider>));
 return {context,rows,archive,period};
}
async function openExport(){
 await act(async()=>host.querySelector('button[aria-label=Actions]').click());
 const submenu=document.querySelector('.forge-toolbar-export-submenu');expect(submenu).not.toBeNull();
 await act(async()=>{submenu.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await pause(220);});
 expect(action('CSV')).toBeTruthy();expect(action('XLSX')).toBeTruthy();
}
it.each(['light','dark'])('keeps Actions available, gates Archive by native selection and exports after menu dismissal (%s)',async mode=>{
 const {context,rows,archive}=await mount(mode);
 expect(host.querySelector('button[aria-label=Actions]').disabled).toBe(false);
 expect(host.querySelector('.forge-toolbar-table-export')).toBeNull();
 await act(async()=>host.querySelector('button[aria-label=Actions]').click());
 expect(action('Archive').getAttribute('aria-disabled')).toBe('true');
 await act(async()=>host.querySelector('button[aria-label=Actions]').click());
 await act(async()=>context.handlers.dataSource.toggleSelection({row:rows[0],rowIndex:0}));
 await act(async()=>host.querySelector('button[aria-label=Actions]').click());
 expect(action('Archive').getAttribute('aria-disabled')).not.toBe('true');
 expect(archive).not.toHaveBeenCalled();
 await act(async()=>host.querySelector('button[aria-label=Actions]').click());
 const payloads=[],downloads=[];
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
 URL.createObjectURL=vi.fn(blob=>{payloads.push(blob);return 'blob:local-export';});URL.revokeObjectURL=vi.fn();
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(){downloads.push(this.download);});
 try{for(const format of ['CSV','XLSX']){await openExport();await act(async()=>{action(format).dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));await pause(340);});expect(host.querySelector('[aria-haspopup]')?.getAttribute('aria-expanded')).toBe('false');}
 expect(downloads).toEqual(['records.csv','records.xlsx']);expect(payloads).toHaveLength(2);
 const csv=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsText(payloads[0]);});
 expect(csv).toContain('Record ID');expect(csv).toContain('One');expect(csv).not.toContain('Two');
 }finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});
it('retains the separate export and selection-gated Actions in Baseline',async()=>{
 await mount('light','baseline');expect(host.querySelector('button[aria-label=Actions]').disabled).toBe(true);expect(host.querySelector('.forge-toolbar-table-export button').disabled).toBe(false);
});
it.each(['light','dark'])('commits the heading period and invokes its original producer action once (%s)',async mode=>{
 const {context,period}=await mount(mode,'design-system-2',[{id:'period',type:'dateRangePreset',label:'Date range',dataField:'periodView',value:'month',properties:{customApplyEnabled:true},options:[{value:'month',label:'Month'},{value:'today',label:'Today'}],on:[{event:'onChange',handler:'example.period'}]}]);
 await act(async()=>host.querySelector('button').click());await act(async()=>action('Today').click());
 expect(context.signals.windowForm.peek().periodView).toBe('today');expect(period).toHaveBeenCalledTimes(1);expect(context.signals.windowForm.peek().customDateStart).toBe(context.signals.windowForm.peek().customDateEnd);
});

it('keeps a producer-hidden export out of the combined Actions menu',async()=>{
 await mount('light','design-system-2',[{id:'actions',type:'menu',label:'Actions',enableWhenSelection:true,menuItems:[]},{id:'export',type:'tableExport',label:'Export',on:[{event:'onVisible',handler:'example.hidden'}]}]);
 expect(host.querySelector('button[aria-label=Actions]').disabled).toBe(true);
 expect(host.querySelector('.forge-toolbar-table-export')).toBeNull();
});

// Independent metadata composition probe: keep the producer's existing menu ID.
it.each(['light','dark'])('adopts an existing named Actions owner without replacing its guarded options (%s)',async mode=>{
 await mount(mode,'design-system-2',[{id:'recordActions',type:'menu',className:'forge-list-page-actions-menu',label:'Actions',enableWhenSelection:true,menuItems:[{id:'archiveUnavailable',label:'Archive unavailable',disabled:true}]},{id:'recordExport',type:'tableExport',label:'Export',properties:{formats:['csv','xlsx'],scope:'page'}}]);
 expect(host.querySelector('button[aria-label=Actions]').disabled).toBe(false);expect(host.querySelector('.forge-toolbar-table-export')).toBeNull();
 await act(async()=>host.querySelector('button[aria-label=Actions]').click());expect(action('Archive unavailable').getAttribute('aria-disabled')).toBe('true');
 const submenu=document.querySelector('.forge-toolbar-export-submenu');expect(submenu).toBeTruthy();await act(async()=>{submenu.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));await pause(220);});expect(action('CSV')).toBeTruthy();expect(action('XLSX')).toBeTruthy();
});

// Independently authored records exercise Blueprint's actual hover lifecycle.
it.each(['light','dark'])('keeps Export open while crossing the anchored panel gap (%s)',async mode=>{
 await mount(mode);await openExport();
 const option=document.querySelector('.forge-toolbar-export-submenu');
 const target=option.closest('.bp6-popover-target');
 const isOpen=()=>target.classList.contains('bp6-popover-open');expect(isOpen()).toBe(true);
 await act(async()=>{option.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:document.body}));await pause(80);});
 expect(isOpen()).toBe(true);
 const csv=action('CSV');
 await act(async()=>{csv.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,relatedTarget:document.body}));await pause(340);});
 expect(isOpen()).toBe(true);
 await act(async()=>{csv.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:document.body}));await pause(340);});
 expect(isOpen()).toBe(false);
});
