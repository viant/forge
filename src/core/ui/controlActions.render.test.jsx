import ContentCarousel from '../../components/content/ContentCarousel.jsx';
import CardRailGroup from '../../components/content/CardRailGroup.jsx';
import Toolbar from '../../components/table/basic/Toolbar.jsx';
import TableCell from '../../components/table/basic/TableCell.jsx';
import PaginationBar from '../../components/table/basic/PaginationBar.jsx';
import TextLookup from '../../packs/blueprint/TextLookup.jsx';
import {getMetadataSignal,getDialogSignal} from '../store/signals.js';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {signal} from '@preact/signals-react';
import '../../packs/blueprint/index.jsx';
import WidgetRenderer from '../../runtime/WidgetRenderer.jsx';
import MutationCommand from '../../components/primitives/MutationCommand.jsx';
import FormPanel from '../../components/FormPanel.jsx';
import WindowContent from '../../components/WindowContent.jsx';
import {SettingProvider} from '../context/Setting.jsx';
import {getWindowContext,setWindowContext} from '../context/registry.js';
import WindowManager from '../../components/WindowManager.jsx';
import {activeWindows,selectedTabId,selectedWindowId} from '../store/signals.js';
import {runUICommand} from './commands.js';
import {useControlEvents} from '../../hooks/event.js';
import QuickSearch from '../../components/table/basic/QuickSearch.jsx';
import {ViewDialogFooterAction} from '../../components/ViewDialog.jsx';
import DraftForm from '../../components/primitives/DraftForm.jsx';
import {invokeRegisteredControlAction,listRegisteredControlActions,readRegisteredControlActions} from './controlActions.js';
let root,host;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
function fixture() {
 const form=signal({name:'old',locked:false}),changed=vi.fn();
 const context={identity:{windowId:'operate-render',dataSourceRef:'record'},signals:{form},metadata:{dataSource:{record:{}}},handlers:{dataSource:{getFormData:()=>form.peek(),peekFormData:()=>form.peek(),setFormField:({item,value})=>{form.value={...form.peek(),[item.dataField || item.id]:value};}}}};
 return {context,form,changed};
}
const operate=(controlId,action,extra={})=>invokeRegisteredControlAction({windowId:'operate-render',dataSourceRef:'record',controlId,...extra},action);
it('normal text callback and adapter both execute, while invalid/readonly/hidden edits fail',async()=>{
 const f=fixture();const item={id:'name',type:'text',dataField:'name',label:'Name',properties:{maxLength:5},readOnlyWhen:{source:'form',field:'locked',equals:true}};
 await act(async()=>root.render(<WidgetRenderer item={item} context={f.context} events={{onChange:f.changed}}/>));
 await act(async()=>{await operate('name','setValue',{value:'new'});});expect(f.changed).toHaveBeenCalledWith('new');expect(f.form.peek().name).toBe('new');expect(host.querySelector('input').value).toBe('new');
 await expect(operate('name','setValue',{value:'too long'})).rejects.toThrow(/validation/);expect(f.form.peek().name).toBe('new');
 await act(async()=>{f.form.value={...f.form.peek(),locked:true};});await expect(operate('name','setValue',{value:'bad'})).rejects.toThrow(/read-only/);
 host.hidden=true;await expect(operate('name','setValue',{value:'bad'})).rejects.toThrow(/hidden/);host.hidden=false;
});
it('async authored callback errors reject operation without an adapter fallback',async()=>{
 const f=fixture(),failure=vi.fn(async()=>{throw new Error('authored callback rejected');});
 await act(async()=>root.render(<WidgetRenderer item={{id:'name',type:'text',dataField:'name'}} context={f.context} events={{onChange:failure}}/>));
 await expect(operate('name','setValue',{value:'bad'})).rejects.toThrow(/authored callback rejected/);expect(f.form.peek().name).toBe('old');
});
it('select rejects unknown/disabled options and invokes the actual normal select callback',async()=>{
 const f=fixture();await act(async()=>root.render(<WidgetRenderer item={{id:'choice',type:'select',options:[{value:'a',label:'A'},{value:'b',label:'B',disabled:true}]}} context={f.context}/>));
 await expect(operate('choice','setValue',{value:'b'})).rejects.toThrow(/disabled/);await expect(operate('choice','setValue',{value:'invented'})).rejects.toThrow(/unavailable/);
 await act(async()=>{await operate('choice','setValue',{value:'a'});});expect(f.form.peek().choice).toBe('a');
});
it('mutation click follows native confirmation resolver and never writes on cancel',async()=>{
 const f=fixture();let writes=0;const control=signal({loading:false,error:null});
 const writer={signals:{control,collection:signal([])},handlers:{dataSource:{setInputParameters(){},fetchCollection(){writes++;control.value={loading:true,error:null};queueMicrotask(()=>{control.value={loading:false,error:null};});}}}};
 f.context.Context=()=>writer;f.context.signals.control=signal({});
 await act(async()=>root.render(<MutationCommand command={{commandId:'archive',dataSourceRef:'writer',confirm:'Archive selected?'}} context={f.context}/>));
 let opened;await act(async()=>{opened=await operate('archive','click');});expect(opened.status).toBe('awaiting_confirmation');expect(writes).toBe(0);expect(document.body.textContent).toContain('Archive selected?');
 await act(async()=>{await operate('archive:cancel','click');});expect(writes).toBe(0);
 await act(async()=>{await operate('archive','click');});expect(writes).toBe(0);
 await act(async()=>{await operate('archive:confirm','click');});expect(writes).toBe(1);
});
it('tab operation uses the normal onTabChange callback and rejects hidden/disabled tabs',async()=>{
 const f=fixture(),tabChange=vi.fn();f.context.lookupHandler=()=>tabChange;
 const panel={id:'sections',tabs:{appearance:'section'},on:[{event:'onTabChange',handler:'changed'}],containers:[{id:'first',title:'First'},{id:'second',title:'Second'},{id:'locked',title:'Locked',disabledWhen:{source:'form',field:'locked',equals:false}}]};
 await act(async()=>root.render(<FormPanel context={f.context} container={panel}/>));
 await act(async()=>{await operate('sections','selectTab',{tabId:'second'});});expect(tabChange).toHaveBeenCalledWith(expect.objectContaining({tabId:'second'}));
 await expect(operate('sections','selectTab',{tabId:'locked'})).rejects.toThrow(/disabled/);
 expect(listRegisteredControlActions({windowId:'operate-render'}).find(item=>item.controlId==='sections').supportedActions).toContain('selectTab');
});

