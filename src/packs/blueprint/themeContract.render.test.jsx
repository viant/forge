import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import './index.jsx';
import {getWidget} from '../../runtime/widgetRegistry.jsx';

for (const key of ['text', 'password', 'number', 'textarea', 'button']) {
    const Widget = getWidget(key);
    const part = key === 'button' ? 'button' : 'input';
    const html = renderToStaticMarkup(<Widget value={key === 'number' ? 1 : ''}
        onChange={() => {}} onValueChange={() => {}} className="ws-example"
        data-forge-widget={key} data-forge-control-id="customer"
        data-forge-part={part} aria-label="Customer" />);
    const nativeTag = html.match(new RegExp(`<${key === 'button' ? 'button' : key === 'textarea' ? 'textarea' : 'input'}\\b[^>]*>`))?.[0];
    assert.ok(nativeTag, `${key}: missing native target`);
    assert.ok(nativeTag.includes(`data-forge-part="${part}"`), `${key}: part must reach native node: ${html}`);
    assert.ok(nativeTag.includes(`data-forge-widget="${key}"`), `${key}: missing logical widget identity`);
    assert.ok(nativeTag.includes('data-forge-control-id="customer"'), `${key}: missing unwrapped control identity`);
    assert.ok(html.includes('ws-example'), `${key}: authored class lost`);
}
const Button = getWidget('button');
const authored = renderToStaticMarkup(<Button style={{borderRadius: 17, background: '#abcdef'}} />);
assert.ok(authored.includes('border-radius:17px'));
assert.ok(authored.includes('background:#abcdef'));
console.log('theme native-part forwarding and inline override contracts passed');

const {default: ControlWrapper} = await import('../../runtime/ControlWrapper.jsx');
const Input = getWidget('text');
for (const wrapper of [undefined, 'none']) {
    const html = renderToStaticMarkup(<ControlWrapper framework="blueprint"
        item={{id: 'customer', label: 'Customer', wrapper, validationError: 'Name required'}} container={{}} context={{}}>
        <Input id="custom-id" data-forge-part="input" aria-describedby="existing-description" />
    </ControlWrapper>);
    const input = html.match(/<input\b[^>]*>/)?.[0];
    const helperID = html.match(/id="([^"]+-(?:help|error))"/)?.[1];
    assert.ok(helperID, html);
    assert.ok(input.includes(`aria-describedby="existing-description ${helperID}"`), html);
    assert.ok(html.includes('data-forge-part="validation-message"'), html);
    if (!wrapper) {
        assert.ok(html.includes('<label'), html);
        const nativeID=input.match(/id="([^"]+)"/)?.[1];
        assert.ok(nativeID && html.includes(`for="${nativeID}"`), html);
        assert.ok(html.includes('data-forge-part="label"'), html);
    }
}
for (const wrapper of [undefined, 'none', 'control-only']) {
    const html=renderToStaticMarkup(<ControlWrapper framework="blueprint" item={{id:'feedback-role',label:'Example',wrapper,validationError:'Required value',properties:{typographyRole:'body'}}} container={{}} context={{}}><Input data-forge-type="body"/></ControlWrapper>);
    assert.match(html, /data-forge-type="metadata"[^>]*data-forge-part="validation-message"|data-forge-part="validation-message"[^>]*data-forge-type="metadata"/);
}
console.log('theme labels, validation targets, and wrapper bypass associations passed');

for (const state of [{disabled: true}, {readOnly: true}]) {
    const html = renderToStaticMarkup(<ControlWrapper framework="blueprint" item={{id: 'resolved-state', label: 'Resolved state', required: true}} container={{}} context={{}} {...state}>
        <Input {...state}/>
    </ControlWrapper>);
    assert.ok(!html.includes('forge-required-input'), 'resolved unavailable controls must not be styled as editable required inputs');
}
console.log('resolved wrapper availability contract passed');

