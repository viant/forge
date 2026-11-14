import React, {useEffect, useId, useMemo, useState} from 'react';
import {signal} from '@preact/signals-react';
import {Breadcrumbs, Button as BlueprintButton, ButtonGroup, Callout, Card, Checkbox, Dialog, Drawer, InputGroup, Menu, MenuDivider, MenuItem, NonIdealState, OverflowList, Radio, RadioCard, RadioGroup, Slider, Spinner, Tag, TagInput, TextArea, Toast, Tooltip, Tree} from '@blueprintjs/core';
import {DatePicker3,TimePicker,TimezoneSelect} from '@blueprintjs/datetime2';
import {Select} from '@blueprintjs/select';
import {DateRangePresetInput} from '../../packs/blueprint/index.jsx';
import CalendarDropdown from '../../packs/blueprint/CalendarDropdown.jsx';
import {anchoredPopoverProps} from '../../components/anchoredPopoverProps.js';
import Button from '../../components/Button.jsx';
import Icon from '../../components/Icon.jsx';
import Typography, {typographyProps} from '../../components/Typography.jsx';
import SelectControl from '../../components/SelectControl.jsx';
import StatusChip from '../../components/StatusChip.jsx';
import CountBadge from '../../components/CountBadge.jsx';
import FilterChips from '../../components/content/FilterChips.jsx';
import Avatar from '../../components/Avatar.jsx';
import Popover from '../../components/Popover.jsx';
import DropdownMenu from '../../components/DropdownMenu.jsx';
import {revealScrollbar} from '../../components/scrollbarActivity.js';
import SwitchControl from '../../components/SwitchControl.jsx';
import SectionTabRail from '../../components/SectionTabRail.jsx';
import {SectionPattern} from '../../components/patterns/index.js';
import ContentCarousel from '../../components/content/ContentCarousel.jsx';
import ChipList from '../../components/ChipList.jsx';
import Splitter from '../../components/Splitter.jsx';
import MarkdownView from '../../components/MarkdownView.jsx';
import SoftSkeleton from '../../components/SoftSkeleton.jsx';
import ProgressBar from '../../components/control/ProgressBar.jsx';
import Composer from '../../components/chat/Composer.jsx';
import MessageCard from '../../components/chat/MessageCard.jsx';
import WidgetRenderer from '../../runtime/WidgetRenderer.jsx';
import DashboardTableContent from '../../components/dashboard/DashboardTableContent.jsx';
import {DashboardEditableTable} from '../../components/dashboard/DashboardBlocks.jsx';
import {ChartExample,chartExamples} from './ChartSpecimen.jsx';
import MetricsSpecimen from './MetricsSpecimen.jsx';
import DocumentSpecimen from './DocumentSpecimen.jsx';
import ReportDocumentSpecimen from './ReportDocumentSpecimen.jsx';
import ComparisonWidthSpecimen from './ComparisonWidthSpecimen.jsx';
import '../../components/chat.css';
import '../../components/chat/documentChat.css';
import '../../components/dashboard/Dashboard.css';
import '../../components/table/basic/Toolbar.css';

const options=[{value:'design',label:'Design'},{value:'engineering',label:'Engineering'},{value:'research',label:'Research'}];
const multiOptions=[...options,...['Product','Operations','Support','Marketing','Analytics'].map(label=>({value:label.toLowerCase(),label}))];
const choiceIcons={design:'lucide:palette',engineering:'lucide:code',research:'lucide:flask-conical'};
const records=[{id:'one',name:'Design foundations',count:24,status:'Ready'},{id:'two',name:'Component library',count:18,status:'In review'},{id:'three',name:'Usage guidelines',count:12,status:'Draft'}];
const code='import {Button} from \'forge/components\';\n\n<Button variant="primary">Save changes</Button>';
const markdown='**A shared language**\n\nBuild with semantic roles and reusable components.\n\n- Clear hierarchy\n- Accessible interactions\n- Consistent behavior';
const toneFor=(variant,state)=>state==='Error'?'danger':state==='Warning'?'warning':state==='Success'?'success':({Information:'info',Success:'success',Warning:'warning',Danger:'danger',Error:'danger',Info:'info',Neutral:'neutral'})[variant]||'info';

export function Asset({className=''}) {
    return <svg className={`catalog-asset ${className}`} viewBox="0 0 280 160" role="img" aria-label="Geometric landscape illustration"><rect width="280" height="160" rx="8" fill="var(--forge-surface-subtle)"/><circle cx="209" cy="44" r="21" fill="var(--forge-selected-background)"/><path d="M0 160V130L83 50L168 134L218 87L280 144V160Z" fill="var(--forge-interaction-color)" opacity=".38"/><path d="M0 160V147L74 99L140 160Z" fill="var(--forge-interaction-color)" opacity=".7"/></svg>;
}

