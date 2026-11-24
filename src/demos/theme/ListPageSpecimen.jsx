import React, {useEffect, useId, useMemo, useState} from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {Drawer, InputGroup} from '@blueprintjs/core';
import {Context} from '../../core/context/Context.jsx';
import BasicTable from '../../components/table/Basic.jsx';
import Button from '../../components/Button.jsx';
import Typography from '../../components/Typography.jsx';
import TableEditReview from './TableEditReview.jsx';
import {tableEditSpecimenActions,tableEditSpecimenState} from './tableEditSpecimen.js';
import {formatTableNumber} from '../../components/table/basic/tableNumericFormat.js';
import {applyClientFilters} from '../../components/table/clientFilters.js';
import './listPageSpecimen.css';

// Independently authored, domain-neutral records. This recipe never contacts a
// business service; the native table owns selection, sorting and cell actions.
const initialRecords = [
    {id: 1001, name: 'Design foundations', workspace: 'Shared library', owner: 'Alex Morgan', contact: 'alex@example.com', amount: 18450, status: 'Active', starred: false},
    {id: 1002, name: 'Component inventory', workspace: 'Product design', owner: 'Taylor Lee', contact: 'taylor@example.com', amount: 27320, status: 'Active', starred: true},
    {id: 1003, name: 'Research collection', workspace: 'Research team', owner: 'Jordan Patel', contact: 'jordan@example.com', amount: 21875, status: 'Paused', starred: false},
    {id: 1004, name: 'Accessibility review', workspace: 'Shared library', owner: 'Casey Chen', contact: 'casey@example.com', amount: 25600, status: 'Active', starred: false},
    {id: 1005, name: 'Release checklist', workspace: 'Product design', owner: 'Riley Rivera', contact: 'riley@example.com', amount: 19995, status: 'Archived', starred: true},
];
// Labels belong to this sample producer; the shared chip owns only its tone.
const statusColumn = {id:'status',name:'Status',type:'text',width:150,sortable:true,badge:{appearance:'status',field:'status',valueMap:Object.fromEntries(initialRecords.map(row=>[row.status,row.status])),toneMap:{Active:'success',Paused:'warning',Archived:'neutral'},replaceValue:true}};
const columnDefinitions = [
    {id: 'starOrder', name: '', sortable: true, align: 'center', type: 'button', icon: 'lucide:star', pressedWhenValue: true, tooltip: 'Starred', width: 64, nonExcludable: true, on: [{event: 'onClick', handler: 'example.toggleStar'}, {event: 'onValue', handler: 'example.starValue'}]},
    {id: 'id', name: 'Record ID', width: 140, sticky: 'left', type: 'number', sortable: true},
    {id: 'name', name: 'Record name', width: 210, sticky: 'left', type: 'editableText', cellProperties: {required:true}, on: [{event: 'onChange', handler: 'example.edit'}, {event: 'onValue', handler: 'example.editValue'}, {event: 'onProperties', handler: 'example.editProperties'}], sortable: true, nonExcludable: true, link: {kind: 'window', windowKey: 'record', parameters: {id: {source: 'row', selector: 'id'}}}},
    {id: 'workspace', name: 'Workspace', width: 180, type: 'editableText', sortable: true, cellProperties: {required:true}, link: {kind:'window',windowKey:'workspace',parameters:{id:{source:'row',selector:'id'},field:{source:'const',value:'workspace'}}}, on: [{event: 'onChange', handler: 'example.edit'}, {event: 'onValue', handler: 'example.editValue'}, {event: 'onProperties', handler: 'example.editProperties'}]},
    {id: 'owner', name: 'Owner', width: 160, type: 'editableText', sortable: true, on: [{event: 'onChange', handler: 'example.edit'}, {event: 'onValue', handler: 'example.editValue'}, {event: 'onProperties', handler: 'example.editProperties'}]},
    {id: 'contact', name: 'Contact', width: 230, type: 'editableText', cellProperties: {type: 'email'}, on: [{event: 'onChange', handler: 'example.edit'}, {event: 'onValue', handler: 'example.editValue'}, {event: 'onProperties', handler: 'example.editProperties'}]},
    {id: 'amount', name: 'Amount', numericFormat: 'usdCurrency', width: 170, minWidth: 170, type: 'editableText', align: 'right', sortable: true, cellProperties: {type: 'number', leftElement: '$', required: true, min: 0, stepSize: 0.01, minorStepSize: 0.01, clampValueOnBlur: false, buttonPosition: 'none', pattern: '\\d+(?:\\.\\d{1,2})?', 'aria-description': 'Use zero or more, with up to two decimal places.'}, on: [{event: 'onChange', handler: 'example.edit'}, {event: 'onValue', handler: 'example.editValue'}, {event: 'onProperties', handler: 'example.editProperties'}]},
];
columnDefinitions.push(statusColumn);
const money=value=>formatTableNumber(value,'usdCurrency');