const iconActionHTML = renderToStaticMarkup(<Button className="forge-action-icon" icon="undo" hideLabel aria-label="Reset changes"/>);
assert.match(iconActionHTML,/class="[^"]*\bforge-action-icon\b[^"]*"/);
assert.match(iconActionHTML,/aria-label="Reset changes"/);
assert.ok(!/style="[^"]*(?:min-height|min-width|padding):/.test(iconActionHTML),'Icon class geometry must not be shadowed by field button inline defaults');

const lookupHTML = renderToStaticMarkup(<Input value="sample" item={{lookup: {dataSource: 'sample'}}}
    adapter={{set() {}}} data-forge-part="input" className="workspace-lookup" />);
assert.match(lookupHTML, /forge-text-lookup/);
assert.match(lookupHTML, /workspace-lookup/);
assert.ok(!lookupHTML.includes('background-color:'), 'Lookup defaults must remain CSS overrideable');
assert.match(lookupHTML, /aria-label="Open lookup"/);
console.log('lookup class and accessible action contract passed');

const themeCSS = fs.readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
for (const token of [
    '--forge-text-muted',
    '--forge-text-secondary',
    '--forge-interaction-color',
    '--forge-selected-background',
    '--forge-status-danger-foreground',
    '--forge-status-success-background',
    '--forge-data-categorical-1',
    '--forge-chart-series-1',
    '--forge-container-surface',
    '--forge-container-border',
    '--forge-section-header-surface',
    '--forge-section-primary-header-surface',
    '--forge-section-primary-header-font-size',
    '--forge-section-primary-header-line-height',
    '--forge-section-quiet-header-surface',
    '--forge-section-quiet-header-font-size',
    '--forge-section-quiet-header-line-height',
    '--forge-section-header-text',
    '--forge-type-caption-size',
    '--forge-type-metric-line-height',
]) {
    assert.ok(themeCSS.includes(token), `missing optional semantic fallback ${token}`);
}
assert.match(themeCSS, /:is\(\[data-forge-part="container-card"\], \[data-forge-part="container-section"\]\)\s*{[^}]*background:\s*var\(--forge-container-surface\)/s);
assert.match(themeCSS, /\[data-forge-part="container-section"\]\s*>\s*\.bp6-section-header\s*{[^}]*background:\s*var\(--forge-section-header-surface\)/s);
assert.match(themeCSS, /\[data-forge-part="container-section"\]\[data-forge-section-appearance="primary"\]\s*>\s*\.bp6-section-header\s*{[^}]*background:\s*var\(--forge-section-primary-header-surface, var\(--forge-section-header-surface\)\)/s);
assert.match(themeCSS, /\[data-forge-part="container-section"\]\[data-forge-section-appearance="quiet"\]\s*>\s*\.bp6-section-header\s*{[^}]*background:\s*var\(--forge-section-quiet-header-surface, var\(--forge-section-header-surface\)\)/s);
assert.match(themeCSS, /data-forge-section-appearance="primary"[^}]*> \.bp6-section-header \.bp6-heading:not\(\[data-forge-type\]\)\s*{[^}]*font-size:\s*var\(--forge-section-primary-header-font-size, var\(--forge-section-header-font-size\)\)/s);
assert.match(themeCSS, /data-forge-section-appearance="quiet"[^}]*> \.bp6-section-header \.bp6-heading:not\(\[data-forge-type\]\)\s*{[^}]*font-size:\s*var\(--forge-section-quiet-header-font-size, var\(--forge-section-header-font-size\)\)/s);
console.log('optional semantic color fallbacks passed');

