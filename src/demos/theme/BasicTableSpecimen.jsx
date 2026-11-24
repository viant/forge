import React,{useEffect,useId,useMemo,useState} from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {Button as BlueprintButton,MenuItem} from '@blueprintjs/core';
import {Select} from '@blueprintjs/select';
import {Context} from '../../core/context/Context.jsx';
import BasicTable from '../../components/table/Basic.jsx';
import SwitchControl from '../../components/SwitchControl.jsx';
import Icon from '../../components/Icon.jsx';
import {typographyProps} from '../../components/Typography.jsx';
import {anchoredPopoverProps,menuTriggerMinWidthModifier} from '../../components/anchoredPopoverProps.js';
import TableEditReview from './TableEditReview.jsx';
import {tableEditSpecimenActions,tableEditSpecimenState} from './tableEditSpecimen.js';
import {formatTableNumber} from '../../components/table/basic/tableNumericFormat.js';
import './basicTableSpecimen.css';

export const tableEditorStates=['Unsaved changes','Validation error'];

// Independent, domain-neutral sample data. The existing table and datasource
// own every interaction; this component is catalog content, not another engine.
const records=[
 {id:1001,name:'Design foundations',owner:'Alex Morgan',email:'alex@example.com',quantity:12,amount:1850.25,rate:.62,progress:62,status:'Active',verified:true,starred:true,starOrder:0,start:'Nov 18, 2026'},
 {id:1002,name:'Component inventory',owner:'Taylor Lee',email:'taylor@example.com',quantity:24,amount:730,rate:.21,progress:21,status:'Paused',verified:false,starred:false,starOrder:1,start:'Nov 19, 2026'},
 {id:1003,name:'Research collection',owner:'Jordan Patel',email:'jordan@example.com',quantity:0,amount:0,rate:0,progress:0,status:'Archived',verified:true,starred:false,starOrder:1,start:'Nov 20, 2026'},
 {id:1004,name:'Release checklist',owner:'Casey Chen',email:'casey@example.com',quantity:8,amount:124.5,rate:.97,progress:97,status:'Custom status',verified:false,starred:true,starOrder:0,readOnly:true,start:'Nov 21, 2026'},
].map(row=>({...row,disabled:row.id===1003,image:{label:'Asset unavailable'},icon:'lucide:file-text',details:{meta:'Shared library',title:row.name,body:'A native multiline cell with supporting context.'},preview:{kind:'imagecard',title:row.name,description:'No image source has been supplied.'}}));
const statusOptions=['Active','Paused','Archived','Custom status'].map(value=>({value,label:value}));
const events=[{event:'onChange',handler:'example.edit'},{event:'onValue',handler:'example.editValue'},{event:'onProperties',handler:'example.editProperties'}];
const editable={type:'editableText',on:events,readOnlyWhen:{source:'row',field:'readOnly',equals:true}};
const idColumn={id:'id',name:'ID',type:'number',align:'right',width:90,sortable:true};
const nameColumn={id:'name',name:'Record name',type:'text',width:230,sortable:true};
const linkColumn={...nameColumn,type:'link',link:{kind:'window',windowKey:'record',parameters:{id:{source:'row',selector:'id'}}}};
const statusColumn={id:'status',name:'Status',width:145,sortable:true,badge:{appearance:'status',field:'status',replaceValue:true,valueMap:Object.fromEntries(records.map(row=>[row.status,row.status])),toneMap:{Active:'success',Paused:'warning',Archived:'neutral'}}};
const starColumn={id:'starOrder',name:'',tooltip:'Starred',type:'button',icon:'lucide:star',pressedWhenValue:true,width:64,align:'center',sortable:true,cellProperties:{'aria-label':'Toggle starred record'},on:[{event:'onClick',handler:'example.toggleStar'},{event:'onValue',handler:'example.starValue'}]};
const quantities={id:'quantity',name:'Quantity',type:'number',numericFormat:'int',align:'right',width:130,sortable:true};
const amount={id:'amount',name:'Amount',type:'number',numericFormat:'usdCurrency',align:'right',width:170,sortable:true};
const fieldColumns=[idColumn,{...linkColumn,...editable,cellProperties:{required:true}},
 {id:'owner',name:'Owner',width:170,...editable},
 {id:'email',name:'Email',width:235,...editable,cellProperties:{type:'email'}},
 {...quantities,...editable,cellProperties:{type:'number',required:true,min:0,max:1000,stepSize:1,buttonPosition:'none',clampValueOnBlur:false,pattern:'\\d+','aria-description':'Enter a whole number from 0 to 1000.'}},
 {...amount,...editable,cellProperties:{type:'number',required:true,min:0,stepSize:.01,minorStepSize:.01,buttonPosition:'none',clampValueOnBlur:false,pattern:'\\d+(?:\\.\\d{1,2})?',leftElement:'$','aria-description':'Use zero or more, with up to two decimal places.'}}];
