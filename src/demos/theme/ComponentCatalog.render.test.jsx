import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {componentCatalog,referenceComponents,componentFamilies,findComponent,filterCatalog} from './componentCatalog.js';
import CatalogExample from './CatalogExamples.jsx';
import ComponentCatalog,{readSemanticTheme} from './ComponentCatalog.jsx';
import {ForgeThemeProvider,ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import {Breadcrumbs,Menu,MenuItem,OverflowList,Toast} from '@blueprintjs/core';
import {MultiSelect} from '@blueprintjs/select';
import DropdownMenu from '../../components/DropdownMenu.jsx';
import Button from '../../components/Button.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();root=null;host=null;});
const mount=async(spec,props={})=>{
 if(!host){host=document.createElement('div');document.body.append(host);root=createRoot(host);}
 await act(async()=>root.render(<ForgeThemeProvider themeId="design-system-2" mode="light"><ForgeThemeBoundary windowKey="catalog-test"><CatalogExample key={`${spec.id}:${props.variant}:${props.state}`} spec={spec} thumbnail {...props}/></ForgeThemeBoundary></ForgeThemeProvider>));
};

it('covers the reference inventory, preserves unique routes and supplies the full documentation contract',()=>{
 expect(referenceComponents).toHaveLength(88);
 expect(componentCatalog).toHaveLength(98);
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
 expect(filterCatalog('', 'layout').map(item=>item.id)).toEqual(['form-layout']);
 expect(filterCatalog('', 'forms')).toHaveLength(20);
 for(const id of ['typeahead','typeahead-item','rich-text-editor','rich-text-editor-auto-link-plugin','rich-text-editor-toolbar','bottom-sheet','bottom-sheet-switcher','command-palette','lightbox','overlay']) expect(findComponent(id)).toBeUndefined();
});

it.each(componentCatalog.map(spec=>[spec.name,spec]))('renders every documented variant and state of %s',async(_,spec)=>{
 for(const variant of spec.variants){await mount(spec,{variant});expect(host.textContent?.trim()||host.querySelector('svg,input,button,progress,[role],[aria-label]'),`${spec.id}: ${variant}`).toBeTruthy();}
 for(const state of spec.states){await mount(spec,{state});expect(host.childElementCount,`${spec.id}: ${state}`).toBeGreaterThan(0);}
 for(const size of spec.sizes||[]){await mount(spec,{iconSize:size.toLowerCase()});expect(host.querySelector('.forge-button--icon-only')).not.toBeNull();}
},20000);

it('keeps busy and read-only actions unavailable and exposes the busy state',async()=>{
 const spec=findComponent('button');await mount(spec,{state:'Loading'});
 expect(host.querySelector('button').disabled).toBe(true);expect(host.querySelector('button').getAttribute('aria-busy')).toBe('true');
 await mount(spec,{state:'Read only'});expect(host.querySelector('button').disabled).toBe(true);
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
 expect(drawer.textContent).toContain('Filter view');
});

it('uses distinct native toast intent icons and can restore a dismissed notification',async()=>{
 for(const [variant,intent,icon] of [['Information','primary','info'],['Success','success','circle-check'],['Warning','warning','triangle-alert'],['Danger','danger','circle-alert']]){
  await mount(findComponent('toast'),{variant});expect(host.querySelector(`.bp6-toast.bp6-intent-${intent}`)).not.toBeNull();expect(host.querySelector(`svg.lucide-${icon}`)).not.toBeNull();
 }
 await mount(findComponent('toast'),{state:'Dismissed'});expect(host.querySelector('.bp6-toast')).toBeNull();
 await act(async()=>host.querySelector('button').click());expect(host.querySelector('.bp6-toast')).not.toBeNull();
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
