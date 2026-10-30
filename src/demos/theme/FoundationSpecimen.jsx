import React, {useRef, useState} from 'react';
import AttachmentDialog from '../../components/chat/AttachmentDialog.jsx';
import Composer from '../../components/chat/Composer.jsx';
import DocumentSpecimen from './DocumentSpecimen.jsx';
import ReportDocumentSpecimen from './ReportDocumentSpecimen.jsx';
import {signal} from '@preact/signals-react';
import {Button as BlueprintButton, Callout, Card, Dialog, Popover, Tag} from '@blueprintjs/core';
import Button from '../../components/Button.jsx';
import SectionTabRail from '../../components/SectionTabRail.jsx';
import SelectControl from '../../components/SelectControl.jsx';
import Icon from '../../components/Icon.jsx';
import Typography, {typographyProps} from '../../components/Typography.jsx';
import AccessibleSection from '../../components/AccessibleSection.jsx';
import DashboardTableContent from '../../components/dashboard/DashboardTableContent.jsx';
import {DashboardEditableTable} from '../../components/dashboard/DashboardBlocks.jsx';
import '../../components/dashboard/Dashboard.css';
import WidgetRenderer from '../../runtime/WidgetRenderer.jsx';
import './foundationSpecimen.css';

const surfaces = [['canvas', 'Canvas'], ['surface', 'Surface'], ['surface-subtle', 'Subtle surface'], ['surface-raised', 'Raised surface']];
const texts = [['text', 'Primary text'], ['text-secondary', 'Secondary text'], ['text-muted', 'Muted text'], ['interaction-color', 'Action']];
const statuses = {info: 'Information', success: 'Saved', warning: 'Needs review', danger: 'Needs attention'};
const columns = [{key: 'name', label: 'Record', flex: true}, {key: 'count', label: 'Count', format: 'number', align: 'right'}, {key: 'status', label: 'Status'}];
const table = {id: 'foundationTable', columns, quickFilter: true, tablePresentation: {variant: 'document'}};
const tableContext = {signals: {collection: signal([{name: 'First example', count: 12345, status: 'Active', frequency: '3 per 1 day'}, {name: 'Second example with a longer name', count: 86, status: 'Warning', frequency: '5 per 1 week'}]), control: signal({}), selection: signal({})}};

tableContext.Context = () => tableContext;
tableContext.handlers = {dataSource:{peekFullCollection:()=>tableContext.signals.collection.value,replaceCollection:({rows})=>{tableContext.signals.collection.value=rows;}}};
const editableTable = {...table, dataSourceRef:'examples', allowAdd:false, columns:[
    {key:'name',label:'Record',width:220,editor:{type:'text'}},
    {key:'count',label:'Count',width:112,align:'right',editor:{type:'number'}},
    {key:'status',label:'Status',width:144,editor:{type:'select',options:['Active','Warning']}},
    {key:'frequency',label:'Frequency',width:260,editor:{type:'frequency'}},
    {key:'notes',label:'Notes',flex:true,minWidth:240,editor:false},
]};

