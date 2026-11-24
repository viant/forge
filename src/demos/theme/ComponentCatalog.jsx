import React, {useEffect, useMemo, useRef, useState} from 'react';
import Button from '../../components/Button.jsx';
import Icon from '../../components/Icon.jsx';
import StatusChip from '../../components/StatusChip.jsx';
import SelectControl from '../../components/SelectControl.jsx';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import {componentCatalog, componentFamilies, catalogSections, catalogComponentGroups, referenceComponents, filterCatalog, findComponent} from './componentCatalog.js';
import CatalogExample,{FilterDrawerStateExample} from './CatalogExamples.jsx';
import FoundationSpecimen from './FoundationSpecimen.jsx';
import ChartSpecimen from './ChartSpecimen.jsx';
import exampleSource from './CatalogExamples.jsx?raw';
import listPageSource from './ListPageSpecimen.jsx?raw';
import tableSource from './BasicTableSpecimen.jsx?raw';
import {tableEditorStates} from './BasicTableSpecimen.jsx';
import patternSource from './PatternExamples.jsx?raw';
import fullScreenSource from './FullScreenExample.jsx?raw';
import discoverySource from './DiscoveryExamples.jsx?raw';
import './componentCatalog.css';

const kindLabel={pattern:'Pattern',component:'Existing component',recipe:'Composition recipe',gap:'Implementation gap'};
const usageExamples={
 'card-rail':`import {CardRail} from 'forge/components';\n\n<CardRail heading="Resources" value={cards} totalCount={total}\n  onClick={openResource} onTagClick={applyTag} onCountClick={showAll}/>`,
 'card-rail-group':`import {CardRailGroup, FilterChips} from 'forge/components';\n\n<FilterChips aria-label="Topics" value={selected} options={topics} onChange={setSelected}/>\n<CardRailGroup value={sections} onClick={openResource}\n  onTagClick={applyTag} onCountClick={showAll}/>`,
 'carousel':`import {ContentCarousel} from 'forge/components';\n\n<ContentCarousel value={featured} wholeSlideAction autoRotateMs={6000}\n  onClick={openCollection} aria-label="Featured collections"/>`,
 'link':`<a href="/documents" style={{color:'var(--forge-interaction-color)'}}>\n  Open documents\n</a>`,
 'button-group':`import {ButtonGroup} from '@blueprintjs/core';\nimport {Button} from 'forge/components';\n\n<ButtonGroup role="group" aria-label="Document actions"\n  style={{gap:'var(--forge-spacing-2)', flexWrap:'wrap'}}>\n  <Button variant="secondary" onClick={copy}>Copy</Button>\n  <Button variant="secondary" onClick={duplicate}>Duplicate</Button>\n  <Button variant="secondary" onClick={save}>Save</Button>\n</ButtonGroup>`,
 'button':`import {Button} from 'forge/components';\n\n<Button variant="primary" onClick={save}>\n  Save changes\n</Button>\n\n<Button variant="primary" loading={saving}>\n  Save changes\n</Button>`,
 'icon-button':`import {Button} from 'forge/components';\n\n<Button variant="ghost" icon="lucide:plus" hideLabel\n  aria-label="Create document" onClick={createDocument}/>\n\n// Small icon button uses the existing compact API.\n<Button variant="ghost" size="compact" icon="lucide:plus" hideLabel\n  aria-label="Create document" onClick={createDocument}/>`,
 'icon':`import {Icon} from 'forge/components';\n\n<Icon name="lucide:search" label="Search"/>\n<Icon name="lucide:check"/> // decorative beside a label`,
 'status-chip':`import {StatusChip} from 'forge/components';\n\nconst tones = {Active: 'success', Paused: 'warning', Archived: 'neutral'};\n<StatusChip tone={tones[status] || 'neutral'}>{status}</StatusChip>`,
 'badge':`import {CountBadge} from 'forge/components';\n\n<span>Messages <CountBadge count={132} max={99}/></span>`,
 'selector':`import {SelectControl} from 'forge/components';\n\n<label>Team\n  <SelectControl value={team} onChange={e => setTeam(e.target.value)}>\n    <option value="design">Design</option>\n    <option value="engineering">Engineering</option>\n  </SelectControl>\n</label>`,
 'popover':`import {Popover, Button} from 'forge/components';\n\n<Popover content={<p>Supporting information</p>}>\n  <Button variant="secondary">Open details</Button>\n</Popover>`,
 'dropdown-menu':`import {DropdownMenu, Button, Icon} from 'forge/components';\nimport {Menu, MenuItem} from '@blueprintjs/core';\n\n<DropdownMenu content={<Menu>\n  <MenuItem text="Open document" onClick={openDocument}/>\n  <MenuItem text="Duplicate" onClick={duplicateDocument}/>\n</Menu>}>\n  <Button variant="secondary">Actions<Icon name="lucide:chevron-down"/></Button>\n</DropdownMenu>`,
 'more-menu':`import {DropdownMenu, Button} from 'forge/components';\nimport {Menu, MenuItem} from '@blueprintjs/core';\n\n<DropdownMenu content={<Menu aria-label="Document actions">\n  <MenuItem text="Open document" onClick={openDocument}/>\n  <MenuItem text="Duplicate" onClick={duplicateDocument}/>\n</Menu>}>\n  <Button variant="ghost" icon="lucide:ellipsis" hideLabel\n    aria-label="More document actions"/>\n</DropdownMenu>`,
 'full-screen':`// Compose existing native APIs; the producer owns validation and actions.\n<Dialog className="forge-fullscreen-dialog" isOpen={open}\n  aria-labelledby="task-title" onClose={requestClose}\n  shouldReturnFocusOnClose>\n  <form className="forge-fullscreen-form" onSubmit={submitExistingForm}>\n    <header className="forge-fullscreen-header">{taskHeader}</header>\n    <ScrollArea ref={bodyRef} className="forge-fullscreen-body" onScroll={followScroll}>\n      <div className="forge-fullscreen-content">\n        <nav className="forge-fullscreen-outline" aria-label="Form sections">\n          {sectionDestinations}\n        </nav>\n        <div className="forge-fullscreen-sections">{sectionCards}</div>\n      </div>\n    </ScrollArea>\n    <footer className="forge-fullscreen-footer">{existingActions}</footer>\n  </form>\n</Dialog>`,
 'section':`import {SectionPattern} from 'forge/patterns';\n\n<SectionPattern title="Project details" appearance="quiet" collapsible>\n  <p>Document content</p>\n</SectionPattern>`,
 'heading':`import {Typography} from 'forge/components';\n\n<Typography as="h1" typeRole="title">Document title</Typography>\n<Typography as="h2" typeRole="section">Project details</Typography>`,
 'text':`import {Typography} from 'forge/components';\n\n<Typography as="p" typeRole="body">Readable supporting text.</Typography>\n<Typography typeRole="caption">Updated today</Typography>`,
 'avatar':`import {Avatar} from 'forge/components';\n\n<span role="img" aria-label="Assistant avatar">\n  <Avatar role="assistant" />\n</span>`,
 'filter-chips':`import {FilterChips, RemovableChip} from 'forge/components';\n\n// Selectable filters\n<FilterChips aria-label="Teams" value={selected}\n  options={[{value:'design', label:'Design', count:24}]}\n  onChange={setSelected}/>;\n\n// Removable Chip: an already-applied filter\n<RemovableChip category="Workspace" label="3 Selected"\n  removeLabel="Remove Workspace filter"\n  onRemove={clearWorkspaceFilter}/>;`,
 'toggle-button':`import {Button} from 'forge/components';\n\n<Button variant={enabled ? 'primary' : 'ghost'}\n  aria-pressed={enabled} icon="lucide:bell"\n  disabled={disabled} onClick={() => setEnabled(!enabled)}>\n  Notifications\n</Button>\n\n// Omit icon for text only, or use hideLabel and aria-label for icon only.`,
 'toolbar':`import {Button, DropdownMenu, Icon} from 'forge/components';\nimport {InputGroup} from '@blueprintjs/core';\n\n<div className="toolbar-container" role="group" aria-label="Document toolbar">\n  <div className="toolbar-left">\n    <Button variant="primary" onClick={createDocument}>New document</Button>\n    <DropdownMenu content={actionsMenu}>\n      <Button variant="secondary">Actions<Icon name="lucide:chevron-down"/></Button>\n    </DropdownMenu>\n  </div>\n  <div className="toolbar-right">\n    <Button variant="ghost" icon="lucide:star" hideLabel\n      aria-label="Saved views" onClick={openSavedViews}/>\n    <Button variant="ghost" icon="lucide:sliders-horizontal" hideLabel\n      aria-label="View options" onClick={openViewOptions}/>\n    <Button variant="ghost" icon="lucide:funnel" hideLabel\n      aria-label="Filters" onClick={openFilters}/>\n    <InputGroup data-forge-part="input" size="large" type="search" aria-label="Search documents"\n      placeholder="Search documents" leftElement={<Icon name="lucide:search" className="bp6-icon"/>}\n      value={query} onChange={event => setQuery(event.target.value)}/>\n  </div>\n</div>`,
};
const apiEntries={
 'card-rail':[['value','Content record array','Each card uses id, title and optional image, subtitle, copyValue/copyLabel, facts and tags.'],['heading / description / totalCount','Producer-owned collection context','Keep the authoritative count independent from the visible card slice.'],['onClick / onTagClick / onCountClick','Existing action callbacks','Opening, filtering and collection navigation remain owned by the consumer.'],['disabled / emptyText','Availability and empty copy','Keep the native unavailable arrows and empty collection message.']],
 'card-rail-group':[['value','Section array','Each declared section supplies id, heading, description, totalCount and its card value array.'],['onClick / onTagClick / onCountClick','Existing callbacks','The group preserves detail.item/detail.tag and adds detail.section.'],['disabled / emptyText','Group availability and empty copy','No alternate card renderer or query mechanism is introduced.']],
 'carousel':[['value','Slide array','Slides supply id, title, description and optional image, graphicImage and actionLabel.'],['wholeSlideAction','boolean','Use the existing main slide action without nesting its content action.'],['autoRotateMs','number; optional','A supported interval enables native pause/resume; reduced motion prevents rotation.'],['onClick / disabled','Existing action and availability','The consumer owns the destination; disabled prevents navigation.']],
 'data-state':[['container.dataStateBoundary.dataSourceRefs','Existing datasource references','Native Container metadata observes those controls and collections.'],['loadingMessage / emptyMessage / errorMessage','Authored readable copy','Keep unknown progress, no records and failed requests distinct.'],['errorAction','label, dataSourceRef, bypassCache','The native Retry action refetches through the existing datasource handler.']],
 'filter-chips':[['FilterChips.value / options','Selected values / declared choices','Use the existing selectable chip group.'],['FilterChips.onChange','function','Receives the native next selection.'],['RemovableChip.label','ReactNode','The visible applied value or caller-authored N Selected count label.'],['RemovableChip.category','string; optional','A quiet category prefix; the component adds the colon.'],['RemovableChip.onRemove','function','The existing ghost-button callback clears this category or value.'],['RemovableChip.removeLabel','string; optional','Value- or category-specific accessible name for the X.'],['disabled','boolean','Prevent selection or removal while keeping labels visible.']],
 'table':[['context','Existing Forge datasource context','Owns collection, selection, sorting, filters, loading, errors and authoritative total metadata.'],['columns[].type','text | link | number | editableText | checkbox | button | image | icon | progress | stacked | mediaPreview','Choose the existing native cell renderer. Use badge metadata for written status chips.'],['columns[].onValue','Existing React content hook','Compose existing controls locally, with explicit disabled/read-only props and isolated clicks. Dropdown and Switch examples reuse the native draft; this is not a new serialized cell type.'],['columns[].align / numericFormat','left | center | right; int | percent | usdCurrency','Declare alignment and numeric display separately from the stored value and editor.'],['columns[].icon / tooltip / sortable','Existing header metadata','Support icon-only headers, a useful accessible name and active-only sorting.'],['columns[].sticky','left','Declare the frozen identity group; reordering preserves its boundary.'],['columns[].hiddenInThemes','Theme ID array; optional','Exclude the complete column from this theme, including width, Customize and export. Other themes retain their saved settings.'],['columns[].cellProperties / on','Existing field properties and native value/change events','Connect producer-owned Text, Email or Number rules and staged changes. Other typed editors require native integration before enabling editing.'],['columns[].badge','appearance: status; valueMap; toneMap','Preserve every producer label and map its meaning to the existing Chip tones. Unknown meanings use neutral.'],['columns[].link / readOnlyWhen','Existing link and row policy metadata','Keep navigation separate from editing and preserve read-only permissions.'],['renderSummaryCell','({column, rows, info}) => ReactNode','Optional DS2 column-aligned summary. Rows are filtered and loaded; use producer aggregates for unloaded data.'],['container.table.presentation','list-page; optional','Compose this same table into the List Page pattern when needed. No separate workspace table engine.']],
 'list-page':[['container.table.presentation','list-page','Enable the shared page composition when DS2 is selected.'],['columns[].link','Existing window, dialog or external link metadata','An editableText column retains its blue navigation action and opens editing through a separate pencil.'],['columns[].cellProperties','Existing Text, Email or Number properties','Preserve required, range, precision, read-only and other producer-owned field rules. The amount example uses a dollar leftElement with buttonPosition none.'],['columns[].numericFormat','usdCurrency for the amount example','Format the resting value as $18,450.20. The active Number field keeps a numeric draft and its separate dollar adornment.'],['renderSummaryCell','({column, rows, info}) => ReactNode','Place a producer-defined value beneath its visible column. Rows are filtered, loaded records; use authoritative producer aggregates for unloaded server pages.']],
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
 'Page canvas':'The List Page uses 32px desktop padding at the top and sides, and 16px at the bottom through spacing-4. The collapsed chat actions occupy their own native row below the page, without covering the summary.',
 'Table action bar':'Keep creation and bulk actions on the left. Show Starred view only when its native producer binding exists. Starred view, Customize view, Filter view and Search share one right-hand flex group with equal spacing-2 (8px) gaps measured between control boundaries. All four controls stay 40px high. Keep the existing icon padding; visible glyph-to-glyph spacing includes that padding. Set the existing toolbar-item-gap to zero within this group so nested tooltip wrappers cannot add extra margins.',
 'Selection and starred controls':'The ghost Starred view trigger, Customize view trigger and Filter view trigger have equal 40px targets, centered icons and the same 8px boundary-to-boundary gap used before the Search field. Retain internal padding and target size; visible glyph edges do not define this spacing. Preserve each native hover, selected and keyboard-only inset focus state.',
 'Numeric field':'The native Number control retains its numeric draft, producer rules and shared control height.',
 'Optional leading prefix':'A currency or unit adornment sits at the semantic inline inset, matching the value’s opposite edge padding, and stays vertically centered within the input height, independent of table-row line height.',
 'Optional stepper':'Native increment and decrement controls are shown only when the field configuration permits them. Currency table editors omit these controls.',
 'Applied filter chips':'Quiet neutral rectangles name the field and committed value. Their small ghost Remove action clears only that filter through the native table handler.',
 'Cell value and edit action':'Hovering a row reveals a trailing ghost pencil in each writable text, email or amount cell in that row. Keyboard focus retains its own edit action. Read-only and disabled values have no pencil; links keep their separate blue navigation action.',
 'Editable field and validation':'Activating the pencil focuses the registered field, retaining its type and constraints inside the fixed table row. Focus uses blue and invalid values use red. The focused error floats below the field without growing the row, with a persistent linked accessible description.',
 'Dropdown cell':'The existing Select uses a Ghost trigger that fits its label, gap and chevron, vertically centered in the row. Its content-sized menu retains the shared selected-trigger treatment and option recipe. The column and row name its accessible target. Selection stages a constrained option value without selecting the row; unavailable and read-only cells cannot open.',
 'Switch cell':'The existing SwitchControl exposes its boolean checked state and readable On/Off label. Activation stages the change without selecting the row. Disabled and read-only values retain their state and cannot toggle.',
 'Edited cell state':'Changed cells have a light semantic background and a 4px leading stroke, without changing text alignment. Their accessible description gives the previous value; saved sort and filter keys stay stable while editing.',
 'Summary footer':'The count stays with the leading identity columns. Producer-defined dollar totals align beneath their visible amount column, following horizontal scrolling, column order and visibility. The local example totals saved rows in the active filtered list; Apply updates the amount while uncommitted edits do not.',
 'Inline edit review':'A content-width floating bar is centered over the lower table area. It reports changed fields and affected rows, with secondary Revert all and primary Apply changes. Separate the status text from Revert all by spacing-4 (16px), retaining spacing-2 (8px) between the two 40px actions. A narrow layout stacks the status above the action pair with 16px vertical separation. Show one decorative status dot: the shared indicator element takes precedence over a generated CSS indicator. It stays above the summary, uses a subtle border and the host semantic elevation shadow, and leaves the rows scrollable behind it.',
 'Data table':'Native sortable headers, frozen identity columns, protected inline text fields and the star utility header share the same column metadata and saved order.',
 'Container':'The boundary of the component and its interactive or visual target.',
 'Interactive container':'The native button target; it owns focus, activation and disabled state.',
 'State border':'The 1px boundary uses the button variant and state border role. Primary default, hover and pressed match the fill; disabled has its own border. It does not change the button dimensions.',
 'Action label':'A stable, concise verb phrase naming the result.',
 'Optional leading icon':'A decorative shared glyph that reinforces the action.',
 'Section collection':'A declared list of sections, rendered by CardRailGroup with the existing CardRail.',
 'Shared search and filters':'The consuming composition supplies the native text field, FilterChips and its own filtered records.',
 'Named card rails':'Each native rail retains its heading, count, scroll track and complete card anatomy.',
 'Empty collection message':'The existing component names the absence of matching records without presenting an error.',
 'Datasource presentation state':'The native boundary observes existing datasource controls and collections.',
 'Error explanation':'A readable failure message remains associated with the affected content region.',
 'Native retry action':'Invokes the declared datasource refetch without a second request mechanism.',
 'Featured content action':'The optional native slide action uses the same consumer callback as whole-slide activation.',
 'Pause and resume control':'DS2 uses shared Lucide Play/Pause at icon-size inside the native rotation control, retaining its accessible label and reduced-motion behavior.',
 'Leading search icon':'The existing shared Icon renders the outlined search glyph at icon-size. Its inset and value gap use control-padding-inline and spacing-2; the input keeps its own accessible name.',
 'Loading indicator':'A busy cue displayed while repeated activation is unavailable.',
 'Label':'A visible name associated with the control or content.',
 'Control':'The native or shared element that accepts the value.',
 'Helper text':'Supporting guidance associated with the field.',
 'Validation message':'An actionable explanation associated with an invalid field.',
 'Trigger':'The named control that opens the contextual surface.',
 'Panel':'The surface containing the related content or options. Field dropdowns and action menus prefer below-start, separated from their trigger by the shared spacing-2 (8px) gap; native viewport fallback preserves this gap above.',
 'Items':'The individual choices or commands in their reading order.',
 'Full-width option target':'The native MenuItem or select option fills its menu width. Its 40px border-box minimum includes vertical padding and border, preserving the same Body typography, menu radius and 2px separation. Multiline content may grow without clipping.',
 'Vertically centered content group':'Center the existing label and optional icons within the option target in every state. A text-only 40px row with the 20px Body line box has equal 10px space above and below; supporting descriptions may grow as one content group.',
 'Left-aligned primary label':'Keep the action label on the shared left reading edge. Vertical centering does not center-align its text or change native accessible naming.',
 'Optional divider':'A quiet separator between meaningful groups.',
 'Title':'The visible name of the task or surface.',
 'Dismiss control':'An available action that closes the surface.',
 'Footer actions':'Cancel and Apply stay at the bottom of a DS2 settings or filter drawer. Reset and Clear filters are omitted; disabled Apply retains its semantic disabled state.',
 'Named native viewport':'The overflow element keeps its accessible name, keyboard focus and native scroll position. Overlay handles reserve no horizontal or vertical gutter.',
 'Overflow content':'The original rows or other content remain inside the native viewport; paging can append without replacing the current reading position.',
 'Overlay scroll thumbs':'Vertical and horizontal handles reflect the current scroll range. Their semantic color, rounded visual mark and larger transparent hit area stay consistent in both modes.',
 'Keyboard focus':'Keyboard navigation uses the shared inset border indicator. Wheel, trackpad and pointer scrolling do not add a focus ring.',
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
 'Previous and next controls':'The native carousel actions retain their small square targets and accessible names. DS2 uses shared Lucide chevrons at icon-size, centered on both axes and independent of surrounding text metrics.',
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
 'Full screen modal':'The existing Blueprint Dialog fills the viewport and owns modal focus, scroll locking, Escape and focus return. All appearance is scoped to DS2 in the managed Global CSS.',
 'Persistent task header':'The surface header holds the task title, the theme-owned application wordmark in its existing brand slot and the shared ghost Close action. Preserve the existing wordmark aspect ratio and header height in both modes. It remains outside the scrolling form body.',
 'Section outline':'The desktop 200px navigation column shows only the section heading and number/error indicator. Author that heading in Title Case, for example Account Settings or Contact Information; the outline, card and accessible label share the same title. The current destination uses the menu-selected background and foreground; unselected hover uses the neutral surface-subtle background with primary text. Selection persists during hover, pressing and editing; validation and keyboard focus remain independent. Numbered indicators keep the primary blue background and contrasting label for every section. They do not turn green as fields are filled; existing validation errors retain their red indicator. Field names, requirements and descriptions remain inside their card, so every section has the same navigation anatomy. On mobile it becomes a full-width, opaque Surface band pinned directly beneath the task header; scrolling content cannot show through a top or side gap. Native named buttons still jump to their card. The single current location also follows the body scroll and focused or edited field, accounting for the sticky mobile band and final card at the bottom. The mobile band reveals the current destination through its own native horizontal scroll. Passive scrolling never moves focus; post-submit error state remains independent.',
 'Numbered form cards':'Non-collapsible SectionPattern cards remain in one continuous form. The outline, 40px gutter and card column share a centered 1200px maximum.',
 'Field validation':'The existing validation owner supplies the field messages and section error results after Apply/Create. Keep native field associations and move to the first invalid field; the outline error uses a Lucide icon plus accessible status.',
 'Persistent task footer':'The footer retains the existing Cancel and primary Create/Apply actions. This pattern’s primary action uses authored Title Case, for example Create Workspace or Apply. Its content aligns to the same 1200px region and stays outside the body scroll area.',
 'Dismiss action':'Closes the surface and returns to the triggering context.',
 'Source-owned option loading':'Six decorative Skeleton rows use the same 40px option height and shared gap. The native option source owns pending, loaded and failed states; existing choices and the draft survive refresh. Apply stays unavailable while required options are pending, including after Back. Retry keeps focus on the existing search field.',
 'Result indicator':'The existing semantic intent icon reinforces the written result.',
 'Concise message':'Readable body text describes the result without relying on icon color.',
 'Rail heading and description':'The shared Surface rail has a 16px inset and the existing surface radius, with no outer border or shadow. Its heading aligns with the first card. Missing decorative artwork contributes no empty leading slot; 16px separates the header from the track.',
 'Collection count action':'The caller-supplied count remains an independently named native action beside the section title.',
 'Rail scroll actions':'Native square controls use the shared 16px Lucide chevrons in DS2, scroll the track, retain their existing accessible names and disable at the corresponding edge.',
 'Card image':'The shared Canvas sits behind each Surface rail; cards retain their own Surface and compact geometry. The existing card-image-height role gives the 240px card an 80px image area. Producer-authored image fitting and fallback handling remain native.',
 'Resource identity and copy action':'Small typography and a 24px embedded copy action keep identifiers readable. DS2 uses decorative 16px Lucide Copy/Check glyphs with the native copy status announcement. Long identifiers truncate visually while copying retains the complete value.',
 'Card title and facts':'The Small identifier appears first, followed by a 14px semibold Section name that reserves two lines and truncates after them. The compact body uses 12px padding and group separation. Two metric columns put Small labels above emphasized Body values, aligned to their respective left and right edges with tabular numerals.',
 'Interactive card tags':'Small text, 24px targets and 4px corners form a compact filter variant. A 60px area reserves two tag rows, their 4px gap and the existing 8px top inset so one-tag and four-tag metadata cards align. Rows start at the top and never stretch tag targets. Choices wrap and retain native pressed semantics and shared semantic selection colors.',
 'Ghost dismiss button':'The native dismiss action uses the shared 32px ghost target, 8px control radius, tertiary-button state colors and keyboard-only inset focus. It is absent in auto-dismiss variants.',
 'Workspace-only native close and expand actions':'Compact native actions retain 28px square targets, 14px Lucide glyphs and the Ghost radius on fine pointers; coarse pointers retain their native 44px targets. The label shares the With icons spacing-2 gap (8px). On selected tabs, close and expand retain a distinct contextual tint of the existing Ghost hover and pressed roles; disabled actions stay quiet. Pointer activation has no ring and keyboard focus stays inset.',
 'Selectable chip surface and control corners':'The shared control-radius role gives the outer filter 8px corners in DS2. Inline labels center against the filters; resolved datasource state does not tint the group background.',
 'Removable chip surface and control corners':'Removable Chip shares Filter Chips’ body typography, container height, visible content insets, 8px outer radius and surface roles. Its embedded X keeps a separate 24px target with 4px hover corners.',
 'Optional category label':'A secondary-text prefix identifies the applied category without competing with its value.',
 'Selected value or count':'The caller supplies one readable value or N Selected for multiple values in that category.',
 'Ghost removal action':'A named ghost action uses the chip-specific 24px embedded target, 16px glyph and 4px hover corners derived from half the shared control radius, while retaining ghost state colors. Disabled prevents activation; the tag itself is not another action.',
 'Backdrop':'Separates a modal task from the background it temporarily blocks.',
 'Scrollable body':'Keeps long content reachable while the surface remains within the viewport.',
 'Selected panel':'Contains the content associated with the currently selected tab.',
 'Named dialog':'Associates the modal surface with its readable title.',
 'Command results':'Lists available commands matching the current query.',
 'Command actions':'Run only after an explicit accepted selection.',
 'Column headers':'Text and number headings follow their column alignment. An icon-only toggle header shares its horizontal center with the row glyphs, using the existing compact control dimensions. Native Lucide and Blueprint wrappers follow the same DS2 recipe in both color modes. The header meets the first row without a transparent bottom-border strip; normal body dividers remain unchanged.',
 'Data rows':'Keep the values for one record together.',
 'Cells':'Retain the relationship between a record and its column header.',
 'Sorting controls':'Only the active column shows a directional chevron. In an icon-only header the chevron sits to the right, outside the star glyph’s layout flow, so sorting never shifts the star. Keep the native sort button, accessible name and keyboard-only inset focus indicator.',
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
 useEffect(()=>{
  if(!ref.current)return;
  const target=previewKey?ref.current.querySelector('[data-example-id] .basic-table-wrapper,[data-example-id] .catalog-toast,[data-example-id] .forge-removable-chip,[data-example-id] .forge-filter-chips,[data-example-id] .forge-card-rail,[data-example-id] .forge-content-carousel')||ref.current.querySelector('[data-example-id] .forge-button')||ref.current:ref.current;
  const resolved=readSemanticTheme(target,names);
  const dismiss=target.matches('.catalog-toast,.forge-removable-chip')&&target.querySelector('.forge-toast-dismiss,.forge-button[data-forge-variant="ghost"]');
  if(dismiss){
   const action=readSemanticTheme(dismiss,names.filter(name=>['button-bg','button-text','button-hover-bg','button-active-bg','border-strong'].includes(name)));
   Object.assign(resolved.values,action.values);Object.assign(resolved.bindings,action.bindings);
  }
  setSnapshot(resolved);
 },[names.join('|'),mode,previewKey]);
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
 const previewStates=spec.variantStates?.[variant]||spec.states;
 const previewTokens=spec.variantTokens?.[variant]||spec.tokens;
 const [tokenRef,values,bindings]=useResolvedTokens(previewTokens,mode,['button','icon-button','button-group','more-menu','toggle-button','table','list-page','toast','filter-chips','card-rail','card-rail-group','carousel'].includes(spec.id)?`${variant}:${state}:${iconSize}`:'');
 const source=usageExamples[spec.id];
 const isDocumentPattern=['document-form','analytical-report','comparison-layout'].includes(spec.id);
 const isDiscoveryExample=['carousel','card-rail','card-rail-group','data-state'].includes(spec.id);
 const hasWidthPreview=isDocumentPattern||isDiscoveryExample||['charts','metrics','table'].includes(spec.id);
 const completeSource=spec.id==='full-screen'?fullScreenSource:spec.id==='table'?tableSource:spec.id==='list-page'?listPageSource:isDiscoveryExample?discoverySource:isDocumentPattern?patternSource:exampleSource;
 const previewExample=<CatalogExample key={`${spec.id}:${variant}:${state}:${iconSize}`} spec={spec} variant={variant} state={state} iconSize={iconSize}/>;
 useEffect(()=>{setVariant(spec.variants[0]);setState('Default');setIconSize('default');setActiveTab('overview');setPreviewWidth('full');},[spec.id]);
 const examples=spec.variants;
 const changeVariant=value=>{setVariant(value);if(!(spec.variantStates?.[value]||spec.states).includes(state)||spec.id==='table'&&value!=='Editable cells'&&tableEditorStates.includes(state))setState('Default');};
 const changeState=value=>{setState(value);if(spec.id==='table'&&tableEditorStates.includes(value))setVariant('Editable cells');};
 return <article className="catalog-detail" ref={tokenRef}>
   <a href={`#category/${spec.family}`} className="catalog-back"><Icon name="lucide:arrow-left"/>{componentFamilies.find(f=>f.id===spec.family)?.name}</a>
   <header className="catalog-detail-header"><div className="catalog-row"><h1>{spec.name}</h1><span className={`catalog-kind ${spec.kind==='gap'?'is-gap':''}`}>{spec.deprecated?'Deprecated reference pattern':kindLabel[spec.kind]}</span></div><p>{spec.description}</p><span className="catalog-implementation">{spec.implementation}</span></header>
   <nav className="catalog-detail-tabs" aria-label="Component documentation">{[['overview','Overview'],['examples','Examples'],['anatomy','Anatomy'],['usage','Usage'],['behavior','Behavior'],['accessibility','Accessibility'],['variables','Variables']].map(([id,label])=><button type="button" key={id} aria-current={activeTab===id?'location':undefined} onClick={()=>{setActiveTab(id);document.getElementById(`component-${id}`)?.scrollIntoView({behavior:'instant',block:'start'});}}>{label}</button>)}</nav>
   <section id="component-overview" className="catalog-doc-section"><h2>Interactive preview</h2><div className="catalog-playground-controls"><label>{spec.id==='table'?'Configuration':'Variant'}<SelectControl aria-label="Preview variant" value={variant} onChange={e=>changeVariant(e.target.value)}>{spec.variants.map(v=><option key={v}>{v}</option>)}</SelectControl></label><label>State<SelectControl aria-label="Preview state" value={state} onChange={e=>changeState(e.target.value)}>{previewStates.map(v=><option key={v}>{v}</option>)}</SelectControl></label>{spec.id==='icon-button'&&<label>Size<SelectControl aria-label="Preview size" value={iconSize} onChange={event=>setIconSize(event.target.value)}><option value="default">Default</option><option value="small">Small</option></SelectControl></label>}</div>
     {hasWidthPreview&&<label className="catalog-analysis-width">Preview context<SelectControl aria-label="Preview context" value={previewWidth} onChange={event=>setPreviewWidth(event.target.value)}><option value="full">Full width</option><option value="560">Split view · 560px</option><option value="320">{spec.id==='table'?'Narrow · 320px':'Chat · 320px'}</option></SelectControl></label>}
     <div className={`catalog-preview catalog-preview--detail ${spec.kind==='gap'?'has-gap':''}`} data-example-id={spec.id}>{hasWidthPreview?<div className="catalog-preview-content" style={{width:'100%',minWidth:0,maxWidth:previewWidth==='full'?undefined:`${previewWidth}px`}}>{previewExample}</div>:previewExample}</div>
     <p className="catalog-caption">Try the controls directly. Hover, keyboard focus and pressed feedback come from the underlying component. The preview uses the selected {mode} semantic values.</p>
     {spec.id==='status-chip'&&<><h3 className="catalog-subsection">Labels vary by list</h3><p>The same component supports any written status. Each list supplies its labels and a semantic tone mapping; these examples are not a fixed status enum. Unmapped labels retain a neutral appearance.</p><div className="catalog-row">{[['Draft','neutral'],['Scheduled','info'],['Active','success'],['Paused','warning'],['Archived','neutral'],['Completed','success'],['Needs review','warning'],['Failed','danger'],['Custom status','neutral']].map(([label,tone])=><StatusChip key={label} tone={tone}>{label}</StatusChip>)}</div><p className="catalog-caption">Use Filter Chips for selectable filters and Token for removable values. Written status chips do not add a click action, hover state or keyboard stop.</p></>}
     {spec.id==='filter-chips'&&variant==='Removable Chip'&&<p className="catalog-caption">This is the same component used above the table in List Page. It represents a value that is already applied. <a href="#components/filter-chips">Filter Chips</a> select filters; <a href="#components/status-chip">Chip</a> displays a written status. The compact X has a 24px target, 4px hover corners and a 16px glyph and uses the shared focus policy.</p>}
     {spec.id==='card-rail-group'&&<p className="catalog-caption">Discovery composition: use <a href="#components/tab-list">Tab List</a>, <a href="#components/carousel">Carousel</a>, <a href="#components/power-search">Power Search</a>, <a href="#components/filter-chips">Filter Chips</a> and the native <a href="#components/card-rail">Card Rail</a> anatomy. Wrap datasource presentation in <a href="#components/data-state">Data State</a>; use <a href="#components/list-page">List Page</a> for the complete inventory table. These are existing shared components; the example introduces no new page API.</p>}
     {spec.id==='table'&&<p className="catalog-caption">This is the native workspace table used by List Page. Configuration changes cell and header types. State changes selection, loading, validation or editing conditions. Hover rows, sort a header or activate a pencil to review their real interaction states. Standard row height, header, summary, borders and edit styling follow the current List Page recipe. Dropdown and Switch reuse their existing field controls and the same Apply/Revert review, with row selection kept separate. Dates are read-only formatted text; no date editor is implied. Report tables and list recipes are under Chat → Tables &amp; Lists. Header and summary share the exact Figma component background and text roles in both color modes.</p>}
     {spec.id==='list-page'&&<p className="catalog-caption">Local interaction review: sort headers, drag named headers or use Alt + Arrow keys, apply and remove filter chips, and use the same pencil action to edit Record name, Workspace, Owner, Contact email or Amount. Only editable cells offer the action; linked names remain navigation targets. Review the changed fields, then use Revert all or Apply changes. The sortable star header uses the shared Lucide icon; only the active sort displays a primary-blue chevron. Keep the native accessible list name on the List Page region and heading, without repeating a visual caption above the column headers. Standalone lists retain their declared column widths and keep the header, toolbar and summary visible while the table body scrolls. Review multi-section creation in Patterns / Full screen.</p>}
     {spec.id==='list-page'&&<p className="catalog-caption">Workspace adoption: Orders, Lines, Marketplace Deals / All Inventory, Client Deals, Deal Groups and Advanced Reporting reuse this page structure locally, including the shared typography, semantic colors, 40px toolbar controls, 8px control gaps, 360px Customize and Filter drawers, and table summary. Each consumer keeps its existing columns, links, data and access rules. Client Deals and Deal Groups retain their existing creation, archive, export and guarded Apply/Revert workflows; Marketplace Discover keeps its own composition. Advertiser details / Campaigns, Orders, Creatives and Measurement also use this native pattern, retaining their advertiser-scoped data, columns, links, existing actions and permissions. Creatives includes List and Exchange status; Measurement includes Pixels, Retargeting Pixels, Advanced reporting and Conversions API, with their original capability and feature gates. Rich native pixel, tag, archive and reporting operations retain their seeded dialogs, row eligibility, selection limits and write-safety rules. Their primary actions reuse the shared semantic recipe; unavailable actions remain disabled. The Within tabs variant begins with the complete action bar, then the table and summary, without a repeated list heading or date picker. Campaigns retains New Campaign and New Outcomes Campaign; Orders retains New Order and Actions, with unbound controls disabled and existing permissions preserved. Their search fields and owned drawers inherit the theme's standard control geometry. Advanced Reporting uses searchable Agency and Advertiser context selectors, with Advertiser limited to the selected agency. Its Report name column comes before Report category; names reuse standard table navigation styling and retain their original report-opening action. Its containing workspace tab is named Advanced Reporting. The separate advertiser-report list retains its native family filter. Its DS2 canvas removes the legacy card inset so page padding is owned once, with the original card and toolbar retained for other themes. Unconnected creation, bulk actions, search, date filtering or starring stay disabled; this sample's interactions do not imply that every consumer has those business bindings.</p>}
     {spec.id==='list-page'&&<p className="catalog-caption">Action hierarchy: keep the reviewed creation action as the primary button. Group existing row and bulk commands in Actions instead of repeating them as standalone buttons beside the same menu. Keep each command's original visibility, permission, selection limits, validation and confirmation. Actions remains unavailable until its required selection exists; individual commands retain their own eligibility. Reuse the existing primary Button, Dropdown Menu, semantic typography, control geometry and inset keyboard focus. Menu access must call the original guarded operation; an enabled-looking placeholder is not a connected workflow. Native EditableCollection can opt into this hierarchy with table.operationToolbar in its DS2 override: primary references the creation operation, menu.operations references its existing selection commands, and editReview references its existing Apply/Revert handlers and producer-owned change counts. Save/reset commands then appear only in the pending-edit review, rather than the main action bar. Other themes retain their prior operation bar.</p>}
     {spec.id==='list-page'&&<p className="catalog-caption">Client Deal Name reuses its existing Details / Open destination. The linked editable cell keeps navigation on the blue name and editing on the separate pencil when permitted. Read-only records keep their navigation link. The redundant Details column is excluded from DS2, including its width and Customize entry; other themes retain it.</p>}
     {spec.id==='table'&&<p className="catalog-caption">Theme-specific columns: declare hiddenInThemes with the theme IDs where a column is excluded. The shared table removes its header, cells, width, summary/export position and Customize entry together. Default, All Columns and saved preferences cannot bring it back in an excluded theme. Other themes retain the column's saved settings. This changes no semantic variables, control states or keyboard focus rules.</p>}
     {spec.kind==='gap'&&<div className="catalog-gap-note"><strong>Remaining shared implementation</strong><p>{spec.usage} This entry records the required coverage and the closest existing implementation; it is not a completed replacement.</p></div>}
     {source&&<div className="catalog-code-block"><div className="catalog-code-heading"><span>Usage example</span><CopyButton value={source}/></div><pre><code>{source}</code></pre></div>}
   </section>
   <section id="component-examples" className="catalog-doc-section"><h2>{spec.id==='table'?'Configurations':'Variants'}</h2><p>{spec.id==='table'?'Choose the columns and header types. These configurations share the same table states and interactions.':'Compare every documented configuration using the same semantic roles.'}</p><div className={`catalog-variant-grid${isDocumentPattern||spec.id==='table'?' catalog-pattern-variants':''}`}>{examples.map(v=><div className="catalog-variant" key={v}><h3>{v}</h3><div className="catalog-preview catalog-preview--variant"><CatalogExample spec={spec} variant={v} iconSize={iconSize} thumbnail={!isDocumentPattern}/></div></div>)}</div>
     {spec.id==='drawer'&&<><h2 className="catalog-subsection">Examples using the 360px drawer</h2><p>These layouts reuse the same drawer size and shared controls.</p><div className="catalog-variant-grid">{['Customize view','Filter view','Condition filter'].map(example=><div className="catalog-variant" key={example}><h3>{example}</h3><div className="catalog-preview catalog-preview--variant"><CatalogExample spec={spec} variant={example} thumbnail/></div></div>)}</div></>}
     {spec.id==='drawer'&&<><h2 className="catalog-subsection">Filter option loading</h2><p>These content states reuse the 360px Filter view drawer. Open a preview and choose Name. Loading options shows the native Skeleton; Load error offers a keyboard-operable Try again action. The existing Toast reports recoverable failures in the product.</p><div className="catalog-state-grid">{['Loading options','Load error'].map(state=><section className="catalog-variant" key={state}><h3>{state}</h3><div className="catalog-preview catalog-preview--variant"><FilterDrawerStateExample state={state}/></div></section>)}</div></>}

     {spec.id==='icon-button'&&<><h2 className="catalog-subsection">Sizes</h2><p>Default matches the regular button height. Small uses the smaller semantic target; the icon glyph stays consistent.</p><div className="catalog-variant-grid"><div className="catalog-variant"><h3>Default · same height as Button</h3><div className="catalog-preview catalog-preview--variant"><div className="catalog-row"><CatalogExample spec={findComponent('button')} variant={variant} thumbnail/><CatalogExample spec={spec} variant={variant} iconSize="default" thumbnail/></div></div></div><div className="catalog-variant"><h3>Small</h3><div className="catalog-preview catalog-preview--variant"><CatalogExample spec={spec} variant={variant} iconSize="small" thumbnail/></div></div></div></>}
     <h2 className="catalog-subsection">States</h2>{spec.id==='table'&&<p>States describe what is happening to the table. Unsaved changes and Validation error use Editable cells; selecting them also updates Configuration. Read only protects record edits in the current configuration, including Dropdown and Switch. Personal starring remains available. Hover, active sorting and keyboard focus are reviewed through the actual controls.</p>}<div className={`catalog-state-grid${spec.id==='table'?' catalog-pattern-variants':''}`}>{previewStates.map(s=><div className="catalog-variant" key={s}><h3>{s}</h3>{spec.id==='table'&&tableEditorStates.includes(s)&&<p className="catalog-caption">Editable cells</p>}<div className="catalog-preview catalog-preview--variant"><CatalogExample spec={spec} variant={variant} state={s} iconSize={iconSize} thumbnail/></div></div>)}</div>
     <div className="catalog-interaction-note"><Icon name="lucide:eye"/><p>For interactive components, move the pointer onto the preview to inspect hover, use Tab to inspect focus, and activate with the documented keys to inspect pressed or selected feedback.</p></div>
   </section>
   <section id="component-anatomy" className="catalog-doc-section"><h2>Anatomy</h2><p>Parts retain these responsibilities across variants and presentation modes.</p><dl className="catalog-anatomy">{spec.anatomy.map((part,index)=><div key={part}><dt><span>{index+1}</span>{part}</dt>{AnatomyDescriptions[part]&&<dd>{AnatomyDescriptions[part]}</dd>}</div>)}</dl></section>
   <section id="component-usage" className="catalog-doc-section"><h2>Usage and best practices</h2><div className="catalog-practices"><div><h3><Icon name="lucide:check"/>Recommended</h3><p>{spec.usage}</p><p>{spec.responsive}</p></div><div><h3><Icon name="lucide:x"/>Avoid</h3><p>{spec.avoid}</p></div></div>{apiEntries[spec.id]?<><h3 className="catalog-subsection">Component API</h3><div className="catalog-table-scroll"><table className="catalog-props"><thead><tr><th scope="col">Property</th><th scope="col">Values</th><th scope="col">Purpose</th></tr></thead><tbody>{apiEntries[spec.id].map(([name,type,description])=><tr key={name}><th scope="row"><code>{name}</code></th><td>{type}</td><td>{description}</td></tr>)}</tbody></table></div></>:<p className="catalog-caption">Implementation: {spec.implementation}. This page documents the actual component or the named composition; it does not introduce another package API.</p>}
     {['table','list-page'].includes(spec.id)&&<><h3 className="catalog-subsection">Editable-field validation rules</h3><p className="catalog-caption">The local review connects the existing Text, Email and Number field controls. Invalid fields retain their error state until corrected; saved data changes only after Apply.</p><p>Each column keeps the rules of its underlying field. The producer declares required, optional, length, range and precision constraints; the table must preserve them. Invalid drafts stay visible and cannot be applied. Every list must declare its field rules before enabling editing; a new column does not inherit guessed business rules.</p><div className="catalog-table-scroll"><table className="catalog-props"><thead><tr><th scope="col">Field</th><th scope="col">Accepted values</th><th scope="col">Invalid state</th></tr></thead><tbody>{[
       ['Name or text','Text, including spaces and Unicode. Honor declared required, minimum-length and maximum-length rules.','Show the field-specific error and keep its unsaved value available for correction.'],
       ['Email address','One correctly formatted address. Empty is accepted only for an optional field. Preserve declared length and other producer constraints.','Keep the email field in an error state until its value is valid. Do not silently remove invalid characters or replace the draft.'],
       ['Number or amount','Finite numeric values only. Preserve declared integer or decimal precision, step, minimum, maximum and optional-empty rules. Zero remains a real value when permitted.','Reject nonnumeric input through the native number control; incomplete or out-of-range values remain invalid until corrected. Never silently coerce invalid text to zero.'],
       ['Whole numbers and percentages','Use the existing Number editor with the column’s declared whole-number or decimal pattern, numeric bounds and unit. Percentage storage may be 0–1 or 0–100; the producer declares the scale. Step controls keyboard increments and is not a substitute for validation.','Keep fractions invalid for whole-number columns. Preserve the entered value while showing range or precision errors; never infer bounds from a heading.'],
       ['URL, domain, phone or reference code','Reuse Text with producer-authored pattern and length rules when those rules are available. Keep leading zeros in string identifiers and preserve the declared country/domain policy.','These fields have no universal table validator. Do not claim that an HTML input type or a visually formatted value proves validity; unresolved rules keep the column read-only.'],
       ['Date, time and date range','Reuse the existing typed date/time controls and their declared bounds and time-zone contract. Validate complete calendar values and start/end relationships.','The current inline cell renderer connects Text, Email and Number only. Keep other typed cells read-only until their native editor and producer validation are connected.'],
       ['Status, category, related record or multiple values','Use producer-supplied allowed values and stable IDs, including available/disabled choices and declared selection limits. Display labels do not replace IDs.','Do not edit an enum or relationship as unrestricted text. A related-record label may be a separate navigation link. Keep it read-only until the correct existing selector and validation are connected.'],
       ['Calculated metric or permission-controlled value','Honor the producer’s writable/read-only declaration and authoritative save permissions.','Do not infer editability from a column name or from a writable local example.'],
       ['Identifier or read-only value','Existing saved value; editing is unavailable.','Preserve the read-only restriction during editing, validation, Apply and Revert.'],
     ].map(([field,accepted,invalid])=><tr key={field}><th scope="row">{field}</th><td>{accepted}</td><td>{invalid}</td></tr>)}</tbody></table></div><p>For every editable column, record the authoritative schema/source, field type, allowed editor, required and empty/null behavior, limits and precision, pattern or allowed options, cross-field checks, permissions and error copy. Reuse forge/validation and the producer’s existing validation hook for authored schema rules. Uniqueness, relationship access and other server-owned rules remain authoritative at save time; retain drafts when the producer rejects an update. The local sample validates only its declared Text, Email and Number fields and never calls a business service.</p><p>Row hover reveals all editable pencils in that row, without showing any input. Other rows remain quiet; keyboard focus also reveals its current edit action. Activating the pencil focuses the field with its semantic blue border; invalid fields retain the red border. Keep every side of the 1px border fully visible, with no clipped lower stroke or outer focus ring. Keyboard focus follows the shared inset policy.</p><p>The focused invalid field shows its error in a floating callout with a 2px gap below the field, outside the row layout. If placement flips above, retain the same 2px gap. Load failures use the semantic danger foreground with the shared Lucide Info icon centered with the message. It must not increase row height. The accessible error description remains linked after focus moves. Apply changes stays disabled while any staged field is invalid, including a row hidden by a filter. Revert all restores saved values and clears their errors.</p><p>Text, email and amount cells use the same pencil action as linked names. A valid field returns to its formatted value after blur; an invalid draft stays visible for correction. Read-only and disabled cells omit the pencil, while read-only links retain navigation. Numeric values, identifiers, counts and totals retain Plus Jakarta Sans with tabular numerals for equal digit widths. Labels and names use the same supplied primary family. The sample Amount displays its dollar sign attached to the amount, with grouping and two decimals, like $18,450.20. Only the active input keeps the dollar adornment at the shared 16px left inset, matching search and calendar icons through the control-padding-inline semantic role, with no stepper arrows. The amount’s right inset matches the prefix’s left inset through the same control-padding-inline role. Center the adornment vertically within the actual field height using the body line-height role; it must not inherit a taller table-row line height. Keep its numeric value and the user's in-progress draft intact while typing; formatting must not round or hide an invalid draft.</p><p>The summary places the dollar total in the Amount column itself, moving with column order and horizontal scrolling. Reserve the same trailing edit-action track for writable values, read-only values and their total so their last digits align. Right-align numeric column headings to this same reading edge. The active numeric sort chevron sits before its label so sorting never shifts that edge. Hiding the column hides its total. The sample totals the saved rows in the current filtered list and updates after Apply; pending edits do not change it. Keep the record count based on the datasource total. A partial loaded-page sum must never be presented as a server-wide total.</p></>}
     <details className="catalog-source"><summary>View complete local example source</summary><CopyButton value={completeSource}/><pre><code>{completeSource}</code></pre></details>
   </section>
   <section id="component-behavior" className="catalog-doc-section"><h2>Interactions and behavior</h2><ul>{spec.behavior.map(text=><li key={text}>{text}</li>)}</ul><h3>Responsive behavior</h3><p>{spec.responsive}</p></section>
   <section id="component-accessibility" className="catalog-doc-section"><h2>Accessibility</h2><p>{spec.accessibility}</p><h3>Keyboard interaction</h3><dl className="catalog-keyboard">{spec.keyboard.map(([key,action])=><div key={key}><dt><kbd>{key}</kbd></dt><dd>{action}</dd></div>)}</dl><p>Light and dark modes retain the same content, anatomy, dimensions and keyboard behavior. Reduced motion preserves state feedback without unnecessary movement.</p></section>
   <section id="component-variables" className="catalog-doc-section"><h2>Semantic variables</h2><p>These renderer roles are bound to your loaded semantic collection. The source variable and its resolved value stay visible together. Button bindings follow the selected variant and state.</p>{spec.id==='tooltip'&&<p>The dark hint surface uses <code>color/text/primary</code> with <code>color/text/inverse</code> for its text in light mode. Dark mode swaps these two roles to retain a dark surface and light text. Its quiet border derives from the same foreground role; padding uses spacing-2 and spacing-3, and copy uses the small typography role.</p>}<div className="catalog-table-scroll"><table className="catalog-props"><thead><tr><th scope="col">Renderer role</th><th scope="col">Your semantic collection</th><th scope="col">Current {mode} value</th></tr></thead><tbody>{previewTokens.map(token=><tr key={token}><th scope="row"><code>--forge-{token}</code></th><td>{bindings[token]?.length?bindings[token].map(name=><code className="catalog-semantic-source" key={name}>{name}</code>):<span className="catalog-muted">Shared behavior or host role</span>}</td><td><code>{values[token]||(bindings[token]?.length?'Unresolved':'Inherited from the host theme')}</code></td></tr>)}</tbody></table></div></section>
   <footer className="catalog-detail-footer"><span>{spec.name} · Shared design system</span><a href="#components">Back to all components</a></footer>
 </article>;
}
function TokensPage({mode}){
 const [query,setQuery]=useState(''),names=useMemo(()=>[...new Set(componentCatalog.flatMap(item=>item.tokens))].sort(),[]),[ref,, ,semantic]=useResolvedTokens(names,mode);
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const visible=semantic.filter(item=>words.every(word=>[item.name,item.value,...item.roles].join(' ').toLowerCase().includes(word)));
 return <div className="catalog-tokens" ref={ref}><h1>Semantic collection</h1><p>Variables read directly from the loaded semantic collection in {mode} mode. Shared renderer aliases point to these values; they are not a separate palette.</p><InputSearch label="Search variables" value={query} onChange={setQuery}/><p className="catalog-caption" role="status">{visible.length} of {semantic.length} loaded semantic variables</p><div className="catalog-token-grid">{visible.map(item=><article key={item.name}><span className="catalog-token-swatch" style={{background:/^(#|rgb|hsl|oklch|color)/i.test(item.value)?`var(${item.name})`:'var(--forge-surface-subtle)'}} aria-hidden="true"/><code>{item.name}</code><span>{item.value||'Unresolved'}</span>{item.roles.length>0&&<span className="catalog-token-bindings">Used by {item.roles.map(role=>`--forge-${role}`).join(', ')}</span>}</article>)}</div></div>;
}
function InputSearch({value,onChange,label='Search library'}){return <label className="catalog-search"><span className="catalog-sr-only">{label}</span><Icon name="lucide:search"/><input type="search" aria-label={label} value={value} placeholder={`${label}…`} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={()=>onChange('')}><Icon name="lucide:x"/></button>}</label>;}

function CatalogNavigation({items,query,family,spec}) {
 const activeSection=spec?.section||(['chat','patterns'].includes(family)?family:'components');
 const link=item=><a key={item.id} href={item.href} aria-current={spec?.id===item.id?'page':undefined}>{item.name}{item.kind==='gap'&&<span className="catalog-gap-dot" aria-label="Implementation gap"/>}</a>;
 return <nav aria-label="Library index">{catalogSections.map(section=>{
  const entries=items.filter(item=>item.section===section.id);
  return <details className="catalog-sidebar__section" key={section.id} open={!!query||activeSection===section.id}>
   <summary><Icon name="lucide:chevron-right" className="catalog-disclosure-icon"/>{section.name}<span>{entries.length}</span></summary>
   <a className="catalog-family-link" href={`#category/${section.id}`}>Browse {section.name.toLowerCase()}</a>
   {['components','chat'].includes(section.id)?<>
    {section.id==='chat'&&entries.filter(item=>!item.navigationGroup).map(link)}
    {catalogComponentGroups.map(group=>{
     const children=entries.filter(item=>item.navigationGroup===group.id);
     return children.length?<details className="catalog-sidebar__group" key={group.id} open={!!query||spec?.navigationGroup===group.id}>
      <summary><Icon name="lucide:chevron-right" className="catalog-disclosure-icon"/>{section.id==='chat'&&group.id==='table'?'Tables & Lists':group.name}<span>{children.length}</span></summary>{children.map(link)}
     </details>:null;
    })}
    {section.id==='components'&&entries.filter(item=>!item.navigationGroup).map(link)}
   </>:entries.map(link)}
  </details>;
 })}</nav>;
}
function GuidelinesPage(){return <article className="catalog-guidelines"><h1>Using the shared system</h1><p>One library for reusable appearance and behavior across product workspaces.</p>{[
 ['Start with meaning','Choose a component for its interaction purpose. Use buttons for actions, links for destinations, status labels for state, and count badges for numeric tallies.'],
 ['Use semantic variables','Build on surface, text, interaction, feedback, typography and geometry roles. Keep palette values and font assets in the theme source.'],
 ['Compose existing components','Use the existing Forge implementation and the documented compositions. Keep business content, producer metadata and product decisions with their owners.'],
 ['Review the whole interaction','Check default, hover, focus, pressed, selected, loading, disabled, read-only, invalid and empty behavior where applicable. Test real keyboard and pointer input.'],
 ['Share borders and scrolling','Use structural roles for layout boundaries, the table-divider role for rows, and each field’s state border role for its control. Scroll thumbs reuse border-color and text-secondary. Keep surfaces free of box shadows. The shared theme owner reveals scrollbars during activity and fades them afterward, including owned portals.'],
 ['Keep list pages consistent','Review the shared List Page pattern on the first adopted page before migrating other lists. It owns 32px top/side page padding and 16px bottom padding, table states, the action bar, summary and matching 360px drawers.'],
 ['Keep both modes aligned','Light and dark are presentation modes. Preserve content, anatomy, spacing, typography metrics and behavior when switching modes.'],
 ['Treat accessibility as component behavior','Name every control, keep focus visible, associate labels and errors, retain native semantics and verify dismissal and focus restoration.'],
 ['Release and adopt deliberately','A local catalog is review evidence. Shared component changes require a versioned Forge release and verification in the consuming products before adoption can be called complete.'],
 ].map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}</article>;}

export default function ComponentCatalog({route='components',mode='light',onModeChange,themeLabel='Shared design system'}){
 const [query,setQuery]=useState(''),[mobileOpen,setMobileOpen]=useState(false);
 const segments=route.split('/'),family=segments[0]==='category'?segments[1]:'all',spec=segments[0]==='components'&&segments[1]?findComponent(segments[1]):null;
 const currentSection=spec?.section||(['chat','patterns'].includes(family)?family:'components');
 const visible=filterCatalog(query,family),sidebarItems=filterCatalog(query),activeFamily=[...catalogSections,...componentFamilies].find(f=>f.id===family);
 useEffect(()=>{setMobileOpen(false);const frame=requestAnimationFrame(()=>{if(route.startsWith('foundation-'))document.getElementById(route)?.scrollIntoView({block:'start'});else window.scrollTo({top:0,behavior:'instant'});});document.title=spec?`${spec.name} · Shared design system`:'Shared design system · Component library';return()=>cancelAnimationFrame(frame);},[route]);
 return <ForgeThemeProvider themeId="design-system-2" mode={mode}><ForgeThemeBoundary windowKey="design-system-2-library"><div className="catalog-app">
   <a href="#catalog-main" className="catalog-skip-link" onClick={event=>{event.preventDefault();document.getElementById('catalog-main')?.focus();}}>Skip to library content</a>
   <header className="catalog-topbar"><a className="catalog-brand" href="#components"><span className="catalog-brand-mark"><Icon name="lucide:layers"/></span><span>Design system</span></a><nav aria-label="Library sections"><a href="#category/components" aria-current={currentSection==='components'?'page':undefined}>Components</a><a href="#category/chat" aria-current={currentSection==='chat'?'page':undefined}>Chat</a><a href="#category/patterns" aria-current={currentSection==='patterns'?'page':undefined}>Patterns</a><a href="#foundations" aria-current={route==='foundations'||route.startsWith('foundation-')?'page':undefined}>Foundations</a><a href="#variables" aria-current={route==='variables'?'page':undefined}>Variables</a><a href="#guidelines" aria-current={route==='guidelines'?'page':undefined}>Guidelines</a></nav><div className="catalog-row"><span className="catalog-local">Local library</span><Button variant="ghost" icon={mode==='light'?'lucide:circle':'lucide:palette'} hideLabel aria-label={mode==='light'?'View dark theme':'View light theme'} title={mode==='light'?'View dark theme':'View light theme'} onClick={()=>onModeChange(mode==='light'?'dark':'light')}/><Button className="catalog-mobile-toggle" variant="ghost" icon="lucide:menu" hideLabel aria-label="Toggle component navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(!mobileOpen)}/></div></header>
   <aside className={`catalog-sidebar ${mobileOpen?'is-open':''}`} aria-label="Library navigation"><InputSearch value={query} onChange={setQuery}/><a href="#components" className={`catalog-overview ${route==='components'?'is-current':''}`}>Overview <span>{componentCatalog.length}</span></a><CatalogNavigation items={sidebarItems} query={query} family={family} spec={spec}/></aside>
   <main id="catalog-main" className="catalog-main" tabIndex={-1}>{spec?<ComponentPage key={spec.id} spec={spec} mode={mode}/>:route==='variables'?<TokensPage mode={mode}/>:route==='guidelines'?<GuidelinesPage/>:route==='foundations'||route.startsWith('foundation-')?<div className="catalog-foundations"><FoundationSpecimen includeDocuments={false}/><ChartSpecimen/></div>:segments[0]==='components'&&segments[1]?<div className="catalog-empty"><h1>Component not found</h1><a href="#components">Browse the library</a></div>:<div id="ds2-component-catalog"><header className="catalog-hero"><h1>{activeFamily?activeFamily.name:'Browse the library'}</h1><p>Explore components, patterns, variants and interactions.<br/>One shared language, built with our semantic variables.</p><div className="catalog-hero-links"><a href="#foundations"><Icon name="lucide:palette"/>Explore foundations</a><a href="#guidelines">Usage guidelines<Icon name="lucide:arrow-right"/></a></div></header>
     <div className="catalog-gallery-tools"><span role="status">{visible.length} {visible.length===1?'entry':'entries'}{query?' matching your search':activeFamily?` in ${activeFamily.name}`:' in the library'}</span><span>{referenceComponents.length} reference entries · {componentCatalog.length-referenceComponents.length} Forge additions</span></div>
     {!visible.length&&<div className="catalog-empty"><h2>No matching components</h2><p>Try a component name, variant, behavior or implementation.</p><Button variant="secondary" onClick={()=>setQuery('')}>Clear search</Button></div>}
     {componentFamilies.map(group=>{const entries=visible.filter(item=>item.family===group.id);if(!entries.length)return null;return <section className="catalog-family" key={group.id} aria-labelledby={`catalog-family-${group.id}`}><div className="catalog-family-heading"><h2 id={`catalog-family-${group.id}`}>{group.name}</h2><span>{entries.length}</span></div><div className="catalog-gallery">{entries.map(item=><article className="catalog-tile" key={item.id}><div className={`catalog-preview catalog-preview--thumbnail ${item.kind==='gap'?'has-gap':''}`} data-example-id={item.id}><CatalogExample spec={item} thumbnail/></div><a href={item.href} className="catalog-tile-label"><h3>{item.name}</h3>{item.deprecated?<span className="catalog-tile-note">Deprecated</span>:item.kind==='gap'?<span className="catalog-tile-note">Gap</span>:<Icon name="lucide:arrow-right"/>}</a></article>)}</div></section>;})}
     <footer className="catalog-footer"><span>Shared design system</span><span>Semantic variables · Light and dark · Local only</span></footer>
   </div>}</main>
 </div></ForgeThemeBoundary></ForgeThemeProvider>;
}
