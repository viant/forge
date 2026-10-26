import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import UploadCollection from './UploadCollection.jsx';

const boundary = vi.hoisted(() => ({renders: [], selected: ''}));
vi.mock('./MutationCommand.jsx', () => ({
    useMutationCommandState: () => boundary.mutation,
    default: ({disabled, extras, onSettled}) => {
        boundary.settled = onSettled;
        boundary.renders.push({selected: boundary.selected, disabled, filename: (Array.isArray(extras.files) ? extras.files[0] : extras.files)?.name, transport: extras.transport});
        return <button aria-label="Upload selected files" disabled={disabled}>Upload</button>;
    },
}));
let host, root;
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    boundary.renders = []; boundary.selected = ''; boundary.mutation = {pending:false}; boundary.settled = null;
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});
const spec = {accept: ['.csv'], maxBytes: 100, multiple: false, upload: {dataSourceRef: 'upload'}};
const render = async options => act(async () => root.render(<UploadCollection context={{}} container={{uploadCollection: {...spec, ...options}}}/>));
async function select(file) {
    boundary.selected = file.name;
    await act(async () => {
        const input = host.querySelector('input[type="file"]');
        Object.defineProperty(input, 'files', {configurable: true, value: [file]});
        input.dispatchEvent(new Event('change', {bubbles: true}));
    });
}
const file = (name, size) => ({name, size, type: 'text/csv', arrayBuffer: vi.fn(async () => new Uint8Array(size).buffer)});

it.each([
    ['wrong.exe', 1, 'unsupported type', 100],
    ['large.csv', 101, 'size limit', 100],
    ['multi-gigabyte.csv', 4_096_000_001, 'size limit', 4_096_000_000],
])('rejects %s before reading its bytes', async (name, size, message, maxBytes) => {
    await render({maxBytes});
    const selected = file(name, size);
    await select(selected);
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    expect(host.textContent).toContain(message);
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(true);
});

it('accepts the exact configured byte limit and revalidates selected files when limits change', async () => {
    await render({maxBytes: 99});
    const selected = file('boundary.csv', 100);
    await select(selected);
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    await render({maxBytes: 100});
    expect(selected.arrayBuffer).toHaveBeenCalledTimes(1);
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(false);
    expect(boundary.renders.at(-1).filename).toBe('boundary.csv');
});

it('never enables a replacement upload with the previous selection payload', async () => {
    await render();
    await select(file('first.csv', 1));
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(false);
    let finish;
    const replacement = {...file('replacement.csv', 1), arrayBuffer: () => new Promise(resolve => {finish = resolve;})};
    await select(replacement);
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(true);
    expect(boundary.renders.filter(entry => entry.selected === replacement.name && !entry.disabled)).toEqual([]);
    await act(async () => finish(new Uint8Array([2]).buffer));
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(false);
    expect(boundary.renders.at(-1).filename).toBe('replacement.csv');
});

it('passes file references to a preparation command without reading whole-file bytes', async () => {
    await render({transport: 'files', upload: {dataSourceRef: 'upload', prepare: 'Upload.transfer'}});
    const selected = file('references.csv', 10);
    await select(selected);
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(false);
    expect(boundary.renders.at(-1)).toMatchObject({filename: 'references.csv', transport: 'files'});
});

it('rejects file references when no preparation command can consume them', async () => {
    await render({transport: 'files'});
    const selected = file('references.csv', 10);
    await select(selected);
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    expect(host.textContent).toContain('requires a command preparation handler');
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(true);
});

it('notifies authored selection and removal handlers with metadata only', async () => {
    const changed = vi.fn();
    const context = {lookupHandler: name => name === 'Files.changed' ? changed : undefined};
    await act(async () => root.render(<UploadCollection context={context} container={{on:[{event:'onSelectionChange',handler:'Files.changed'}],uploadCollection:spec}}/>));
    const selected=file('first.csv',1);await select(selected);
    expect(changed.mock.calls[0][0]).toMatchObject({operation:'select',files:[{name:'first.csv',size:1,type:'text/csv'}]});
    expect(changed.mock.calls[0][0].files[0].arrayBuffer).toBeUndefined();
    await act(async () => host.querySelector('.bp6-tag-remove').click());
    expect(changed.mock.calls.at(-1)[0]).toMatchObject({operation:'remove',files:[]});
});
it.each(['disabledWhen','readOnlyWhen'])('honors container %s for selection, removal and submission', async predicate => {
    const context={handlers:{dataSource:{peekFormData:()=>({blocked:true})}}};
    const container={[predicate]:{source:'form',field:'blocked',equals:true},uploadCollection:spec};
    await act(async () => root.render(<UploadCollection context={context} container={container}/>));
    expect(host.querySelector('input[type=file]').disabled).toBe(true);
    const selected=file('blocked.csv',1);await select(selected);
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(true);
});

