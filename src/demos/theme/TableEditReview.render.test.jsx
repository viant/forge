// @vitest-environment jsdom
// Independently authored sample records; no business transport is installed.
import React, {act, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {useSignals} from '@preact/signals-react/runtime';
import {Context} from '../../core/context/Context.jsx';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import Basic from '../../components/table/Basic.jsx';
import TableEditReview from './TableEditReview.jsx';
import EditableTextCell from '../../components/table/basic/EditableTextCell.jsx';
import {formatTableNumber} from '../../components/table/basic/tableNumericFormat.js';
import {tableEditSpecimenActions, tableEditSpecimenState} from './tableEditSpecimen.js';

let host, root, owner;
let scenario = 0;
const on = [{event: 'onChange', handler: 'example.edit'}, {event: 'onValue', handler: 'example.editValue'}, {event: 'onProperties', handler: 'example.editProperties'}];
const columns = [{id: 'starOrder', name: '', tooltip: 'Starred', icon: 'lucide:star', sortable: true, width: 64}, {id: 'id', name: 'ID', width: 100}, {id: 'name', name: 'Name', type: 'editableText', sortable: true, width: 200, cellProperties: {required: true}, on}, {id: 'note', name: 'Note', type: 'editableText', width: 200, on, readOnlyWhen: {source: 'row', field: 'readOnly', equals: true}}];
columns.push({id:'email',name:'Email',type:'editableText',cellProperties:{type:'email'},on,readOnlyWhen:{source:'row',field:'readOnly',equals:true}},{id:'amount',name:'Amount',numericFormat:'usdCurrency',type:'editableText',cellProperties:{type:'number',leftElement:'$',required:true,min:0,max:10000,stepSize:0.01,minorStepSize:0.01,clampValueOnBlur:false,buttonPosition:'none',pattern:'\\d+(?:\\.\\d{1,2})?','aria-description':'Use at most two decimal places.'},on,readOnlyWhen:{source:'row',field:'readOnly',equals:true}});
const records = [{id: 1, name: 'Zulu', note: 'First', email:'one@example.com', amount:10, starOrder: 1}, {id: 2, name: 'Alpha', note: 'Second', email:'two@example.com', amount:20, starOrder: 0}, {id: 3, name: 'Read only', note: 'Protected', email:'three@example.com', amount:30, readOnly: true, starOrder: 1}];
beforeEach(() => {globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}}; localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);});
afterEach(async () => {await act(async () => root.unmount()); owner?.dispose(); host.remove();});

async function fixture(mode = 'light', fieldColumns = columns) {
    const opened=[];
    owner = Context(`staged-table-example-${++scenario}`, {dataSource: {records: {autoFetch: false, sortMode: 'client', filterMode: 'client', selectionMode: 'none', filterSet: [{name: 'records', default: true, template: [{id: 'name', field: 'name', label: 'Name', operator: 'contains'}]}]}, savedRecords: {autoFetch: false}, pendingEdits: {autoFetch: false}}, actions: {import: context => ({example: tableEditSpecimenActions(context, fieldColumns)})}}, 'records', {window:{openTarget:args=>opened.push(args)}});
    owner.init();
    const context = owner.Context('records'), saved = owner.Context('savedRecords'), draft = owner.Context('pendingEdits');
    saved.handlers.dataSource.setCollection(records.map(row => ({...row})));
    draft.handlers.dataSource.setFormData({values: {pending: {}}});
    function Example() {
        useSignals();
        const rows = saved.signals.collection.value;
        const state = tableEditSpecimenState(draft.signals.form.value.pending, fieldColumns);
        useEffect(() => {context.handlers.dataSource.setCollection(rows); context.signals.control.value = {loaded: true};}, [rows]);
        return <ForgeThemeProvider themeId="design-system-2" mode={mode}><ForgeThemeBoundary><Basic context={context} container={{id: 'staged-records', title: 'Records', fetchData: false, table: {presentation: 'list-page', toolbar: {items: []}}}} columns={fieldColumns} renderSummaryCell={({column,rows})=>column.id==='amount'?formatTableNumber(rows.reduce((sum,row)=>sum+row.amount,0),'usdCurrency'):null}/><TableEditReview context={context} {...state}/></ForgeThemeBoundary></ForgeThemeProvider>;
    }
    await act(async () => root.render(<Example/>));
    const open=async label=>{
        await act(async()=>host.querySelector(`button[aria-label="Edit ${label}"]`)?.click());
        return host.querySelector(`input[aria-label="${label}"]`);
    };
    return {context, saved, draft, opened, open, edit: async (label, value) => {
        const input=host.querySelector(`input[aria-label="${label}"]`) || await open(label);
        await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
    }, click: async text => act(async () => [...host.querySelectorAll('button')].find(node => node.textContent === text).click())};
}

