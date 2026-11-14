import React, {useEffect, useMemo, useRef, useState} from 'react';
import Button from '../../components/Button.jsx';
import Icon from '../../components/Icon.jsx';
import SelectControl from '../../components/SelectControl.jsx';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import {componentCatalog, componentFamilies, referenceComponents, filterCatalog, findComponent} from './componentCatalog.js';
import CatalogExample from './CatalogExamples.jsx';
import FoundationSpecimen from './FoundationSpecimen.jsx';
import ChartSpecimen from './ChartSpecimen.jsx';
import exampleSource from './CatalogExamples.jsx?raw';
import './componentCatalog.css';

const kindLabel={component:'Existing component',recipe:'Composition recipe',gap:'Implementation gap'};
const usageExamples={
 'link':`<a href="/documents" style={{color:'var(--forge-interaction-color)'}}>\n  Open documents\n</a>`,
 'button-group':`import {ButtonGroup} from '@blueprintjs/core';\nimport {Button} from 'forge/components';\n\n<ButtonGroup role="group" aria-label="Document actions"\n  style={{gap:'var(--forge-spacing-2)', flexWrap:'wrap'}}>\n  <Button variant="secondary" onClick={copy}>Copy</Button>\n  <Button variant="secondary" onClick={duplicate}>Duplicate</Button>\n  <Button variant="secondary" onClick={save}>Save</Button>\n</ButtonGroup>`,
 'button':`import {Button} from 'forge/components';\n\n<Button variant="primary" onClick={save}>\n  Save changes\n</Button>\n\n<Button variant="primary" loading={saving}>\n  Save changes\n</Button>`,
 'icon-button':`import {Button} from 'forge/components';\n\n<Button variant="ghost" icon="lucide:plus" hideLabel\n  aria-label="Create document" onClick={createDocument}/>\n\n// Small icon button uses the existing compact API.\n<Button variant="ghost" size="compact" icon="lucide:plus" hideLabel\n  aria-label="Create document" onClick={createDocument}/>`,
 'icon':`import {Icon} from 'forge/components';\n\n<Icon name="lucide:search" label="Search"/>\n<Icon name="lucide:check"/> // decorative beside a label`,
 'status-chip':`import {StatusChip} from 'forge/components';\n\n<StatusChip tone="success">Ready</StatusChip>`,
 'badge':`import {CountBadge} from 'forge/components';\n\n<span>Messages <CountBadge count={132} max={99}/></span>`,
 'selector':`import {SelectControl} from 'forge/components';\n\n<label>Team\n  <SelectControl value={team} onChange={e => setTeam(e.target.value)}>\n    <option value="design">Design</option>\n    <option value="engineering">Engineering</option>\n  </SelectControl>\n</label>`,
 'popover':`import {Popover, Button} from 'forge/components';\n\n<Popover content={<p>Supporting information</p>}>\n  <Button variant="secondary">Open details</Button>\n</Popover>`,
 'dropdown-menu':`import {DropdownMenu, Button, Icon} from 'forge/components';\nimport {Menu, MenuItem} from '@blueprintjs/core';\n\n<DropdownMenu content={<Menu>\n  <MenuItem text="Open document" onClick={openDocument}/>\n  <MenuItem text="Duplicate" onClick={duplicateDocument}/>\n</Menu>}>\n  <Button variant="secondary">Actions<Icon name="lucide:chevron-down"/></Button>\n</DropdownMenu>`,
 'more-menu':`import {DropdownMenu, Button} from 'forge/components';\nimport {Menu, MenuItem} from '@blueprintjs/core';\n\n<DropdownMenu content={<Menu aria-label="Document actions">\n  <MenuItem text="Open document" onClick={openDocument}/>\n  <MenuItem text="Duplicate" onClick={duplicateDocument}/>\n</Menu>}>\n  <Button variant="ghost" icon="lucide:ellipsis" hideLabel\n    aria-label="More document actions"/>\n</DropdownMenu>`,
 'section':`import {SectionPattern} from 'forge/patterns';\n\n<SectionPattern title="Project details" appearance="quiet" collapsible>\n  <p>Document content</p>\n</SectionPattern>`,
 'heading':`import {Typography} from 'forge/components';\n\n<Typography as="h1" typeRole="title">Document title</Typography>\n<Typography as="h2" typeRole="section">Project details</Typography>`,
 'text':`import {Typography} from 'forge/components';\n\n<Typography as="p" typeRole="body">Readable supporting text.</Typography>\n<Typography typeRole="caption">Updated today</Typography>`,
 'avatar':`import {Avatar} from 'forge/components';\n\n<span role="img" aria-label="Assistant avatar">\n  <Avatar role="assistant" />\n</span>`,
 'filter-chips':`import {FilterChips} from 'forge/components';\n\n<FilterChips aria-label="Teams" value={selected}\n  options={[{value:'design', label:'Design', count:24}]}\n  onChange={setSelected}/>`,
 'toggle-button':`import {Button} from 'forge/components';\n\n<Button variant={enabled ? 'primary' : 'ghost'}\n  aria-pressed={enabled} icon="lucide:bell"\n  disabled={disabled} onClick={() => setEnabled(!enabled)}>\n  Notifications\n</Button>\n\n// Omit icon for text only, or use hideLabel and aria-label for icon only.`,
 'toolbar':`import {Button, DropdownMenu, Icon} from 'forge/components';\nimport {InputGroup} from '@blueprintjs/core';\n\n<div className="toolbar-container" role="group" aria-label="Document toolbar">\n  <div className="toolbar-left">\n    <Button variant="primary" onClick={createDocument}>New document</Button>\n    <DropdownMenu content={actionsMenu}>\n      <Button variant="secondary">Actions<Icon name="lucide:chevron-down"/></Button>\n    </DropdownMenu>\n  </div>\n  <div className="toolbar-right">\n    <Button variant="ghost" icon="lucide:star" hideLabel\n      aria-label="Saved views" onClick={openSavedViews}/>\n    <Button variant="ghost" icon="lucide:sliders-horizontal" hideLabel\n      aria-label="View options" onClick={openViewOptions}/>\n    <Button variant="ghost" icon="lucide:funnel" hideLabel\n      aria-label="Filters" onClick={openFilters}/>\n    <InputGroup data-forge-part="input" size="large" type="search" aria-label="Search documents"\n      placeholder="Search documents" leftElement={<Icon name="lucide:search" className="bp6-icon"/>}\n      value={query} onChange={event => setQuery(event.target.value)}/>\n  </div>\n</div>`,
};
const apiEntries={
 'button':[['variant','primary | secondary | ghost | link | danger','Select the semantic action appearance.'],['size','default','Use the standard shared control geometry.'],['disabled','boolean','Prevent activation.'],['loading','boolean','Expose aria-busy and prevent repeat activation.'],['readOnly','boolean','Keep an action unavailable without changing its callback.'],['icon','lucide: name','Use an icon from the shared finite registry.'],['hideLabel','boolean','Render an icon-only target; provide an accessible name.'],['onClick','function','Run the action after activation.']],
 'icon-button':[['variant','primary | secondary | ghost | danger','Select the semantic action appearance.'],['icon','lucide: name','Choose a registered glyph.'],['aria-label','string','Required meaningful action name.'],['hideLabel','true','Show the glyph without visible button text.'],['size','default | compact','Default matches Button; compact is the Small icon size.']],
 'toggle-button':[['variant','secondary | ghost when off; primary when on','Choose the off appearance while retaining a visible selected state.'],['aria-pressed','boolean','Expose the persistent setting state.'],['icon','lucide: name; optional','Add a decorative glyph beside the stable label.'],['hideLabel','boolean','Use an icon-only toggle with an aria-label.'],['disabled','boolean','Prevent changes while retaining the current value.'],['onClick','function','Toggle the controlled state.']],
 'status-chip':[['tone','neutral | info | success | warning | danger','Choose the meaning of the written state.'],['children','React node','Provide a concise status label.']],
 'badge':[['count','number','The tally, normalized to a nonnegative integer.'],['max','number; default 99','Above this value, display the maximum with a plus sign.']],
 'icon':[['name','registered lucide: name','The finite shared icon identifier.'],['label','string; optional','Name an informative icon. Omit for decoration.']],
 'section':[['title','string','Name the section.'],['appearance','primary | quiet','Select the supported surface appearance.'],['contentInset','flush; optional','Let composition control its own content inset.'],['collapsible','boolean','Expose a keyboard-operable disclosure.']],
 'selector':[['value','string','The currently selected value.'],['onChange','native change event','Read the next value from event.target.value.'],['disabled','boolean','Retain native disabled semantics.'],['children','option elements','Provide genuine native options.']],
 'popover':[['content','React node','The contextual content.'],['children','trigger element','An operable trigger with a meaningful name.'],['position','Blueprint placement','Request placement; existing constraints keep it in view.']],
};
const AnatomyDescriptions={
 'Container':'The boundary of the component and its interactive or visual target.',
 'Interactive container':'The native button target; it owns focus, activation and disabled state.',
 'Action label':'A stable, concise verb phrase naming the result.',
 'Optional leading icon':'A decorative shared glyph that reinforces the action.',
 'Loading indicator':'A busy cue displayed while repeated activation is unavailable.',
 'Label':'A visible name associated with the control or content.',
 'Control':'The native or shared element that accepts the value.',
 'Helper text':'Supporting guidance associated with the field.',
 'Validation message':'An actionable explanation associated with an invalid field.',
 'Trigger':'The named control that opens the contextual surface.',
 'Panel':'The surface containing the related content or options.',
 'Items':'The individual choices or commands in their reading order.',
 'Optional divider':'A quiet separator between meaningful groups.',
 'Title':'The visible name of the task or surface.',
 'Dismiss control':'An available action that closes the surface.',
 'Selection indicator':'The visible reflection of the actual selected, checked or pressed value.',

 'Group container':'Associates related actions and separates them with the semantic spacing role. Each button retains its own border and corner radius.',
 'Individual actions':'Each action retains its own accessible name, availability and callback.',
 'Group orientation':'Changes arrangement while preserving document and focus order.',
 'Shared glyph':'A registered icon using the shared size and current text color.',
 'Accessible action name':'Names the action for assistive technology when the visual label is hidden.',
 'Anchor destination':'A genuine href identifies where navigation goes.',
 'Descriptive label':'Names the destination without relying on surrounding text.',
 'Optional external indicator':'Signals when a destination opens a different context.',
 'Named Ghost Icon Button trigger':'A Ghost Icon Button with an object-specific accessible name, the default Button height, and the shared interaction states.',
 'Action menu':'An anchored list of commands that apply to the current object.',
 'Enabled and disabled items':'Unavailable commands remain legible while preventing activation.',
 'Named choice group':'Names the relationship between the available values.',
 'Options':'Each option represents one selectable value.',
 'Stable setting label':'Names the setting independently from whether it is enabled.',
 'Pressed state':'Exposes the persistent selection with aria-pressed.',
 'Selection mode':'Determines whether choosing another value replaces or adds to the selection.',
 'Task context':'Identifies the document, object or selection affected by nearby actions.',
 'Left action container':'Keeps the Primary Button and Actions dropdown together at the start of the toolbar.',
 'Actions dropdown':'Groups contextual commands behind a text trigger with a trailing chevron.',
 'Right utility container':'Aligns the three Ghost Icon Buttons and search field at the trailing edge.',
 'Ghost icon actions':'Named controls for saved views, view options and filters, using shared default-size Ghost Icon Buttons.',
 'Search field':'An accessible search input with a leading search icon; the consuming screen owns the result set.',
 'Related action groups':'Keep related controls together without combining unrelated tasks.',
 'Primary action':'The most important completion action in this decision area.',
 'Draft input':'Preserves the message being written until it is accepted or explicitly cleared.',
 'Attachment area':'Shows selected files and their current preparation or transfer state.',
 'Tool controls':'Expose supported request configuration near the draft.',
 'Send or stop action':'Sends an available draft or interrupts an active response.',
 'Shortcut guidance':'Explains the actual send and newline key behavior.',
 'Conversation thread':'Maintains the chronological reading order of the conversation.',
 'Message sequence':'Keeps each author and message associated with its supporting context.',
 'Composer':'Keeps draft entry close to the conversation it will continue.',
 'Optional context region':'Contains supporting material without interrupting the thread.',
 'Author identity':'Names or identifies the speaker independently from bubble color.',
 'Message body':'Preserves the complete authored message and its supported formatting.',
 'Message actions':'Operate on this message, with names that explain each result.',
 'Metadata':'Provides subordinate context such as origin or time.',
 'Author label':'A written name or role identifies who produced the message.',
 'Machine-readable timestamp':'A time element retains the exact datetime behind its visible label.',
 'Optional model context':'Reports known model context without inventing missing information.',
 'Event indicator':'Reinforces the written system event without replacing it.',
 'Event description':'Explains what changed and its effect on the conversation.',
 'Optional recovery action':'Offers a relevant next step when the current operation cannot continue.',
 'Operation summary':'Names the tool operation in concise, readable terms.',
 'Status label':'States whether work is running, complete or failed.',
 'Disclosure trigger':'Exposes expanded state and controls the supporting result region.',
 'Detailed result':'Keeps useful operation output available without overwhelming the summary.',
 'Card surface':'Groups one coherent object using shared surface and boundary roles.',
 'Content heading':'Names the object or subject contained within the card.',
 'Supporting content':'Provides the details needed to understand the primary content.',
 'Optional actions':'Apply only to the object or content in this container.',
 'Slide viewport':'Shows the current item without losing the collection relationship.',
 'Current slide':'Contains the active item and a readable position in the collection.',
 'Previous and next controls':'Move one item while respecting the collection behavior.',
 'Position controls':'Offer direct navigation and identify the current position.',
 'Card link':'Gives the whole card one unambiguous navigation destination.',
 'Destination heading':'Names the page or object the link will open.',
 'Supporting description':'Adds distinguishing context without becoming another action.',
 'Native choice control':'Retains real checkbox or radio semantics and keyboard behavior.',
 'Option title':'Provides the main label for the selectable value.',
 'Option description':'Explains a meaningful difference between choices.',
 'Identity shape':'Reserves a consistent, compact area for the identity mark.',
 'Role or identity mark':'Represents the person or agent without carrying status on its own.',
 'Accessible identity':'Provides the same identity through text or an accessible name.',
 'Overflow count':'Explains how many additional values or participants are not shown.',
 'Quoted text':'Contains the actual material being quoted.',
 'Optional attribution':'Names the source of the quotation.',
 'Citation marker':'Connects a particular statement to its supporting source.',
 'Source title':'Describes the supporting document so its destination is understandable.',
 'Source destination':'Points directly to the material supporting the claim.',
 'Code region':'Preserves the complete source text and indentation.',
 'Preserved indentation':'Keeps multiline code readable and copyable.',
 'Optional copy action':'Copies the actual displayed source and confirms the result.',
 'Condition icon':'Reinforces the empty or failed state without replacing written guidance.',
 'Explanation heading':'Names the actual condition, such as no results or failed loading.',
 'Supporting guidance':'Explains why content is absent or what the user can do next.',
 'Recovery action':'Offers a useful response to this particular state.',
 'Semantic heading level':'Contributes to the document outline independently from visual size.',
 'Visual type role':'Selects the shared typography metrics for the intended hierarchy.',
 'Media frame':'Reserves the intended dimensions and crop for a visual asset.',
 'Alternative description':'Describes meaningful visual content when the image cannot be seen.',
 'Elapsed duration':'Reports time since the operation or timer started.',
 'Start or pause action':'Changes the timer state without losing its elapsed value.',
 'Reset action':'Stops the timer and explicitly clears its accumulated duration.',
 'Visible time label':'Formats the moment for readable display.',
 'Exact datetime':'Preserves the unambiguous underlying instant in machine-readable form.',
 'Time-zone context':'Explains which local time or offset the displayed value uses.',
 'Optional removal action':'Removes this value and names the value in its accessible label.',
 'Numeric tally':'Shows how many items the adjacent label refers to.',
 'Overflow representation':'Abbreviates a large tally at the configured display maximum.',
 'Status message':'Explains the condition and its relevant consequence.',
 'Named help trigger':'Provides an operable, named route to optional explanation.',
 'Explanation panel':'Contains supporting help near the control it describes.',
 'Track':'Represents the full setting range or amount of work.',
 'Completed value':'Represents completed work relative to its maximum.',
 'Operation label':'Names the task being measured or loaded.',
 'Maximum value':'Defines the complete amount of measurable work.',
 'Loading announcement':'Provides one concise explanation that content is still loading.',
 'Written status label':'Names the state independently from its semantic color.',
 'Semantic tone':'Selects meaning such as information, success, warning or danger.',
 'Filter group label':'Names the collection or attribute being filtered.',
 'Optional counts':'Report the number of records associated with each filter.',
 'Month heading':'Identifies the calendar month currently in view.',
 'Month navigation':'Changes the visible month without selecting a day.',
 'Weekday headings':'Label the weekday relationships of the date grid.',
 'Day grid':'Organizes available dates in calendar order.',
 'Selected date':'Identifies the committed day independently from hover or focus.',
 'Field label':'Provides a visible name associated with its input.',
 'Required indicator':'Explains that a value is needed before the task can complete.',
 'Period trigger':'Summarizes the currently committed date range.',
 'Preset choices':'Offer named ranges with a clear start and end.',
 'Start date':'Defines the first day included in a range.',
 'End date':'Defines the last day included in a range.',
 'Apply action':'Commits the complete, valid draft range together.',
 'Selected filenames':'Confirm which local files were selected without implying upload success.',
 'Selected values':'Remain visible while the query or available options change.',
 'Removal controls':'Allow one selected value to be removed without clearing the others.',
 'Unit or bounds':'Explain the quantity, step and allowed range.',
 'Search query':'Keeps the current search text visible and editable.',
 'Matching results':'Reflect the current query and supported scope.',
 'Zero-results guidance':'Preserves the query and explains how to broaden the search.',
 'Group legend':'Names a group of related native choices.',
 'Thumb':'Represents the current value or setting on its track.',
 'Current value':'Reports the actual committed value in readable terms.',
 'Bounds labels':'Explain the minimum and maximum values and their units.',
 'Resize affordance':'Allows the text area to grow without altering the entered content.',
 'Query':'The text being searched, which can differ from the committed value.',
 'Suggestion list':'Contains the choices matching the current query.',
 'Committed value':'The choice accepted by the user, separate from a highlighted suggestion.',
 'Modal surface':'Contains the focused task while interaction with the background is blocked.',
 'Visible title':'Names the dialog or drawer for both visual and accessible context.',
 'Task content':'Contains the information and controls needed for the focused task.',
 'Completion actions':'Complete or cancel the task while preserving a clear outcome.',
 'Dismiss action':'Closes the surface and returns to the triggering context.',
 'Backdrop':'Separates a modal task from the background it temporarily blocks.',
 'Scrollable body':'Keeps long content reachable while the surface remains within the viewport.',
 'Selected panel':'Contains the content associated with the currently selected tab.',
 'Named dialog':'Associates the modal surface with its readable title.',
 'Command results':'Lists available commands matching the current query.',
 'Command actions':'Run only after an explicit accepted selection.',
 'Column headers':'Identify the values and supported sort control in each column.',
 'Data rows':'Keep the values for one record together.',
 'Cells':'Retain the relationship between a record and its column header.',
 'Sorting controls':'Expose the current order and allow a deliberate order change.',
 'Optional row selection':'Lets users explicitly select records for contextual actions.',
 'Selected-count label':'Reports how many records the available actions will affect.',
 'Clear action':'Removes the selection without changing the records.',
 'Branches':'Group descendants under an expandable parent.',
 'Leaves':'Represent terminal items in the hierarchy.',
 'Accessible text':'Adds meaningful context to the accessible name or description.',
 'Visual hiding rule':'Keeps text available to assistive technology without taking visual space.',
 'Optional focus reveal':'Makes a hidden focusable control visible when a keyboard user reaches it.',
};
// Read the existing loaded theme; never create or flatten a second token source.
export function readSemanticTheme(element, names=[]) {
 const view=element.ownerDocument.defaultView;
 const declarations={}, ancestors=[];
 for(let node=element;node;node=node.parentElement)ancestors.unshift(node);
 const inspect=(rules,node)=>{
  for(const rule of rules){
   if(rule.style&&rule.selectorText){
    let matches=false;try{matches=node.matches(rule.selectorText);}catch{continue;}
    if(matches)for(let index=0;index<rule.style.length;index++){
     const property=rule.style.item(index);
     if(property.startsWith('--'))declarations[property]=rule.style.getPropertyValue(property).trim();
    }
   }else if(rule.cssRules){
    if(rule.media?.mediaText&&view.matchMedia&&!view.matchMedia(rule.media.mediaText).matches)continue;
    if(rule.conditionText&&rule.constructor.name==='CSSSupportsRule'&&view.CSS?.supports&&!view.CSS.supports(rule.conditionText))continue;
    inspect(rule.cssRules,node);
   }
  }
 };
 for(const node of ancestors)for(const sheet of element.ownerDocument.styleSheets){
  // External sheets may be unreadable; the local workspace theme is same-origin.
  let rules;try{rules=sheet.cssRules;}catch{continue;}
  inspect(rules,node);
 }
 const isSemantic=name=>/-semantic-/.test(name);
 const sources=(name,seen=new Set())=>{
  if(isSemantic(name))return [name];
  if(seen.has(name))return [];seen.add(name);
  return [...new Set([...String(declarations[name]||'').matchAll(/var\(\s*(--[\w-]+)/g)].flatMap(match=>sources(match[1],new Set(seen))))];
 };
 const computed=view.getComputedStyle(element);
 const bindings=Object.fromEntries(names.map(name=>[name,sources(`--forge-${name}`)]));
 return {
  values:Object.fromEntries(names.map(name=>[name,computed.getPropertyValue(`--forge-${name}`).trim()])),
  bindings,
  semantic:Object.keys(declarations).filter(isSemantic).sort().map(name=>({name,value:computed.getPropertyValue(name).trim(),roles:names.filter(role=>bindings[role].includes(name))})),
 };
}
function useResolvedTokens(names,mode,previewKey=''){
 const ref=useRef(null),[snapshot,setSnapshot]=useState({values:{},bindings:{},semantic:[]});
 useEffect(()=>{if(!ref.current)return;const target=previewKey?ref.current.querySelector('[data-example-id] .forge-button')||ref.current:ref.current;setSnapshot(readSemanticTheme(target,names));},[names.join('|'),mode,previewKey]);
 return [ref,snapshot.values,snapshot.bindings,snapshot.semantic];
}
function CopyButton({value,label='Copy source'}){
 const [copied,setCopied]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{if(!copied)return;const timer=setTimeout(()=>setCopied(false),2000);return()=>clearTimeout(timer);},[copied]);
 return <span className="catalog-row"><Button variant="ghost" icon="lucide:copy" onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setError(false);}catch{setError(true);}}}>{copied?'Copied':label}</Button>{error&&<span role="status">Select and copy the source below.</span>}</span>;
}
function ComponentPage({spec,mode}){
 const [variant,setVariant]=useState(spec.variants[0]),[state,setState]=useState('Default'),[iconSize,setIconSize]=useState('default'),[activeTab,setActiveTab]=useState('overview');
 const [previewWidth,setPreviewWidth]=useState('full');
 const [tokenRef,values,bindings]=useResolvedTokens(spec.tokens,mode,['button','icon-button','button-group','more-menu','toggle-button'].includes(spec.id)?`${variant}:${state}:${iconSize}`:'');
 const source=usageExamples[spec.id];
 const previewExample=<CatalogExample key={`${spec.id}:${variant}:${state}:${iconSize}`} spec={spec} variant={variant} state={state} iconSize={iconSize}/>;
 useEffect(()=>{setVariant(spec.variants[0]);setState('Default');setIconSize('default');setActiveTab('overview');setPreviewWidth('full');},[spec.id]);
 const examples=spec.variants;
 return <article className="catalog-detail" ref={tokenRef}>
   <a href={`#category/${spec.family}`} className="catalog-back"><Icon name="lucide:arrow-left"/>{componentFamilies.find(f=>f.id===spec.family)?.name}</a>
   <header className="catalog-detail-header"><div className="catalog-row"><h1>{spec.name}</h1><span className={`catalog-kind ${spec.kind==='gap'?'is-gap':''}`}>{spec.deprecated?'Deprecated reference pattern':kindLabel[spec.kind]}</span></div><p>{spec.description}</p><span className="catalog-implementation">{spec.implementation}</span></header>
   <nav className="catalog-detail-tabs" aria-label="Component documentation">{[['overview','Overview'],['examples','Examples'],['anatomy','Anatomy'],['usage','Usage'],['behavior','Behavior'],['accessibility','Accessibility'],['variables','Variables']].map(([id,label])=><button type="button" key={id} aria-current={activeTab===id?'location':undefined} onClick={()=>{setActiveTab(id);document.getElementById(`component-${id}`)?.scrollIntoView({behavior:'instant',block:'start'});}}>{label}</button>)}</nav>
   <section id="component-overview" className="catalog-doc-section"><h2>Interactive preview</h2><div className="catalog-playground-controls"><label>Variant<SelectControl aria-label="Preview variant" value={variant} onChange={e=>setVariant(e.target.value)}>{spec.variants.map(v=><option key={v}>{v}</option>)}</SelectControl></label><label>State<SelectControl aria-label="Preview state" value={state} onChange={e=>setState(e.target.value)}>{spec.states.map(v=><option key={v}>{v}</option>)}</SelectControl></label>{spec.id==='icon-button'&&<label>Size<SelectControl aria-label="Preview size" value={iconSize} onChange={event=>setIconSize(event.target.value)}><option value="default">Default</option><option value="small">Small</option></SelectControl></label>}</div>
     {['charts','metrics'].includes(spec.id)&&<label className="catalog-analysis-width">Preview context<SelectControl aria-label="Preview context" value={previewWidth} onChange={event=>setPreviewWidth(event.target.value)}><option value="full">Report · full width</option><option value="560">Split view · 560px</option><option value="320">Chat · 320px</option></SelectControl></label>}
     <div className={`catalog-preview catalog-preview--detail ${spec.kind==='gap'?'has-gap':''}`} data-example-id={spec.id}>{['charts','metrics'].includes(spec.id)?<div className="catalog-preview-content" style={{width:'100%',minWidth:0,maxWidth:previewWidth==='full'?undefined:`${previewWidth}px`}}>{previewExample}</div>:previewExample}</div>
     <p className="catalog-caption">Try the controls directly. Hover, keyboard focus and pressed feedback come from the underlying component. The preview uses the selected {mode} semantic values.</p>
     {spec.kind==='gap'&&<div className="catalog-gap-note"><strong>Remaining shared implementation</strong><p>{spec.usage} This entry records the required coverage and the closest existing implementation; it is not a completed replacement.</p></div>}
     {source&&<div className="catalog-code-block"><div className="catalog-code-heading"><span>Usage example</span><CopyButton value={source}/></div><pre><code>{source}</code></pre></div>}
   </section>
   <section id="component-examples" className="catalog-doc-section"><h2>Variants</h2><p>Compare every documented configuration using the same semantic roles.</p><div className="catalog-variant-grid">{examples.map(v=><div className="catalog-variant" key={v}><h3>{v}</h3><div className="catalog-preview catalog-preview--variant"><CatalogExample spec={spec} variant={v} iconSize={iconSize} thumbnail/></div></div>)}</div>
     {spec.id==='drawer'&&<><h2 className="catalog-subsection">Examples using the 360px drawer</h2><p>These layouts reuse the same drawer size and shared controls.</p><div className="catalog-variant-grid">{['Customize view','Filter view','Condition filter'].map(example=><div className="catalog-variant" key={example}><h3>{example}</h3><div className="catalog-preview catalog-preview--variant"><CatalogExample spec={spec} variant={example} thumbnail/></div></div>)}</div></>}
     {spec.id==='icon-button'&&<><h2 className="catalog-subsection">Sizes</h2><p>Default matches the regular button height. Small uses the smaller semantic target; the icon glyph stays consistent.</p><div className="catalog-variant-grid"><div className="catalog-variant"><h3>Default · same height as Button</h3><div className="catalog-preview catalog-preview--variant"><div className="catalog-row"><CatalogExample spec={findComponent('button')} variant={variant} thumbnail/><CatalogExample spec={spec} variant={variant} iconSize="default" thumbnail/></div></div></div><div className="catalog-variant"><h3>Small</h3><div className="catalog-preview catalog-preview--variant"><CatalogExample spec={spec} variant={variant} iconSize="small" thumbnail/></div></div></div></>}
     <h2 className="catalog-subsection">States</h2><div className="catalog-state-grid">{spec.states.map(s=><div className="catalog-variant" key={s}><h3>{s}</h3><div className="catalog-preview catalog-preview--variant"><CatalogExample spec={spec} variant={variant} state={s} iconSize={iconSize} thumbnail/></div></div>)}</div>
     <div className="catalog-interaction-note"><Icon name="lucide:eye"/><p>For interactive components, move the pointer onto the preview to inspect hover, use Tab to inspect focus, and activate with the documented keys to inspect pressed or selected feedback.</p></div>
   </section>
   <section id="component-anatomy" className="catalog-doc-section"><h2>Anatomy</h2><p>Parts retain these responsibilities across variants and presentation modes.</p><dl className="catalog-anatomy">{spec.anatomy.map((part,index)=><div key={part}><dt><span>{index+1}</span>{part}</dt>{AnatomyDescriptions[part]&&<dd>{AnatomyDescriptions[part]}</dd>}</div>)}</dl></section>
   <section id="component-usage" className="catalog-doc-section"><h2>Usage and best practices</h2><div className="catalog-practices"><div><h3><Icon name="lucide:check"/>Recommended</h3><p>{spec.usage}</p><p>{spec.responsive}</p></div><div><h3><Icon name="lucide:x"/>Avoid</h3><p>{spec.avoid}</p></div></div>{apiEntries[spec.id]?<><h3 className="catalog-subsection">Component API</h3><div className="catalog-table-scroll"><table className="catalog-props"><thead><tr><th scope="col">Property</th><th scope="col">Values</th><th scope="col">Purpose</th></tr></thead><tbody>{apiEntries[spec.id].map(([name,type,description])=><tr key={name}><th scope="row"><code>{name}</code></th><td>{type}</td><td>{description}</td></tr>)}</tbody></table></div></>:<p className="catalog-caption">Implementation: {spec.implementation}. This page documents the actual component or the named composition; it does not introduce another package API.</p>}
     <details className="catalog-source"><summary>View complete local example source</summary><CopyButton value={exampleSource}/><pre><code>{exampleSource}</code></pre></details>
   </section>
   <section id="component-behavior" className="catalog-doc-section"><h2>Interactions and behavior</h2><ul>{spec.behavior.map(text=><li key={text}>{text}</li>)}</ul><h3>Responsive behavior</h3><p>{spec.responsive}</p></section>
   <section id="component-accessibility" className="catalog-doc-section"><h2>Accessibility</h2><p>{spec.accessibility}</p><h3>Keyboard interaction</h3><dl className="catalog-keyboard">{spec.keyboard.map(([key,action])=><div key={key}><dt><kbd>{key}</kbd></dt><dd>{action}</dd></div>)}</dl><p>Light and dark modes retain the same content, anatomy, dimensions and keyboard behavior. Reduced motion preserves state feedback without unnecessary movement.</p></section>
   <section id="component-variables" className="catalog-doc-section"><h2>Semantic variables</h2><p>These renderer roles are bound to your loaded semantic collection. The source variable and its resolved value stay visible together. Button bindings follow the selected variant and state.</p><div className="catalog-table-scroll"><table className="catalog-props"><thead><tr><th scope="col">Renderer role</th><th scope="col">Your semantic collection</th><th scope="col">Current {mode} value</th></tr></thead><tbody>{spec.tokens.map(token=><tr key={token}><th scope="row"><code>--forge-{token}</code></th><td>{bindings[token]?.length?bindings[token].map(name=><code className="catalog-semantic-source" key={name}>{name}</code>):<span className="catalog-muted">Shared behavior or host role</span>}</td><td><code>{values[token]||(bindings[token]?.length?'Unresolved':'Inherited from the host theme')}</code></td></tr>)}</tbody></table></div></section>
   <footer className="catalog-detail-footer"><span>{spec.name} · Shared design system</span><a href="#components">Back to all components</a></footer>
 </article>;
}
function TokensPage({mode}){
 const [query,setQuery]=useState(''),names=useMemo(()=>[...new Set(componentCatalog.flatMap(item=>item.tokens))].sort(),[]),[ref,, ,semantic]=useResolvedTokens(names,mode);
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const visible=semantic.filter(item=>words.every(word=>[item.name,item.value,...item.roles].join(' ').toLowerCase().includes(word)));
 return <div className="catalog-tokens" ref={ref}><h1>Semantic collection</h1><p>Variables read directly from the loaded semantic collection in {mode} mode. Shared renderer aliases point to these values; they are not a separate palette.</p><InputSearch label="Search variables" value={query} onChange={setQuery}/><p className="catalog-caption" role="status">{visible.length} of {semantic.length} loaded semantic variables</p><div className="catalog-token-grid">{visible.map(item=><article key={item.name}><span className="catalog-token-swatch" style={{background:/^(#|rgb|hsl|oklch|color)/i.test(item.value)?`var(${item.name})`:'var(--forge-surface-subtle)'}} aria-hidden="true"/><code>{item.name}</code><span>{item.value||'Unresolved'}</span>{item.roles.length>0&&<span className="catalog-token-bindings">Used by {item.roles.map(role=>`--forge-${role}`).join(', ')}</span>}</article>)}</div></div>;
}
function InputSearch({value,onChange,label='Search components'}){return <label className="catalog-search"><span className="catalog-sr-only">{label}</span><Icon name="lucide:search"/><input type="search" aria-label={label} value={value} placeholder={`${label}…`} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={()=>onChange('')}><Icon name="lucide:x"/></button>}</label>;}
function GuidelinesPage(){return <article className="catalog-guidelines"><h1>Using the shared system</h1><p>One library for reusable appearance and behavior across product workspaces.</p>{[
 ['Start with meaning','Choose a component for its interaction purpose. Use buttons for actions, links for destinations, status labels for state, and count badges for numeric tallies.'],
 ['Use semantic variables','Build on surface, text, interaction, feedback, typography and geometry roles. Keep palette values and font assets in the theme source.'],
 ['Compose existing components','Use the existing Forge implementation and the documented compositions. Keep business content, producer metadata and product decisions with their owners.'],
 ['Review the whole interaction','Check default, hover, focus, pressed, selected, loading, disabled, read-only, invalid and empty behavior where applicable. Test real keyboard and pointer input.'],
 ['Keep both modes aligned','Light and dark are presentation modes. Preserve content, anatomy, spacing, typography metrics and behavior when switching modes.'],
 ['Treat accessibility as component behavior','Name every control, keep focus visible, associate labels and errors, retain native semantics and verify dismissal and focus restoration.'],
 ['Release and adopt deliberately','A local catalog is review evidence. Shared component changes require a versioned Forge release and verification in the consuming products before adoption can be called complete.'],
 ].map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}</article>;}

export default function ComponentCatalog({route='components',mode='light',onModeChange,themeLabel='Shared design system'}){
 const [query,setQuery]=useState(''),[mobileOpen,setMobileOpen]=useState(false);
 const segments=route.split('/'),family=segments[0]==='category'?segments[1]:'all',spec=segments[0]==='components'&&segments[1]?findComponent(segments[1]):null;
 const visible=filterCatalog(query,family),sidebarItems=filterCatalog(query),activeFamily=componentFamilies.find(f=>f.id===family);
 useEffect(()=>{setMobileOpen(false);const frame=requestAnimationFrame(()=>{if(route.startsWith('foundation-'))document.getElementById(route)?.scrollIntoView({block:'start'});else window.scrollTo({top:0,behavior:'instant'});});document.title=spec?`${spec.name} · Shared design system`:'Shared design system · Component library';return()=>cancelAnimationFrame(frame);},[route]);
 return <ForgeThemeProvider themeId="design-system-2" mode={mode}><ForgeThemeBoundary windowKey="design-system-2-library"><div className="catalog-app">
   <a href="#catalog-main" className="catalog-skip-link" onClick={event=>{event.preventDefault();document.getElementById('catalog-main')?.focus();}}>Skip to library content</a>
   <header className="catalog-topbar"><a className="catalog-brand" href="#components"><span className="catalog-brand-mark"><Icon name="lucide:layers"/></span><span>Design system</span></a><nav aria-label="Library sections"><a href="#components" aria-current={segments[0]==='components'||segments[0]==='category'?'page':undefined}>Components</a><a href="#foundations" aria-current={route==='foundations'||route.startsWith('foundation-')?'page':undefined}>Foundations</a><a href="#variables" aria-current={route==='variables'?'page':undefined}>Variables</a><a href="#guidelines" aria-current={route==='guidelines'?'page':undefined}>Guidelines</a></nav><div className="catalog-row"><span className="catalog-local">Local library</span><Button variant="ghost" icon={mode==='light'?'lucide:circle':'lucide:palette'} hideLabel aria-label={mode==='light'?'View dark theme':'View light theme'} title={mode==='light'?'View dark theme':'View light theme'} onClick={()=>onModeChange(mode==='light'?'dark':'light')}/><Button className="catalog-mobile-toggle" variant="ghost" icon="lucide:menu" hideLabel aria-label="Toggle component navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(!mobileOpen)}/></div></header>
   <aside className={`catalog-sidebar ${mobileOpen?'is-open':''}`} aria-label="Component navigation"><InputSearch value={query} onChange={setQuery}/><a href="#components" className={`catalog-overview ${route==='components'?'is-current':''}`}>Overview <span>{componentCatalog.length}</span></a><nav aria-label="Component index">{componentFamilies.map(group=>{
     const items=sidebarItems.filter(item=>item.family===group.id);if(!items.length)return null;
     return <details key={group.id} open={!!query||family===group.id||spec?.family===group.id||group.id==='action'}><summary>{group.name}<span>{items.length}</span></summary><a className="catalog-family-link" href={`#category/${group.id}`}>Browse {group.name.toLowerCase()}</a>{items.map(item=><a key={item.id} href={item.href} aria-current={spec?.id===item.id?'page':undefined}>{item.name}{item.kind==='gap'&&<span className="catalog-gap-dot" aria-label="Implementation gap"/>}</a>)}</details>;
   })}</nav></aside>
   <main id="catalog-main" className="catalog-main" tabIndex={-1}>{spec?<ComponentPage key={spec.id} spec={spec} mode={mode}/>:route==='variables'?<TokensPage mode={mode}/>:route==='guidelines'?<GuidelinesPage/>:route==='foundations'||route.startsWith('foundation-')?<div className="catalog-foundations"><FoundationSpecimen includeDocuments={false}/><ChartSpecimen/></div>:segments[0]==='components'&&segments[1]?<div className="catalog-empty"><h1>Component not found</h1><a href="#components">Browse the library</a></div>:<div id="ds2-component-catalog"><header className="catalog-hero"><h1>{activeFamily?activeFamily.name:'Browse the library'}</h1><p>Explore components, variants and interactions.<br/>One shared language, built with our semantic variables.</p><div className="catalog-hero-links"><a href="#foundations"><Icon name="lucide:palette"/>Explore foundations</a><a href="#guidelines">Usage guidelines<Icon name="lucide:arrow-right"/></a></div></header>
     <div className="catalog-gallery-tools"><span role="status">{visible.length} {visible.length===1?'component':'components'}{query?' matching your search':activeFamily?` in ${activeFamily.name}`:' in the library'}</span><span>{referenceComponents.length} reference entries · {componentCatalog.length-referenceComponents.length} Forge additions</span></div>
     {!visible.length&&<div className="catalog-empty"><h2>No matching components</h2><p>Try a component name, variant, behavior or implementation.</p><Button variant="secondary" onClick={()=>setQuery('')}>Clear search</Button></div>}
     {componentFamilies.map(group=>{const entries=visible.filter(item=>item.family===group.id);if(!entries.length)return null;return <section className="catalog-family" key={group.id} aria-labelledby={`catalog-family-${group.id}`}><div className="catalog-family-heading"><h2 id={`catalog-family-${group.id}`}>{group.name}</h2><span>{entries.length}</span></div><div className="catalog-gallery">{entries.map(item=><article className="catalog-tile" key={item.id}><div className={`catalog-preview catalog-preview--thumbnail ${item.kind==='gap'?'has-gap':''}`} data-example-id={item.id}><CatalogExample spec={item} thumbnail/></div><a href={item.href} className="catalog-tile-label"><h3>{item.name}</h3>{item.deprecated?<span className="catalog-tile-note">Deprecated</span>:item.kind==='gap'?<span className="catalog-tile-note">Gap</span>:<Icon name="lucide:arrow-right"/>}</a></article>)}</div></section>;})}
     <footer className="catalog-footer"><span>Shared design system</span><span>Semantic variables · Light and dark · Local only</span></footer>
   </div>}</main>
 </div></ForgeThemeBoundary></ForgeThemeProvider>;
}