async function dialogButton(label) {
    const dialog=document.querySelector('[role="alertdialog"]');expect(dialog).not.toBeNull();
    const button=[...dialog.querySelectorAll('button')].find(item=>item.textContent.trim()===label);expect(button).toBeTruthy();
    await act(async()=>button.click());
}
it('cancelled replacement retains the current file and never reads proposed bytes', async()=>{
    await render({replaceConfirmation:'Replace the selected files?'});
    const first=file('first.csv',1),next=file('next.csv',2);await select(first);await select(next);
    expect(next.arrayBuffer).not.toHaveBeenCalled();expect(host.querySelector('input[type=file]').value).toBe('');
    expect(host.querySelector('.forge-upload-collection__files').textContent).toContain(first.name);
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(true);
    await dialogButton('Cancel');
    expect(next.arrayBuffer).not.toHaveBeenCalled();expect(boundary.renders.at(-1).filename).toBe(first.name);
    expect(host.querySelector('button[aria-label="Upload selected files"]').disabled).toBe(false);
});
it('confirmation replaces the selection before encoding the proposed file', async()=>{
    const changed=vi.fn(),context={lookupHandler:()=>changed};
    await act(async()=>root.render(<UploadCollection context={context} container={{on:[{event:'onSelectionChange',handler:'Files.changed'}],uploadCollection:{...spec,replaceConfirmation:'Replace the selected files?'}}}/>));
    const first=file('first.csv',1),next=file('next.csv',2);await select(first);await select(next);
    expect(changed).toHaveBeenCalledTimes(1);expect(next.arrayBuffer).not.toHaveBeenCalled();
    await dialogButton('Replace');
    expect(changed).toHaveBeenCalledTimes(2);expect(changed.mock.calls[1][0].files[0].name).toBe(next.name);
    expect(next.arrayBuffer).toHaveBeenCalledTimes(1);expect(boundary.renders.at(-1).filename).toBe(next.name);
});
it.each([true,false])('retainOnSuccess=%s preserves the intended success selection', async retainOnSuccess=>{
    await render({retainOnSuccess});await select(file('first.csv',1));
    await act(async()=>boundary.settled({status:'succeeded'}));
    expect(host.querySelectorAll('.forge-upload-collection__files .bp6-tag').length).toBe(retainOnSuccess?1:0);
});
it('starting a guarded command dismisses an outstanding replacement without accepting it', async()=>{
    await render({replaceConfirmation:'Replace the selected files?'});
    const first=file('first.csv',1),next=file('next.csv',2);await select(first);await select(next);
    boundary.mutation={phase:'preparing',guarded:true};await render({replaceConfirmation:'Replace the selected files?'});
    expect(next.arrayBuffer).not.toHaveBeenCalled();expect(boundary.renders.at(-1).filename).toBe(first.name);
    expect(host.querySelector('input[type=file]').disabled).toBe(true);
    // A closing portal may remain mounted during its transition. A late click
    // must still be inert rather than accepting the abandoned selection.
    if(document.querySelector('[role="alertdialog"]'))await dialogButton('Replace');
    expect(next.arrayBuffer).not.toHaveBeenCalled();expect(boundary.renders.at(-1).filename).toBe(first.name);
});
it('an empty chooser selection does not remove a retained file', async()=>{
    await render();const first=file('first.csv',1);await select(first);
    await act(async()=>{const input=host.querySelector('input[type=file]');Object.defineProperty(input,'files',{configurable:true,value:[]});input.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(boundary.renders.at(-1).filename).toBe(first.name);
});