it.each(['light','dark'])('uses the same pencil entry for writable text, email and amount cells (%s)', async mode => {
    const f=await fixture(mode);
    expect(host.querySelectorAll('input[aria-label="Name 1"],input[aria-label="Note 1"],input[aria-label="Email 1"],input[aria-label="Amount 1"]')).toHaveLength(0);
    for(const label of ['Name 1','Note 1','Email 1','Amount 1']) expect(host.querySelector(`button[aria-label="Edit ${label}"]`)).not.toBeNull();
    expect(host.querySelector('td[data-col=id] button[aria-label^="Edit "]')).toBeNull();
    expect(host.querySelector('button[aria-label="Edit Note 3"]')).toBeNull();
    expect(host.querySelector('td[data-col=amount] [data-forge-part=cell-value]').textContent).toBe('$10.00');
    expect(host.querySelector('td[data-col=id]').getAttribute('data-forge-value-type')).toBe('number');
    expect(host.querySelector('td[data-col=name]').hasAttribute('data-forge-value-type')).toBe(false);
    expect(host.querySelector('[data-summary-column=amount]').getAttribute('data-forge-value-type')).toBe('number');
    expect(host.querySelector('tfoot [role=status] [data-forge-value-type=number]').textContent).toBe('3');
    await act(async()=>host.querySelector('td[data-col=note] [data-forge-part=cell-value]').click());
    expect(host.querySelector('input[aria-label="Note 1"]')).toBeNull();
    const input=await f.open('Note 1');expect(document.activeElement).toBe(input);
    await act(async()=>input.blur());
    expect(host.querySelector('input[aria-label="Note 1"]')).toBeNull();
    expect(host.querySelector('.forge-table-edit-review')).toBeNull();
});

it.each(['light', 'dark'])('stages multiple edits, marks cells and commits only on Apply (%s)', async mode => {
    const f = await fixture(mode);
    await f.edit('Name 1', 'Zulu updated'); await f.edit('Note 2', 'Second updated');
    expect(host.querySelector('.forge-table-edit-review').textContent).toContain('2 unsaved changes in 2 rows');
    expect(host.querySelectorAll('td:has([data-edit-state="pending"])')).toHaveLength(2);
    expect(f.saved.signals.collection.peek()[0].name).toBe('Zulu');
    expect(f.draft.signals.formStatus.peek().dirty).toBe(true);
    await f.click('Apply changes');
    expect(f.saved.signals.collection.peek()[0].name).toBe('Zulu updated');
    expect(f.saved.signals.collection.peek()[1].note).toBe('Second updated');
    expect(host.querySelector('.forge-table-edit-review')).toBeNull();
    expect(f.draft.signals.formStatus.peek().dirty).toBe(false);
    expect(host.querySelector('input[aria-label="Note 3"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Edit Note 3"]')).toBeNull();
});

it('reverts all cells and removes a field from the count when restored manually', async () => {
    const f = await fixture();
    await f.edit('Name 1', 'Other'); await f.edit('Note 1', 'Changed');
    expect(host.querySelector('.forge-table-edit-review').textContent).toContain('2 unsaved changes in 1 row');
    await f.edit('Name 1', 'Zulu');
    expect(host.querySelector('.forge-table-edit-review').textContent).toContain('1 unsaved change in 1 row');
    await f.click('Revert all');
    expect(host.querySelector('td[data-col=note]').textContent).toContain('First');
    expect(host.querySelector('.forge-table-edit-review')).toBeNull();
    expect(f.saved.signals.collection.peek()).toEqual(records);
});

