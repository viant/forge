import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import UploadCollection from './UploadCollection.jsx';

const boundary = vi.hoisted(() => ({renders: [], selected: ''}));
vi.mock('./MutationCommand.jsx', () => ({
    useMutationCommandState: () => ({pending: false}),
    default: ({disabled, extras}) => {
        boundary.renders.push({selected: boundary.selected, disabled, filename: (Array.isArray(extras.files) ? extras.files[0] : extras.files)?.name, transport: extras.transport});
        return <button aria-label="Upload selected files" disabled={disabled}>Upload</button>;
    },
}));
let host, root;
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    boundary.renders = []; boundary.selected = '';
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