function CalendarExample({variant,disabled}) {
    const [date,setDate]=useState(new Date(2026,10,12));
    return <DatePicker3 value={date} onChange={(next,isUserChange)=>{if(isUserChange)setDate(next);}} minDate={new Date(2026,0,1)} maxDate={new Date(2027,11,31)} dayPickerProps={{components:{Dropdown:CalendarDropdown},disabled:disabled||undefined}}/>;
}
function RadioListExample({variant,disabled}) {
    const [selected,setSelected]=useState('daily');
    const groupId=useId(), cards=variant.includes('Cards'), info=variant.includes('info');
    const choices=[{value:'daily',label:'Daily',description:'Receive a summary each day.'},{value:'weekly',label:'Weekly',description:'Receive one summary each week.'}];
    return <RadioGroup className={`catalog-radio-list${cards?' catalog-radio-list--cards':''}`} label="Update frequency" name={groupId} selectedValue={selected} onChange={event=>setSelected(event.target.value)} inline={variant==='Horizontal'} disabled={disabled}>
        {choices.map(choice=>{
            const label=<span className="catalog-radio-option"><span className="catalog-radio-option__copy"><span>{choice.label}</span>{cards&&<span className="catalog-muted">{choice.description}</span>}</span>{info&&<Popover popupKind="dialog" autoFocus targetProps={{onKeyDown:undefined}} content={<div className="forge-field-help" role="dialog" aria-label={`About ${choice.label}`} tabIndex={-1}><Typography typeRole="body">{choice.description}</Typography></div>}><Button variant="ghost" size="compact" icon="lucide:info" hideLabel aria-label={`About ${choice.label}`}/></Popover>}</span>;
            return cards?<RadioCard key={choice.value} value={choice.value} alignIndicator="start" inputProps={{name:groupId,'aria-label':choice.label}}>{label}</RadioCard>:<Radio key={choice.value} value={choice.value} aria-label={choice.label} labelElement={label}/>;
        })}
    </RadioGroup>;
}
function TimeInputExample({variant,state}) {
    const [time,setTime]=useState(new Date(2026,10,13,10,30)),[open,setOpen]=useState(false);
    const id=useId(), seconds=variant==='With seconds', unavailable=state==='Disabled'||state==='Read only';
    const display=[time.getHours()%12||12,time.getMinutes(),...(seconds?[time.getSeconds()]:[])].map(part=>String(part).padStart(2,'0')).join(':')+` ${time.getHours()<12?'AM':'PM'}`;
    return <div className={`catalog-example-field catalog-field-label${state==='Read only'?' forge-widget-readonly':''}`}><label id={`${id}-label`}>Start time</label><Popover minimal popupKind="dialog" popoverClassName="forge-time-picker-popover" isOpen={open} onInteraction={setOpen} disabled={unavailable} targetProps={{onKeyDown:undefined}}
        content={<div className="forge-time-picker-panel" role="dialog" aria-label="Choose time"><Typography typeRole="label">Time</Typography><TimePicker value={time} onChange={setTime} precision={seconds?'second':'minute'} useAmPm showArrowButtons={false}/><Button variant="primary" onClick={()=>setOpen(false)}>Done</Button></div>}>
        <BlueprintButton className="forge-button catalog-time-trigger" data-forge-part="input" {...typographyProps('body')} outlined disabled={unavailable} aria-labelledby={`${id}-label ${id}-value`} aria-invalid={state==='Invalid'||undefined} icon={<Icon name="lucide:clock-3"/>} text={<span id={`${id}-value`}>{display}</span>} endIcon={<Icon name="lucide:chevron-down"/>}/>
    </Popover></div>;
}
function TokenizerExample({variant,state}) {
    const [tokens,setTokens]=useState(variant==='Default'?[]:variant==='Many tokens'?['Foundations','Components','Accessibility','Patterns','Motion']:['Foundations','Components']);
    const id=useId(), unavailable=state==='Disabled'||state==='Read only', icons=variant==='With icons';
    return <div className={`catalog-example-field catalog-field-label${state==='Read only'?' forge-widget-readonly':''}`}><label id={`${id}-label`}>Document tags</label><Popover minimal popupKind="dialog" popoverClassName="forge-tokenizer-popover" targetProps={{onKeyDown:undefined}} onOpened={panel=>panel.querySelector('input')?.focus()}
        content={<div className="forge-tokenizer-panel" role="dialog" aria-label="Edit document tags"><Typography typeRole="label">Document tags</Typography><TagInput fill values={tokens} onChange={setTokens} separator={false} addOnPaste={false} placeholder="Add a tag…" disabled={unavailable} intent={state==='Invalid'?'danger':'none'} inputProps={{id:`${id}-query`,'aria-label':'Document tags','aria-invalid':state==='Invalid'||undefined}} tagProps={icons?{icon:<Icon name="lucide:tag"/>}:undefined}/><Typography typeRole="metadata" className="catalog-muted">Type a value and press Enter. Remove tags with their × button.</Typography></div>}>
        <BlueprintButton className="forge-button forge-tokenizer-trigger forge-token-summary" data-forge-part="input" {...typographyProps('body')} disabled={state==='Disabled'} outlined aria-labelledby={`${id}-label`} aria-label={`Document tags: ${tokens.length} selected`} aria-invalid={state==='Invalid'||undefined} title={tokens.join(', ')} endIcon={<Icon name="lucide:chevron-down"/>}>
            {tokens.length?<OverflowList tagName="span" items={tokens.slice(0,3)} collapseFrom="end" alwaysRenderOverflow visibleItemRenderer={(token,index)=><Tag key={`${index}:${token}`} icon={icons?<Icon name="lucide:tag"/>:undefined}>{token}</Tag>} overflowRenderer={hidden=>tokens.length>3||hidden.length?<Tag className="forge-multi-select-overflow">+{Math.max(0,tokens.length-3)+hidden.length}</Tag>:null}/>:<span className="forge-multi-select-placeholder">Add tags…</span>}
        </BlueprintButton>
    </Popover></div>;
}
function SelectorExample({variant, disabled, readOnly, invalid, searchable=false}) {
    const items=searchable?[...options,...['Product','Operations','Marketing','Data','Finance','Legal','Support','People','Security'].map(label=>({value:label.toLowerCase(),label}))]:options;
    const [selected,setSelected]=useState(variant==='With placeholder'?null:items[0]);
    const id=useId();
    return <div className={`catalog-example-field catalog-field-label${readOnly?' forge-widget-readonly':''}`}><label id={`${id}-label`}>Team</label>
        <Select items={items} itemsEqual="value" initialActiveItem={selected} filterable={searchable} disabled={disabled||readOnly} fill
            itemPredicate={searchable?((query,item)=>item.label.toLowerCase().includes(query.toLowerCase())):undefined}
            resetOnClose={searchable}
            inputProps={searchable?{type:'search','aria-label':'Search options',placeholder:'Search options…',leftIcon:<Icon name="lucide:search" className="bp6-icon"/>}:undefined}
            noResults={<MenuItem disabled roleStructure="listoption" text="No matching options"/>}
            menuProps={{'aria-labelledby':`${id}-label`}}
            popoverProps={anchoredPopoverProps({minimal:true,matchTargetWidth:true,popoverClassName:`forge-dropdown-menu${searchable?' forge-searchable-dropdown':''}`})}
            onItemSelect={setSelected}
            itemRenderer={(item,{handleClick,handleFocus,id:itemId,modifiers,ref})=><MenuItem key={item.value}
                icon={variant==='With icons'?<Icon name={choiceIcons[item.value]||'lucide:users'}/>:undefined}
                ref={ref} id={itemId} roleStructure="listoption" selected={selected?.value===item.value}
                active={modifiers.active} onClick={handleClick} onFocus={handleFocus}
                text={<span className="catalog-selector-option"><span>{item.label}</span>{variant==='With descriptions'&&<span className="catalog-muted">{({design:'Create and maintain shared design resources.',engineering:'Build and maintain product experiences.',research:'Plan studies and share customer insights.'})[item.value]||`${item.label} workspace team.`}</span>}</span>}/> }>
            <BlueprintButton outlined className="forge-button catalog-selector-trigger" disabled={disabled||readOnly}
                data-forge-variant="secondary" data-forge-size="default" {...typographyProps('label')}
                aria-labelledby={`${id}-label ${id}-value`} aria-invalid={invalid||undefined}
                aria-describedby={invalid?`${id}-error`:undefined} alignText="left"
                text={<span id={`${id}-value`}>{selected?.label||'Choose a team'}</span>} rightIcon={<Icon name="lucide:chevron-down"/>}/>
        </Select>{invalid&&<span id={`${id}-error`} className="catalog-error">Choose an available team.</span>}
    </div>;
}
function RangeExample({variant,disabled,readOnly}) {
    const [preset,setPreset]=useState(variant==='Custom'?'custom':'recent');
    const [range,setRange]=useState({start:'2026-11-06',end:'2026-11-12'});
    return <div className={`catalog-example-field${readOnly?' forge-widget-readonly':''}`}><DateRangePresetInput item={{id:useId(),label:'Date range'}} value={preset} range={range} disabled={disabled} readOnly={readOnly} options={[{value:'recent',label:'Recent period',range:{start:'2026-11-06',end:'2026-11-12'}},{value:'custom',label:'Custom dates'}]} customApplyEnabled onPresetRequest={option=>{setPreset(option.value);if(option.range)setRange(option.range);return true;}} onRangeChange={next=>{setPreset('custom');setRange(next);}}/></div>;
}

function FieldExample({spec,variant,state,thumbnail}) {
    const statePair=useState({value:spec.id==='number-input'?24:spec.id==='multi-selector'?(variant==='Many selections'?multiOptions.slice(0,5).map(item=>item.value):variant==='With tokens'?['design','engineering']:[]):spec.id==='date-time-input'?'2026-11-13T16:30:00.000Z':spec.id==='file-input'&&variant==='With file'?{name:'design-notes.csv'}:spec.id==='file-input'&&variant==='With files'?[{filename:'design-notes.csv'},{filename:'component-list.csv'}]:''});
    const id=useId();
    const [timeZone,setTimeZone]=useState('America/Los_Angeles');
    const widget=({'number-input':'number','date-input':'date','date-time-input':'datetime','multi-selector':'multiSelect','file-input':'file','text-area':'textarea'})[spec.id]||'text';
    return <div className="catalog-example-field"><WidgetRenderer state={statePair} item={{id:`field-${id}`,name:'value',dataField:'value',scope:'local',widget,label:({'field':'Project name','text-input':'Project name','text-area':'Description','number-input':'Number of seats','date-input':'Start date','date-time-input':'Scheduled time','multi-selector':'Teams','file-input':'Attach a file'})[spec.id]||'Project name',
        disabled:state==='Disabled',readOnly:state==='Read only',required:variant.startsWith('Required'),
        tooltip:variant.includes('With help')?'Use a descriptive name so your team can recognize this project.':undefined,
        helperText:thumbnail?undefined:spec.id==='file-input'?'Files stay on your computer.':widget==='multiSelect'?'Open to search, view or remove selections.':widget==='date'?'Use MM/DD/YYYY, or choose a calendar date.':widget==='datetime'?'Adjust the time and time zone together below the calendar.':widget==='number'?'Enter the number of seats.':'Use a clear, descriptive value.',
        validationError:state==='Invalid'?'Enter a valid value to continue.':undefined,
        options:widget==='multiSelect'?multiOptions:options, multiple:variant==='Multiple'||variant==='With files', properties:{typographyRole:'body',...(widget==='textarea'?{rows:4,className:variant==='Resizable'?'forge-textarea--resizable':'forge-textarea--fixed'}:{}),...(widget==='number'&&variant==='With bounds'?{min:0,max:100}:{}),...(widget==='date'?{valueMode:'civil',dateFnsFormat:'MM/dd/yyyy'}:{}),...(widget==='datetime'?{
            timePrecision:variant==='With seconds'?'second':'minute',
            dateFnsFormat:variant==='With seconds'?'MM/dd/yyyy HH:mm:ss':'MM/dd/yyyy HH:mm',
            timezone:timeZone,onTimezoneChange:setTimeZone,showTimezoneSelect:false,
            timePickerProps:{useAmPm:false},closeOnSelection:false,
            footerElement:<><Typography as="span" typeRole="metadata" className="forge-date-time-label">Time</Typography><Typography as="span" typeRole="metadata" className="forge-date-time-zone-label">Time zone</Typography><div className="forge-date-time-zone"><TimezoneSelect
                value={timeZone} onChange={setTimeZone} valueDisplayFormat="abbreviation" date={new Date(statePair[0].value || '2026-11-13T16:30:00.000Z')}
                buttonProps={{'aria-label':'Time zone',outlined:true,className:'forge-time-zone-trigger',endIcon:<Icon name="lucide:chevron-down"/>}}
                inputProps={{'aria-label':'Search time zones'}}
                popoverProps={anchoredPopoverProps({minimal:true,captureDismiss:true})}/></div></>,
        }:{})},
    }}/></div>;
}

function TableExample({selection=false,state='Default',editable=false,variant='Default',thumbnail=false}) {
    const context=useMemo(()=>{
        const signals={collection:signal(records.map(row=>({...row}))),control:signal({}),selection:signal({selection:[]})};
        const ds={peekFullCollection:()=>signals.collection.value,replaceCollection:({rows})=>{signals.collection.value=rows;},
            toggleSelection:({row})=>{const prev=signals.selection.value.selection||[];signals.selection.value={selection:prev.some(item=>item.id===row.id)?prev.filter(item=>item.id!==row.id):[...prev,row]};},
            setAllSelection:()=>{signals.selection.value={selection:signals.collection.value};},resetSelection:()=>{signals.selection.value={selection:[]};}};
        const ctx={signals,handlers:{dataSource:ds},dataSource:{selectionMode:selection?'multi':'single'}};ctx.Context=()=>ctx;return ctx;
    },[selection]);
    useEffect(()=>{
        context.signals.collection.value=state==='Empty'?[]:records.map(row=>({...row}));
        context.signals.control.value=state==='Loading'?{loading:true}:state==='Error'?{error:{message:'The example records could not load. Choose Default to retry.'}}:{};
    },[state,context]);
    const container={id:'catalog-table',dataSourceRef:'examples',quickFilter:!thumbnail,allowAdd:false,tablePresentation:{variant:'document'},selectionMode:selection?'multi':undefined,columns:[
        {key:'name',label:'Name',flex:true,editor:{type:'text'}},{key:'count',label:'Items',align:'right',width:90,editor:{type:'number'}},{key:'status',label:'Status',width:120,editor:{type:'select',options:['Ready','In review','Draft']}},
    ]};
    return <div className="catalog-example-table">{editable&&variant!=='Read'?<DashboardEditableTable embedded container={container} context={context}/>:<DashboardTableContent container={container} context={context}/>}</div>;
}