it('keeps sort keys stable while editing and uses one active indicator including the star header', async () => {
    const f = await fixture();
    expect(host.querySelectorAll('.forge-table-sort-indicator')).toHaveLength(0);
    await act(async () => host.querySelector('button[aria-label="Sort by Starred"]').click());
    expect([...host.querySelectorAll('td[data-col="id"]')].map(n => n.textContent)).toEqual(['2', '1', '3']);
    expect(host.querySelectorAll('.forge-table-sort-indicator')).toHaveLength(1);
    await act(async () => host.querySelector('button[aria-label="Sort by Starred"]').click());
    expect([...host.querySelectorAll('td[data-col="id"]')].map(n => n.textContent)).toEqual(['1', '3', '2']);
    await act(async () => host.querySelector('button[aria-label="Sort by Name"]').click());
    await f.edit('Name 1', 'Aardvark');
    expect([...host.querySelectorAll('td[data-col="id"]')].map(n => n.textContent)).toEqual(['2', '3', '1']);
    expect(host.querySelector('input[aria-label="Name 1"]').value).toBe('Aardvark');
    await f.click('Apply changes');
    expect([...host.querySelectorAll('td[data-col="id"]')].map(n => n.textContent)).toEqual(['1', '2', '3']);
});

it('keeps edits and their count when filtering hides the edited row', async () => {
    const f = await fixture(); await f.edit('Note 1', 'Kept while hidden');
    await act(async () => {f.context.signals.input.value = {...f.context.signals.input.peek(), filter: {name: 'Alpha'}};});
    expect(host.querySelector('input[aria-label="Note 1"]')).toBeNull();
    expect(host.querySelector('.forge-table-edit-review').textContent).toContain('1 unsaved change in 1 row');
    await f.click('Apply changes');
    expect(f.saved.signals.collection.peek()[0].note).toBe('Kept while hidden');
    expect(f.context.signals.input.peek().filter).toEqual({name: 'Alpha'});
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
});

it('retains invalid pending values and uses the existing field validation before Apply', async () => {
    const f = await fixture(); await f.edit('Name 1', '');
    expect(host.querySelector('input[aria-label="Name 1"]').getAttribute('aria-invalid')).toBe('true');
    const apply = [...host.querySelectorAll('button')].find(n => n.textContent === 'Apply changes');
    expect(apply.disabled).toBe(true);
    expect(f.saved.signals.collection.peek()[0].name).toBe('Zulu');
    await f.edit('Name 1', 'Restored'); expect(apply.disabled).toBe(false);
});

it('lets the native DS2 focus manager observe Tab while keeping editing keys inside the cell', async () => {
    const f=await fixture();await f.open('Name 1');
    const observed = [];
    const observe = event => observed.push(event.key);
    document.body.addEventListener('keydown', observe);
    try {
        const input = host.querySelector('input[aria-label="Name 1"]');
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true}));
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
        expect(observed).toEqual(['Tab']);
    } finally {document.body.removeEventListener('keydown', observe);}
});


it.each(['light','dark'])('keeps invalid email drafts visible, described and unapplied until corrected (%s)', async mode => {
    const f=await fixture(mode);await f.edit('Email 1','not-an-address');
    const input=host.querySelector('input[aria-label="Email 1"]');
    expect(input.type).toBe('email');expect(input.value).toBe('not-an-address');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-errormessage'))?.textContent).toBe('Enter a valid email address.');
    expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Apply changes').disabled).toBe(true);
    await f.click('Apply changes');expect(f.saved.signals.collection.peek()[0].email).toBe('one@example.com');
    await f.edit('Email 1','updated+team@example.com');expect(input.getAttribute('aria-invalid')).not.toBe('true');
    await f.click('Apply changes');expect(f.saved.signals.collection.peek()[0].email).toBe('updated+team@example.com');
});

