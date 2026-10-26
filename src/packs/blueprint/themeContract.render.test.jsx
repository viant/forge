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
assert.match(themeCSS, /data-forge-section-appearance="primary"[^}]*> \.bp6-section-header \.bp6-heading\s*{[^}]*font-size:\s*var\(--forge-section-primary-header-font-size, var\(--forge-section-header-font-size\)\)/s);
assert.match(themeCSS, /data-forge-section-appearance="quiet"[^}]*> \.bp6-section-header \.bp6-heading\s*{[^}]*font-size:\s*var\(--forge-section-quiet-header-font-size, var\(--forge-section-header-font-size\)\)/s);
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