export default function ListPageSpecimen({state='Default',variant='Default'}) {
    useSignals();
    const id=useId();
    const [editMessage,setEditMessage]=useState('');
    const [starredOnly,setStarredOnly]=useState(false);
    const [drawer,setDrawer]=useState(null);
    const [draftName,setDraftName]=useState('');
    const native=useMemo(()=>{
        let context;
        const root=Context(`list-page-${id}`,{
            dataSource:{savedRecords:{autoFetch:false,cardinality:'collection',uniqueKey:[{field:'id'}]},pendingEdits:{autoFetch:false,cardinality:'record'},records:{autoFetch:false,cardinality:'collection',selectionMode:'multi',filterMode:'client',uniqueKey:[{field:'id'}],filterSet:[{name:'records',default:true,template:[
                {id:'recordIds',field:'id',label:'Record name',operator:'in',type:'number[]',options:initialRecords.map(row=>({value:row.id,label:row.name}))},
                {id:'status',field:'status',label:'Status',operator:'in',type:'string[]',options:[...new Set(initialRecords.map(row=>row.status))].map(value=>({value,label:value}))},
            ]}]}},
            actions:{import:ctx=>{
                const changeStars=starred=>{
                    const ids=(ctx.handlers.dataSource.getSelection().selection||[]).map(row=>row.id);
                    const source=ctx.Context('savedRecords').handlers.dataSource;source.setCollection(source.peekCollection().map(row=>ids.includes(row.id)?{...row,starred,starOrder:starred?0:1}:row));
                    return true;
                };
                return {example:{
                    ...tableEditSpecimenActions(ctx,columnDefinitions,setEditMessage),
                    starValue:({row})=>row.starred,
                    toggleStar:({row})=>{const source=ctx.Context('savedRecords').handlers.dataSource;source.setCollection(source.peekCollection().map(record=>record.id===row.id?{...record,starred:!record.starred,starOrder:record.starred?1:0}:record));return true;},
                    changeView:({event})=>{setStarredOnly(event.target.value==='starred');return true;},
                    search:()=>true,
                    create:()=>{setDraftName('');setDrawer({type:'new'});return true;},
                    starSelected:()=>changeStars(true),unstarSelected:()=>changeStars(false),
                }};
            }},
        },'records',{window:{openTarget:({target})=>{
            const record=context.handlers.dataSource.peekCollection().find(row=>row.id===target.parameters.id);
            if(record)setDrawer({type:'details',record:target.parameters.field?{...record,name:record[target.parameters.field]}:record});
        }}});
        root.init();context=root.Context('records');const saved=root.Context('savedRecords'),draft=root.Context('pendingEdits');saved.handlers.dataSource.setCollection(initialRecords.map(row=>({...row,starOrder:row.starred?0:1})));draft.handlers.dataSource.setFormData({values:{pending:{}}});return {root,context,saved,draft};
    },[id]);
    useEffect(()=>{if(state==='With pending edits')native.draft.handlers.dataSource.setEditedFormData({values:{pending:{1001:{owner:'Alex Morgan updated'},1002:{contact:'team@example.com'}}}});},[native,state]);
    useEffect(()=>{if(state==='With invalid edits')native.draft.handlers.dataSource.setEditedFormData({values:{pending:{1001:{contact:'not-an-email',amount:-1}}}});},[native,state]);
    const context=native.context;
    const rows=native.saved.signals.collection.value;
    const search=context.signals.windowForm.value?.search || ''; 
    const edits=tableEditSpecimenState(native.draft.signals.form.value?.pending,columnDefinitions);
    useEffect(()=>()=>native.root.dispose(),[native]);
    const visibleRows=useMemo(()=>state==='Empty'||state==='Error'?[]:applyClientFilters(rows.filter(row=>!starredOnly||row.starred),{template:[{id:'search',field:'name',operator:'contains'}]},{search}),[rows,starredOnly,state,search]);
    useEffect(()=>{
        context.dataSource.filterSet[0].template[0].options=rows.map(row=>({value:row.id,label:row.name}));
        statusColumn.badge.valueMap=Object.fromEntries(rows.map(row=>[row.status,row.status]));
        context.handlers.dataSource.setCollection(visibleRows);
        context.signals.control.value=['Loading','Loading more'].includes(state)?{loading:true,loaded:true,appending:state==='Loading more'}:state==='Error'?{loaded:true,error:{message:'The example records could not be loaded.'}}:{loaded:true};
        context.handlers.dataSource.resetSelection();
        if(state==='With selection'&&visibleRows.length)context.handlers.dataSource.toggleSelection({row:visibleRows[0],rowIndex:0});
    },[context,visibleRows,state,rows]);
    const container=useMemo(()=>({id:'list-page-records',title:'Records',fetchData:false,table:{presentation:'list-page',fillRemainingWidth:true,enforceColumnSize:false,
        emptyState:{title:'No records found',description:'Try another search or clear the active filters.'},
        toolbar:{items:[
            {id:'period',type:'dateRangePreset',value:'current_month',label:'Date range',placement:'header',align:'right',minWidth:300,properties:{customApplyEnabled:true},options:[{value:'current_month',label:'Month'},{value:'last_month',label:'Previous month'},{value:'custom',label:'Custom dates'}]},
            {id:'create',label:'New record',intent:'primary',align:'left',enabled:true,disabled:state==='Creation unavailable',disabledWhen:{source:'control',field:'loading',equals:true},on:[{event:'onClick',handler:'example.create'}]},
            {id:'view',label:'View',type:'select',appearance:'starred-toggle',ariaLabel:'Starred view',value:'all',scope:'windowForm',align:'left',options:[{value:'all',label:'All records'},{value:'starred',label:'Starred only'}],on:[{event:'onChange',handler:'example.changeView'}]},
            {id:'actions',label:'Actions',type:'menu',align:'left',className:'forge-list-page-actions-menu',enableWhenSelection:true,menuItems:[{id:'star',label:'Star selected records',on:[{event:'onClick',handler:'example.starSelected'}]},{id:'unstar',label:'Unstar selected records',on:[{event:'onClick',handler:'example.unstarSelected'}]}]},
            {id:'export',label:'Export',type:'tableExport',align:'left',properties:{filename:'example-records',formats:['csv','xlsx'],scope:'filtered'}},
            {id:'settings',label:'Customize view',icon:'settings',hideLabel:true,align:'right'},
            {id:'filterList',label:'Filter records',icon:'filter',hideLabel:true,align:'right'},
            {id:'search',type:'quickSearch',appearance:'field',scope:'windowForm',align:'center',properties:{field:'search',label:'Search records',placeholder:'Search records'},on:[{event:'onChange',handler:'example.search'}]},
        ]},
    }}),[state]);
    const createRecord=()=>{
        native.saved.handlers.dataSource.setCollection([...rows,{id:Math.max(...rows.map(row=>row.id),1000)+1,name:draftName.trim(),workspace:'Shared library',owner:'You',contact:'you@example.com',amount:0,status:'Active',starred:false,starOrder:1}]);
        setDrawer(null);
    };
    return <>
        {/* The catalog supplies the 560px space that a real tab host owns. Component styling stays in Global CSS. */}
        <div className={`forge-list-page-review${variant==='Within tabs'?' forge-list-page--embedded':''}`} style={variant==='Within tabs'?{height:560,display:'flex',flexDirection:'column'}:undefined}><BasicTable context={context} container={container} columns={columnDefinitions} sizingMode="content" renderSummaryCell={({column,rows})=>column.id==='amount'?<span aria-label="Total amount for displayed rows">{money(rows.reduce((total,row)=>total+row.amount,0))}</span>:null}/><TableEditReview context={context} {...edits}/></div><span className="catalog-sr-only" role="status">{editMessage}</span>
        <Drawer isOpen={!!drawer} onClose={()=>setDrawer(null)} title={drawer?.type==='new'?'New record':drawer?.record?.name||''} role="dialog" position="right" size={360} className="forge-drawer forge-list-page-drawer" shouldReturnFocusOnClose transitionDuration={200}>
            <div className="forge-drawer-body">{drawer?.type==='new'?<label className="catalog-field-label" htmlFor={`${id}-name`}>Record name<InputGroup id={`${id}-name`} value={draftName} onChange={event=>setDraftName(event.target.value)} placeholder="Enter a record name"/></label>:drawer?.record&&<dl className="forge-list-page__details">{[['ID',drawer.record.id],['Workspace',drawer.record.workspace],['Owner',drawer.record.owner],['Contact',drawer.record.contact],['Amount',money(drawer.record.amount)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}</div>
            <div className="forge-drawer-actions"><Button variant="ghost" onClick={()=>setDrawer(null)}>{drawer?.type==='new'?'Cancel':'Close'}</Button>{drawer?.type==='new'&&<Button variant="primary" disabled={!draftName.trim()} onClick={createRecord}>Create record</Button>}</div>
        </Drawer>
    </>;
}
