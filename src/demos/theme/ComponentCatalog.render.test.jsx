import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {componentCatalog,referenceComponents,componentFamilies,catalogSections,catalogComponentGroups,findComponent,filterCatalog} from './componentCatalog.js';
import CatalogExample from './CatalogExamples.jsx';
import ComponentCatalog,{readSemanticTheme} from './ComponentCatalog.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import {Breadcrumbs,Menu,MenuItem,OverflowList,Toast} from '@blueprintjs/core';
import {MultiSelect} from '@blueprintjs/select';
import DropdownMenu from '../../components/DropdownMenu.jsx';
import Button from '../../components/Button.jsx';
import BasicTable from '../../components/table/Basic.jsx';
import BasicTableSpecimen from './BasicTableSpecimen.jsx';
import TableBackfill from '../../components/table/basic/TableBackfill.jsx';
import {Context} from '../../core/context/Context.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();root=null;host=null;});
const mount=async(spec,props={})=>{
 if(!host){host=document.createElement('div');document.body.append(host);root=createRoot(host);}
 await act(async()=>root.render(<ForgeThemeProvider themeId="design-system-2" mode="light"><ForgeThemeBoundary windowKey="catalog-test"><CatalogExample key={`${spec.id}:${props.variant}:${props.state}`} spec={spec} thumbnail {...props}/></ForgeThemeBoundary></ForgeThemeProvider>));
};

it('covers the reference inventory, preserves unique routes and supplies the full documentation contract',()=>{
 expect(referenceComponents).toHaveLength(87);
 expect(componentCatalog).toHaveLength(103);
 expect(new Set(componentCatalog.map(item=>item.id)).size).toBe(componentCatalog.length);
 expect(componentFamilies.filter(f=>referenceComponents.some(item=>item.family===f.id))).toHaveLength(11);
 for(const spec of componentCatalog){
  expect(spec.variants.length,spec.id).toBeGreaterThan(0);
  expect(spec.anatomy.length,spec.id).toBeGreaterThan(1);
  expect(spec.behavior.length,spec.id).toBeGreaterThan(0);
  expect(spec.keyboard.length,spec.id).toBeGreaterThan(0);
  expect(spec.tokens.every(token=>!token.startsWith('--')),spec.id).toBe(true);
  expect(spec.usage,spec.id).toBeTruthy();expect(spec.avoid,spec.id).toBeTruthy();
  expect(findComponent(spec.id)).toBe(spec);
 }
 expect(filterCatalog('', 'patterns').map(item=>item.id)).toEqual(['list-page','drawer','dialog','full-screen','form-layout','document-form','analytical-report','comparison-layout']);
 expect(catalogSections.map(section=>section.name)).toEqual(['Components','Chat','Patterns']);
 expect(filterCatalog('', 'chat').map(item=>item.id)).toContain('chat-layout');
 expect(filterCatalog('', 'components').every(item=>!['chat','patterns'].includes(item.section))).toBe(true);
 expect(componentCatalog.filter(item=>item.navigationGroup==='dropdown').map(item=>item.id)).toEqual(expect.arrayContaining(['dropdown-menu','dropdown-menu-option']));
 expect(componentCatalog.every(item=>catalogSections.some(section=>section.id===item.section))).toBe(true);
 expect(componentCatalog.every(item=>!item.navigationGroup||catalogComponentGroups.some(group=>group.id===item.navigationGroup))).toBe(true);
 expect(findComponent('drawer').kind).toBe('pattern');
 expect(findComponent('dialog').family).toBe('patterns');
 expect(findComponent('table').implementation).toBe('Basic');
 expect(findComponent('table').section).toBe('components');
 expect(componentFamilies.find(item=>item.id==='table').name).toBe('Table');
 expect(catalogComponentGroups.find(item=>item.id==='table').name).toBe('Table');
 expect(findComponent('table').variants.some(value=>findComponent('table').states.includes(value))).toBe(false);
 expect(findComponent('table').states).not.toEqual(expect.arrayContaining(['With selection','With pending edits','Invalid edits']));
 for(const id of ['report-table','editable-table','list','metadata-list','overflow-list','table-selection-toolbar','tree-list']){
  expect(findComponent(id).section).toBe('chat');
  expect(findComponent(id).navigationGroup).toBe('table');
 }
 expect(filterCatalog('', 'forms')).toHaveLength(20);
 for(const id of ['typeahead','typeahead-item','rich-text-editor','rich-text-editor-auto-link-plugin','rich-text-editor-toolbar','bottom-sheet','bottom-sheet-switcher','command-palette','lightbox','overlay']) expect(findComponent(id)).toBeUndefined();
});

it.each(componentCatalog.map(spec=>[spec.name,spec]))('renders every documented variant and state of %s',async(_,spec)=>{
 for(const variant of spec.variants){await mount(spec,{variant});expect(host.textContent?.trim()||host.querySelector('svg,input,button,progress,[role],[aria-label]'),`${spec.id}: ${variant}`).toBeTruthy();}
 for(const state of spec.states){await mount(spec,{state});expect(host.childElementCount,`${spec.id}: ${state}`).toBeGreaterThan(0);}
 for(const size of spec.sizes||[]){await mount(spec,{iconSize:size.toLowerCase()});expect(host.querySelector('.forge-button--icon-only')).not.toBeNull();}
},20000);