it('uses the native number control, preserves number types and enforces range and declared precision', async () => {
    const f=await fixture();const input=await f.open('Amount 1');
    expect(input.getAttribute('role')).toBe('spinbutton');expect(input.closest('.bp6-numeric-input')).not.toBeNull();
    await f.edit('Amount 1','-1');expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(f.saved.signals.collection.peek()[0].amount).toBe(10);
    await f.edit('Amount 1','12.345');expect(input.getAttribute('aria-invalid')).toBe('true');
    await f.edit('Amount 1','12.34');expect(input.getAttribute('aria-invalid')).not.toBe('true');
    await f.click('Apply changes');expect(f.saved.signals.collection.peek()[0].amount).toBe(12.34);
    expect(typeof f.saved.signals.collection.peek()[0].amount).toBe('number');
    await f.edit('Amount 1','0');await f.click('Apply changes');expect(f.saved.signals.collection.peek()[0].amount).toBe(0);
    expect(host.querySelector('button[aria-label="Edit Amount 3"]')).toBeNull();
});

it('formats valid amounts after blur without arrows, replacing focus or committing the draft', async () => {
    const f=await fixture();const input=await f.open('Amount 1');
    expect(host.querySelector('input[aria-label="Amount 1"]')).toBe(input);
    expect(input.value).toBe('10');
    expect(input.closest('.bp6-numeric-input').querySelector('button')).toBeNull();
    await act(async()=>input.focus());
    await f.edit('Amount 1','12');await f.edit('Amount 1','12.');expect(input.value).toBe('12.');
    await f.edit('Amount 1','12.345');
    expect(document.activeElement).toBe(input);
    expect(host.querySelector('input[aria-label="Amount 1"]')).toBe(input);
    await act(async()=>input.blur());
    expect(input.value).toBe('12.345');
    await act(async()=>input.focus());await f.edit('Amount 1','12.3');
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('12.3');
    await act(async()=>input.blur());
    expect(host.querySelector('input[aria-label="Amount 1"]')).toBeNull();
    expect(host.querySelector('td[data-col=amount] [data-forge-part=cell-value]').textContent).toBe('$12.30');
    expect(f.saved.signals.collection.peek()[0].amount).toBe(10);
    await f.click('Apply changes');expect(f.saved.signals.collection.peek()[0].amount).toBe(12.3);
});

it.each(['light','dark'])('keeps the currency total in its column and reflects only applied, filtered rows (%s)', async mode => {
    const f=await fixture(mode);
    const total=()=>host.querySelector('tfoot td[data-summary-column="amount"]');
    expect(total().textContent).toBe('$60.00');
    await f.edit('Amount 1','12.3');expect(total().textContent).toBe('$60.00');
    await f.click('Apply changes');expect(total().textContent).toBe('$62.30');
    await act(async()=>{f.context.signals.input.value={...f.context.signals.input.peek(),filter:{name:'Alpha'}};});
    expect(total().textContent).toBe('$20.00');
    expect(host.querySelector('tfoot').textContent).toContain('Summary: 1 Records');
    expect(host.querySelector('.forge-list-page__summary')).toBeNull();
});

it('omits a hidden column total while retaining the record count', async () => {
    await fixture('light',columns.map(column=>column.id==='amount'?{...column,visible:false}:column));
    expect(host.querySelector('[data-summary-column="amount"]')).toBeNull();
    expect(host.querySelector('tfoot').textContent).toContain('Summary: 3 Records');
});

it('keeps linked names navigable and opens staged editing only from the pencil', async () => {
    const linked=columns.map(column=>column.id==='name'?{...column,link:{kind:'window',windowKey:'record',parameters:{id:{source:'row',selector:'id'}}},readOnlyWhen:{source:'row',field:'readOnly',equals:true}}:column);
    const f=await fixture('light',linked);
    expect(host.querySelector('input[aria-label="Name 1"]')).toBeNull();
    await f.click('Zulu');expect(f.opened).toHaveLength(1);expect(f.opened[0].target.parameters.id).toBe(1);
    await act(async()=>host.querySelector('button[aria-label="Edit Name 1"]').click());
    const input=host.querySelector('input[aria-label="Name 1"]');expect(document.activeElement).toBe(input);
    await f.edit('Name 1','Updated name');await act(async()=>input.blur());
    expect(host.querySelector('input[aria-label="Name 1"]')).toBeNull();
    expect([...host.querySelectorAll('.forge-table-link')].some(link=>link.textContent==='Updated name')).toBe(true);
    expect(host.querySelector('[data-edit-state="pending"]')).not.toBeNull();
    expect(f.saved.signals.collection.peek()[0].name).toBe('Zulu');
    expect(host.querySelector('button[aria-label="Edit Name 3"]')).toBeNull();
    await f.click('Apply changes');expect(f.saved.signals.collection.peek()[0].name).toBe('Updated name');
});