it('normal mutation failures reject operation without retrying the fake writer',async()=>{
 const f=fixture();let writes=0;const control=signal({loading:false,error:null});
 f.context.Context=()=>({signals:{control,collection:signal([])},handlers:{dataSource:{setInputParameters(){},fetchCollection(){writes++;throw new Error('fake writer failed');}}}});
 f.context.signals.control=signal({});
 await act(async()=>root.render(<MutationCommand command={{commandId:'broken',dataSourceRef:'writer'}} context={f.context}/>));
 await act(async()=>{await expect(operate('broken','click')).rejects.toThrow(/fake writer failed/);});expect(writes).toBe(1);
});

it('table selection invokes the real normal row handler and rejects disabled or invented rows',async()=>{
 const selected=vi.fn(({context,...args})=>context.handlers.dataSource.toggleSelection(args));
 const metadata={dataSource:{rows:{service:{uri:'mcp://fake/reader'},uniqueKey:[{field:'id'}],selectors:{data:'data'},selectionMode:'multi',autoSelect:false}},view:{content:{id:'rowsTable',dataSourceRef:'rows',fetchData:true,table:{on:[{event:'onRowSelect',handler:'test.selected'}],columns:[{id:'id',multiSelect:true,selectionDisabledWhen:{source:'row',field:'locked',equals:true}},{id:'name'}]}}}};
 await act(async()=>{root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/fake-window'}}}} services={{test:{selected},dataConnectorTransport:async()=>({data:[{id:1,name:'One',locked:false},{id:2,name:'Two',locked:true}]})}}><WindowContent window={{windowId:'operate-render',windowKey:'table-test'}} selectedMetadata={metadata}/></SettingProvider>);for(let i=0;i<40;i++)await Promise.resolve();});
 const ctx=getWindowContext('operate-render').Context('rows'),rows=ctx.signals.collection.peek();expect(rows).toHaveLength(2);
 await act(async()=>{await operate('rowsTable','selectRows',{dataSourceRef:'rows',rows:[rows[0]]});});expect(selected).toHaveBeenCalledTimes(1);expect(ctx.signals.selection.peek().selection[0].id).toBe(1);
 await expect(operate('rowsTable','selectRows',{dataSourceRef:'rows',rows:[rows[1]]})).rejects.toThrow(/disabled/);expect(selected).toHaveBeenCalledTimes(1);
 await expect(operate('rowsTable','selectRows',{dataSourceRef:'rows',rows:[{id:99,name:'Invented'}]})).rejects.toThrow(/current or retained/);expect(selected).toHaveBeenCalledTimes(1);
});
it('draft reset waits for the normal discard confirmation and retains values on cancel',async()=>{
 const f=fixture();f.context.signals.formStatus=signal({dirty:true,version:1});
 f.context.handlers.dataSource.setFormData=({values})=>{f.form.value=values;};f.context.handlers.dataSource.resetFormDirty=()=>{f.context.signals.formStatus.value={dirty:false,version:2};};
 await act(async()=>root.render(<DraftForm container={{id:'editor',dataSourceRef:'record',draftForm:{confirmDiscard:'Discard changes?'}}} context={f.context}/>));
 await act(async()=>{f.form.value={name:'edited'};});
 await act(async()=>{await operate('editor:reset','click');});expect(f.form.peek().name).toBe('edited');
 await act(async()=>{await operate('editor:reset:cancel','click');});expect(f.form.peek().name).toBe('edited');
 await act(async()=>{await operate('editor:reset','click');});await act(async()=>{await operate('editor:reset:confirm','click');});expect(f.form.peek().name).toBe('old');
});

it('window close uses the normal dirty confirmation, preserves draft on cancel and closes only after confirm',async()=>{
 activeWindows.value=[{windowId:'operate-render',windowKey:'close-test',windowTitle:'Close test',inTab:true}];selectedTabId.value='operate-render';selectedWindowId.value='operate-render';
 const source={signals:{formStatus:signal({dirty:true}),form:signal({name:'unsaved'})}};
 setWindowContext('operate-render',{identity:{windowId:'operate-render'},metadata:{window:{confirmDiscardOnClose:'Discard unsaved?',dirtyDataSourceRefs:['record']}},Context:()=>source});
 await act(async()=>root.render(<WindowManager renderWindowContent={()=> <div>Editor</div>}/>));
 let result;await act(async()=>{result=await runUICommand({method:'ui.window.close',params:{windowId:'operate-render'}});});expect(result.status).toBe('awaiting_confirmation');expect(result.pendingConfirmation).toBe(true);expect(activeWindows.peek()).toHaveLength(1);
 await act(async()=>{await operate('window:close:cancel','click',{dataSourceRef:null});});expect(source.signals.form.peek().name).toBe('unsaved');expect(activeWindows.peek()).toHaveLength(1);
 await act(async()=>{await runUICommand({method:'ui.window.close',params:{windowId:'operate-render'}});});await act(async()=>{result=await runUICommand({method:'ui.control.click',params:{windowId:'operate-render',controlId:'window:close:confirm'}});});expect(result.status).toBe('closed');expect(activeWindows.peek()).toHaveLength(0);
 await act(async()=>{activeWindows.value=[{windowId:'clean-close',windowKey:'clean',windowTitle:'Clean',inTab:true}];selectedTabId.value='clean-close';});
 await act(async()=>{result=await runUICommand({method:'ui.window.close',params:{windowId:'clean-close'}});});expect(result.status).toBe('closed');expect(activeWindows.peek()).toHaveLength(0);
});
it('unregistered window close fails without removing the live instance',async()=>{
 activeWindows.value=[{windowId:'unregistered-close',windowKey:'test'}];
 await expect(runUICommand({method:'ui.window.close',params:{windowId:'unregistered-close'}})).rejects.toThrow(/unsupported or unmounted/);expect(activeWindows.peek()).toHaveLength(1);activeWindows.value=[];
});

it('declared validation and readonly handlers are rechecked against current values before dispatch',async()=>{
 const f=fixture();f.context.signals.message=signal([]);
 f.context.lookupHandler=name=>name==='test.locked'?()=>f.form.peek().locked:name==='test.validate'?({value})=>value==='forbidden'?'Forbidden value':null:f.context.handlers.dataSource.setFormField;
 const item={id:'name',type:'text',dataField:'name',on:[{event:'onReadonly',handler:'test.locked'},{event:'onValidate',handler:'test.validate'}]};
 const {events,stateEvents}=useControlEvents(f.context,[item]).name;
 await act(async()=>root.render(<WidgetRenderer item={item} context={f.context} events={events} stateEvents={stateEvents}/>));
 await expect(operate('name','setValue',{value:'forbidden'})).rejects.toThrow(/Forbidden value/);expect(f.form.peek().name).toBe('old');
 f.form.peek().locked=true;await expect(operate('name','setValue',{value:'allowed'})).rejects.toThrow(/read-only/);expect(f.form.peek().name).toBe('old');
});

it('lazy control Read returns rendered values/flags and never invokes authored guards or actions',async()=>{
 const f=fixture(),guard=vi.fn(()=>false);f.context.signals.message=signal([]);f.context.lookupHandler=name=>name==='guard'?guard:f.context.handlers.dataSource.setFormField;
 const item={id:'name',type:'text',dataField:'name',on:[{event:'onReadonly',handler:'guard'}]};
 const {events,stateEvents}=useControlEvents(f.context,[item]).name;
 await act(async()=>root.render(<><WidgetRenderer item={item} context={f.context} events={events} stateEvents={stateEvents}/><WidgetRenderer item={{id:'opaque',type:'text',properties:{type:'password',value:'private'}}} context={f.context}/></>));
 const before=guard.mock.calls.length;
 const observed=readRegisteredControlActions({windowId:'operate-render'});expect(guard).toHaveBeenCalledTimes(before);expect(observed.controls.find(control=>control.controlId==='name').value).toBe('old');expect(observed.controls.find(control=>control.controlId==='opaque').value).toBe('[redacted]');expect(observed.redacted).toBe(true);
});

it('registered focus triggers real lazy-select focus loading, then permits only loaded option selection',async()=>{
 const f=fixture(),collection=signal([]),control=signal({loaded:false,loading:false}),input=signal({fetch:false}),fetchCollection=vi.fn(()=>{control.value={loaded:false,loading:true};input.value={fetch:true};});
 const choices={signals:{collection,control,input},handlers:{dataSource:{fetchCollection}}};f.context.Context=()=>choices;
 await act(async()=>root.render(<WidgetRenderer item={{id:'category',label:'Category',type:'select',optionsDataSourceRef:'choices',optionsFetchMode:'onFocus',optionValueField:'id',optionLabelField:'name'}} context={f.context}/>));
 expect(fetchCollection).not.toHaveBeenCalled();await expect(operate('category','setValue',{value:'one'})).rejects.toThrow(/unavailable/);
 const button=host.querySelector('button');button.getClientRects=()=>[{width:100,height:30}];
 await act(async()=>{await operate('category','focus');});expect(document.activeElement).toBe(button);expect(fetchCollection).toHaveBeenCalledTimes(1);
 await act(async()=>{collection.value=[{id:'one',name:'One'}];control.value={loaded:true,loading:false};input.value={fetch:false};});
 await act(async()=>{await operate('category','setValue',{value:'one'});});expect(f.form.peek().category).toBe('one');
});

it('currency, civil-date, date-range and tree controls use native typed callbacks and reject invalid values',async()=>{
 const f=fixture();f.form.value={name:'old',amount:1,start:'2026-01-02',range:{start:'2026-02-01',end:'2026-02-03',retained:'yes'},tree:[]};
 await act(async()=>root.render(<><WidgetRenderer item={{id:'amount',type:'currency',widget:'currency',properties:{min:0,max:100,currency:'EUR'}}} context={f.context}/><WidgetRenderer item={{id:'start',type:'date',widget:'date',properties:{valueMode:'civil',minDate:new Date('2026-01-01'),maxDate:new Date('2026-12-31')}}} context={f.context}/><WidgetRenderer item={{id:'range',widget:'dateRange',type:'dateRange'}} context={f.context}/><WidgetRenderer item={{id:'tree',type:'treeMultiSelect',widget:'treeMultiSelect',options:[{value:'group_one',label:'One'},{value:'group_two',label:'Two'}]}} context={f.context}/></>));
 await act(async()=>{await operate('amount','setValue',{value:42.5});await operate('start','setValue',{value:'2026-12-01'});await operate('range','setValue',{value:{end:'2026-02-04'}});await operate('tree','setValue',{value:['group_one']});});
 expect(f.form.peek().amount).toBe(42.5);expect(f.form.peek().start).toBe('2026-12-01');expect(f.form.peek().range).toEqual({start:'2026-02-01',end:'2026-02-04',retained:'yes'});expect(f.form.peek().tree).toEqual(['group_one']);
 await expect(operate('amount','setValue',{value:101})).rejects.toThrow(/bounds/);await expect(operate('start','setValue',{value:'2026-02-30'})).rejects.toThrow(/ISO date/);await expect(operate('range','setValue',{value:{start:'2026-03-01'}})).rejects.toThrow(/precede/);await expect(operate('tree','setValue',{value:['invented']})).rejects.toThrow(/unavailable/);
});
it('array fields preserve siblings and enforce per-row readonly, removal predicates and minimum rows',async()=>{
 const f=fixture();f.form.value={flights:[{id:11,name:'First',locked:false,untouched:'keep'},{id:12,name:'Locked',locked:true}]};
 const item={id:'flights',type:'arrayFields',widget:'arrayFields',properties:{fields:[{field:'name',type:'text',properties:{maxLength:10}}],newRow:{id:0,name:'New'},minRows:1,rowReadOnlyWhen:{source:'row',field:'locked',equals:true},removeWhen:{source:'row',field:'locked',equals:false}}};
 await act(async()=>root.render(<WidgetRenderer item={item} context={f.context}/>));
 await act(async()=>{await operate('flights:11:name','setValue',{value:'Edited'});});expect(f.form.peek().flights[0]).toEqual({id:11,name:'Edited',locked:false,untouched:'keep'});
 await expect(operate('flights:12:name','setValue',{value:'No'})).rejects.toThrow(/read-only/);await expect(operate('flights:12:remove','click')).rejects.toThrow(/hidden/);
 await act(async()=>{await operate('flights:add','click');});expect(f.form.peek().flights).toHaveLength(3);
 await act(async()=>{await operate('flights:11:remove','click');});expect(f.form.peek().flights[0]).toEqual({id:12,name:'Locked',locked:true});
});
it('date-range presets invoke native coherent preset/custom apply callbacks',async()=>{
 const f=fixture();f.context.signals.windowForm=signal({period:'month',retained:'yes'});
 const item={id:'period',type:'dateRangePreset',widget:'dateRangePreset',scope:'windowForm',options:[{value:'today',label:'Today'},{value:'week',label:'Week'},{value:'month',label:'Month'},{value:'custom',label:'Custom'}],properties:{customApplyEnabled:true}};
 await act(async()=>root.render(<WidgetRenderer item={item} context={f.context}/>));
 await act(async()=>{await operate('period','setValue',{value:'week'});});expect(f.context.signals.windowForm.peek().period).toBe('week');expect(f.context.signals.windowForm.peek().customDateStart).toBeTruthy();expect(f.context.signals.windowForm.peek().customDateEnd).toBeTruthy();
 await act(async()=>{await operate('period','setValue',{value:{start:'2026-04-01',end:'2026-04-02'}});});expect(f.context.signals.windowForm.peek()).toEqual(expect.objectContaining({period:'custom',customDateStart:'2026-04-01',customDateEnd:'2026-04-02',granularity:'hour',retained:'yes'}));
 await expect(operate('period','setValue',{value:'invented'})).rejects.toThrow(/unavailable/);await expect(operate('period','setValue',{value:{start:'2026-05-01',end:'2026-04-01'}})).rejects.toThrow(/rejected/);
});
it('quick search invokes its normal commit and paging callback, preserving other criteria',async()=>{
 const f=fixture();f.context.signals.input=signal({filter:{Name:'old',Status:'Active'},page:4});
 const setFilter=vi.fn(({filter})=>{f.context.signals.input.value={...f.context.signals.input.peek(),filter};}),setPage=vi.fn(page=>{f.context.signals.input.value={...f.context.signals.input.peek(),page};});Object.assign(f.context.handlers.dataSource,{setFilter,setPage});
 await act(async()=>root.render(<QuickSearch context={f.context} item={{id:'nameSearch',type:'quickSearch',dataField:'Name'}}/>));
 await act(async()=>{await operate('nameSearch','setValue',{value:'new'});});expect(setFilter).toHaveBeenCalledTimes(1);expect(f.context.signals.input.peek()).toEqual({filter:{Name:'new',Status:'Active'},page:1});
 await act(async()=>{await operate('nameSearch','setValue',{value:''});});expect(f.context.signals.input.peek()).toEqual({filter:{Status:'Active'},page:1});
});
it('registered dialog footer invokes actual guarded callbacks and retains dialog on rejected action',async()=>{
 const f=fixture(),close=vi.fn(),invoke=vi.fn(async()=>false);
 await act(async()=>root.render(<ViewDialogFooterAction dialogId="picker" context={f.context} action={{id:'apply',label:'Apply',close:true}} onClose={close} onInvoke={invoke} onOperateInvoke={invoke} invokeBeforeClose/>));
 await expect(operate('picker:apply','click')).rejects.toThrow(/rejected/);expect(invoke).toHaveBeenCalledTimes(1);expect(close).not.toHaveBeenCalled();
});

it('editable table cells and row actions call strict native handlers with the actual row',async()=>{
 const f=fixture(),row={id:7,name:'Seven'},changed=vi.fn(),clicked=vi.fn();f.context.handlers.dataSource.getUniqueKeyValue=r=>r.id;f.context.handlers.dataSource.isSelected=()=>true;
 const columnHandlers={onChange:{isDefined:()=>true,execute:changed,executeStrict:changed},onClick:{isDefined:()=>true,execute:clicked,executeStrict:clicked}};
 const render=(type,disabled=false)=>root.render(<table><tbody><tr><TableCell context={f.context} cell={{value:'Seven',displayedText:'Seven'}} cellSelection={{row,col:{id:'name',type,disabledWhen:{source:'row',field:'locked',equals:true}},rowIndex:0}} columnHandlers={columnHandlers} onRowClick={()=>{}}/></tr></tbody></table>);
 await act(async()=>render('editableText'));
 await act(async()=>{await operate('record:row:7:name','setValue',{value:'Changed'});});expect(changed).toHaveBeenCalledWith(expect.objectContaining({row,event:expect.objectContaining({target:{value:'Changed'}})}));
 await act(async()=>render('button'));await act(async()=>{await operate('record:row:7:name','click');});expect(clicked).toHaveBeenCalledWith(expect.objectContaining({row}));
 row.locked=true;await expect(operate('record:row:7:name','click')).rejects.toThrow(/disabled/);expect(clicked).toHaveBeenCalledTimes(1);
});
it('table dialog links use the declared normal opener and propagate its rejection',async()=>{
 const f=fixture(),openDialog=vi.fn(async()=>{throw new Error('picker unavailable');}),row={id:9};f.context.handlers.window={openDialog};f.context.handlers.dataSource.getUniqueKeyValue=r=>r.id;f.context.handlers.dataSource.isSelected=()=>true;
 await act(async()=>root.render(<table><tbody><tr><TableCell context={f.context} cell={{value:'Open',displayedText:'Open'}} cellSelection={{row,col:{id:'relation',type:'link',link:{kind:'dialog',dialogId:'picker',text:'Open'}},rowIndex:0}}/></tr></tbody></table>));
 await expect(operate('record:row:9:relation','click')).rejects.toThrow(/picker unavailable/);expect(openDialog).toHaveBeenCalledTimes(1);expect(openDialog.mock.calls[0][0].execution.args[0]).toBe('picker');
});
it('text lookup returns pending declared interaction and applies only the normal returned selection',async()=>{
 const f=fixture();let finish;const dialog=getDialogSignal('operate-renderDialoglookup-picker');dialog.value={open:false};getMetadataSignal('operate-render').value={dialogs:[{id:'lookup-picker'}]};
 f.context.handlers.lookup={open:vi.fn(()=>{dialog.value={open:true};return new Promise(resolve=>finish=resolve);})};
 const adapter={set:value=>{f.form.value={...f.form.peek(),name:value};}};
 await act(async()=>root.render(<TextLookup item={{id:'lookup-name',dataField:'name',type:'text',lookup:{dialogId:'lookup-picker',valueField:'name'}}} context={f.context} adapter={adapter} value={f.form.peek().name}/>));
 let pending;await act(async()=>{pending=await operate('lookup-name','click');});expect(pending.status).toBe('awaiting_interaction');expect(pending.pendingInteraction.targetId).toBe('lookup-picker');expect(f.form.peek().name).toBe('old');
 await expect(operate('lookup-name','click')).rejects.toThrow(/awaiting/);
 await act(async()=>{dialog.value={open:false};finish({name:'Selected'});for(let i=0;i<10;i++)await Promise.resolve();});expect(f.form.peek().name).toBe('Selected');expect(readRegisteredControlActions({windowId:'operate-render',controlId:'lookup-name'}).controls[0].operationState.status).toBe('handler_completed');
 getMetadataSignal('operate-render').value={};
});
it('toolbar select/boolean/menu actions use normal callbacks and reject unknown or disabled choices',async()=>{
 const f=fixture(),changed=vi.fn(),menu=vi.fn();f.context.signals.control=signal({});f.context.signals.formStatus=signal({});f.context.signals.selection=signal({});f.context.signals.windowForm=signal({});f.context.signals.message=signal([]);f.context.lookupHandler=name=>name==='test.menu'?menu:changed;
 const items=[{id:'choice',type:'select',field:'choice',options:[{value:'a',label:'A'},{value:'b',disabled:true}],on:[{event:'onChange',handler:'test.change'}]},{id:'flag',type:'checkbox',on:[{event:'onChange',handler:'test.change'}]},{id:'actions',type:'menu',label:'Actions',menuItems:[{id:'go',label:'Go',on:[{event:'onClick',handler:'test.menu'}]},{id:'blocked',disabled:true,label:'Blocked',on:[{event:'onClick',handler:'test.menu'}]}]}];
 await act(async()=>root.render(<Toolbar context={f.context} toolbarItems={items}/>));
 await expect(operate('choice','setValue',{value:'b'})).rejects.toThrow(/disabled/);await expect(operate('choice','setValue',{value:'unknown'})).rejects.toThrow(/unavailable/);
 await act(async()=>{await operate('choice','setValue',{value:'a'});});expect(f.form.peek().choice).toBe('a');expect(changed).toHaveBeenCalledTimes(1);
 await act(async()=>{await operate('flag','setValue',{value:true});});expect(f.form.peek().flag).toBe(true);expect(changed).toHaveBeenCalledTimes(2);
 await act(async()=>{await operate('actions','click');});await expect(operate('actions:blocked','click')).rejects.toThrow(/disabled/);await act(async()=>{await operate('actions:go','click');});expect(menu).toHaveBeenCalledTimes(1);
});
it('native pagination enforces current boundaries and loaded page-size choices; refresh reports failure',async()=>{
 const f=fixture(),setPage=vi.fn(),setPageSize=vi.fn(),fetchCollection=vi.fn(async()=>{throw new Error('read refresh failed');});f.context.signals.control=signal({loading:false});f.context.signals.collection=signal([{id:1}]);f.context.signals.formStatus=signal({});f.context.signals.selection=signal({});f.context.lookupHandler=()=>()=>{};
 Object.assign(f.context.handlers.dataSource,{setPage,setPageSize,fetchCollection,getCollectionInfo:()=>({page:1,totalPages:3,totalCount:30}),getPage:()=>1,isInactive:()=>false});
 await act(async()=>root.render(<><PaginationBar context={f.context} pageSize={10} pageSizeOptions={[10,20]}/><Toolbar context={f.context} toolbarItems={[{id:'refresh'}]}/></>));
 await expect(operate('pagination.first','click')).rejects.toThrow(/disabled/);await act(async()=>{await operate('pagination.next','click');});expect(setPage).toHaveBeenCalledWith(2);
 await expect(operate('pagination.pageSize','setValue',{value:999})).rejects.toThrow(/unavailable/);await act(async()=>{await operate('pagination.pageSize','setValue',{value:20});});expect(setPageSize).toHaveBeenCalledWith(20);
 await act(async()=>{await expect(operate('refresh','click')).rejects.toThrow(/read refresh failed/);});expect(fetchCollection).toHaveBeenCalledTimes(1);
});
it('quick filters commit through native change/blur and toggle callbacks without replacing unrelated criteria',async()=>{
 const f=fixture(),filter=signal({unrelated:'keep'}),setPage=vi.fn();f.context.signals.control=signal({});f.context.signals.formStatus=signal({});f.context.signals.selection=signal({});f.context.signals.input=signal({});f.context.lookupHandler=()=>()=>{};
 f.context.dataSource={quickFilterSet:'quick',filterSet:[{name:'quick',mode:'fieldSelector',filters:[{field:'name'},{field:'id'}]}]};
 Object.assign(f.context.handlers.dataSource,{peekFilter:()=>filter.peek(),setSilentFilterValues:({filter:values})=>{filter.value={...filter.peek(),...values};},setPage});
 await act(async()=>root.render(<Toolbar context={f.context} toolbarItems={[{id:'quickFilterInputs'},{id:'quickFilterToggle'}]}/>));
 await act(async()=>{await operate('quickFilter:name','setValue',{value:'needle'});});expect(filter.peek().name).toBe('needle');expect(filter.peek().unrelated).toBe('keep');expect(setPage).toHaveBeenCalledWith(1);
 await expect(operate('quickFilter:field','setValue',{value:'invented'})).rejects.toThrow(/unavailable/);
 await act(async()=>{await operate('quickFilter:field','setValue',{value:'id'});});expect(filter.peek().name).toBe('');expect(listRegisteredControlActions({windowId:'operate-render'}).some(control=>control.controlId==='quickFilter:id')).toBe(true);
});
it('table export uses its native format action and rejects failed download creation',async()=>{
 const f=fixture();f.context.signals.control=signal({});f.context.signals.formStatus=signal({});f.context.signals.selection=signal({});f.context.lookupHandler=()=>()=>{};
 const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;URL.createObjectURL=vi.fn(()=>{throw new Error('download capability unavailable');});URL.revokeObjectURL=vi.fn();
 try{
  await act(async()=>root.render(<Toolbar context={f.context} toolbarItems={[{id:'export',type:'tableExport',label:'Export',properties:{formats:['csv']}}]} exportRows={[{name:'One'}]} exportColumns={[{id:'name'}]}/>));
  await act(async()=>{await operate('export','click');});
  await act(async()=>{await expect(operate('export:csv','click')).rejects.toThrow(/download capability unavailable/);});expect(URL.createObjectURL).toHaveBeenCalledTimes(1);expect(document.body.textContent).toContain('download capability unavailable');
 }finally{URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}
});

it('native lookup registration redacts and blocks password-format values without a credential field name',async()=>{
 const f=fixture();await act(async()=>root.render(<TextLookup item={{id:'opaque-lookup',type:'text',properties:{type:'password'},lookup:{dialogId:'picker'}}} context={f.context} adapter={{set:vi.fn()}} value="private-value"/>));
 const read=readRegisteredControlActions({windowId:'operate-render',controlId:'opaque-lookup'});expect(read.controls[0].value).toBe('[redacted]');await expect(operate('opaque-lookup','setValue',{value:'other'})).rejects.toThrow(/sensitive/);
});

it('lookup authored onLookup completion propagates rejection after mapped draft without retrying selection',async()=>{
 const f=fixture(),complete=vi.fn(async()=>{throw new Error('authored lookup rejected');}),select=vi.fn(async()=>({name:'Mapped'}));f.context.handlers.lookup={open:select};f.context.lookupHandler=()=>complete;
 await act(async()=>root.render(<TextLookup item={{id:'authored-lookup',dataField:'name',type:'text',lookup:{valueField:'name'},on:[{event:'onLookup',handler:'test.complete'}]}} context={f.context} adapter={{set:value=>{f.form.value={...f.form.peek(),name:value};}}} value="old"/>));
 await act(async()=>{await expect(operate('authored-lookup','click')).rejects.toThrow(/authored lookup rejected/);});expect(f.form.peek().name).toBe('Mapped');expect(select).toHaveBeenCalledTimes(1);expect(complete).toHaveBeenCalledTimes(1);
});

it('carousel known-page navigation and card-rail actions invoke current normal authored callbacks',async()=>{
 const f=fixture(),carousel=vi.fn(),rail=vi.fn(),tag=vi.fn();const strictRail=vi.fn(async event=>{rail(event);throw new Error('rail authored rejected');});rail.operate=strictRail;
 await act(async()=>root.render(<><ContentCarousel id="featured" context={f.context} onClick={carousel} value={[{id:'first',title:'First',actionLabel:'Open'},{id:'second',title:'Second',actionLabel:'Open'}]}/><CardRailGroup id="rails" context={f.context} onClick={rail} onTagClick={tag} value={[{id:'section',heading:'Section',value:[{id:'known',title:'Known',tags:[{id:'tag',label:'Tag'}]},{id:'locked',title:'Locked',disabled:true}]}]}/></>));
 await act(async()=>{await operate('featured:page:second','click');});await act(async()=>{await operate('featured:action','click');});expect(carousel).toHaveBeenCalledWith(expect.objectContaining({detail:expect.objectContaining({item:expect.objectContaining({id:'second'})})}));
 await expect(operate('featured:page:invented','click')).rejects.toThrow(/unsupported/);
 await act(async()=>{await expect(operate('rails-section:card:known:open','click')).rejects.toThrow(/rail authored rejected/);});expect(strictRail).toHaveBeenCalledTimes(1);expect(rail.mock.calls[0][0].detail.section.id).toBe('section');
 await act(async()=>{await operate('rails-section:card:known:tag:tag','click');});expect(tag.mock.calls[0][0].detail.item.id).toBe('known');await expect(operate('rails-section:card:locked:open','click')).rejects.toThrow(/disabled/);
});
it('file controls report trusted native input requirement and never accept file paths as values',async()=>{
 const f=fixture();await act(async()=>root.render(<WidgetRenderer context={f.context} item={{id:'import',type:'file'}}/>));const read=readRegisteredControlActions({windowId:'operate-render',controlId:'import'}).controls[0];expect(read.constraints).toMatchObject({requiresTrustedFileInput:true,requiresUserInteraction:true});expect(read.supportedActions).not.toContain('setValue');await expect(operate('import','setValue',{value:'/tmp/pretend.csv'})).rejects.toThrow(/unsupported/);
});