const choiceColumn={type:'text',width:210,readOnlyWhen:{source:'row',field:'readOnly',equals:true},disabledWhen:{source:'row',field:'disabled',equals:true},on:[{event:'onValue',handler:'example.choiceValue'}]};
const groups={
 'Text and IDs':[starColumn,idColumn,nameColumn,statusColumn,{id:'owner',name:'Owner',width:170}],
 'Numbers and dates':[idColumn,quantities,amount,{id:'rate',name:'Rate',type:'number',numericFormat:'percent',align:'right',width:135,sortable:true},{id:'start',name:'Start date',width:170}],
 'Links and status':[idColumn,linkColumn,{id:'owner',name:'Related record',type:'link',width:180,link:{kind:'window',windowKey:'related-record',parameters:{id:{source:'row',selector:'id'}}}},statusColumn,{id:'verified',name:'Verified',type:'checkbox',width:100,align:'center'}],
 'Editable cells':fieldColumns,
 'Dropdown and Switch':[idColumn,nameColumn,{...choiceColumn,id:'status',name:'Status',cellProperties:{type:'select',options:statusOptions}},{...choiceColumn,id:'verified',name:'Verified',width:160,cellProperties:{type:'switch'}}],
 'Header types':[starColumn,{...nameColumn,sortable:false},quantities,{id:'owner',name:'A descriptive header that exceeds its available column width',width:180,sortable:true}],
 'Frozen columns':[{...idColumn,sticky:'left'},{...linkColumn,sticky:'left'},{id:'owner',name:'Owner',width:180},amount,statusColumn,{id:'email',name:'Email',width:240}],
 'Rich cells':[nameColumn,{id:'image',name:'Image fallback',type:'image',width:180},{id:'icon',name:'Icon',type:'icon',width:70,align:'center'},{id:'progress',name:'Progress',type:'progress',width:200,progress:{appearance:'inline',max:100}},{id:'details',name:'Multiline content',type:'stacked',width:260},{id:'preview',name:'Media preview',type:'mediaPreview',width:150}],
};

// Native onValue content composition, not new serialized table cell types.
// Keep control clicks (including the Select portal) out of row selection.
function TableChoiceCell({args,editActions}) {
 useSignals();
 const {row,col}=args,value=editActions.editValue(args),properties=editActions.editProperties(args);
 const onChange=value=>editActions.edit({...args,event:{target:{value}}});
 const id=useId(),label=`${col.name} ${row.id}`,unavailable=row.disabled||row.readOnly;
 const description=[row.disabled?'Unavailable.':row.readOnly?'Read only.':'',properties['aria-description']].filter(Boolean).join(' ')||undefined;
 const selected=statusOptions.find(option=>option.value===value);
 return <span className="catalog-table-choice-cell" data-edit-state={properties['data-edit-state']} onClick={event=>event.stopPropagation()}>
  {col.cellProperties.type==='switch'?<SwitchControl value={value} onChange={onChange} disabled={row.disabled} readOnly={row.readOnly} aria-label={label} aria-describedby={description?`${id}-description`:undefined} trueLabel="On" falseLabel="Off"/>:
   <Select items={statusOptions} itemsEqual="value" initialActiveItem={selected} filterable={false} disabled={unavailable}
    menuProps={{'aria-label':label}}
    popoverProps={anchoredPopoverProps({minimal:true,popoverClassName:'forge-dropdown-menu',modifiersCustom:[menuTriggerMinWidthModifier]})}
    onItemSelect={option=>onChange(option.value)}
    itemRenderer={(option,{handleClick,handleFocus,id:itemId,modifiers,ref})=><MenuItem key={option.value} id={itemId} ref={ref} roleStructure="listoption" text={option.label} selected={value===option.value} active={modifiers.active} disabled={modifiers.disabled} onClick={handleClick} onFocus={handleFocus}/> }>
    <BlueprintButton minimal className="forge-button" data-forge-variant="ghost" data-forge-size="default" {...typographyProps('body')} disabled={unavailable} aria-label={label} aria-describedby={description?`${id}-description`:undefined} alignText="left" text={value} rightIcon={<Icon name="lucide:chevron-down"/>}/>
   </Select>}
  {description&&<span id={`${id}-description`} className="bp6-visually-hidden">{description}</span>}
 </span>;
}