it('retains typed errors across filtering, and Revert clears their drafts and errors', async () => {
    const f=await fixture();await f.edit('Email 1','invalid');await f.edit('Amount 2','-1');
    await act(async()=>{f.context.signals.input.value={...f.context.signals.input.peek(),filter:{name:'Alpha'}};});
    await f.edit('Amount 2','20.50');
    expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Apply changes').disabled).toBe(true);
    await f.click('Revert all');expect(host.querySelector('.forge-table-edit-review')).toBeNull();
    expect(host.querySelector('[aria-invalid="true"]')).toBeNull();expect(f.saved.signals.collection.peek()).toEqual(records);
});

it('keeps optional numeric clearing as null, and required numeric clearing invalid', async () => {
    const optional=columns.map(col=>col.id==='amount'?{...col,cellProperties:{...col.cellProperties,required:false,nullable:true}}:col);
    const f=await fixture('light',optional);await f.edit('Amount 1','');
    expect(host.querySelector('input[aria-label="Amount 1"]').getAttribute('aria-invalid')).not.toBe('true');
    await f.click('Apply changes');expect(f.saved.signals.collection.peek()[0].amount).toBeNull();
});

it('preserves legacy text input behavior when switching away from DS2', async () => {
    const render=theme=>act(async()=>root.render(<ForgeThemeProvider themeId={theme}><ForgeThemeBoundary><EditableTextCell type="email" value="invalid" label="Email example"/></ForgeThemeBoundary></ForgeThemeProvider>));
    await render('design-system-2');
    await act(async()=>host.querySelector('button[aria-label="Edit Email example"]').click());
    expect(host.querySelector('input').type).toBe('email');expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await render('baseline');expect(host.querySelector('input').type).toBe('text');expect(host.querySelector('[role="alert"]')).toBeNull();
});

it.each(['light','dark'])('reuses column-authored text rules across different lists (%s)', async mode => {
    // Synthetic constraints demonstrate metadata reuse, not business defaults.
    const fields=columns.map(column=>column.id==='name'?{...column,cellProperties:{required:true,minLength:3,maxLength:12,pattern:'[A-Za-z ]+','aria-description':'Use letters and spaces.'}}:column);
    const f=await fixture(mode,fields);
    for(const value of ['', 'AB', 'A name that is too long', 'Name42']) {
        await f.edit('Name 1',value);
        expect(host.querySelector('input[aria-label="Name 1"]').getAttribute('aria-invalid')).toBe('true');
        expect([...host.querySelectorAll('button')].find(button=>button.textContent==='Apply changes').disabled).toBe(true);
        expect(f.saved.signals.collection.peek()[0].name).toBe('Zulu');
    }
    await f.edit('Name 1','Valid Name');await f.click('Apply changes');
    expect(f.saved.signals.collection.peek()[0].name).toBe('Valid Name');
});

it.each(['light','dark'])('honors a different list’s whole-number constraints without treating step as validation (%s)', async mode => {
    const fields=columns.map(column=>column.id==='amount'?{...column,name:'Quantity',numericFormat:'int',cellProperties:{type:'number',required:true,min:0,max:100,stepSize:1,buttonPosition:'none',clampValueOnBlur:false,pattern:'\\d+','aria-description':'Enter a whole number from 0 to 100.'}}:column);
    const f=await fixture(mode,fields);
    for(const value of ['12.5','101','-1']) {
        await f.edit('Quantity 1',value);
        expect(host.querySelector('input[aria-label="Quantity 1"]').getAttribute('aria-invalid')).toBe('true');
        expect([...host.querySelectorAll('button')].find(button=>button.textContent==='Apply changes').disabled).toBe(true);
    }
    await f.edit('Quantity 1','0');await f.click('Apply changes');
    expect(f.saved.signals.collection.peek()[0].amount).toBe(0);
});