export default function FoundationSpecimen({iconExamples = ['menu', 'search', 'plus', 'panel-right', 'maximize', 'minimize', 'thumbs-up', 'thumbs-down', 'ellipsis'].map(name => ({name: `lucide:${name}`, label: name}))}) {
    const state = useState({foundationName: '', foundationAmount: 12345, foundationSelect: 'all', foundationRadio: 'daily', foundationCheck: true, foundationSwitch: false});
    const [saved, setSaved] = useState(0);
    const [dialog, setDialog] = useState(false);
    const [attachmentsOpen, setAttachmentsOpen] = useState(false);
    const [uploads, setUploads] = useState([]);
    const [dropFiles, setDropFiles] = useState([]);
    const [dropDraft, setDropDraft] = useState('');
    const [dropDisabled, setDropDisabled] = useState(false);
    const [dropStage, setDropStage] = useState('done');
    const dropPicker = useRef(null);
    const [tableState, setTableState] = useState('populated');
    const [section, setSection] = useState('overview');
    const input = (id, label, widget, extra = {}) => <WidgetRenderer key={id} state={state}
        item={{id, label, widget, scope: 'local', properties: {typographyRole: 'body'}, ...extra}}/>;
    const changeTable = value => {
        setTableState(value);
        tableContext.signals.control.value = value === 'loading' ? {loading: true} : value === 'error' ? {error: {message: 'Example data could not load. Try again.'}} : {};
        tableContext.signals.collection.value = value === 'empty' ? [] : [{name: 'First example', count: 12345, status: 'Active', frequency: '3 per 1 day'}, {name: 'Second example with a longer name', count: 86, status: 'Warning', frequency: '5 per 1 week'}];
    };
    return <div className="forge-foundation-specimen">
        <DocumentSpecimen/>
        <ReportDocumentSpecimen/>
        <header>
            <Typography as="h1" typeRole="display">Workspace design system</Typography>
            <Typography as="p" typeRole="body">The shared components, foundations and states available to workspace authors. Appearance follows the selected workspace theme.</Typography>
            <nav aria-label="Foundation sections">{['Colors', 'Spacing and surfaces', 'Actions and icons', 'Form controls', 'Feedback', 'Overlays', 'Data display', 'Charts'].map(label => <a key={label} href={`#foundation-${label.split(' ')[0].toLowerCase()}`} {...typographyProps('body')}>{label}</a>)}</nav>
        </header>
        <section id="foundation-colors" aria-label="Semantic colors">
            <Typography as="h2" typeRole="section">Colors</Typography>
            <Typography as="p" typeRole="body">Surfaces establish depth. Text and actions retain their own semantic roles. Status always includes a written label.</Typography>
            <div className="forge-foundation-swatches">{surfaces.map(([token, label]) => <div key={token}><span className="forge-foundation-swatch" style={{background: `var(--forge-${token})`}}/><Typography typeRole="metadata">{label}</Typography></div>)}</div>
            <div className="forge-foundation-row">{texts.map(([token, label]) => <Typography key={token} typeRole="body" style={{color: `var(--forge-${token})`}}>{label}</Typography>)}</div>
            <div className="forge-foundation-row" aria-label="Categorical data colors">{[1, 2, 3, 4, 5, 6].map(step => <span key={step} className="forge-foundation-data-color" style={{background: `var(--forge-data-categorical-${step})`}} aria-label={`Data series ${step}`}/>)}</div>
        </section>
        <section id="foundation-spacing" aria-label="Spacing and surfaces">
            <Typography as="h2" typeRole="section">Spacing and surfaces</Typography>
            <div className="forge-foundation-row">{[1, 2, 3, 4, 5, 6].map(step => <div className="forge-foundation-space" key={step}><span className="forge-foundation-space__sample" style={{width: `var(--forge-spacing-${step}, ${step * 4}px)`}}/><Typography typeRole="metadata">Step {step}</Typography></div>)}</div>
            <Card className="forge-foundation-card" data-forge-part="container-card"><Typography as="h3" typeRole="section">Surface with a quiet border</Typography><Typography as="p" typeRole="body">Shared border, radius and inset roles. Elevation is reserved for overlays.</Typography></Card>
            <AccessibleSection title="Reusable section" collapsible data-forge-part="container-section" data-forge-section-appearance="quiet"><Typography as="p" typeRole="body">The section retains its keyboard control and expanded state.</Typography></AccessibleSection>
        </section>
        <section id="foundation-actions" aria-label="Actions and icons">
            <Typography as="h2" typeRole="section">Actions and icons</Typography>
            <div className="forge-foundation-row">
                <Button variant="primary" icon="lucide:check" onClick={() => setSaved(saved + 1)}>Save example</Button>
                <Button variant="secondary" onClick={() => setSaved(0)}>Reset example</Button>
                <Button variant="ghost">Ghost action</Button><Button variant="link">Link action</Button>
                <Button variant="danger">Remove example</Button><Button variant="secondary" size="compact">Compact action</Button>
                <Button variant="primary" disabled>Unavailable action</Button><Button variant="primary" loading>Saving example</Button>
                <Button variant="ghost" size="compact" icon="lucide:panel-right" hideLabel aria-label="Show example panel" onClick={() => setDialog(true)}/>
                <BlueprintButton minimal icon="refresh" aria-label="Reset example count" onClick={() => setSaved(0)}/>
            </div>
            <Typography as="p" typeRole="metadata" role="status">Example saved {saved} {saved === 1 ? 'time' : 'times'}.</Typography>
            <SectionTabRail ariaLabel="Example sections" items={['overview', 'records', 'schedule', 'sources', 'settings', 'history'].map(id => ({id, label:id.charAt(0).toUpperCase()+id.slice(1)}))} selectedId={section} onChange={setSection}/>
            <div className="forge-foundation-row" aria-label="Shared icon set">{iconExamples.map(({name, label}) => <span className="forge-foundation-icon-example" key={name}><Icon name={name}/><Typography typeRole="metadata">{label}</Typography></span>)}</div>
        </section>
        <section id="foundation-form" aria-label="Form controls">
            <Typography as="h2" typeRole="section">Form controls</Typography>
            <div className="forge-foundation-fields">
                {input('foundationName', 'Name', 'text', {helperText: 'Enter a descriptive name.'})}
                {input('foundationAmount', 'Amount', 'number')}
                {input('foundationSelect', 'Scope', 'select', {options: [{value: 'all', label: 'All records'}, {value: 'selected', label: 'Selected records'}]})}
                {input('foundationNotes', 'Notes', 'textarea')}
                {input('foundationDisabled', 'Disabled field', 'text', {disabled: true})}
                {input('foundationInvalid', 'Required name', 'text', {validationError: 'Enter a name to continue.'})}
                {input('foundationCheck', 'Include archived records', 'checkbox')}
                {input('foundationSwitch', 'Automatic refresh', 'switch')}
                {input('foundationRadio', 'Grouping', 'radio', {appearance: 'segmented', options: [{value: 'daily', label: 'Daily'}, {value: 'weekly', label: 'Weekly'}]})}
            </div>
        </section>
        <section id="foundation-feedback" aria-label="Feedback">
            <Typography as="h2" typeRole="section">Feedback</Typography>
            <div className="forge-foundation-row">{Object.entries(statuses).map(([status, label]) => <Tag key={status} data-forge-status={status} {...typographyProps('metadata')}>{label}</Tag>)}</div>
            <Callout data-forge-status="info" icon={null} {...typographyProps('body')}>Supporting information stays visible next to the task.</Callout>
            <Callout data-forge-status="success" icon={null} {...typographyProps('body')}>The example was saved.</Callout>
            <Callout data-forge-status="warning" icon={null} {...typographyProps('body')}>Review the assumptions before continuing.</Callout>
            <Callout data-forge-status="danger" icon={null} {...typographyProps('body')}>The example could not be saved. Check the required fields and try again.</Callout>
        </section>
        <section id="foundation-overlays" aria-label="Overlays">
            <Typography as="h2" typeRole="section">Overlays, focus and motion</Typography>
            <Typography as="p" typeRole="body">Use Tab to inspect focus. Popovers and dialogs inherit this theme. Reduced motion removes transitions and the loading rotation.</Typography>
            <div className="forge-foundation-row">
                <Popover content={<div className="forge-foundation-overlay"><Typography as="p" typeRole="body">Popover content uses the raised surface and overlay elevation.</Typography></div>}><Button variant="secondary">Open example popover</Button></Popover>
                <Button variant="secondary" onClick={() => setDialog(true)}>Open example dialog</Button>
                <Button variant="secondary" onClick={() => setAttachmentsOpen(true)}>Open attachment dialog</Button>
            </div>
            <AttachmentDialog isOpen={attachmentsOpen} onClose={() => setAttachmentsOpen(false)} uploads={uploads} onSelect={files => setUploads(files.map(file => ({name:file.name,size:file.size,status:"error",progress:0.4,error:new Error("Example upload failed. Select Upload to retry.")})))}/>
            <Dialog className="forge-foundation-overlay" isOpen={dialog} onClose={() => setDialog(false)} onOpened={node => node.querySelector('[data-dialog-initial-focus]')?.focus()} title="Example dialog"><Typography as="p" typeRole="body">Focus stays inside while open. Escape closes the dialog and returns focus to its trigger.</Typography><Button variant="primary" data-dialog-initial-focus onClick={() => setDialog(false)}>Close example dialog</Button></Dialog>
        </section>
        <section aria-label="File drop composer">
            <Typography as="h2" typeRole="section">File uploads in chat</Typography>
            <label {...typographyProps('label')}><input type="checkbox" checked={dropDisabled} onChange={event => setDropDisabled(event.target.checked)}/> Disable example uploads</label>
            <label {...typographyProps('label')}>Upload stage <SelectControl {...typographyProps('body')} aria-label="Example upload stage" value={dropStage} onChange={event => setDropStage(event.target.value)}>
                <option value="idle">Preparing</option><option value="uploading">Uploading</option><option value="finishing">Finishing</option><option value="error">Failed</option><option value="done">Ready</option>
            </SelectControl></label>
            <input ref={dropPicker} type="file" multiple hidden aria-label="Choose example files" onChange={event => {
                const files = Array.from(event.target.files || []); event.target.value = '';
                setDropFiles(current => [...current, ...files]);
            }}/>
            <div className="forge-document-chat">
                <Composer appearance="document" draftKey="file-drop-example" draftValue={dropDraft} onDraftChange={setDropDraft}
                    showUpload disabled={dropDisabled} onDropFiles={files => setDropFiles(current => [...current, ...files])}
                    onOpenAttach={() => dropPicker.current?.click()} attachments={dropStage === 'done' ? dropFiles.map((file, index) => ({name:file.name, uploadId:`example-${index}`})) : []}
                    uploads={dropFiles.map((file, index) => ({id:`example-${index}`, index, name:file.name, file, status:dropStage === 'finishing' ? 'uploading' : dropStage, progress:dropStage === 'idle' ? 0 : dropStage === 'finishing' ? 1 : .4}))}
                    onCancelUpload={id => setDropFiles(current => current.filter((_, index) => `example-${index}` !== id))}
                    onRetryUpload={() => setDropStage('uploading')}
                    onRemoveAttachment={index => setDropFiles(current => current.filter((_, i) => i !== index))}/>
            </div>
            <Typography as="p" typeRole="metadata">Use the stage control to inspect upload feedback. This local example makes no network requests.</Typography>
        </section>
        <section id="foundation-data" aria-label="Data display">
            <Typography as="h2" typeRole="section">Data display and states</Typography>
            <label {...typographyProps('label')}>Table state <SelectControl {...typographyProps('body')} aria-label="Example table state" value={tableState} onChange={event => changeTable(event.target.value)}>{['populated', 'editing', 'empty', 'loading', 'error'].map(value => <option key={value}>{value}</option>)}</SelectControl></label>
            {tableState==='editing' ? <DashboardEditableTable embedded container={editableTable} context={tableContext}/> : <DashboardTableContent container={table} context={tableContext}/>}
            <Typography as="p" typeRole="metadata">Actual document table with local sample data. Legacy table variants remain available for existing consumers.</Typography>
        </section>
    </div>;
}