function TimerExample({variant}) {
    const [elapsed,setElapsed]=useState(0),[running,setRunning]=useState(variant==='Running');
    useEffect(()=>{if(!running)return;const started=Date.now()-elapsed;const timer=setInterval(()=>setElapsed(Date.now()-started),1000);return()=>clearInterval(timer);},[running]);
    return <div className="catalog-stack"><time className="catalog-timer" dateTime={`PT${Math.floor(elapsed/1000)}S`}>{`${Math.floor(elapsed/60000)}`.padStart(2,'0')}:{`${Math.floor(elapsed/1000)%60}`.padStart(2,'0')}</time><div className="catalog-row"><Button variant="secondary" onClick={()=>setRunning(!running)}>{running?'Pause':'Start'}</Button><Button variant="ghost" onClick={()=>{setElapsed(0);setRunning(false);}}>Reset</Button></div></div>;
}

function ToolbarExample({variant,state,thumbnail}) {
    const [query,setQuery]=useState(''),[feedback,setFeedback]=useState('');
    const table=variant==='Table',subject=table?'records':'documents',primaryLabel=table?'New record':'New document';
    const loading=state==='Loading',disabled=state==='Disabled'||state==='Read only'||loading;
    return <div className="catalog-stack catalog-full">
        <div className="toolbar-container catalog-action-toolbar" role="group" aria-label={`${table?'Record':'Document'} toolbar`}>
            <div className="toolbar-left" role="group" aria-label="Primary actions">
                <Button variant="primary" disabled={disabled} loading={loading} onClick={()=>setFeedback(`${primaryLabel} requested`)}>{primaryLabel}</Button>
                <DropdownMenu disabled={disabled} content={<Menu aria-label="Toolbar actions">{['Duplicate','Archive','Export'].map(label=><MenuItem key={label} text={label} onClick={()=>setFeedback(`${label} requested`)}/>)}</Menu>}>
                    <Button variant="secondary" className="catalog-toolbar-actions" disabled={disabled}><span>Actions</span><Icon name="lucide:chevron-down"/></Button>
                </DropdownMenu>
            </div>
            <div className="toolbar-right" role="group" aria-label="View and search">
                <div className="catalog-toolbar-icons">
                    {[
                        {icon:'star',label:'Saved views',items:['Default view','My saved view']},
                        {icon:'sliders-horizontal',label:'View options',items:['List view','Grid view']},
                        {icon:'funnel',label:'Filters',items:['All items','Owned by me']},
                    ].map(utility=><DropdownMenu key={utility.label} disabled={disabled} content={<Menu aria-label={utility.label}>{utility.items.map(label=><MenuItem key={label} text={label} onClick={()=>setFeedback(`${label} selected`)}/>)}</Menu>}>
                        <Button variant="ghost" icon={`lucide:${utility.icon}`} hideLabel aria-label={utility.label} title={utility.label} disabled={disabled}/>
                    </DropdownMenu>)}
                </div>
                <InputGroup className="catalog-toolbar-search" data-forge-part="input" size="large" type="search" aria-label={`Search ${subject}`} placeholder={`Search ${subject}`} leftElement={<Icon name="lucide:search" className="bp6-icon"/>} value={query} disabled={disabled} onChange={event=>setQuery(event.target.value)}/>
            </div>
        </div>
        {!thumbnail&&(query||feedback)&&<span className="catalog-muted" role="status">{query?`Search: ${query}`:feedback}</span>}
    </div>;
}
function LocalTabs({variant='Default',disabled=false}) {
    const [selected,setSelected]=useState('overview');const base=useId().replace(/:/g,'');
    const items=[{id:'overview',label:'Overview',icon:'lucide:file-text'},{id:'activity',label:'Activity',icon:'lucide:activity'},{id:'settings',label:'Settings',icon:'lucide:settings'}].map(item=>({...item,disabled}));
    return <div className="catalog-full"><SectionTabRail ariaLabel="Example views" items={items} showIcons={variant==='With icons'} selectedId={selected} onChange={setSelected} idPrefix={base} panelId={`${base}-panel`}/><div className="catalog-tab-panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${items.findIndex(item=>item.id===selected)}`}>{selected==='overview'?'A clear view of the current document.':selected==='activity'?'Recent updates appear here.':'Choose how this document behaves.'}</div></div>;
}

// These are documentation examples. Runtime ownership stays in the imported
// Forge / Blueprint primitives or in the explicitly named semantic HTML recipe.
function BreadcrumbsExample({variant,disabled}) {
    const [workspace,setWorkspace]=useState('Workspace'),[collection,setCollection]=useState('Documents'),[document,setDocument]=useState('Design foundations');
    const documents=collection==='Guidelines'?['Usage guidelines','Accessibility','Content guidelines']:collection==='Patterns'?['Form patterns','Navigation patterns','Chat patterns']:['Design foundations','Component library','Semantic variables'];
    const groups=[
        {id:'workspace',text:workspace,options:['Workspace','Design team','Product team'],select:setWorkspace},
        {id:'collection',text:collection,options:['Documents','Guidelines','Patterns'],select:value=>{setCollection(value);setDocument(value==='Guidelines'?'Usage guidelines':value==='Patterns'?'Form patterns':'Design foundations');}},
        {id:'document',text:document,options:documents,select:setDocument},
    ];
    const options=group=>group.options.map(label=><MenuItem key={label} roleStructure="listoption" text={label} selected={label===group.text} icon={variant==='With icons'?<Icon name="lucide:file-text"/>:undefined} onClick={()=>group.select(label)}/>);
    const items=groups.map(group=>({id:group.id,text:group.text,disabled,onClick:()=>group.select(group.text),children:options(group),submenuProps:{role:'listbox'}}));
    return <nav className={`forge-super-breadcrumbs${variant==='With overflow'?' is-collapsible':''}`} aria-label="Document breadcrumbs"><Breadcrumbs items={items} minVisibleItems={variant==='With overflow'?1:3}
        popoverProps={anchoredPopoverProps({minimal:true,popoverClassName:'forge-dropdown-menu'})}
        breadcrumbRenderer={item=><Select items={groups.find(group=>group.id===item.id).options} filterable={false} disabled={disabled} initialActiveItem={item.text} onItemSelect={value=>groups.find(group=>group.id===item.id).select(value)} menuProps={{'aria-label':`Switch ${item.id}`}}
            popoverProps={anchoredPopoverProps({minimal:true,popoverClassName:'forge-dropdown-menu'})}
            itemRenderer={(label,{handleClick,handleFocus,id:optionId,modifiers,ref})=><MenuItem key={label} id={optionId} ref={ref} roleStructure="listoption" text={label} selected={label===item.text} active={modifiers.active} onClick={handleClick} onFocus={handleFocus} icon={variant==='With icons'?<Icon name="lucide:file-text"/>:undefined}/> }>
            <BlueprintButton minimal className="forge-button forge-super-breadcrumbs__trigger" {...typographyProps('body')} disabled={disabled} aria-label={`Switch ${item.id}: ${item.text}`} aria-current={item.id==='document'?'page':undefined}>
                {variant==='With icons'&&<Icon name={item.id==='workspace'?'lucide:layers':item.id==='collection'?'lucide:folder':'lucide:file-text'}/>}{item.text}<Icon name="lucide:chevron-down"/>
            </BlueprintButton>
        </Select>}/></nav>;
}

function StepperExample({variant,state}) {
    const [current,setCurrent]=useState(state==='Default'||state==='Disabled'?0:1);
    const steps=[{title:'Identity',description:'Name and category'},{title:'Workspace settings',description:'Language and timezone'},{title:'Contact information',description:'Contact details'}];
    return <nav aria-label="Setup progress" className="forge-stepper"><ol className={variant==='Horizontal'?'is-horizontal':undefined}>{steps.map((step,index)=>{
        const status=state==='Default'||state==='Disabled'?'pending':index===0?'success':index===1&&state==='Error'?'error':index===1&&state==='Missing information'?'missing':'pending';
        const statusLabel=status==='success'?'Completed':status==='error'?'Error':status==='missing'?'Missing information':undefined;
        return <li key={step.title}><button type="button" data-step-status={status} aria-current={index===current?'step':undefined} disabled={state==='Disabled'} onClick={()=>setCurrent(index)} aria-label={`${index+1}. ${step.title}${statusLabel?`, ${statusLabel}`:''}`}>
            <span className="forge-stepper__marker" aria-hidden="true">{status==='success'?<Icon name="lucide:check"/>:status==='error'||status==='missing'?<Icon name="lucide:circle-alert"/>:index+1}</span>
            <span className="forge-stepper__copy"><Typography typeRole="label" className="forge-stepper__title">{step.title}</Typography><Typography typeRole="body" className="forge-stepper__description">{step.description}</Typography></span>
        </button></li>;
    })}</ol><span className="catalog-sr-only" role="status">Current step: {steps[current].title}</span></nav>;
}