export default function BasicTableSpecimen({variant='Text and IDs',state='Default',thumbnail=false}) {
 useSignals();
 const id=useId(),[message,setMessage]=useState('');
 const choices=variant==='Dropdown and Switch',editing=variant==='Editable cells'||choices;
 const selection=true;
 const columns=groups[variant]||groups['Text and IDs'];
 const native=useMemo(()=>{
  const root=Context(`table-component-${id}-${variant}`,{dataSource:{savedRecords:{autoFetch:false,uniqueKey:[{field:'id'}]},pendingEdits:{autoFetch:false},records:{autoFetch:false,cardinality:'collection',selectionMode:selection?'multi':'none',sortMode:'client',filterMode:'client',uniqueKey:[{field:'id'}]}},actions:{import:context=>{const editActions=tableEditSpecimenActions(context,columns,setMessage);return{example:{
   ...editActions,
   choiceValue:args=><TableChoiceCell args={args} editActions={editActions}/>,
   starValue:({row})=>row.starred,
   toggleStar:({row})=>{const source=context.Context('savedRecords').handlers.dataSource;source.setCollection(source.peekCollection().map(item=>item.id===row.id?{...item,starred:!item.starred,starOrder:item.starred?1:0}:item));return true;},
  }}}}},'records',{window:{openTarget:({target})=>setMessage(`Local navigation: ${target.windowKey || 'record'} ${target.parameters?.id || ''}`)}});
  root.init();const saved=root.Context('savedRecords'),draft=root.Context('pendingEdits');saved.handlers.dataSource.setCollection(records.slice(0,thumbnail?2:4).map(row=>({...row})));draft.handlers.dataSource.setFormData({values:{pending:{}}});return{root,context:root.Context('records'),saved,draft};
 },[id,variant,columns,selection,thumbnail]);
 useEffect(()=>()=>native.root.dispose(),[native]);
 const rows=native.saved.signals.collection.value;
 useEffect(()=>{
  const shown=state==='Empty'?[]:rows.map(row=>state==='Read only'?{...row,readOnly:true}:row);
  native.context.handlers.dataSource.setCollection(shown);
  native.context.signals.control.value=state==='Loading'?{loaded:true,loading:true}:state==='Load error'?{loaded:true,error:{message:'The sample rows could not be loaded.'}}:{loaded:true};
  if(state==='Row selected'&&shown.length&&!native.context.handlers.dataSource.isSelected({row:shown[0],rowIndex:0}))native.context.handlers.dataSource.toggleSelection({row:shown[0],rowIndex:0});
 },[native,rows,state]);
 useEffect(()=>{
  native.draft.handlers.dataSource.setFormData({values:{pending:state==='Validation error'?{1001:{email:'not-an-address'}}:state==='Unsaved changes'?{1001:{owner:'Alex Morgan updated'}}:{}}});
 },[native,state]);
 const edits=tableEditSpecimenState(native.draft.signals.form.value?.pending,columns);
 const container={id:`table-${variant}`,title:'Records',fetchData:false,table:{selectionEnabled:selection,fullWidth:true,minRows:0,rowHeight:56,enforceColumnSize:false,toolbar:{items:[],style:{display:'none'}},emptyState:{title:'No records to display',description:'Change the query or add records through the owning page.'}}};
 return <div className="catalog-native-table forge-list-page-review">
  <BasicTable context={native.context} container={container} columns={columns} sizingMode="content" renderSummaryCell={({column,rows})=>column.id==='amount'?formatTableNumber(rows.reduce((total,row)=>total+row.amount,0),'usdCurrency'):null}/>
  {editing&&<TableEditReview context={native.context} {...edits}/>}
  {choices&&!thumbnail&&<p className="catalog-caption">Dropdown and Switch use the existing field controls. Changes stay local until Apply changes. Research collection is disabled; Release checklist is read only.</p>}
  {message&&<p className="catalog-caption" role="status">{message}</p>}
 </div>;
}