it('uses native form validation for the full screen section outline after Create',async()=>{
 await mount(findComponent('full-screen'),{variant:'Create',thumbnail:false});
 expect(host.querySelector('.forge-fullscreen-form')).toBeNull();
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Open full screen').click());
 const form=document.querySelector('.forge-fullscreen-dialog .forge-fullscreen-form');
 const sections=[...form.querySelectorAll('[data-fullscreen-section]')];
 const scroll=vi.fn();form.querySelector('.forge-fullscreen-body').scrollTo=scroll;
 expect(form.querySelectorAll('[aria-invalid=true]')).toHaveLength(0);
 expect(form.querySelectorAll('[data-invalid=true]')).toHaveLength(0);
 await act(async()=>form.querySelector('button[type=submit]').click());
 expect(form.querySelectorAll('[aria-invalid=true]')).toHaveLength(4);
 expect(form.querySelectorAll('.forge-fullscreen-destination[data-invalid=true]')).toHaveLength(2);
 expect(form.querySelectorAll('.forge-fullscreen-section-title[data-invalid=true]')).toHaveLength(2);
 expect(form.querySelector('[role=alert]').textContent).toBe('Organization is required.');
 expect(form.querySelector('.forge-fullscreen-footer').textContent).toBe('CancelCreate Workspace');
 expect([...form.querySelectorAll('.forge-fullscreen-destination-copy')].map(node=>node.textContent)).toEqual(['Identity','Account Settings','Contact Information']);
 expect(document.activeElement.name).toBe('organization');
 expect(scroll).toHaveBeenCalledTimes(1);
 const contact=form.querySelector('[aria-label="3. Contact Information"]');
 await act(async()=>contact.click());
 expect(document.activeElement.name).toBe('contact');
 expect(contact.getAttribute('aria-current')).toBe('location');
 expect(sections.every(section=>section.querySelector('[data-forge-component=section]'))).toBe(true);
 const organization=form.querySelector('select[name=organization]');
 await act(async()=>{organization.value='design';organization.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(organization.getAttribute('aria-invalid')).toBeNull();
 expect(form.querySelectorAll('[aria-invalid=true]')).toHaveLength(3);
 const type=async(name,value)=>act(async()=>{const input=form.querySelector(`input[name=${name}]`);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 await type('name','Example workspace');
 for(const [name,value] of [['category','internal'],['timezone','utc']])await act(async()=>{const select=form.querySelector(`select[name=${name}]`);select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(form.querySelectorAll('[aria-invalid=true]')).toHaveLength(0);
 expect(form.querySelectorAll('[data-invalid=true]')).toHaveLength(0);
 await type('email','invalid-email');
 expect(form.querySelector('input[name=email]').getAttribute('aria-invalid')).toBe('true');
 expect(form.querySelector('[aria-label="3. Contact Information, 1 field needs attention"]')).not.toBeNull();
 await type('email','review@example.com');
 expect(form.querySelectorAll('[aria-invalid=true]')).toHaveLength(0);
 await mount(findComponent('full-screen'),{variant:'Create',state:'Disabled',thumbnail:false});
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Open full screen').click());
 const disabledForm=document.querySelector('.forge-fullscreen-dialog .forge-fullscreen-form');
 expect([...disabledForm.querySelectorAll('input,select')].every(field=>field.disabled)).toBe(true);
 expect(disabledForm.querySelector('button[type=submit]').disabled).toBe(true);
 expect(disabledForm.querySelector('.forge-fullscreen-destination').disabled).toBe(false);
});

it.each([0,73])('follows the full screen native scroll and edited section with a %spx header inset',async inset=>{
 await mount(findComponent('full-screen'),{thumbnail:false});
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Open full screen').click());
 const form=document.querySelector('.forge-fullscreen-dialog form');
 const viewport=form.querySelector('.forge-fullscreen-body');
 // JSDOM has no Web Animations API for the native scroll-activity owner.
 viewport.parentElement.querySelectorAll('.forge-scroll-area__thumb').forEach(thumb=>{
  thumb.getAnimations=()=>[];thumb.animate=()=>({id:''});
 });
 const cards=[...form.querySelectorAll('[data-fullscreen-section]')];
 const current=()=>form.querySelector('.forge-fullscreen-destination[aria-current=location]')?.textContent;
 Object.defineProperties(viewport,{clientHeight:{value:400,configurable:true},scrollHeight:{value:1200,configurable:true}});
 viewport.style.scrollPaddingTop=`${inset}px`;
 viewport.getBoundingClientRect=()=>({top:64});
 cards.forEach((card,index)=>{
  card.style.scrollMarginTop='16px';
  card.getBoundingClientRect=()=>({top:64+[24,400,820][index]-viewport.scrollTop});
 });
 const nav=form.querySelector('.forge-fullscreen-outline');
 Object.defineProperties(nav,{clientWidth:{value:390},scrollWidth:{value:648}});
 nav.style.paddingInlineStart='16px';
 nav.getBoundingClientRect=()=>({left:0,right:390});
 nav.scrollTo=({left})=>{nav.scrollLeft=Math.max(0,Math.min(258,left));};
 [...nav.querySelectorAll('button')].forEach((button,index)=>{
  button.getBoundingClientRect=()=>({left:16+208*index-nav.scrollLeft,right:216+208*index-nav.scrollLeft});
 });
 const scrollTo=async top=>act(async()=>{viewport.scrollTop=top;viewport.dispatchEvent(new Event('scroll'));});
 const readingInset=inset+(400-inset)/4;
 await scrollTo(400-readingInset-16-2);
 expect(current()).toBe('1Identity');
 await scrollTo(400-readingInset-16);
 expect(current()).toBe('2Account Settings');
 expect(nav.scrollLeft).toBe(50);
 await scrollTo(800);
 expect(current()).toBe('3Contact Information');
 expect(nav.scrollLeft).toBe(258);
 await scrollTo(0);
 expect(current()).toBe('1Identity');
 expect(nav.scrollLeft).toBe(0);
 const contact=form.querySelector('input[name=contact]');
 await act(async()=>contact.focus());
 expect(current()).toBe('3Contact Information');
 await scrollTo(400);
 expect(current()).toBe('2Account Settings');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(contact,'Example contact');contact.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(current()).toBe('3Contact Information');
 viewport.scrollTo=({top})=>{viewport.scrollTop=Math.min(viewport.scrollHeight-viewport.clientHeight,top);viewport.dispatchEvent(new Event('scroll'));};
 await act(async()=>form.querySelector('[aria-label="3. Contact Information"]').click());
 expect(current()).toBe('3Contact Information');
 expect(document.activeElement).toBe(contact);
 Object.defineProperty(viewport,'clientHeight',{value:900,configurable:true});
 await act(async()=>form.querySelector('[aria-label="2. Account Settings"]').click());
 expect(viewport.scrollTop).toBe(300);
 expect(current()).toBe('2Account Settings');
 await scrollTo(0);
 await scrollTo(300);
 expect(current()).toBe('3Contact Information');
 Object.defineProperty(viewport,'scrollHeight',{value:400,configurable:true});
 await act(async()=>form.querySelector('input[name=name]').focus());
 await scrollTo(0);
 expect(current()).toBe('1Identity');
});

it('completes the full screen Apply example locally and opens the native modal',async()=>{
 await mount(findComponent('full-screen'),{variant:'Apply',thumbnail:false});
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Open full screen').click());
 const dialog=document.querySelector('.forge-fullscreen-dialog[role=dialog]');
 expect(dialog).not.toBeNull();
 expect(dialog.getAttribute('aria-modal')).toBe('true');
 expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Edit Workspace');
 expect(dialog.querySelector('.forge-scroll-area__viewport')).not.toBeNull();
 await act(async()=>dialog.querySelector('button[type=submit]').click());
 expect(host.textContent).toContain('Example changes applied locally.');
});

it('lets an open native picker consume Escape before the full screen dialog',async()=>{
 await mount(findComponent('full-screen'),{thumbnail:false});
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Open full screen').click());
 const select=document.querySelector('.forge-fullscreen-dialog select[name=organization]');
 const originalMatches=select.matches;
 select.matches=function(selector){return selector===':open'||originalMatches.call(this,selector);};
 const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
 await act(async()=>select.dispatchEvent(escape));
 expect(escape.defaultPrevented).toBe(false);
 expect(document.querySelector('.forge-fullscreen-dialog')).not.toBeNull();
 select.matches=originalMatches;
});

it('keeps busy and read-only actions unavailable and exposes the busy state',async()=>{
 const spec=findComponent('button');await mount(spec,{state:'Loading'});
 expect(host.querySelector('button').disabled).toBe(true);expect(host.querySelector('button').getAttribute('aria-busy')).toBe('true');
 await mount(spec,{state:'Read only'});expect(host.querySelector('button').disabled).toBe(true);
});

it('demonstrates pending and failed option content inside the same native filter drawer',async()=>{
 const drawer=findComponent('drawer');
 const action=text=>[...document.querySelectorAll('button')].find(button=>button.textContent===text);
 await mount(drawer,{variant:'Filter view',state:'Loading options'});
 await act(async()=>action('Open drawer').click());
 await act(async()=>action('Name').click());
 expect(document.querySelectorAll('.forge-filter-options-skeleton__row')).toHaveLength(6);
 expect(action('Apply').disabled).toBe(true);
 await mount(drawer,{variant:'Filter view',state:'Load error'});
 await act(async()=>action('Open drawer').click());
 await act(async()=>action('Name').click());
 const retry=document.querySelector('button[aria-label="Retry filter options"]');
 expect(retry).not.toBeNull();
 await act(async()=>{retry.focus();retry.click();});
 expect(document.querySelectorAll('.forge-drawer-choice-list input[type=checkbox]')).toHaveLength(4);
 expect(document.activeElement?.getAttribute('aria-label')).toBe('Search filter options');
});

it('uses the native workspace table for typed cells, headers, staged edits and column totals',async()=>{
 const spec=findComponent('table');
 await mount(spec,{variant:'Links and status'});
 expect(host.querySelector('.basic-table-wrapper')).not.toBeNull();
 expect(host.querySelector('.forge-list-page')).toBeNull();
 expect(host.querySelectorAll('td[data-col=status] .forge-status-chip')).toHaveLength(2);
 expect(host.querySelector('td[data-col=name] .forge-table-link')).not.toBeNull();
 await mount(spec,{variant:'Editable cells'});
 expect(host.querySelector('[data-summary-column=amount]').textContent).toBe('$2,580.25');
 await act(async()=>host.querySelector('button[aria-label="Edit Email 1001"]').click());
 const email=host.querySelector('input[aria-label="Email 1001"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(email,'invalid');email.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(email.getAttribute('aria-invalid')).toBe('true');
 expect([...host.querySelectorAll('button')].find(button=>button.textContent==='Apply changes').disabled).toBe(true);
 expect(host.querySelector('[data-summary-column=amount]').textContent).toBe('$2,580.25');
});

it.each(['light','dark'])('stages composed Dropdown and Switch edits without selecting the row (%s)',async mode=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(<ForgeThemeProvider themeId="design-system-2" mode={mode}><ForgeThemeBoundary><BasicTableSpecimen variant="Dropdown and Switch"/></ForgeThemeBoundary></ForgeThemeProvider>));
 const control=label=>host.querySelector(`button[aria-label="${label}"]`);
 const clickAction=async label=>act(async()=>[...host.querySelectorAll('button')].find(e=>e.textContent===label).click());
 expect(control('Status 1001').textContent).toBe('Active');
 expect(control('Status 1001').dataset.forgeVariant).toBe('ghost');
 expect(control('Verified 1001').getAttribute('aria-checked')).toBe('true');
 await act(async()=>control('Status 1001').click());
 const options=()=>[...document.querySelectorAll('.forge-dropdown-menu [role=option]')];
 expect(options().map(e=>e.textContent)).toEqual(['Active','Paused','Archived','Custom status']);
 expect(options().find(e=>e.getAttribute('aria-selected')==='true').textContent).toBe('Active');
 await act(async()=>options().find(e=>e.textContent==='Paused').querySelector('a').click());
 expect(control('Status 1001').textContent).toBe('Paused');
 await act(async()=>control('Verified 1001').click());
 expect(control('Status 1001').textContent).toBe('Paused');
 expect(control('Verified 1001').getAttribute('aria-checked')).toBe('false');
 expect(host.querySelector('.forge-table-edit-review').textContent).toContain('2 unsaved changes in 1 row');
 expect(host.querySelector('tbody input[aria-label="Select row"]').checked).toBe(false);
 expect(host.querySelectorAll('[data-edit-state=pending]')).toHaveLength(2);
 expect([...host.querySelectorAll('button')].find(e=>e.textContent==='Apply changes').disabled).toBe(false);
 await clickAction('Revert all');
 expect(control('Status 1001').textContent).toBe('Active');
 expect(control('Verified 1001').getAttribute('aria-checked')).toBe('true');
 expect(host.querySelector('.forge-table-edit-review')).toBeNull();
 await act(async()=>control('Verified 1001').click());
 await clickAction('Apply changes');
 expect(control('Verified 1001').getAttribute('aria-checked')).toBe('false');
 expect(host.querySelector('.forge-table-edit-review')).toBeNull();
 for(const id of [1003,1004]){
  expect(control(`Status ${id}`).disabled).toBe(true);
  expect(control(`Verified ${id}`).disabled).toBe(true);
  await act(async()=>control(`Verified ${id}`).click());
 }
 expect(host.querySelector('.forge-table-edit-review')).toBeNull();
});

it.each(['design-system-2','baseline'])('uses the requested native error icon only in DS2 (%s)',async themeId=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const context={signals:{control:{value:{error:{message:'The sample rows could not be loaded.'}}}}};
 await act(async()=>root.render(<ForgeThemeProvider themeId={themeId}><table><tbody><TableBackfill context={context} rowCount={1} colSpan={1} collection={[]}/></tbody></table></ForgeThemeProvider>));
 expect(host.querySelector('[role=alert]').textContent).toContain('could not be loaded');
 expect(!!host.querySelector('.forge-table-error-message .lucide-info')).toBe(themeId==='design-system-2');
 expect(!!host.querySelector('.forge-table-error-message .lucide-circle-alert')).toBe(themeId==='baseline');
});

it('composes list-page actions with native row selection and reversible starred filtering',async()=>{
 await mount(findComponent('list-page'));
 const actions=()=>[...host.querySelectorAll('.toolbar-left button')].find(button=>button.textContent==='Actions');
 expect(actions().disabled).toBe(false);
 expect(actions().querySelector('svg.lucide-chevron-down')).not.toBeNull();
 await act(async()=>host.querySelector('[aria-label="Select row"]').click());
 expect(actions().disabled).toBe(false);
 expect(host.querySelector('[data-summary-column=amount]').textContent).toBe('$113,240.00');
 expect(host.querySelector('tfoot').textContent).toContain('1 selected');
 await act(async()=>host.querySelector('[aria-label="Starred view"]').click());
 expect(host.querySelector('tfoot').textContent.toLowerCase()).toContain('2 records');
 expect(host.querySelector('[data-summary-column=amount]').textContent).toBe('$47,315.00');
 expect(actions().disabled).toBe(false);
 expect(host.querySelector('[aria-label="Starred view"]').getAttribute('aria-pressed')).toBe('true');
 await act(async()=>host.querySelector('[aria-label="Starred view"]').click());
 expect(host.querySelector('tfoot').textContent.toLowerCase()).toContain('5 records');
});

it('combines table search and stable record-choice filtering without replacing either binding',async()=>{
 await mount(findComponent('list-page'));
 const input=host.querySelector('input[aria-label="Search records"]');
 const change=async(node,value)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});
 await change(input,'Design');
 expect(host.querySelectorAll('tbody tr:has(td[data-col=id])')).toHaveLength(1);
 await act(async()=>host.querySelector('button[aria-label="Filter records"]').click());
 await act(async()=>[...document.querySelectorAll('.forge-drawer-options button')].find(button=>button.textContent==='Record name').click());
 const choices=document.querySelectorAll('.forge-drawer-choice-list input[type=checkbox]');
 expect(choices).toHaveLength(6); // Select all plus all five records, independent of table search.
 await act(async()=>choices[1].click());
 await act(async()=>[...document.querySelectorAll('.forge-drawer-actions button')].find(button=>button.textContent==='Apply').click());
 expect(host.querySelector('.forge-list-page__filters').textContent).toContain('Record name: Design foundations');
 await change(input,'Component');
 expect(host.querySelectorAll('tbody tr:has(td[data-col=id])')).toHaveLength(0);
 await change(input,'');
 expect(host.querySelectorAll('tbody tr:has(td[data-col=id])')).toHaveLength(1);
 await act(async()=>host.querySelector('button[aria-label="Remove Record name filter"]').click());
 expect(host.querySelectorAll('tbody tr:has(td[data-col=id])')).toHaveLength(5);
 expect(host.querySelectorAll('td[data-col=status] .forge-status-chip')).toHaveLength(5);
});

it('applies the native list-page presentation only in DS2 and retains its existing select binding',async()=>{
 const metadata={actions:{import:()=>({})},dataSource:{records:{autoFetch:false,cardinality:'collection',selectionMode:'multi',uniqueKey:[{field:'id'}]}}};
 const windowContext=Context('native-list-pattern-test',metadata,'records',{});
 windowContext.init();
 const context=windowContext.Context('records');
 context.handlers.dataSource.setCollection([{id:1,name:'Example record'}]);
 context.signals.control.value={loaded:true};
 const container={id:'records',title:'Records',fetchData:false,table:{presentation:'list-page',toolbar:{items:[
  {id:'period',type:'dateRangePreset',placement:'header',align:'right',value:'current_month',options:[{value:'current_month',label:'Month'}]},
  {id:'view',label:'View',type:'select',scope:'windowForm',appearance:'starred-toggle',value:'all',options:[{value:'all',label:'All records'},{value:'starred',label:'Starred only'}]},
  {id:'search',type:'quickSearch',appearance:'field',properties:{field:'name',placeholder:'Search records'}},
  {id:'settings',icon:'settings',label:'Customize',hideLabel:true,align:'right'},
 ]}}};
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const render=theme=><ForgeThemeProvider themeId={theme} mode="light"><ForgeThemeBoundary><BasicTable container={container} context={context} columns={[{id:'name',name:'Name'}]}/></ForgeThemeBoundary></ForgeThemeProvider>;
 try {
  await act(async()=>root.render(render('baseline')));
  expect(host.querySelector('.forge-list-page')).toBeNull();
  expect(host.querySelector('.forge-toolbar-select-trigger')).not.toBeNull();
  await act(async()=>root.render(render('design-system-2')));
  expect(host.querySelector('.forge-list-page h1').textContent).toBe('Records');
  expect(host.querySelector('.forge-list-page__period').textContent).toContain('Month:');
  expect(host.querySelector('input[placeholder="Search records"]')).not.toBeNull();
  await act(async()=>host.querySelector('[aria-label="Starred view"]').click());
  expect(context.signals.windowForm.peek().view).toBe('starred');
  expect(host.querySelector('[aria-label="Starred view"]').getAttribute('aria-pressed')).toBe('true');
  await act(async()=>host.querySelector('[data-testid="toolbar-btn-settings"]').click());
  expect(document.querySelector('.bp6-drawer.forge-table-settings')).not.toBeNull();
 } finally {
  await act(async()=>root.unmount());root=null;windowContext.dispose();
 }
});

it('uses native breadcrumb renderers with the existing dropdown and selection callbacks',async()=>{
 const select=vi.fn();
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(<Breadcrumbs minVisibleItems={2} items={[{text:'Documents'},{text:'Design foundations'}]}
  breadcrumbRenderer={item=><DropdownMenu content={<Menu><MenuItem text="Component library" onClick={select}/></Menu>}><Button variant="ghost">{item.text}</Button></DropdownMenu>}/>));
 expect(host.querySelectorAll('ol>li button')).toHaveLength(2);
 await act(async()=>[...host.querySelectorAll('button')].find(node=>node.textContent==='Design foundations').click());
 await act(async()=>[...document.querySelectorAll('.bp6-menu-item')].find(node=>node.textContent==='Component library').click());
 expect(select).toHaveBeenCalledOnce();
});

it('reuses table Customize in the drawer catalog and discards cancelled column edits',async()=>{
 await mount(findComponent('drawer'),{variant:'Customize view'});
 await act(async()=>[...host.querySelectorAll('button')].find(node=>node.textContent==='Open drawer').click());
 const drawer=document.querySelector('.bp6-drawer.forge-table-settings');
 expect(drawer).not.toBeNull();
 expect([...drawer.querySelectorAll('.forge-drawer-actions button')].map(button=>button.textContent)).toEqual(['Cancel','Apply']);
 const view=name=>[...drawer.querySelectorAll('[role="option"]')].find(node=>node.textContent===name);
 expect(view('Default').getAttribute('aria-selected')).toBe('true');
 await act(async()=>view('All Columns').querySelector('.bp6-menu-item').click());
 expect(view('All Columns').getAttribute('aria-selected')).toBe('true');
 expect(view('Default').getAttribute('aria-selected')).toBe('false');
 await act(async()=>view('Default').querySelector('.bp6-menu-item').click());
 expect(view('Default').getAttribute('aria-selected')).toBe('true');
 const owner=()=>[...document.querySelectorAll('.forge-list-page-drawer label')].find(node=>node.textContent==='Owner').querySelector('input');
 expect(owner().checked).toBe(true);
 await act(async()=>owner().click());
 await act(async()=>[...drawer.querySelectorAll('button')].find(node=>node.textContent==='Cancel').click());
 await act(async()=>[...host.querySelectorAll('button')].find(node=>node.textContent==='Open drawer').click());
 expect(owner().checked).toBe(true);
 expect(document.querySelector('.forge-list-page-drawer input:disabled').checked).toBe(true);
});

it('reuses table Filter in the drawer catalog and commits the selected options through Apply',async()=>{
 await mount(findComponent('drawer'),{variant:'Filter view'});
 await act(async()=>[...host.querySelectorAll('button')].find(node=>node.textContent==='Open drawer').click());
 const drawer=()=>document.querySelector('.bp6-drawer.forge-filter-dialog');
 expect(drawer()).not.toBeNull();
 await act(async()=>[...drawer().querySelectorAll('button')].find(node=>node.textContent==='Status').click());
 const apply=()=>[...drawer().querySelectorAll('button')].find(node=>node.textContent==='Apply');
 expect(apply().disabled).toBe(true);
 const ready=()=>[...drawer().querySelectorAll('label')].find(node=>node.textContent==='Ready').querySelector('input');
 await act(async()=>ready().click());
 expect(apply().disabled).toBe(false);
 await act(async()=>apply().click());
 await act(async()=>[...host.querySelectorAll('button')].find(node=>node.textContent==='Open drawer').click());
 await act(async()=>[...drawer().querySelectorAll('button')].find(node=>node.textContent==='Status').click());
 expect(ready().checked).toBe(true);
 expect([...drawer().querySelectorAll('.forge-drawer-actions button')].map(button=>button.textContent)).toEqual(['Cancel','Apply']);
});

it('switches sibling documents through each native breadcrumb dropdown',async()=>{
 await mount(findComponent('breadcrumbs'));
 expect(host.querySelectorAll('.forge-super-breadcrumbs__trigger')).toHaveLength(3);
 await act(async()=>host.querySelector('[aria-label="Switch document: Design foundations"]').click());
 await act(async()=>[...document.querySelectorAll('.bp6-menu-item')].find(node=>node.textContent==='Component library').click());
 expect(host.querySelector('[aria-label="Switch document: Component library"]').getAttribute('aria-current')).toBe('page');
 await act(async()=>host.querySelector('[aria-label="Switch collection: Documents"]').click());
 await act(async()=>[...document.querySelectorAll('.bp6-menu-item')].find(node=>node.textContent==='Guidelines').click());
 expect(host.querySelector('[aria-label="Switch document: Usage guidelines"]')).not.toBeNull();
});

it('keeps compact pagination within its bounds and announces the page once',async()=>{
 await mount(findComponent('pagination'));
 const previous=host.querySelector('[aria-label="Previous page"]'),next=host.querySelector('[aria-label="Next page"]');
 expect(previous.disabled).toBe(true);expect(next.dataset.forgeSize).toBe('compact');
 await act(async()=>next.click());await act(async()=>next.click());await act(async()=>next.click());
 expect(host.querySelector('[role="status"]').textContent).toBe('3 / 3');expect(next.disabled).toBe(true);
 expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
});

it('lets users revisit stepper steps without inventing completion and retains validation statuses',async()=>{
 await mount(findComponent('stepper'),{state:'Error'});
 const steps=host.querySelectorAll('.forge-stepper button');
 expect(steps[0].dataset.stepStatus).toBe('success');expect(steps[1].dataset.stepStatus).toBe('error');
 expect(steps[1].getAttribute('aria-label')).toContain('Error');expect(steps[1].textContent).not.toContain('Error');
 await act(async()=>steps[2].click());
 expect(steps[2].getAttribute('aria-current')).toBe('step');expect(steps[1].dataset.stepStatus).toBe('error');
 expect(steps[2].dataset.stepStatus).toBe('pending');
 await mount(findComponent('stepper'),{state:'Missing information'});
 expect(host.querySelector('[data-step-status="missing"]').getAttribute('aria-label')).toContain('Missing information');expect(host.querySelector('.forge-stepper__status')).toBeNull();
});

it('shows native Workspace close and expand actions without touching real windows',async()=>{
 await mount(findComponent('tab-list'),{variant:'Workspace'});
 expect(host.querySelectorAll('.forge-window-tab-action[aria-label^="Close "]')).toHaveLength(3);
 const expand=host.querySelector('[aria-label="Expand Overview"]');
 expect(expand.querySelector('svg')).not.toBeNull();
 await act(async()=>expand.click());
 expect(host.querySelector('[role="status"]').textContent).toBe('Expand requested for Overview.');
 expect(host.querySelector('[role="tab"][aria-selected="true"]').textContent).toContain('Overview');
 await act(async()=>host.querySelector('[aria-label="Close Activity"]').click());
 expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
 expect(host.querySelector('[role="tab"][aria-selected="true"]').textContent).toContain('Overview');
 await act(async()=>host.querySelector('[aria-label="Close Overview"]').click());
 const selected=host.querySelector('[role="tab"][aria-selected="true"]');
 expect(selected.textContent).toContain('Settings');
 expect(host.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe(selected.id);
 await act(async()=>host.querySelector('[aria-label="Close Settings"]').click());
 expect(host.querySelectorAll('[role="tab"]')).toHaveLength(0);
 await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Restore example tabs').click());
 expect(host.querySelectorAll('[role="tab"]')).toHaveLength(3);
 await mount(findComponent('tab-list'),{variant:'Workspace',state:'Disabled'});
 expect([...host.querySelectorAll('.forge-window-tab-action')].every(button=>button.disabled)).toBe(true);
});

it('keeps Contained tabs on the native panel owner with selection and disabled semantics',async()=>{
 await mount(findComponent('tab-list'),{variant:'Contained'});
 const tabs=[...host.querySelectorAll('.forge-form-panel-tabs [role="tab"]')];
 expect(tabs).toHaveLength(3);
 expect(tabs[0].getAttribute('aria-selected')).toBe('true');
 await act(async()=>tabs[1].click());
 expect(tabs[1].getAttribute('aria-selected')).toBe('true');
 const panel=host.querySelector('[role="tabpanel"]');
 expect(panel.getAttribute('aria-labelledby')).toBe(tabs[1].id);
 expect(panel.textContent).toContain('Recent updates');
 await mount(findComponent('tab-list'),{variant:'Contained',state:'Disabled'});
 expect([...host.querySelectorAll('[role="tab"]')].every(tab=>tab.getAttribute('aria-disabled')==='true')).toBe(true);
});

it('uses the native tab keyboard path and exposes distinct Top Nav utilities and disabled states',async()=>{
 await mount(findComponent('tab-list'),{variant:'With icons'});
 const tabs=host.querySelectorAll('[role="tab"]');expect(tabs[0].querySelector('svg')).not.toBeNull();
 await act(async()=>tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
 expect(host.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Activity');
 expect(host.querySelector('[role="tabpanel"]').textContent).toContain('Recent updates');
 await mount(findComponent('tab-list'),{state:'Disabled'});expect([...host.querySelectorAll('[role="tab"]')].every(node=>node.disabled)).toBe(true);
 await mount(findComponent('top-nav'));expect(host.querySelector('[aria-label="Notifications"]')).toBeNull();
 await mount(findComponent('top-nav'),{variant:'With actions'});expect(host.textContent).toContain('New document');
 await mount(findComponent('top-nav'),{variant:'With search'});expect(host.querySelector('[aria-label="Search workspace"]')).not.toBeNull();
 await mount(findComponent('top-nav'),{variant:'With actions',state:'Disabled'});expect([...host.querySelectorAll('button')].every(node=>node.disabled)).toBe(true);
});

it('keeps the mega menu grouped with native headings and no featured variant',async()=>{
 const spec=findComponent('top-nav-mega-menu');expect(spec.variants).toEqual(['Grouped']);
 await mount(spec);
 expect(host.querySelectorAll('.forge-mega-menu .bp6-menu-header')).toHaveLength(2);
 expect(host.querySelectorAll('.forge-mega-menu .bp6-menu-item')).toHaveLength(4);
 expect(host.querySelector('.forge-mega-menu__feature')).toBeNull();
});

it('uses the native dialog for blue primary and red destructive confirmations',async()=>{
 await mount(findComponent('dialog'));
 await act(async()=>[...host.querySelectorAll('button')].find(n=>n.textContent==='Open dialog').click());
 let dialog=document.querySelector('[role="dialog"]');expect(dialog.textContent).toContain('Archive selected items?');
 expect(dialog.querySelector('[data-forge-variant="primary"]').textContent).toBe('Archive items');
 expect(dialog.querySelector('[data-forge-variant="ghost"]').textContent).toBe('Cancel');
 await mount(findComponent('dialog'),{variant:'Confirmation'});
 await act(async()=>[...host.querySelectorAll('button')].find(n=>n.textContent==='Open dialog').click());
 dialog=document.querySelector('[role="alertdialog"]');expect(dialog.textContent).toContain('Discard changes?');
 expect(dialog.querySelector('[data-forge-variant="ghost"]').textContent).toBe('Keep editing');
 await act(async()=>dialog.querySelector('[data-forge-variant="danger"]').click());
 expect(host.textContent).toContain('Example changes discarded.');
});

it('uses the native right-side drawer sizing and supports filter drilldown',async()=>{
 const spec=findComponent('drawer');
 expect(spec.variants).toEqual(['360px','560px','920px','1200px']);
 for(const size of ['360px','560px','920px','1200px']){
  await mount(spec,{variant:size});
  await act(async()=>[...host.querySelectorAll('button')].find(n=>n.textContent==='Open drawer').click());
  const drawer=document.querySelector('.bp6-drawer');expect(drawer.classList.contains('bp6-position-right')).toBe(true);expect(drawer.style.width).toBe(size);
  expect([...drawer.querySelectorAll('button')].find(n=>n.textContent==='Apply').disabled).toBe(true);
 }
 await mount(spec,{variant:'Filter view'});
 await act(async()=>[...host.querySelectorAll('button')].find(n=>n.textContent==='Open drawer').click());
 let drawer=document.querySelector('.bp6-drawer');
 await act(async()=>[...drawer.querySelectorAll('button')].find(n=>n.textContent==='Owner').click());
 expect(drawer.querySelector('[aria-label="Back to filters"]')).not.toBeNull();
 await act(async()=>drawer.querySelector('input[type="checkbox"]').click());
 expect([...drawer.querySelectorAll('button')].find(n=>n.textContent==='Apply').disabled).toBe(false);
 await act(async()=>drawer.querySelector('[aria-label="Back to filters"]').click());
 expect(drawer.textContent).toContain('Filter View');
});

it('uses distinct native toast intent icons and can restore a dismissed notification',async()=>{
 for(const [variant,intent,icon] of [['Information','primary','info'],['Success','success','circle-check'],['Warning','warning','triangle-alert'],['Danger','danger','circle-alert']]){
  await mount(findComponent('toast'),{variant});expect(host.querySelector(`.bp6-toast.bp6-intent-${intent}`)).not.toBeNull();expect(host.querySelector(`svg.lucide-${icon}`)).not.toBeNull();
 }
 await mount(findComponent('toast'),{state:'Dismissed'});expect(host.querySelector('.bp6-toast')).toBeNull();
 await act(async()=>host.querySelector('button').click());expect(host.querySelector('.bp6-toast')).not.toBeNull();
});

it('removes and restores standalone values and preserves disabled category tags',async()=>{
 const spec=findComponent('filter-chips');
 await mount(spec,{variant:'Removable Chip'});
 expect(host.querySelector('.forge-removable-chip').textContent).toContain('Workspace: 3 Selected');
 await act(async()=>host.querySelector('.forge-removable-chip').click());
 expect(host.querySelector('.forge-removable-chip')).not.toBeNull();
 await act(async()=>host.querySelector('button[aria-label="Remove Workspace"]').click());
 expect(host.querySelector('.forge-removable-chip')).toBeNull();
 await act(async()=>host.querySelector('button').click());
 expect(host.querySelector('.forge-removable-chip')).not.toBeNull();
 await mount(spec,{variant:'Removable Chip',state:'Disabled'});
 const remove=host.querySelector('button[aria-label="Remove Workspace"]');
 expect(remove.disabled).toBe(true);
 await act(async()=>remove.click());
 expect(host.querySelector('.forge-removable-chip')).not.toBeNull();
});

it('uses the native Toast action and timeout APIs for close and automatic dismissal',async()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const dismissed=vi.fn();
 await act(async()=>root.render(<Toast message="Saved" isCloseButtonShown={false} action={{text:'Close','aria-label':'Close'}} timeout={0} onDismiss={dismissed}/>));
 await act(async()=>host.querySelector('[aria-label="Close"]').click());
 expect(dismissed).toHaveBeenLastCalledWith(false);
 vi.useFakeTimers();
 try{
  await act(async()=>root.render(<Toast key="automatic" message="Saved" isCloseButtonShown={false} timeout={4000} onDismiss={dismissed}/>));
  expect(host.querySelector('button,a')).toBeNull();
  await act(async()=>vi.advanceTimersByTime(3999));expect(dismissed).toHaveBeenCalledTimes(1);
  await act(async()=>vi.advanceTimersByTime(1));expect(dismissed).toHaveBeenLastCalledWith(true);
 }finally{vi.useRealTimers();}
});

it('closes manual toasts through the ghost action and automatically dismisses every no-close type after four seconds',async()=>{
 const spec=findComponent('toast');
 await mount(spec,{variant:'Success'});
 expect(host.querySelector('.forge-toast-dismiss svg.lucide-x')).not.toBeNull();
 await act(async()=>host.querySelector('.forge-toast-dismiss').click());expect(host.querySelector('.bp6-toast')).toBeNull();
 vi.useFakeTimers();
 try{
  for(const type of ['Information','Success','Warning','Danger']){
   await mount(spec,{variant:`${type} auto dismiss`});
   expect(host.querySelector('.bp6-toast')).not.toBeNull();expect(host.querySelector('.bp6-toast button,.bp6-toast a')).toBeNull();
   await act(async()=>vi.advanceTimersByTime(3999));expect(host.querySelector('.bp6-toast')).not.toBeNull();
   await act(async()=>vi.advanceTimersByTime(1));expect(host.querySelector('.bp6-toast')).toBeNull();
  }
 }finally{vi.useRealTimers();}
});

it('opens the learn-more panel on native hover without moving focus and retains its accessible link',async()=>{
 const spec=findComponent('tooltip');expect(spec.variants).toEqual(['Text','Keyboard hint','With heading','With learn more']);
 await mount(spec,{variant:'With learn more'});
 vi.useFakeTimers();
 const focused=document.activeElement;
 try{
 await act(async()=>host.querySelector('[aria-label="About workspace access"]').dispatchEvent(new MouseEvent('mouseover',{bubbles:true})));
 await act(async()=>vi.advanceTimersByTime(151));
 const panel=document.querySelector('[role="dialog"][aria-label="About workspace access"]');
 expect(panel.textContent).toContain('Workspace access');expect(panel.querySelector('a').getAttribute('href')).toBe('#guidelines');
 expect(document.querySelector('.forge-tooltip-help .bp6-popover-arrow')).toBeNull();
 expect(document.activeElement).toBe(focused);
 await act(async()=>panel.querySelector('a').focus());expect(document.activeElement).toBe(panel.querySelector('a'));
 }finally{vi.useRealTimers();}
});

it('allows an initially enabled switch variant to be turned off',async()=>{
 const spec=findComponent('switch');expect(spec.states).toContain('Selected + Disabled');
 await mount(spec,{variant:'On'});
 let control=host.querySelector('[role="switch"]');expect(control.getAttribute('aria-checked')).toBe('true');
 await act(async()=>control.click());control=host.querySelector('[role="switch"]');expect(control.getAttribute('aria-checked')).toBe('false');
 await mount(spec,{variant:'On',state:'Disabled'});control=host.querySelector('[role="switch"]');expect(control.disabled).toBe(true);expect(control.getAttribute('aria-checked')).toBe('false');
 await mount(spec,{state:'Selected + Disabled'});control=host.querySelector('[role="switch"]');expect(control.disabled).toBe(true);expect(control.getAttribute('aria-checked')).toBe('true');
});

it('uses the real field binding and retains typed input',async()=>{
 await mount(findComponent('text-input'));
 const input=host.querySelector('input');
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
 await act(async()=>{setter.call(input,'A retained document');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(host.querySelector('input').value).toBe('A retained document');
});

it('uses native report metrics and distinguishes zero from missing observations',async()=>{
 const spec=findComponent('metrics');
 await mount(spec,{variant:'Comparison',state:'Zero'});
 expect([...host.querySelectorAll('.forge-report-document-metric dd')].map(node=>node.textContent)).toEqual(['0','0.0%','$0.00']);
 await mount(spec,{variant:'Value',state:'Empty'});
 expect(host.querySelector('.forge-report-document-metric dd').textContent).toBe('No observations for this period.');
 await mount(spec,{variant:'Trend'});
 expect(host.querySelector('.forge-report-document-metric svg').getAttribute('aria-label')).toContain('solid: selected period; dashed: prior period');
 expect(host.textContent).toContain('12.0%');
 await mount(spec,{variant:'Value',state:'Error'});
 expect(host.textContent).toContain('could not be refreshed');
 expect(host.querySelector('.forge-report-document-metric dd')).toBeNull();
});

it('keeps the date value while browsing months and commits a chosen day once',async()=>{
 const spec=findComponent('date-input');await mount(spec);
 const input=host.querySelector('input');
 await act(async()=>input.focus());
 await act(async()=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'11/12/2026');
  input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 expect(input.value).toBe('11/12/2026');
 await act(async()=>document.querySelector('.forge-calendar-dropdown--months').click());
 const may=[...document.querySelectorAll('[role="option"]')].find(node=>node.textContent==='May');
 await act(async()=>may.querySelector('a').click());
 expect(input.value).toBe('11/12/2026');expect(input.getAttribute('aria-expanded')).toBe('true');
 const day=[...document.querySelectorAll('.rdp-day')].find(node=>node.textContent==='17'&&!node.disabled);
 await act(async()=>day.click());
 expect(input.value).toBe('05/17/2026');expect(input.getAttribute('aria-expanded')).toBe('false');
 await mount(spec,{state:'Disabled'});expect(host.querySelector('input').disabled).toBe(true);
});

it('distinguishes empty disabled checkboxes from selected disabled checkboxes',async()=>{
 const spec=findComponent('checkbox-input');
 await mount(spec,{variant:'Checked',state:'Disabled'});
 expect(host.querySelector('input').disabled).toBe(true);expect(host.querySelector('input').checked).toBe(false);
 await mount(spec,{variant:'Checked',state:'Selected + Disabled'});
 const input=host.querySelector('input');expect(input.disabled).toBe(true);expect(input.checked).toBe(true);
 await act(async()=>input.click());expect(input.checked).toBe(true);
});

it('combines a required field with a working help explanation',async()=>{
 await mount(findComponent('field'),{variant:'Required + With help'});
 const input=host.querySelector('input');expect(input.getAttribute('aria-required')).toBe('true');
 expect(host.querySelector('label').textContent.match(/\*/g)).toHaveLength(1);
 const help=host.querySelector('button[aria-label="Help for Project name"]');expect(help).toBeTruthy();
 await act(async()=>help.click());
 expect(document.querySelector('[role="dialog"][aria-label="Help for Project name"]').textContent).toContain('Use a descriptive name');
});

it('filters a searchable dropdown without clearing its committed value',async()=>{
 await mount(findComponent('searchable-dropdown'));
 await act(async()=>host.querySelector('button').click());
 const search=document.querySelector('input[aria-label="Search options"]');expect(search).toBeTruthy();
 const change=async value=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,value);search.dispatchEvent(new Event('input',{bubbles:true}));});
 await change('no such team');expect(document.body.textContent).toContain('No matching options');
 expect(host.querySelector('button').textContent).toContain('Design');
 await change('engine');
 const option=[...document.querySelectorAll('[role="option"]')].find(node=>node.textContent==='Engineering');expect(option).toBeTruthy();
 await act(async()=>option.querySelector('a').click());expect(host.querySelector('button').textContent).toContain('Engineering');
});

it('supports a native compact multi-select target with selected tags outside the available choices',async()=>{
 const choices=['One','Two','Three','Four','Five','Six'].map(label=>({value:label,label}));
 function NativeExample(){
  const [values,setValues]=React.useState(choices.slice(0,4));
  return <MultiSelect items={choices.filter(choice=>!values.includes(choice))} selectedItems={values} resetOnSelect
   popoverTargetProps={{tabIndex:0,'aria-label':'Choose values'}} tagInputProps={{inputProps:{'aria-label':'Search choices'}}}
   customTarget={selected=><div className="native-summary"><OverflowList items={selected} collapseFrom="end" visibleItemRenderer={item=><span key={item.value}>{item.label}</span>} overflowRenderer={hidden=><span>+{hidden.length}</span>}/></div>}
   tagRenderer={item=>item.label} onItemSelect={item=>setValues(previous=>[...previous,item])} onRemove={(_,index)=>setValues(previous=>previous.filter((_,i)=>i!==index))}
   itemRenderer={(item,{handleClick,modifiers})=><MenuItem key={item.value} roleStructure="listoption" text={item.label} active={modifiers.active} onClick={handleClick} shouldDismissPopover={false}/>}/>;
 }
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(<NativeExample/>));
 await act(async()=>host.querySelector('.native-summary').click());
 expect(document.querySelectorAll('.bp6-tag-input .bp6-tag')).toHaveLength(4);
 const labels=()=>[...document.querySelectorAll('[role="option"]')].map(node=>node.textContent);
 expect(labels()).toEqual(['Five','Six']);
});

it('hides multi-selector selections and restores an option when its tag is removed',async()=>{
 await mount(findComponent('multi-selector'),{variant:'Many selections'});
 await act(async()=>host.querySelector('.forge-multi-select-trigger').click());
 const menu=()=>document.querySelector('.forge-multi-select-popover [role="listbox"]');
 const labels=()=>[...menu().querySelectorAll('[role="option"]')].map(node=>node.textContent);
 expect(labels()).toEqual(['Support','Marketing','Analytics']);
 expect(document.querySelectorAll('.forge-multi-select-popover .bp6-tag-input .bp6-tag')).toHaveLength(5);
 await act(async()=>menu().querySelector('a').click());
 expect(labels()).toEqual(['Marketing','Analytics']);
 expect(document.querySelectorAll('.forge-multi-select-popover .bp6-tag-input .bp6-tag')).toHaveLength(6);
 await act(async()=>document.querySelector('.forge-multi-select-popover .bp6-tag-remove').click());
 expect(labels()).toEqual(['Design','Marketing','Analytics']);
});

it('edits the complete tokenizer collection without losing hidden tokens',async()=>{
 await mount(findComponent('tokenizer'),{variant:'Many tokens'});
 await act(async()=>host.querySelector('.forge-tokenizer-trigger').click());
 const panel=()=>document.querySelector('.forge-tokenizer-panel');
 expect(panel().querySelectorAll('.bp6-tag')).toHaveLength(5);
 const input=panel().querySelector('input');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Content');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true})));
 expect(panel().querySelectorAll('.bp6-tag')).toHaveLength(6);
 expect(host.querySelector('.forge-tokenizer-trigger').getAttribute('title')).toContain('Content');
 await act(async()=>panel().querySelector('.bp6-tag-remove').click());
 expect(panel().querySelectorAll('.bp6-tag')).toHaveLength(5);
 expect(host.querySelector('.forge-tokenizer-trigger').getAttribute('title')).not.toContain('Foundations');
});

it('changes the native time picker between AM and PM',async()=>{
 await mount(findComponent('time-input'));
 await act(async()=>host.querySelector('.catalog-time-trigger').click());
 const ampm=document.querySelector('.bp6-timepicker-ampm-select select');expect(ampm.value).toBe('am');
 await act(async()=>{ampm.value='pm';ampm.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(host.querySelector('.catalog-time-trigger').textContent).toContain('10:30 PM');
});

it('assembles a component page with all documentation sections and an actual stateful playground',async()=>{
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 try {
  await act(async()=>root.render(<ComponentCatalog route="components/button" mode="light" onModeChange={()=>{}}/>));
  expect(host.querySelector('h1').textContent).toBe('Button');
  expect(host.querySelector('[aria-label="Preview size"]')).toBeNull();
  expect([...host.querySelectorAll('[data-forge-size]')].every(node=>node.dataset.forgeSize==='default')).toBe(true);
  expect(host.querySelectorAll('.catalog-doc-section')).toHaveLength(7);
  expect(host.querySelectorAll('.catalog-anatomy dt')).toHaveLength(4);
  expect(host.querySelector('code').textContent).toContain("forge/components");
  const state=host.querySelector('[aria-label="Preview state"]');
  await act(async()=>{state.value='Loading';state.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.querySelector('#component-overview .catalog-preview button').getAttribute('aria-busy')).toBe('true');
 }finally{scroll.mockRestore();}
});

it('keeps Table configurations and current state presets distinct and labels the rendered columns accurately',async()=>{
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 try{
  await act(async()=>root.render(<ComponentCatalog route="components/table" mode="light" onModeChange={()=>{}}/>));
  const configuration=host.querySelector('[aria-label="Preview variant"]'),state=host.querySelector('[aria-label="Preview state"]');
  const preview=()=>host.querySelector('[data-example-id=table]');
  const choose=async(node,value)=>act(async()=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(configuration.closest('label').textContent).toMatch(/^Configuration/);
  expect(configuration.value).toBe('Text and IDs');
  await choose(configuration,'Numbers and dates');
  expect(preview().querySelector('th[data-column-id=amount]')).not.toBeNull();
  await choose(state,'Validation error');
  expect(configuration.value).toBe('Editable cells');
  expect(preview().querySelector('input[aria-label="Email 1001"]').getAttribute('aria-invalid')).toBe('true');
  expect([...preview().querySelectorAll('button')].find(x=>x.textContent==='Apply changes').disabled).toBe(true);
  await choose(configuration,'Header types');
  expect(state.value).toBe('Default');
  expect(preview().querySelector('[data-col=email]')).toBeNull();
  await choose(state,'Row selected');
  expect(configuration.value).toBe('Header types');
  expect(preview().querySelector('input[aria-label="Select row"]').checked).toBe(true);
  expect(preview().querySelector('tfoot').textContent).toContain('1 selected');
  await choose(state,'Load error');
  expect(preview().querySelector('[role=alert]').textContent).toContain('could not be loaded');
  await choose(state,'Empty');
  expect(preview().textContent).toContain('No records to display');
  expect(preview().querySelectorAll('tbody tr:has([data-col=id])')).toHaveLength(0);
  await choose(configuration,'Dropdown and Switch');
  await choose(state,'Read only');
  expect(configuration.value).toBe('Dropdown and Switch');
  expect(preview().querySelector('button[aria-label="Status 1001"]').disabled).toBe(true);
  expect(preview().querySelector('button[aria-label="Verified 1001"]').disabled).toBe(true);
  await choose(configuration,'Text and IDs');
  expect(state.value).toBe('Read only');
  const star=preview().querySelector('button[aria-label="Toggle starred record"]');
  expect(star.disabled).toBe(false);
  await act(async()=>star.click());
  expect(preview().querySelector('button[aria-label="Toggle starred record"]').getAttribute('aria-pressed')).toBe('false');
 }finally{scroll.mockRestore();}
});


it('shows the loaded semantic collection and derives renderer bindings from its actual stylesheet',async()=>{
 const style=document.createElement('style');
 style.textContent=`
  [data-forge-theme="design-system-2"] {
   --sample-alias-blue: #123456;
   --sample-semantic-action-background: var(--sample-alias-blue);
   --sample-semantic-type-body-family: "Example Sans";
   --sample-semantic-control-height: 40;
   --sample-semantic-action-disabled-background: #eeeeee;
   --forge-button-bg: var(--sample-semantic-action-background);
   --forge-control-height: calc(var(--sample-semantic-control-height) * 1px);
  }
  [data-forge-theme="design-system-2"] button:disabled {
   --forge-button-bg: var(--sample-semantic-action-disabled-background);
  }
  [data-forge-theme="design-system-2"][data-forge-color-mode="dark"] {
   --sample-semantic-action-background: #abcdef;
  }
 `;
 document.head.append(style);
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 try {
  await act(async()=>root.render(<ComponentCatalog route="variables" mode="light" onModeChange={()=>{}}/>));
  const scope=host.querySelector('[data-forge-theme]');
  const light=readSemanticTheme(scope,['button-bg','control-height']);
  expect(light.bindings['button-bg']).toEqual(['--sample-semantic-action-background']);
  expect(light.bindings['control-height']).toEqual(['--sample-semantic-control-height']);
  expect(light.semantic.map(token=>token.name)).toContain('--sample-semantic-type-body-family');
  const disabled=document.createElement('button');disabled.disabled=true;scope.append(disabled);
  expect(readSemanticTheme(disabled,['button-bg']).bindings['button-bg']).toEqual(['--sample-semantic-action-disabled-background']);
  disabled.remove();
  expect(host.querySelector('h1').textContent).toBe('Semantic collection');
  expect(host.textContent).toContain('--sample-semantic-action-background');
  expect(host.textContent).toContain('--forge-button-bg');
  await act(async()=>root.render(<ComponentCatalog route="variables" mode="dark" onModeChange={()=>{}}/>));
  const dark=readSemanticTheme(host.querySelector('[data-forge-theme]'),['button-bg']);
  expect(dark.bindings['button-bg']).toEqual(light.bindings['button-bg']);
  expect(dark.semantic.find(token=>token.name==='--sample-semantic-action-background').value).toBe('#abcdef');
 }finally{style.remove();scroll.mockRestore();}
});


it('uses native selection semantics and a trailing chevron for the dropdown',async()=>{
 await mount(findComponent('dropdown-menu'),{variant:'Selection'});
 const trigger=host.querySelector('button');
 expect(trigger.querySelector('svg')).not.toBeNull();
 await act(async()=>trigger.click());
 const list=document.querySelector('[role="listbox"][aria-label="Document selection"]');
 expect(list).not.toBeNull();
 expect(list.querySelector('[role="option"][aria-selected="true"]').textContent).toContain('Open document');
 const duplicate=[...list.querySelectorAll('[role="option"]')].find(node=>node.textContent.includes('Duplicate'));
 await act(async()=>duplicate.querySelector('a').click());
 expect(host.textContent).toContain('Duplicate selected');
 await act(async()=>trigger.click());
 const reopened=document.querySelector('[role="listbox"][aria-label="Document selection"]');
 expect(reopened.querySelector('[role="option"][aria-selected="true"]').textContent).toContain('Duplicate');
});


it('offers Small only for icon buttons and reuses the native compact icon API',async()=>{
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 try {
  await act(async()=>root.render(<ComponentCatalog route="components/icon-button" mode="light" onModeChange={()=>{}}/>));
  const size=host.querySelector('[aria-label="Preview size"]');
  expect([...size.options].map(option=>option.textContent)).toEqual(['Default','Small']);
  expect(host.querySelector('#component-overview .forge-button--icon-only').dataset.forgeSize).toBe('default');
  await act(async()=>{size.value='small';size.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.querySelector('#component-overview .forge-button--icon-only').dataset.forgeSize).toBe('compact');
  expect(host.querySelectorAll('.catalog-state-grid .forge-button--icon-only[data-forge-size="compact"]').length).toBe(findComponent('icon-button').states.length);
 }finally{scroll.mockRestore();}
});

it('composes native discovery search and topic filters without replacing the rail cards',async()=>{
 await mount(findComponent('card-rail-group'),{variant:'With filters'});
 const input=host.querySelector('input[aria-label="Search resources"]');
 expect(input?.type).toBe('search');
 const topic=[...host.querySelectorAll('.forge-filter-chips button')].find(button=>button.textContent==='Design');
 await act(async()=>topic.click());
 expect(topic.getAttribute('aria-pressed')).toBe('true');
 expect([...new Set([...host.querySelectorAll('.forge-content-card h3')].map(node=>node.textContent))]).toEqual(['Foundation guide','Component anatomy','Field patterns']);
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Keyboard');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(host.textContent).toContain('No resources match these filters.');
 await act(async()=>topic.click());
 expect([...new Set([...host.querySelectorAll('.forge-content-card h3')].map(node=>node.textContent))]).toEqual(['Keyboard navigation']);
});

it('uses the native data boundary error and retry path in the library',async()=>{
 await mount(findComponent('data-state'),{state:'Error'});
 expect(host.querySelector('[role="alert"]')).not.toBeNull();
 const retry=host.querySelector('button[aria-label="Retry"]');
 expect(retry).toBeTruthy();
 await act(async()=>retry.click());
 expect(host.querySelector('[role="alert"]')).toBeNull();
 expect(host.querySelector('[data-forge-data-state="ready"]')).not.toBeNull();
 expect(host.querySelector('[aria-busy="true"]')).toBeNull();
 expect(host.textContent).toContain('Browse shared resource collections.');
});

it('shows the native empty collection after the library datasource has finished loading',async()=>{
 await mount(findComponent('data-state'),{state:'Empty'});
 expect(host.textContent).toContain('No resources yet.');
 expect(host.querySelector('[aria-busy="true"]')).toBeNull();
});