const {default: Typography, typographyRoles} = await import('../../components/Typography.jsx');
for (const role of typographyRoles) {
    const html = renderToStaticMarkup(<Typography as="h2" typeRole={role}>Role content</Typography>);
    assert.match(html, new RegExp(`<h2 data-forge-type="${role}">`));
    assert.doesNotMatch(html, /style=/);
}
assert.throws(() => renderToStaticMarkup(<Typography typeRole="invented"/>), /Unsupported typography/);
for (const style of [{font:'bold 18px serif'}, {fontSize:18}, {fontWeight:700}, {lineHeight:2}, {letterSpacing:2}, {fontFamily:'serif'}, {'--forge-type-body-size':'18px'}]) {
    assert.throws(() => renderToStaticMarkup(<Typography style={style}/>), /typography role and tokens/);
}
assert.match(renderToStaticMarkup(<Typography style={{marginTop:8}}>Allowed layout</Typography>), /margin-top:8px/);
const {default: WidgetRenderer} = await import('../../runtime/WidgetRenderer.jsx');
const roleWidget = renderToStaticMarkup(<WidgetRenderer item={{id:'pilot', widget:'label', label:'Pilot', value:'A real value', properties:{typographyRole:'heading'}}}/>);
assert.match(roleWidget, /data-forge-type="heading"/);
assert.doesNotMatch(roleWidget, /typographyRole=/);
for (const styleLocation of ['style','properties']) {
    const item={id:'invalid-role',widget:'text',properties:{typographyRole:'body'}};
    if (styleLocation==='style') item.style={fontSize:18};
    else item.properties.style={fontSize:18};
    assert.throws(() => renderToStaticMarkup(<WidgetRenderer item={item}/>), /typography role and tokens/);
}
const typeSource = fs.readFileSync(new URL('../../components/Typography.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(typeSource, /(?:fontSize|fontWeight|lineHeight|letterSpacing|fontFamily)\s*:/);
console.log('complete typography roles and real widget selection passed');

const typeCSS = fs.readFileSync(new URL('../../components/typography.css', import.meta.url), 'utf8');
for (const role of typographyRoles) {
    const block = typeCSS.split(`[data-forge-type="${role}"] {`)[1]?.split('}')[0];
    assert.ok(block, `missing applied role ${role}`);
    for (const suffix of ['family', 'size', 'weight', 'line-height', 'letter-spacing']) assert.ok(block.includes(`var(--forge-type-${role}-${suffix},`));
    assert.doesNotMatch(block, /(?:font-size|font-weight|line-height|letter-spacing):\s*(?:-?\d|["'])/);
}

const {default: SharedButton, buttonVariants} = await import('../../components/Button.jsx');
const {default: SharedIcon, iconNames} = await import('../../components/Icon.jsx');
for (const variant of buttonVariants) {
    const html = renderToStaticMarkup(<SharedButton variant={variant} icon="lucide:check">Save example</SharedButton>);
    assert.ok(html.includes(`data-forge-variant="${variant}"`));
    assert.match(html, /data-forge-type="label"/);
    assert.match(html, /<svg[^>]*aria-hidden="true"/);
    assert.doesNotMatch(html, /style=/, 'Shared appearance must come from tokens');
}
for (const unavailable of [{disabled: true}, {readOnly: true}, {loading: true}]) {
    assert.match(renderToStaticMarkup(<SharedButton variant="primary" {...unavailable}>Save</SharedButton>), /disabled=""/);
}
assert.match(renderToStaticMarkup(<SharedButton variant="primary" loading>Saving</SharedButton>), /aria-busy="true"/);
assert.throws(() => renderToStaticMarkup(<SharedButton variant="custom">Save</SharedButton>), /Unsupported button variant/);
assert.throws(() => renderToStaticMarkup(<SharedButton variant="primary" style={{background: 'red'}}>Save</SharedButton>), /shared variant and tokens/);
assert.throws(() => renderToStaticMarkup(<SharedButton variant="ghost" hideLabel icon="lucide:search"/>), /accessible name/);
assert.throws(() => renderToStaticMarkup(<SharedIcon name="lucide:missing"/>), /Unsupported icon/);
for (const name of iconNames) assert.match(renderToStaticMarkup(<SharedIcon name={name} label="Example icon"/>), /aria-label="Example icon"/);
for (const file of ['../../components/Button.jsx', '../../components/Icon.jsx', '../../components/foundations.css', '../../demos/theme/FoundationSpecimen.jsx', '../../demos/theme/foundationSpecimen.css']) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:IBM Plex|Steward|Viant|#2d5bff|#1a1d24)/i, 'Workspace branding must stay in workspace-owned assets');
    assert.doesNotMatch(source, /(?:fontSize|fontWeight|lineHeight|letterSpacing|fontFamily)\s*:/, 'Shared examples must select roles');
}
console.log('shared action variants, icon names, unavailable states and workspace ownership passed');

const {DashboardEditableTable} = await import('../../components/dashboard/DashboardBlocks.jsx');
const sampleRows = [{name: 'A long editable name', amount: 1200, notes: 'Always-visible row detail'}];
assert.throws(() => renderToStaticMarkup(<DashboardEditableTable container={{tablePresentation:{variant:'invented'}}}/>), /Unsupported table variant/);
const documentHTML = renderToStaticMarkup(<DashboardEditableTable embedded container={{id: 'example', dataSourceRef: 'rows', title: 'Example', allowAdd: false, tablePresentation: {variant: 'document', removeIcon: 'lucide:x', rowDetails: {field: 'notes', label: 'Notes'}}, columns: [{key: 'name', label: 'Name', flex: true, editor: {type: 'multiline'}}, {key: 'amount', label: 'Amount', width: 104, align: 'right', editor: {type: 'number'}}, {key: 'notes', editor: false}]}} context={{Context: () => ({handlers: {dataSource: {peekFullCollection: () => sampleRows}}})}}/>);
assert.match(documentHTML, /forge-document-table/);
assert.match(documentHTML, /<textarea[^>]*aria-label="Name row 1"/);
assert.match(documentHTML, /colSpan="3"/i);
assert.match(documentHTML, /Notes: Always-visible row detail/);
assert.match(documentHTML, /lucide-x/);
assert.doesNotMatch(documentHTML, /forge-table-frozen-identifier|<th[^>]*>notes/);
console.log('actual editable document table anatomy, multiline edit and row detail passed');
const compoundHTML = renderToStaticMarkup(<DashboardEditableTable embedded container={{id:'compound', dataSourceRef:'rows', tablePresentation:{variant:'document'}, columns:[
    {key:'name', label:'Name', width:220, editor:{type:'multiline', commitOnEnter:true}},
    {key:'amount', label:'Amount', width:104, editor:{type:'number'}, dataBar:{color:'red'}},
    {key:'frequency', label:'Frequency', width:260, editor:{type:'frequency', disabledWhen:'${locked}'}},
]}} context={{Context:()=>({handlers:{dataSource:{peekFullCollection:()=>[{name:'Example',amount:12,frequency:'3 per 1 day',locked:true}]}}})}}/>);
assert.match(compoundHTML, /<textarea[^>]*data-commit-on-enter="true"/);
assert.match(compoundHTML, /forge-select-control forge-document-select/);
assert.match(compoundHTML, /<select[^>]*disabled=""/);
assert.doesNotMatch(compoundHTML, /linear-gradient/, 'Document numeric fields retain the quiet editor appearance');
assert.doesNotMatch(documentHTML, /data-commit-on-enter="true"/, 'Multiline notes retain Enter for newlines unless explicitly selected');


const {default: SelectControl} = await import('../../components/SelectControl.jsx');
const nativeSelect = renderToStaticMarkup(<label htmlFor="native-choice">Choice<SelectControl id="native-choice" name="choice" aria-describedby="choice-help" data-forge-type="body" required defaultValue="long"><option value="short">Short</option><option value="long">A longer choice</option></SelectControl></label>);
assert.match(nativeSelect, /<select[^>]*id="native-choice"[^>]*name="choice"[^>]*aria-describedby="choice-help"[^>]*data-forge-type="body"[^>]*required=""/);
assert.match(nativeSelect, /<option value="long" selected="">/);
const selectIcon = nativeSelect.match(/<svg\b[^>]*>/)?.[0];
assert.match(selectIcon, /aria-hidden="true"/);
assert.match(selectIcon, /lucide-chevron-down/);
assert.doesNotMatch(nativeSelect, /style=/);
assert.match(renderToStaticMarkup(<SelectControl disabled/>), /<select disabled=""/);
assert.throws(() => renderToStaticMarkup(<SelectControl data-forge-type="body" style={{fontSize:18}}/>), /typography role and tokens/);
console.log('shared native select retains label, form, selected, disabled and typography contracts');

const {documentAppearance,documentAttributes}=await import('../../components/documentPresentation.js');
const {default:DocumentSpecimen}=await import('../../demos/theme/DocumentSpecimen.jsx');
assert.equal(documentAppearance({}),'');
assert.deepEqual(documentAttributes({appearance:'document'}),{'data-forge-appearance':'document'});
assert.throws(()=>documentAppearance({appearance:'custom'}),/Unsupported container appearance/);
assert.throws(()=>documentAppearance({appearance:'document',style:{padding:9}}),/shared geometry/);
const documentSpecimenHTML=renderToStaticMarkup(<DocumentSpecimen/>);
assert.match(documentSpecimenHTML,/<h1[^>]*data-forge-type="title"/);
assert.match(documentSpecimenHTML,/data-forge-appearance="document-header"/);
assert.match(documentSpecimenHTML,/forge-document-records/);
assert.match(documentSpecimenHTML,/forge-document-date-range/);
assert.match(documentSpecimenHTML,/<h3(?=[^>]*data-forge-type="section")(?=[^>]*data-forge-part="section-title")[^>]*>/);
assert.match(documentSpecimenHTML,/class="forge-document-date-range"[^>]*data-forge-part="group"/);
assert.match(documentSpecimenHTML,/<input[^>]*type="date"[^>]*data-forge-type="body"[^>]*data-forge-part="input"/);
assert.match(documentSpecimenHTML,/value="2026-01-01"/);
assert.match(documentSpecimenHTML,/value="2026-01-31"/);
assert.match(documentSpecimenHTML,/<dt[^>]*data-forge-type="metadata"/);
assert.doesNotMatch(documentSpecimenHTML,/for="[^"]*period[^"]*"[^>]*data-forge-part="label"/,'Split date labels replace the redundant group label');
const {workspaceToolbarItem}=await import('../../core/context/WorkspacePresentation.jsx');
const namedExport={id:'export-example',label:'Export example',hideLabel:false};
assert.equal(workspaceToolbarItem(namedExport,{kind:'report'}),namedExport,'Explicit named actions retain their visible labels');
console.log('actual document layout, native paired dates, summary roles, visible actions and legacy opt-out passed');

const {default: ReportDocumentSpecimen} = await import('../../demos/theme/ReportDocumentSpecimen.jsx');
const analyticalDocument = renderToStaticMarkup(<ReportDocumentSpecimen/>);
assert.match(analyticalDocument,/data-forge-report-appearance="document"/);
assert.match(analyticalDocument,/<h1[^>]*data-forge-type="title"/);
assert.match(analyticalDocument,/data-forge-type="metric"/);
assert.doesNotMatch(analyticalDocument,/font-weight:800|forge-report-runtime-kpi-panel/);
const {normalizeReportViewerSettings,resolveReportChartTableSwitch} = await import('../../reporting/reportViewerSettings.js');
assert.deepEqual(normalizeReportViewerSettings({appearance:'document',allowChartTableSwitch:false}),{appearance:'document',allowChartTableSwitch:false});
assert.throws(()=>normalizeReportViewerSettings({appearance:'invented'}));
assert.equal(resolveReportChartTableSwitch({reportSpec:{viewer:{appearance:'document'}},presentationMode:'preview'}),true);
console.log('real analytical document specimen, viewer validation and legacy chart switch fallback passed');
const {default: RecordTable}=await import('../../components/dashboard/DashboardTableContent.jsx');
const recordContext={dataSource:{uniqueKey:['name']},signals:{collection:{value:[{name:'First record',selected:false}]},control:{value:{}},selection:{value:{selection:[]}}}};
const recordContainer={tablePresentation:{variant:'document',recordTitleField:'name'},columns:[{key:'name',label:'Name'},{key:'selected',label:'Selected',displayValueMap:{false:'Not selected'}}]};
const recordHTML=renderToStaticMarkup(<RecordTable container={recordContainer} context={recordContext}/>);
assert.match(recordHTML,/<summary[^>]*data-forge-type="body"/);
assert.match(recordHTML,/Not selected/);
assert.doesNotMatch(recordHTML,/<input|<table/);
const actionHTML=renderToStaticMarkup(<RecordTable container={{...recordContainer,rowActions:[{kind:'detail',label:'Read record'}]}} context={recordContext}/>);
assert.match(actionHTML,/<table/,'Record presentation must not conceal row actions');
const selectionHTML=renderToStaticMarkup(<RecordTable container={recordContainer} context={{...recordContext,dataSource:{...recordContext.dataSource,selectionMode:'multi'}}}/>);
assert.match(selectionHTML,/type="checkbox"/,'Record presentation must not conceal selection controls');
console.log('read-only record semantics and interactive-table fallback passed');
await import('../../reporting/inlineReportCompiler.test.js');

const {default: GeographicReportRuntime}=await import('../../components/dashboard/ReportRuntime.jsx');
const {compileInlineReport: compileGeographicReport}=await import('../../reporting/inlineReportCompiler.js');
const paragraphCompiled=compileGeographicReport({reportId:'paragraph-spacing',grammar:'report-document-v1',source:{title:'Paragraph spacing',viewer:{appearance:'document'},blocks:[{id:'copy',kind:'markdownBlock',markdown:'First paragraph.\n\n\nSecond paragraph.\n\n```text\nfirst line\n\nthird line\n```'}]}});
const paragraphHTML=renderToStaticMarkup(<GeographicReportRuntime {...paragraphCompiled}/>);
assert.equal((paragraphHTML.match(/<p\b/g)||[]).length,2);
assert.match(paragraphHTML,/<code>first line\n\nthird line<\/code>/,'Blank lines inside code remain content');
assert.match(renderToStaticMarkup(<GeographicReportRuntime {...paragraphCompiled} reportSpec={{...paragraphCompiled.reportSpec,viewer:{}}}/>),/data-report-markdown-blank-line/,'Legacy report spacing is retained');
const listCompiled=compileGeographicReport({reportId:'narrative-lists',grammar:'report-document-v1',source:{title:'Narrative lists',viewer:{appearance:'document'},blocks:[{id:'lists',kind:'markdownBlock',markdown:'3. **First step** with <literal> evidence.\n\n7. Keep its original priority.\n\n- One observation.\n- Another observation.\n\nAfter the lists.\n\n```text\n1. literal\n- literal\n```'}]}});
const listHTML=renderToStaticMarkup(<GeographicReportRuntime {...listCompiled}/>);
assert.match(listHTML,/<ol(?=[^>]*start="3")(?=[^>]*class="forge-report-document-list")/);
assert.match(listHTML,/<li[^>]*value="3"[^>]*><strong>First step<\/strong> with &lt;literal&gt; evidence\.<\/li>/);
assert.match(listHTML,/<li[^>]*value="7"[^>]*>Keep its original priority\.<\/li>/);
assert.equal((listHTML.match(/<ul\b/g)||[]).length,1);
assert.equal((listHTML.match(/<li\b/g)||[]).length,4);
assert.match(listHTML,/<code>1\. literal\n- literal<\/code>/);
assert.doesNotMatch(renderToStaticMarkup(<GeographicReportRuntime {...listCompiled} reportSpec={{...listCompiled.reportSpec,viewer:{}}}/>),/forge-report-document-list/,'Legacy narrative presentation stays compatible');
const geographicSource={title:'Geographic evidence',viewer:{appearance:'document'},blocks:[
  {id:'states',kind:'geoMapBlock',title:'State evidence',datasetRef:'states',geo:{shape:'us-states',key:'code',labelKey:'name',metric:{key:'count',label:'Records',format:'number'},aggregate:'sum'}},
  {id:'empty',kind:'geoMapBlock',title:'Missing geography',datasetRef:'empty',geo:{shape:'us-states',key:'code',metric:{key:'count',label:'Records',format:'number'},aggregate:'sum'}},
  {id:'timeline',kind:'timelineBlock',title:'Observation timeline',events:[{id:'one',date:'2026-01-01',title:'Recorded observation',body:'Scope unchanged.'}]},
]};
const geographicCompiled=compileGeographicReport({reportId:'geographic',grammar:'report-document-v1',source:geographicSource,dataSources:{states:{rows:[{code:'CA',name:'California',count:0}]},empty:{rows:[]}}});
const geographicHTML=renderToStaticMarkup(<GeographicReportRuntime {...geographicCompiled}/>);
assert.match(geographicHTML,/<button(?=[^>]*data-forge-type="caption")(?=[^>]*aria-label="California \(CA\): 0")[^>]*>/);
assert.match(geographicHTML,/No geo data\./);
assert.match(geographicHTML,/<ol class="forge-report-document-timeline"/);
assert.match(geographicHTML,/<h3[^>]*data-forge-type="label"[^>]*>Recorded observation/);
assert.doesNotMatch(geographicHTML.slice(geographicHTML.indexOf('data-report-runtime-block-id="states"')),/font-size:|font-weight:|text-transform:/,'Migrated map/timeline consumers must use complete roles');
const legacyGeographic=renderToStaticMarkup(<GeographicReportRuntime {...geographicCompiled} reportSpec={{...geographicCompiled.reportSpec,viewer:{}}}/>);
assert.match(legacyGeographic,/forge-report-runtime-geo-tiles/,'Legacy map remains compatible');
console.log('shared document map/timeline roles, zero/empty data and legacy rendering passed');
const geographicErrorHTML=renderToStaticMarkup(<GeographicReportRuntime {...geographicCompiled} reportFill={{...geographicCompiled.reportFill,diagnostics:[{blockId:'states',severity:'error',code:'missingEvidence',message:'Source unavailable',suggestedFix:'Retry the original read.'}]}}/>);
assert.match(geographicErrorHTML,/data-forge-status="danger" role="alert"/);
assert.match(geographicErrorHTML,/<p[^>]*data-forge-type="body"[^>]*>Source unavailable/);
const {default: WorldMapControl}=await import('../../components/dashboard/WorldCountryMap.jsx');
const worldControlHTML=renderToStaticMarkup(<WorldMapControl/>);
assert.match(worldControlHTML,/aria-label="Zoom in map"/);
assert.match(worldControlHTML,/aria-label="Zoom out map"[^>]*disabled/);
assert.match(worldControlHTML,/<small[^>]*data-forge-type="caption"[^>]*>Natural Earth country boundaries/);
console.log('document geography error roles and shared world-map controls passed');

// The document workflow reuses semantic roles; legacy rendering remains available.
const workflowSource={title:'Example workflow',viewer:{appearance:'document'},blocks:[
  {id:'steps',kind:'stepperBlock',title:'Sequence',steps:[{id:'inspect',title:'Inspect evidence',body:'Read the complete source.'}]},
  {id:'board',kind:'kanbanBlock',title:'Stages',columns:[{id:'queued',title:'Queued',cards:[{id:'one',title:'Read source',body:'Preserve context.',badge:'Review'}]}]},
]};
const workflowReport=compileGeographicReport({reportId:'workflow',grammar:'report-document-v1',source:workflowSource});
const workflowHTML=renderToStaticMarkup(<GeographicReportRuntime {...workflowReport}/>);
assert.match(workflowHTML,/<ol(?=[^>]*data-forge-type="body")(?=[^>]*class="forge-report-document-steps")/);
assert.match(workflowHTML,/<h3[^>]*data-forge-type="label"/);
assert.match(workflowHTML,/<h4[^>]*data-forge-type="label"/);
assert.doesNotMatch(workflowHTML,/text-transform:uppercase|font-weight:800|draggable=/);
const emptyWorkflow=compileGeographicReport({reportId:'workflow-empty',grammar:'report-document-v1',source:{...workflowSource,blocks:[{id:'steps',kind:'stepperBlock',steps:[]},{id:'board',kind:'kanbanBlock',columns:[]}]}});
const emptyWorkflowHTML=renderToStaticMarkup(<GeographicReportRuntime {...emptyWorkflow}/>);
assert.match(emptyWorkflowHTML,/No process steps configured/);assert.match(emptyWorkflowHTML,/No pipeline columns configured/);
console.log('semantic read-only process/stage documents and empty states passed');

assert.match(analyticalDocument,/class="forge-report-document-metrics"/);
assert.match(analyticalDocument,/class="forge-report-document-metrics is-summary"/,'Plain summary metrics use compact responsive composition alongside rich metric cards');
assert.match(analyticalDocument,/<p[^>]*data-forge-type="body"[^>]*>No status information available.<\/p>/);
assert.doesNotMatch(analyticalDocument,/No pills configured/);
for(const label of ['Forecast records','Estimated amount'])assert.match(analyticalDocument,new RegExp(`<dt[^>]*data-forge-type="metadata"[^>]*>${label}</dt><dd[^>]*data-forge-type="body"[^>]*>No KPI value available.</dd>`),'Unavailable document metrics retain a labeled value');
const explicitStackSource={title:'Explicit stack',viewer:{appearance:'document'},blocks:[{id:'a',kind:'kpiBlock',value:1},{id:'b',kind:'kpiBlock',value:2},{id:'group',kind:'compositeBlock',layout:'stack',childBlockIds:['a','b']}]};
const explicitStack=compileGeographicReport({reportId:'explicit-stack',grammar:'report-document-v1',source:explicitStackSource});
assert.doesNotMatch(renderToStaticMarkup(<GeographicReportRuntime {...explicitStack}/>),/class="forge-report-document-metrics"/,'Explicit composite layouts remain authoritative');

const {updateReportChartTableSwitch}=await import('../../reporting/reportViewerSettings.js');
for(const value of ['true','false','']) {
 const viewer=updateReportChartTableSwitch({appearance:'document',allowChartTableSwitch:false},value);
 assert.equal(viewer.appearance,'document');
 assert.equal(viewer.allowChartTableSwitch,value===''?undefined:value==='true');
}
assert.equal(updateReportChartTableSwitch({allowChartTableSwitch:true},''),null);
assert.deepEqual(updateReportChartTableSwitch(null,'true'),{allowChartTableSwitch:true});
assert.throws(()=>updateReportChartTableSwitch({appearance:'invented'},'true'));
console.log('chart switching edits retain independent appearance and legacy defaults');

const {default:ReviewTable}=await import('../../components/dashboard/ReviewTable.jsx');
const lockedReview=renderToStaticMarkup(<ReviewTable id="locked" rows={[{name:'Example',selected:true}]} columns={[{key:'name',label:'Item'}]} disabled showDownload={false}/>);
assert.match(lockedReview,/<input[^>]*disabled/);
assert.doesNotMatch(lockedReview,/Download CSV/);
console.log('shared resolved review disables native selection without introducing an export action');