function TopNavExample({variant,disabled}) {
    const [active,setActive]=useState('Overview'),[query,setQuery]=useState(''),[feedback,setFeedback]=useState('');
    return <div className="catalog-full"><header className="forge-top-nav"><span className="forge-top-nav__brand"><Icon name="lucide:layers"/><Typography typeRole="label">Workspace</Typography></span>
        <nav aria-label="Example workspace navigation">{['Overview','Documents','Settings'].map(label=><button type="button" key={label} disabled={disabled} aria-current={active===label?'page':undefined} onClick={()=>setActive(label)} {...typographyProps('body')}>{label}</button>)}</nav>
        {variant!=='Default'&&<div className="forge-top-nav__actions">{variant==='With search'&&<InputGroup type="search" aria-label="Search workspace" placeholder="Search workspace" disabled={disabled} value={query} onChange={event=>setQuery(event.target.value)} leftIcon={<Icon name="lucide:search" className="bp6-icon"/>}/>}
            <DropdownMenu disabled={disabled} content={<Menu aria-label="Notifications"><MenuItem disabled text="You're all caught up"/></Menu>}><Button variant="ghost" size="compact" icon="lucide:bell" hideLabel aria-label="Notifications" disabled={disabled}/></DropdownMenu>
            {variant==='With actions'&&<Button variant="primary" icon="lucide:plus" disabled={disabled} onClick={()=>setFeedback('Create document requested')}>New document</Button>}
        </div>}
    </header><Typography typeRole="small" className="catalog-muted" role="status">{feedback||query&&`Search: ${query}`||`${active} view`}</Typography></div>;
}

function FeaturedGuide({disabled=false,icon=false}) {
    return <a className="forge-mega-menu__feature" href="#foundations" aria-disabled={disabled||undefined} tabIndex={disabled?-1:undefined} onClick={disabled?event=>event.preventDefault():undefined}>
        <span className="forge-mega-menu__art" aria-hidden="true"><Asset/></span><Typography typeRole="small" className="forge-mega-menu__eyebrow">Featured guide</Typography><Typography typeRole="label">{icon&&<Icon name="lucide:layers"/>}Design foundations</Typography>
        <Typography typeRole="small" className="forge-mega-menu__description">Start with shared color, typography and spacing.</Typography><Typography typeRole="small" className="forge-mega-menu__feature-link">Explore foundations<Icon name="lucide:arrow-right"/></Typography>
    </a>;
}

function MegaMenuExample({disabled,open,thumbnail}) {
    const panel=<div className="forge-mega-menu forge-dropdown-menu"><Menu aria-label="Resource destinations"><MenuDivider title="Design resources"/><MenuItem disabled={disabled} text="Foundations" href="#foundations"/><MenuItem disabled={disabled} text="Components" href="#components"/><MenuDivider title="Build together"/><MenuItem disabled={disabled} text="Usage guidelines" href="#guidelines"/><MenuItem disabled={disabled} text="Semantic variables" href="#variables"/></Menu></div>;
    return thumbnail?panel:<DropdownMenu disabled={disabled} defaultIsOpen={open} popoverClassName="forge-mega-menu-popover" content={panel}><Button variant="secondary" disabled={disabled}>Resources<Icon name="lucide:chevron-down"/></Button></DropdownMenu>;
}

function DialogExample({variant,disabled}) {
    const [open,setOpen]=useState(false),[result,setResult]=useState('');
    const id=useId(),destructive=variant==='Confirmation';
    return <div className="catalog-stack"><Button variant="secondary" disabled={disabled} onClick={()=>setOpen(true)}>Open dialog</Button>
        <Dialog isOpen={open} onClose={()=>setOpen(false)} title={destructive?'Discard changes?':'Archive selected items?'} role={destructive?'alertdialog':'dialog'} aria-describedby={`${id}-description`} shouldReturnFocusOnClose onOpened={node=>node.querySelector('[data-dialog-initial-focus]')?.focus()}>
            <div className="forge-dialog-body"><Typography as="p" typeRole="body" id={`${id}-description`}>{destructive?'You have unsaved changes. Closing will discard all pending changes.':'Archived items will be removed from the active list. You can find them later in Archive.'}</Typography>
                <div className="forge-dialog-actions"><Button variant="ghost" data-dialog-initial-focus onClick={()=>setOpen(false)}>{destructive?'Keep editing':'Cancel'}</Button><Button variant={destructive?'danger':'primary'} onClick={()=>{setResult(destructive?'Example changes discarded.':'Example items archived.');setOpen(false);}}>{destructive?'Discard changes':'Archive items'}</Button></div>
            </div>
        </Dialog>{result&&<Typography typeRole="small" role="status" className="catalog-muted">{result}</Typography>}
    </div>;
}

function DrawerExample({variant,disabled}) {
    const columns=['Name','Owner','Status','Created','Updated','Priority','Item count','Region','Tags','ID','Notes','Category','Visibility'];
    const initial={name:'Design foundations',columns:['Name','Owner','Status','ID'],values:[],condition:'Greater than or equal to',value:''};
    const [open,setOpen]=useState(false),[saved,setSaved]=useState(initial),[draft,setDraft]=useState(initial),[result,setResult]=useState(''),[query,setQuery]=useState(''),[group,setGroup]=useState(null);
    const id=useId(),parsedWidth=Number.parseInt(variant,10),width=Number.isFinite(parsedWidth)?parsedWidth:360;
    const customize=variant==='Customize view',filter=variant==='Filter view'||variant==='Condition filter',condition=filter&&group==='Item count';
    const edit=changes=>setDraft({...draft,...changes}),matches=label=>label.toLowerCase().includes(query.toLowerCase());
    const values=group==='Status'?['Draft','In review','Ready','Archived']:group==='Owner'?['Design','Engineering','Research']:['Foundations','Components','Patterns'];
    const visibleValues=values.filter(matches),allVisible=visibleValues.length>0&&visibleValues.every(value=>draft.values.includes(value));
    const toggle=value=>edit({values:draft.values.includes(value)?draft.values.filter(item=>item!==value):[...draft.values,value]});
    const title=customize?'Customize view':filter?(group||'Filter view'):'Document details';
    const valid=condition?!!draft.value.trim():customize||filter||!!draft.name.trim(),dirty=JSON.stringify(draft)!==JSON.stringify(saved);
    const search=<InputGroup type="search" aria-label={customize?'Search columns':'Search filters'} placeholder="Search" value={query} onChange={event=>setQuery(event.target.value)} leftIcon={<Icon name="lucide:search" className="bp6-icon"/>}/>;
    return <div className="catalog-stack"><Button variant="secondary" disabled={disabled} onClick={()=>{setDraft(saved);setGroup(variant==='Condition filter'?'Item count':null);setQuery('');setOpen(true);}}>Open drawer</Button>
        <Drawer isOpen={open} onClose={()=>setOpen(false)} title={<span className="forge-drawer-heading">{filter&&group&&<Button variant="ghost" size="compact" icon="lucide:chevron-left" hideLabel aria-label="Back to filters" onClick={()=>{setGroup(null);setQuery('');}}/>}<span>{title}</span></span>} position="right" size={width} shouldReturnFocusOnClose onOpened={node=>node.querySelector('input')?.focus()}>
            <div className="forge-drawer-body">{customize?<>{search}<Typography as="h3" typeRole="label" className="catalog-muted">Views</Typography><div className="forge-drawer-options"><Button variant="ghost" onClick={()=>edit({columns:initial.columns})}>Default</Button><Button variant="ghost" onClick={()=>edit({columns})}>All columns</Button></div><hr/><Typography as="h3" typeRole="label" className="catalog-muted">Columns</Typography>{columns.filter(matches).map(label=><Checkbox key={label} label={label} checked={draft.columns.includes(label)} disabled={label==='Name'||label==='ID'} onChange={()=>edit({columns:draft.columns.includes(label)?draft.columns.filter(item=>item!==label):[...draft.columns,label]})}/>)}</>:filter?condition?<div className="catalog-stack"><label className="catalog-field-label" id={`${id}-condition`}>Condition</label><Select items={['Greater than or equal to','Equals','Less than or equal to']} filterable={false} initialActiveItem={draft.condition} onItemSelect={value=>edit({condition:value})} menuProps={{'aria-labelledby':`${id}-condition`}} popoverProps={anchoredPopoverProps({minimal:true,matchTargetWidth:true,popoverClassName:'forge-dropdown-menu'})} itemRenderer={(label,{handleClick,handleFocus,id:optionId,modifiers,ref})=><MenuItem key={label} ref={ref} id={optionId} roleStructure="listoption" selected={draft.condition===label} active={modifiers.active} onClick={handleClick} onFocus={handleFocus} text={label}/>}><BlueprintButton outlined className="forge-button catalog-selector-trigger" aria-labelledby={`${id}-condition`} text={draft.condition} endIcon={<Icon name="lucide:chevron-down"/>}/></Select><label className="catalog-field-label" htmlFor={`${id}-value`}>Value<InputGroup id={`${id}-value`} inputMode="decimal" placeholder="Enter a value" value={draft.value} onChange={event=>edit({value:event.target.value})}/></label></div>:<>{search}<div className="forge-drawer-options">{group?<><Checkbox label="Select all" checked={allVisible} onChange={()=>edit({values:allVisible?draft.values.filter(value=>!visibleValues.includes(value)):[...new Set([...draft.values,...visibleValues])]})}/>{visibleValues.map(label=><Checkbox key={label} label={label} checked={draft.values.includes(label)} onChange={()=>toggle(label)}/>)}</>:['Name','Owner','Status','Item count','Region','Priority','Updated'].filter(matches).map(label=><Button variant="ghost" key={label} onClick={()=>{setGroup(label);setQuery('');}}><span>{label}</span><Icon name="lucide:chevron-right"/></Button>)}</div></>:<><label className="catalog-field-label" htmlFor={id}>Document name<InputGroup id={id} value={draft.name} onChange={event=>edit({name:event.target.value})}/></label><Typography as="p" typeRole="body" className="catalog-muted">Update the document details, then apply your changes.</Typography></>}</div>
            <div className="forge-drawer-actions"><Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!dirty||!valid} onClick={()=>{setSaved(draft);setResult('Example changes applied.');setOpen(false);}}>Apply</Button></div>
        </Drawer>{result&&<Typography typeRole="small" role="status" className="catalog-muted">{result}</Typography>}
    </div>;
}

export default function CatalogExample({spec,variant=spec.variants[0],state='Default',thumbnail=false,iconSize='default'}) {
    const id=spec.id, disabled=state==='Disabled'||state==='Selected + Disabled', invalid=state==='Invalid';
    const [value,setValue]=useState(id==='dropdown-menu'&&variant==='Selection'?'Open document':'design'),[pressed,setPressed]=useState(state.startsWith('Selected')||variant==='On'||variant==='Checked'),[count,setCount]=useState(0),[text,setText]=useState(''),[selected,setSelected]=useState(id==='table-selection-toolbar'?(variant==='No selection'?[]:['one']):id==='filter-chips'?(state.startsWith('Selected')?['design']:[]):['design']),[page,setPage]=useState(1),[number,setNumber]=useState(40),[toast,setToast]=useState(state!=='Dismissed'),[mixed,setMixed]=useState(variant==='Indeterminate'),[expanded,setExpanded]=useState(state==='Expanded'||variant==='Expanded');
    const [composerSettings,setComposerSettings]=useState({agent:'auto',model:'default',reasoning:'standard'});
    const inputId=useId();
    useEffect(()=>{setPressed(state.startsWith('Selected')||variant==='On'||variant==='Checked');setExpanded(state==='Expanded'||variant==='Expanded');setMixed(variant==='Indeterminate');if(id==='filter-chips')setSelected(state.startsWith('Selected')?['design']:[]);},[id,state,variant]);
    const actionVariant=variant.toLowerCase()==='danger'?'danger':['primary','secondary','ghost','link'].includes(variant.toLowerCase())?variant.toLowerCase():'primary';
    const action=(label='Save changes',extra={})=><Button variant={actionVariant} disabled={disabled} readOnly={state==='Read only'} loading={state==='Loading'} onClick={()=>setCount(count+1)} {...extra}>{label}</Button>;
    const status=thumbnail?null:count>0?<span role="status" className="catalog-muted">Action completed {count} {count===1?'time':'times'}.</span>:null;
    const fieldProps={disabled,readOnly:state==='Read only',intent:invalid?'danger':'none'};
    if(id==='button')return <div className="catalog-stack">{action()}{status}</div>;
    if(id==='icon-button')return <div className="catalog-stack">{action('',{icon:'lucide:plus',hideLabel:true,'aria-label':'Create document',size:iconSize==='small'?'compact':'default'})}{status}</div>;
    if(id==='button-group')return <div className="catalog-stack"><ButtonGroup vertical={variant.toLowerCase().includes('vertical')} role="group" aria-label="Document actions" style={{gap:'var(--forge-spacing-2)',flexWrap:'wrap'}}>{['Copy','Duplicate','Save'].map(label=><Button key={label} variant={variant.startsWith('Ghost')?'ghost':'secondary'} disabled={disabled} readOnly={state==='Read only'} loading={state==='Loading'} onClick={()=>setCount(count+1)}>{label}</Button>)}</ButtonGroup>{status}</div>;
    if(id==='top-nav-mega-menu')return <MegaMenuExample variant={variant} disabled={disabled} open={state==='Open'} thumbnail={thumbnail}/>;
    if(id==='top-nav-menu')return <DropdownMenu disabled={disabled} content={<Menu aria-label="Resource destinations"><MenuItem text="Foundations" href="#foundations" icon={variant==='With icons'?<Icon name="lucide:palette"/>:undefined}/><MenuItem text="Components" href="#components" icon={variant==='With icons'?<Icon name="lucide:layers"/>:undefined}/><MenuItem text="Usage guidelines" href="#guidelines"/><MenuItem text="Semantic variables" href="#variables"/></Menu>}><Button variant="secondary" disabled={disabled}>Resources<Icon name="lucide:chevron-down"/></Button></DropdownMenu>;
    if(id==='dropdown-menu-option') {
        const leading=variant==='Leading icon'||variant==='Leading and trailing icons';
        const trailing=variant==='Trailing icon'||variant==='Leading and trailing icons';
        const labels=variant==='Scrollable'?['Design foundations','Component library','Usage guidelines','Color variables','Typography','Spacing','Icons','Accessibility','Motion','Layout','Patterns','Resources']:['Design foundations','Component library'];
        return <div className="catalog-stack catalog-example-field"><div className="forge-dropdown-menu catalog-full"><Menu aria-label="Example menu options" role="listbox" onScroll={revealScrollbar}>
            {labels.map((label,index)=><MenuItem key={label} roleStructure="listoption" selected={count>0?value===label:pressed&&index===0} disabled={disabled} active={state==='Hover'&&index===0}
                icon={leading?<Icon name={index===0?'lucide:file-text':'lucide:layers'}/>:undefined}
                labelElement={trailing?<Icon name="lucide:chevron-right"/>:undefined}
                text={<span className="catalog-selector-option"><span>{label}</span>{variant==='With description'&&<span className="catalog-muted">{index===0?'Shared guidance for every product.':'Reusable components and interactions.'}</span>}</span>}
                onClick={()=>{setValue(label);setPressed(true);setCount(count+1);}}/>)}
            </Menu></div>{count>0&&<span role="status" className="catalog-muted">{value} selected</span>}
        </div>;
    }
    if(['dropdown-menu','more-menu'].includes(id))return <div className="catalog-stack"><DropdownMenu disabled={disabled} content={<Menu aria-label={variant==='Selection'?'Document selection':'Document actions'} role={variant==='Selection'?'listbox':'menu'}>{['Open document','Duplicate','Archive'].map((label,index)=><MenuItem key={label} text={label} icon={variant==='With icons'?<Icon name={`lucide:${['file-text','copy','folder'][index]}`}/>:undefined} roleStructure={variant==='Selection'?'listoption':'menuitem'} selected={variant==='Selection'&&value===label} onClick={()=>{setValue(label);setCount(count+1);}}/>)}<MenuItem text="Delete document" disabled roleStructure={variant==='Selection'?'listoption':'menuitem'}/></Menu>}><Button variant={id==='more-menu'?'ghost':'secondary'} disabled={disabled} icon={id==='more-menu'?`lucide:${variant==='Vertical'?'ellipsis-vertical':'ellipsis'}`:undefined} hideLabel={id==='more-menu'} aria-label={id==='more-menu'?'More document actions':undefined}>{id==='more-menu'?'':<><span>Actions</span><Icon name="lucide:chevron-down"/></>}</Button></DropdownMenu>{count>0&&<span role="status" className="catalog-muted">{value} selected</span>}</div>;
    if(id==='link')return <a className="catalog-link" href={variant==='External'?'https://astryx.atmeta.com/components':'#foundations'} {...(variant==='External'?{target:'_blank',rel:'noreferrer'}:{})}>{variant==='Inline'?'Read the usage guidelines':variant==='External'?'Reference catalog':'Explore foundations'}{variant==='External'&&<Icon name="lucide:external-link"/>}</a>;
    if(['segmented-control','toggle-button-group','filter-chips'].includes(id))return <FilterChips aria-label="Example choices" value={selected} options={options.map(item=>({...item,label:id==='segmented-control'&&variant==='With icons'?<span className="catalog-row"><Icon name={choiceIcons[item.value]}/>{item.label}</span>:item.label,disabled,...(variant==='With counts'?{count:item.value==='design'?24:12}:{})}))} onChange={next=>setSelected(variant==='Multi select'?next:next.slice(-1))}/>;
    if(id==='toggle-button'){
        const ghost=variant.startsWith('Ghost'),iconOnly=variant==='Icon only'||variant==='Ghost icon only',withIcon=iconOnly||variant==='With icon'||variant==='Ghost with icon';
        return <Button variant={pressed?'primary':ghost?'ghost':'secondary'} disabled={disabled} aria-pressed={pressed} icon={withIcon?'lucide:bell':undefined} hideLabel={iconOnly} aria-label={iconOnly?'Notifications':undefined} onClick={()=>setPressed(!pressed)}>{iconOnly?'':'Notifications'}</Button>;
    }
    if(id==='toolbar')return <ToolbarExample variant={variant} state={state} thumbnail={thumbnail}/>;
    if(id==='chat-composer'||id==='chat-layout') {
        const chat=<div className="forge-document-chat catalog-chat">{id==='chat-layout'&&<><MessageCard appearance="document" messageIndex={0} msg={{id:'catalog-user',createdAt:'2026-11-12T18:29:00Z',role:'user',content:'Can you review the shared design and explain how it behaves in a narrower chat panel?'}}/><MessageCard appearance="document" messageIndex={1} msg={{id:'catalog-message',createdAt:'2026-11-12T18:30:00Z',role:'assistant',content:'The messages and composer share one centered content column. Text wraps within that column as the available space changes, and user messages stay aligned to its right edge.\n\nThe same spacing is preserved when chat appears beside a document or in an overlay.'}}/></>}<Composer appearance="document" draftKey={`catalog-${inputId}`} draftValue={text} onDraftChange={setText} disabled={disabled}
        showUpload showMic micOn={false} onToggleMic={()=>setCount(count+1)} onOpenAttach={()=>setCount(count+1)}
        agentOptions={[{value:'auto',label:'Automatic'},{value:'assistant',label:'Example assistant'}]} agentValue={composerSettings.agent} onAgentChange={agent=>setComposerSettings(previous=>({...previous,agent}))}
        modelOptions={[{value:'default',label:'Workspace default'},{value:'example',label:'Example model'}]} modelValue={composerSettings.model} onModelChange={model=>setComposerSettings(previous=>({...previous,model}))}
        reasoningOptions={[{value:'standard',label:'Standard'},{value:'extended',label:'Extended'}]} reasoningValue={composerSettings.reasoning} onReasoningChange={reasoning=>setComposerSettings(previous=>({...previous,reasoning}))}
        showAbort={variant==='Stop response'||state==='Loading'} onAbort={()=>setCount(count+1)} attachments={variant==='With attachment'?[{name:'design-notes.txt',uploadId:'example'}]:[]} onSubmit={()=>{setText('');setCount(count+1);}}/>{status}</div>;
        return id==='chat-layout'?<div className={`catalog-chat-frame${variant==='With context panel'?' is-split':variant==='Overlay'?' is-overlay':''}`}>
            {variant!=='Conversation'&&<aside className="catalog-chat-context"><Typography as="h3" typeRole="heading">Document context</Typography><p>A workspace can stay visible while the conversation uses the space beside it or an overlay.</p></aside>}{chat}
        </div>:chat;
    }
    if(id==='chat-message')return <div className="forge-document-chat catalog-chat"><MessageCard appearance="document" messageIndex={0} msg={{id:'catalog-message',createdAt:'2026-11-12T18:30:00Z',role:variant==='User'?'user':'assistant',content:variant==='User'?'Can you review the design?':'The design uses consistent spacing and readable labels.'}}/></div>;
    if(id==='chat-message-metadata')return <div className="catalog-row catalog-muted"><Icon name="lucide:bot"/><span>Assistant</span>{variant==='Model and time'&&<span>Example model</span>}<time dateTime="2026-11-12T10:30:00-08:00">10:30 AM PST</time></div>;
    if(id==='chat-system-message'||id==='banner'){
        const tone=toneFor(variant,state);
        const message=tone==='success'?'Your changes have been saved.':tone==='warning'?'Review the changes before continuing.':tone==='danger'?(id==='chat-system-message'?'Your message could not be sent. Please try again.':'The changes could not be saved. Try again.'):'Your workspace is ready to use.';
        return <Callout {...typographyProps('body')} data-forge-status={tone} role={id==='chat-system-message'&&!thumbnail?(tone==='danger'?'alert':'status'):undefined} icon={<Icon className="bp6-icon" name={`lucide:${tone==='success'?'circle-check':tone==='danger'?'circle-alert':'info'}`}/>}>{message}</Callout>;
    }
    if(id==='chat-tool-calls'){
        const running=variant==='Running',failed=variant==='Failed';
        const activity=running?'Reviewing the component styles…':failed?'Command failed':'Worked for 12s';
        return <details className={`app-run-progress catalog-tool-activity${running?'':' is-completed'}`} data-activity-state={variant.toLowerCase()} open={state==='Expanded'}>
            <summary className="app-run-progress-toggle" {...typographyProps('body')}>
                <span className="app-run-progress-activity"><Icon name={running?'lucide:loader-circle':failed?'lucide:circle-alert':'lucide:check'} className={running?'app-run-progress-spinner':undefined}/><Typography typeRole="body">{activity}</Typography></span>
                {running&&<Typography typeRole="metadata">0:12</Typography>}<Icon className="catalog-tool-chevron" name="lucide:chevron-right"/>
            </summary>
            <ol className="catalog-tool-steps" aria-label="Working steps">
                <li><Icon name="lucide:check"/><Typography typeRole="small">Read the component definitions</Typography></li>
                <li><Icon name="lucide:check"/><Typography typeRole="small">Checked the semantic variables</Typography></li>
                <li><Icon name={failed?'lucide:circle-alert':running?'lucide:loader-circle':'lucide:check'}/><Typography typeRole="small">{failed?'The component check needs attention':running?'Checking the component styles':'Component checks passed'}</Typography></li>
            </ol>
            <details className="catalog-tool-command" open={state==='Expanded'&&running}>
                <summary {...typographyProps('small')}><Icon name="lucide:terminal"/>{running?'Running command':failed?'Command failed':'Ran command'}<Icon name="lucide:chevron-down"/></summary>
                <pre {...typographyProps('code')}><code>{'npm run check:components\n\n'+(failed?'One component check failed. Review the reported styles.':running?'Checking button, menu and composer styles…':'All component checks passed.')}</code></pre>
            </details>
        </details>;
    }
    if(id==='card')return <Card className={`catalog-native-card ${variant==='Subtle'?'catalog-subtle':''}`}><strong>Design foundations</strong><p>The shared language behind every product.</p></Card>;
    if(id==='carousel')return <ContentCarousel disabled={disabled} aria-label="Example featured documents" value={[{id:'one',title:'Foundations',description:'Start with the shared visual language.'},{id:'two',title:'Components',description:'Build with consistent interactions.'},{id:'three',title:'Patterns',description:'Compose complete workflows.'}]}/>;
    if(id==='top-nav-mega-menu-featured-card')return <FeaturedGuide disabled={disabled} icon={variant==='With icon'}/>;
    if(id==='clickable-card')return <a className="catalog-clickable-card" href="#foundations">{variant==='With icon'&&<Icon name="lucide:layers"/>}<strong>Explore foundations</strong><span>Color, typography and spacing in one place.</span></a>;
    if(id==='collapsible'||id==='section')return <SectionPattern title={id==='section'?'Project details':'What is included?'} appearance={variant==='Primary'?'primary':'quiet'} collapsible={id==='collapsible'||variant==='Collapsible'}><p>Shared components, semantic variables and accessible interactions.</p></SectionPattern>;
    if(id==='selectable-card')return <label className={`catalog-choice-card ${pressed?'is-selected':''}`}><input type={variant==='Multi select'?'checkbox':'radio'} name={inputId} checked={pressed} disabled={disabled} onChange={()=>setPressed(!pressed)}/><span><strong>Standard workspace</strong><span>Everything you need to get started.</span></span></label>;
    if(id==='avatar')return <span role="img" aria-label={`${variant} avatar`}><Avatar role={variant.toLowerCase()}/></span>;
    if(id==='avatar-group')return <div className="catalog-avatar-group" role="img" aria-label="Assistant, user and tool; 7 participants"><Avatar role="assistant"/><Avatar role="user"/><Avatar role="tool"/>{variant==='With overflow count'&&<CountBadge count={4}/>}</div>;
    if(id==='blockquote')return <blockquote>Good interfaces make the next step clear.{variant==='With attribution'&&<footer>— Example design principle</footer>}</blockquote>;
    if(id==='citation')return variant==='Source card'?<a className="catalog-clickable-card" href="#foundations"><Icon name="lucide:file-text"/><strong>Design foundations</strong><span>Source 1 · Usage guidelines</span></a>:<p>Use semantic roles for shared appearance. <a href="#foundations" className="catalog-citation" aria-label="Source 1: Design foundations">1</a></p>;
    if(id==='code')return variant==='Inline'?<code className="catalog-inline-code">--forge-surface</code>:<p>Use <code className="catalog-inline-code">variant="primary"</code> for the main action.</p>;
    if(id==='code-block')return <div className="catalog-code-example">{variant==='With copy action'&&<Button variant="ghost" icon="lucide:copy" onClick={async()=>{await navigator.clipboard.writeText(code);setCount(count+1);}}>{count?'Copied':'Copy'}</Button>}<pre><code>{code}</code></pre></div>;
    if(id==='empty-state')return <NonIdealState icon={<Icon name={variant==='Error'?'lucide:circle-alert':'lucide:file-text'}/>} title={variant==='Error'?'Unable to load documents':variant==='No results'?'No matching documents':'Create your first document'} description={variant==='No results'?'Try a different search or clear your filters.':'Your documents will appear here.'} action={<Button variant="secondary" onClick={()=>setCount(count+1)}>{variant==='Error'?'Try again':variant==='No results'?'Clear filters':'Create document'}</Button>}/>;
    if(id==='heading')return <Typography as={variant==='Title'?'h2':variant==='Heading'?'h3':'h4'} typeRole={variant.toLowerCase()}>A shared design language</Typography>;
    if(id==='icon')return <div className="catalog-row">{['house','search','settings','calendar','message-square'].map(name=><Icon key={name} name={`lucide:${name}`} label={variant==='Informative'?name:undefined}/>)}</div>;
    if(id==='kbd')return <div className="catalog-row">{variant==='Key combination'&&<><kbd>Shift</kbd><span>+</span></>}<kbd>Enter</kbd></div>;
    if(id==='markdown'||id==='rich-text-view')return <MarkdownView value={variant==='Code'?'Use `--forge-surface` for the shared surface.':variant==='With links'?'Read the [foundations](#foundations) before building.':markdown}/>;
    if(id==='text')return <Typography typeRole={variant==='Caption'?'caption':'body'} className={variant==='Secondary'?'catalog-muted':''}>Interfaces share one clear, consistent language.</Typography>;
    if(id==='thumbnail')return <div className={`catalog-thumbnail ${variant==='Square'?'is-square':''}`}><Asset/></div>;
    if(id==='timer')return <TimerExample variant={variant}/>;
    if(id==='timestamp')return <time dateTime="2026-11-12T10:30:00-08:00" title="November 12, 2026 at 10:30 AM PST">{variant==='Date'?'November 12, 2026':variant==='Relative'?'Example: 5 minutes ago':'Nov 12, 2026, 10:30 AM PST'}</time>;
    if(id==='token')return toast?<Tag onRemove={variant==='With remove action'?()=>setToast(false):undefined}>Design systems</Tag>:<Button variant="ghost" onClick={()=>setToast(true)}>Restore token</Button>;
    if(id==='badge')return <div className="catalog-row"><span>Messages</span><CountBadge count={variant==='Overflow'?132:4}/></div>;
    if(id==='info-tip'){
        const help=variant==='Help';
        const title=help?'Choosing semantic variables':'About semantic variables';
        // The native button handles Enter/Space; avoid a second toggle on its wrapper.
        return <Popover interactionKind="click" popupKind="dialog" autoFocus targetProps={{onKeyDown:undefined}} content={<div className="catalog-popover-content" role="dialog" aria-label={title}><strong>{title}</strong><p>{help?'Choose the role that matches the purpose: surface roles for backgrounds, text roles for labels and feedback roles for status.':'Semantic variables name the purpose of a color, spacing or typography value so components can adapt to the selected theme.'}</p></div>}><Button variant="ghost" icon={help?'lucide:circle-help':'lucide:info'} hideLabel aria-label={help?'Help choosing semantic variables':'About semantic variables'}/></Popover>;
    }
    if(id==='hover-card'||id==='popover')return <Popover interactionKind={id==='hover-card'?'hover':'click'} popoverClassName={id==='hover-card'?'forge-hover-card':undefined} content={<div className="catalog-popover-content"><strong>{id==='hover-card'?'Design foundations':'Supporting information'}</strong><p>This content uses the shared raised surface and text roles.</p>{variant==='Interactive'||variant==='With action'?<a href="#foundations">Open foundations</a>:null}</div>}><Button variant="secondary">{id==='hover-card'?'Preview document':'Open popover'}</Button></Popover>;
    if(id==='progress-bar')return <div className="catalog-progress">{variant==='Indeterminate'||state==='Loading'?<div className="forge-progress-inline"><span className="forge-progress-inline__value">Preparing…</span><progress className="forge-progress-inline__meter" aria-label="Preparing documents"/></div>:<ProgressBar value={65} text="65%" label="Document preparation" progress={{appearance:'inline'}}/>}</div>;
    if(id==='skeleton')return <div className="catalog-skeleton" role="status" aria-label="Loading document">{variant==='Card'?<Card className="catalog-native-card" aria-hidden="true"><div className="catalog-skeleton-media"/><SoftSkeleton lines={3}/></Card>:<div aria-hidden="true"><SoftSkeleton lines={3}/></div>}</div>;
    if(id==='spinner')return <span className="catalog-row" role="status"><Spinner size={28}/><span className="catalog-muted">Loading</span></span>;
    if(id==='status-dot')return <span className="catalog-status-dot" data-tone={toneFor(variant,state)}><span aria-hidden="true"/>{({Neutral:'Draft',Success:'Available',Warning:'Needs review',Danger:'Unavailable'})[variant]||'Available'}</span>;
    if(id==='status-chip')return <StatusChip tone={state==='Default'?variant.toLowerCase():toneFor(variant,state)}>{state==='Default'?({Neutral:'Draft',Info:'In progress',Success:'Ready',Warning:'Needs review',Danger:'Failed'})[variant]:({Success:'Ready',Warning:'Needs review',Error:'Failed'})[state]}</StatusChip>;
    if(id==='calendar')return <CalendarExample variant={variant} disabled={disabled}/>;
    if(id==='checkbox-input')return <Checkbox label="Include archived documents" checked={state==='Disabled'?false:pressed} indeterminate={disabled?false:mixed} disabled={disabled} onChange={event=>{setMixed(false);setPressed(event.target.checked);}}/>;
    if(['date-input','date-time-input','field','file-input','multi-selector','number-input','text-area','text-input'].includes(id))return <FieldExample spec={spec} variant={variant} state={state} thumbnail={thumbnail}/>;
    if(id==='date-range-input')return <RangeExample variant={variant} disabled={disabled} readOnly={state==='Read only'}/>;
    if(id==='complex-selector'||id==='selector'||id==='searchable-dropdown')return <SelectorExample variant={variant} disabled={disabled} readOnly={state==='Read only'} invalid={invalid} searchable={id==='searchable-dropdown'}/>;
    if(id==='power-search')return <div className="catalog-example-field catalog-field-label"><label htmlFor={inputId}>Search documents</label><InputGroup id={inputId} type="search" aria-label="Search documents" leftIcon={<Icon name="lucide:search" className="bp6-icon"/>} placeholder="Search documents…" value={text} onChange={event=>setText(event.target.value)} {...fieldProps}/></div>;
    if(id==='radio-list')return <RadioListExample variant={variant} disabled={disabled}/>;
    if(id==='slider')return <div className="catalog-slider"><label id={`${inputId}-label`}>Volume: {number}%</label><Slider min={0} max={100} stepSize={variant==='With steps'?10:1} labelStepSize={50} value={number} onChange={setNumber} disabled={disabled} handleHtmlProps={{'aria-label':'Volume','aria-valuetext':`${number}%`}}/></div>;
    if(id==='switch')return <div className="catalog-row"><SwitchControl value={state==='Disabled'?false:pressed} onChange={setPressed} disabled={disabled} aria-label="Automatic updates"/><span>Automatic updates</span></div>;
    if(id==='time-input')return <TimeInputExample variant={variant} state={state}/>;
    if(id==='tokenizer')return <TokenizerExample variant={variant} state={state}/>;
    if(id==='app-shell')return <div className={`catalog-mini-shell ${variant==='Collapsed'?'is-collapsed':''}`}><div className="catalog-mini-shell__header"><Icon name="lucide:layers"/>Workspace</div><nav aria-label="Example app navigation"><Icon name="lucide:house"/>{variant!=='Collapsed'&&'Home'}<Icon name="lucide:file-text"/>{variant!=='Collapsed'&&'Documents'}</nav><div className="catalog-mini-shell__main"><strong>Welcome to your workspace</strong><p>Everything has a place.</p></div></div>;
    if(id==='aspect-ratio')return <div className="catalog-aspect" style={{aspectRatio:variant==='Square'?'1':variant==='Portrait'?'3/4':'16/9'}}><Asset/></div>;
    if(id==='divider')return <div className={`catalog-divider-example ${variant==='Vertical'?'is-vertical':''}`}><span>Overview</span><div role="separator" aria-orientation={variant==='Vertical'?'vertical':'horizontal'}/><span>Details</span></div>;
    if(id==='form-layout')return <form className={`catalog-form-example ${variant==='Two columns'?'two-columns':''}`} onSubmit={event=>event.preventDefault()}><label className="catalog-field-label">First name<InputGroup placeholder="Alex"/></label><label className="catalog-field-label">Last name<InputGroup placeholder="Morgan"/></label><Button variant="primary" onClick={()=>setCount(count+1)}>Save profile</Button>{status}</form>;
    if(id==='grid'||id==='stack'||id==='layout')return <div className={`catalog-layout-example ${id==='stack'&&variant==='Vertical'?'vertical':''}`} style={{gridTemplateColumns:id==='grid'?`repeat(${variant==='Three columns'?3:2},minmax(0,1fr))`:id==='layout'&&variant==='Main and aside'?'2fr 1fr':undefined}}>{(id==='layout'?['Main content','Aside']:['First','Second','Third']).map(label=><div key={label}>{label}</div>)}</div>;
    if(id==='resize-handle')return <div className="catalog-splitter"><Splitter orientation={variant.toLowerCase()} divider={{visible:true}}><div className="catalog-panel">First panel</div><div className="catalog-panel">Second panel</div></Splitter></div>;
    if(id==='scrollable-area')return <div className={`catalog-scroll-area ${variant==='Horizontal'?'horizontal':''}`} tabIndex={0} role="region" aria-label="Scrollable example documents">{Array.from({length:8},(_,index)=><div key={index}>Document {index+1}<span className="catalog-muted">Shared library</span></div>)}</div>;
    if(id==='breadcrumbs')return <BreadcrumbsExample variant={variant} disabled={disabled}/>;
    if(id==='outline')return <nav className="catalog-outline" aria-label="Example document outline"><a href="#foundations">Foundations</a><a href="#components/button">Components</a>{variant==='Nested'&&<a className="is-nested" href="#components/button">Button</a>}<a href="#components/analytical-report">Patterns</a></nav>;
    if(id==='pagination')return <nav className="forge-pagination" aria-label="Example result pages"><Button variant="ghost" size="compact" disabled={disabled||page===1} aria-label="Previous page" icon="lucide:chevron-left" hideLabel onClick={()=>setPage(page-1)}/>{variant==='Numbered'?<>{[1,2,3].map(n=><BlueprintButton minimal small key={n} active={page===n} aria-current={page===n?'page':undefined} aria-label={`Page ${n}`} disabled={disabled} onClick={()=>setPage(n)} {...typographyProps('small')}>{n}</BlueprintButton>)}<span className="catalog-sr-only" role="status">Page {page} of 3</span></>:<Typography typeRole="small" role="status" aria-live="polite">{page} / 3</Typography>}<Button variant="ghost" size="compact" disabled={disabled||page===3} aria-label="Next page" icon="lucide:chevron-right" hideLabel onClick={()=>setPage(page+1)}/></nav>;
    if(id==='top-nav')return <TopNavExample variant={variant} disabled={disabled}/>;
    if(id==='side-nav')return <nav className="catalog-nav-example vertical" aria-label="Example workspace destinations">{[{name:'Overview',icon:'house'},{name:'Documents',icon:'file-text'},{name:'Settings',icon:'settings'}].map((item,index)=><a href={`#components/${['form-layout','table','switch'][index]}`} key={item.name} aria-current={index===0?'page':undefined}><Icon name={`lucide:${item.icon}`}/>{variant!=='Collapsed'&&item.name}</a>)}</nav>;
    if(id==='stepper')return <StepperExample variant={variant} state={state}/>;
    if(id==='tab-list')return <LocalTabs variant={variant} disabled={disabled}/>;
    if(id==='dialog')return <DialogExample variant={variant} disabled={disabled}/>;
    if(id==='drawer')return <DrawerExample variant={variant} disabled={disabled}/>;
    if(id==='toast'){
        const automatic=variant.endsWith('auto dismiss'),type=variant.replace(' auto dismiss','');
        const tone=type==='Danger'?'danger':type==='Warning'?'warning':type==='Success'?'success':'primary';
        const icon={danger:'lucide:circle-alert',warning:'lucide:triangle-alert',success:'lucide:circle-check',primary:'lucide:info'}[tone];
        return <div className="catalog-stack">{toast?<Toast className="catalog-toast" intent={tone} icon={<Icon className="bp6-icon" name={icon}/>} message={{danger:'Changes could not be saved.',warning:'Review the changes before saving.',success:'Changes saved successfully.',primary:'Your changes are ready to review.'}[tone]} isCloseButtonShown={false} action={automatic?undefined:{icon:<Icon className="bp6-icon" name="lucide:x"/>,'aria-label':'Close',className:'forge-toast-dismiss'}} timeout={automatic?4000:0} onDismiss={()=>setToast(false)}/>:<Button variant="secondary" onClick={()=>setToast(true)}>Show notification</Button>}{automatic&&<Typography typeRole="small" className="catalog-muted">Closes automatically after 4 seconds.</Typography>}</div>;
    }
    if(id==='tooltip'){
        const details=<div className="forge-tooltip-copy"><Typography as="strong" typeRole="label">Workspace access</Typography><Typography typeRole="small">Choose who can view and edit this workspace.</Typography>{variant==='With learn more'&&<a href="#guidelines" {...typographyProps('small')}>Learn more</a>}</div>;
        const trigger=<Button id={inputId} variant="ghost" icon={variant.startsWith('With ')?'lucide:info':'lucide:send'} hideLabel aria-label={variant.startsWith('With ')?'About workspace access':'Send message'} onClick={variant.startsWith('With ')?undefined:()=>setCount(count+1)}/>;
        return variant==='With learn more'?<Popover minimal interactionKind="hover" popupKind="dialog" autoFocus={false} enforceFocus={false} targetProps={{onKeyDown:undefined}} popoverClassName="forge-tooltip-help" onOpened={node=>{const target=node.ownerDocument.getElementById(inputId);if(target===node.ownerDocument.activeElement&&target.matches(':focus-visible'))node.querySelector('a')?.focus();}} content={<div role="dialog" aria-label="About workspace access">{details}</div>}>{trigger}</Popover>:<Tooltip minimal content={variant==='With heading'?details:variant==='Keyboard hint'?'Send message · Enter':'Send message'}>{trigger}</Tooltip>;
    }
    if(id==='list')return <ul className="catalog-simple-list">{records.slice(0,thumbnail?2:3).map(item=><li key={item.id}><span>{item.name}</span>{variant==='With actions'&&<Button variant="ghost" icon="lucide:ellipsis" hideLabel aria-label={`More actions for ${item.name}`} onClick={()=>setCount(count+1)}/>}</li>)}</ul>;
    if(id==='metadata-list')return <dl className={`catalog-metadata ${variant==='Two columns'?'two-columns':''}`}><div><dt>Owner</dt><dd>Design team</dd></div><div><dt>Status</dt><dd><StatusChip tone="success">Ready</StatusChip></dd></div><div><dt>Updated</dt><dd>November 12, 2026</dd></div></dl>;
    if(id==='overflow-list')return <ChipList value={['Foundations','Components','Patterns','Accessibility','Content']} readOnly maxVisible={variant==='Expanded'?10:2}/>;
    if(id==='table'||id==='editable-table')return <TableExample thumbnail={thumbnail} selection={variant==='With selection'} state={state} editable={id==='editable-table'} variant={variant}/>;
    if(id==='table-selection-toolbar')return <div className="catalog-stack catalog-full"><div className="catalog-toolbar"><span>{selected.length} selected</span><Button variant="secondary" disabled={!selected.length} onClick={()=>setSelected([])}>Clear selection</Button></div>{records.map(item=><Checkbox key={item.id} checked={selected.includes(item.id)} label={item.name} onChange={event=>setSelected(event.target.checked?[...selected,item.id]:selected.filter(entry=>entry!==item.id))}/>)}</div>;
    if(id==='tree-list')return <Tree contents={[{id:'root',label:'Design system',hasCaret:true,isExpanded:expanded,icon:<Icon name="lucide:folder"/>,childNodes:records.map(item=>({id:item.id,label:item.name,icon:<Icon name="lucide:file-text"/>}))}]} onNodeExpand={()=>setExpanded(true)} onNodeCollapse={()=>setExpanded(false)} onNodeClick={node=>{if(node.id==='root')setExpanded(!expanded);else setValue(node.label);}}/>;
    if(id==='visuallyhidden')return variant==='Keyboard skip link'?<div className="catalog-stack"><Typography typeRole="body">Press Tab to reveal the skip link. Enter moves focus to the library content.</Typography><a className="catalog-skip-example" href="#catalog-main" onClick={event=>{event.preventDefault();document.getElementById('catalog-main')?.focus();}}>Skip to library content</a></div>:<div className="catalog-stack"><Button variant="ghost"><Icon name="lucide:download"/><span className="catalog-sr-only">Download design guidelines</span></Button><Typography typeRole="body">Screen readers announce “Download design guidelines” for this icon button. The label is visually hidden.</Typography></div>;
    if(id==='charts'){
        const idByVariant={Bar:'bar',Line:'line',Area:'area','Stacked bars':'stacked',Comparison:'horizontal_bar',Pie:'pie',Donut:'donut',Heatmap:'heatmap'};
        const guidance={Bar:'Compare categories on a common baseline.',Line:'Show change over an ordered time period.',Area:'Show magnitude over time with a shared baseline. Keep overlapping series limited.','Stacked bars':'Show a total and its contributing parts. Use comparison bars when precise differences matter.',Comparison:'Compare values with long category labels. Keep labels and values visible.',Pie:'Show a few non-negative parts of one whole. Use bars for precise comparisons.',Donut:'Show a few non-negative parts of one whole; keep the total and labels explicit.',Heatmap:'Compare values across two categorical dimensions with a labeled scale.'};
        return <div className="catalog-stack catalog-full"><Typography typeRole="body">{guidance[variant]}</Typography><ChartExample example={chartExamples.find(entry=>entry.id===idByVariant[variant])} state={state==='Default'?'populated':state.toLowerCase()}/></div>;
    }
    if(id==='metrics')return <MetricsSpecimen variant={variant} state={state}/>;
    if(id==='document-form')return thumbnail?<div className="catalog-stack"><strong>Working document</strong><InputGroup aria-label="Example document name" defaultValue="Design foundations"/><Button variant="primary">Save changes</Button></div>:<DocumentSpecimen/>;
    if(id==='analytical-report')return thumbnail?<div className="catalog-stack"><strong>Workspace report</strong><Typography typeRole="metric">24</Typography><span className="catalog-muted">Components reviewed</span><StatusChip tone="success">Ready</StatusChip></div>:<ReportDocumentSpecimen/>;
    if(id==='comparison-layout')return thumbnail?<div className="catalog-mini-chart" role="img" aria-label="Illustrative comparison arrangement; open the page for the shared comparison renderer">{[75,45,60].map((width,index)=><span key={index} style={{width:`${width}%`,height:12}}/>)}</div>:<ComparisonWidthSpecimen/>;
    throw new Error(`Missing catalog example: ${id}`);
}
