import React, {act, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fs from 'node:fs';
import AttachmentDialog from './AttachmentDialog.jsx';
import Composer from './Composer.jsx';
import StarterTaskBrowser from './StarterTaskBrowser.jsx';
import useComposerDraft from './useComposerDraft.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => {sessionStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});
const render = value => act(async () => root.render(value));
const change = (node, value) => act(async () => Simulate.change(node, {target: {value}}));
const click = node => act(async () => node.click());
const press = (node, key, options = {}) => act(async () => node.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...options})));

describe('document composer and task discovery', () => {
    it('keeps IME and newline entry, rejects blank/invalid sends and clears a sent draft', async () => {
        const submit = vi.fn();
        await render(<Composer appearance="document" draftKey="a" onSubmit={submit}/>);
        const input = host.querySelector('textarea'), send = host.querySelector('[data-testid=chat-composer-send]');
        expect(send.disabled).toBe(true);
        await change(input, '  '); await press(input, 'Enter'); expect(submit).not.toHaveBeenCalled();
        await change(input, 'First line\nSecond line');
        await press(input, 'Enter', {shiftKey: true});
        await press(input, 'Enter', {isComposing: true});
        await press(input, 'Enter', {keyCode: 229});
        expect(submit).not.toHaveBeenCalled();
        await press(input, 'Enter');
        expect(submit).toHaveBeenCalledExactlyOnceWith({content: 'First line\nSecond line', toolNames: []});
        expect(input.value).toBe(''); expect(send.disabled).toBe(true);
        expect(input.dataset.forgeType).toBe('body');
        expect(host.querySelector('.composer-bar-left')).toBeNull();
    });

    it('keeps exact drafts, including an emptied draft, isolated by conversation and across remounts', async () => {
        function Chat({id}) {const [draft, update] = useComposerDraft(id); return <Composer appearance="document" draftKey={id} draftValue={draft} onDraftChange={update}/>;}
        await render(<Chat id="a"/>); await change(host.querySelector('textarea'), '  A\n');
        await render(<Chat id="b"/>); expect(host.querySelector('textarea').value).toBe('');
        await change(host.querySelector('textarea'), 'B');
        await render(<Chat id="a"/>); expect(host.querySelector('textarea').value).toBe('  A\n');
        await change(host.querySelector('textarea'), ''); await render(<Chat id="b"/>);
        expect(host.querySelector('textarea').value).toBe('B');
        await render(<Chat id="a"/>); expect(host.querySelector('textarea').value).toBe('');
        expect(JSON.parse(sessionStorage.getItem('forge.composerDrafts.v1'))).toMatchObject({a: '', b: 'B'});
    });

    it('groups real selector callbacks under Tools and returns focus on Escape', async () => {
        const agent = vi.fn(), model = vi.fn(), reasoning = vi.fn(), attach = vi.fn();
        await render(<Composer appearance="document" draftKey="a" showUpload onOpenAttach={attach}
            agentOptions={[{value: 'a', label: 'Agent A'}, {value: 'b', label: 'Agent B'}]} agentValue="a" onAgentChange={agent}
            modelOptions={[{value: 'm', label: 'Model M'}]} modelValue="m" onModelChange={model}
            reasoningOptions={[{value: 'low', label: 'Low'}]} onReasoningChange={reasoning}/>);
        const tools = host.querySelector('summary[aria-label=Tools]');
        await click(tools);
        await change(host.querySelector('select[aria-label=Agent]'), 'b'); expect(agent).toHaveBeenCalledWith('b');
        await change(host.querySelector('select[aria-label=Model]'), 'm'); expect(model).toHaveBeenCalledWith('m');
        await change(host.querySelector('select[aria-label=Reasoning]'), 'low'); expect(reasoning).toHaveBeenCalledWith('low');
        await press(host.querySelector('select[aria-label=Reasoning]'), 'Escape');
        expect(tools.closest('details').open).toBe(false); expect(document.activeElement).toBe(tools);
        await click(host.querySelector('summary[aria-label="Add photos or files"]'));
        await click([...host.querySelectorAll('button')].find(button => button.textContent === 'Add photos or files'));
        expect(attach).toHaveBeenCalledOnce();
    });

    it('preserves stop and queue callbacks while allowing the next draft', async () => {
        const abort = vi.fn(), remove = vi.fn(), steer = vi.fn(), cancel = vi.fn();
        const queued = {id: 'next', preview: 'Queued follow-up'};
        await render(<Composer appearance="document" draftKey="a" commandCenter showAbort onAbort={abort}
            queueRunning queuedTurns={[queued]} onQueueSteer={steer} onQueueCancel={cancel}
            attachments={[{name: 'example.csv'}]} onRemoveAttachment={remove}/>);
        await click(host.querySelector('[data-testid=chat-composer-abort]')); expect(abort).toHaveBeenCalledOnce();
        await click(host.querySelector('[aria-label="Remove example.csv"]')); expect(remove).toHaveBeenCalledWith(0);
        await click([...host.querySelectorAll('button')].find(button => button.textContent === 'Steer'));
        expect(steer).toHaveBeenCalledWith(queued);
        await click(host.querySelector('[aria-label="Remove queued request"]')); expect(cancel).toHaveBeenCalledWith(queued);
        await change(host.querySelector('textarea'), 'Next question'); expect(host.querySelector('textarea').value).toBe('Next question');
    });

    it('shows every authored task, counts/search/recovery and fills without sending', async () => {
        const tasks = Array.from({length: 16}, (_, i) => ({id: `task-${i}`, categoryId: `group-${i % 5}`, title: `Task ${i}`, description: `Description ${i}`, prompt: `Prompt ${i}`}));
        const categories = Array.from({length: 5}, (_, i) => ({id: `group-${i}`, title: `Group ${i}`}));
        const select = vi.fn();
        await render(<StarterTaskBrowser tasks={tasks} categories={categories} onSelect={select}/>);
        expect(host.querySelectorAll('.forge-task-row')).toHaveLength(5);
        expect([...host.querySelectorAll('.forge-task-filters button')].every(node => node.dataset.forgeType === 'small')).toBe(true);
        await click([...host.querySelectorAll('button')].find(button => button.textContent === 'Browse all 16 tasks'));
        expect(host.querySelectorAll('.forge-task-row')).toHaveLength(16);
        expect(host.querySelectorAll('.forge-task-group')).toHaveLength(5);
        expect(document.activeElement.tagName).toBe('H1');
        await change(host.querySelector('input[type=search]'), 'no match'); expect(host.textContent).toContain('No tasks match your search');
        await change(host.querySelector('input[type=search]'), 'Description 15'); expect(host.querySelectorAll('.forge-task-row')).toHaveLength(1);
        await click(host.querySelector('.forge-task-row'));
        expect(select).toHaveBeenCalledWith(tasks[15], expect.objectContaining({library: true, search: 'Description 15'}));
        await change(host.querySelector('input[type=search]'), 'Group 3');
        expect(host.querySelectorAll('.forge-task-row')).toHaveLength(3);
        await change(host.querySelector('input[type=search]'), 'no match');
        await click([...host.querySelectorAll('button')].find(button => button.textContent === 'Show all tasks'));
        expect(document.activeElement).toBe(host.querySelector('input[type=search]'));
        expect(host.querySelectorAll('.forge-task-row')).toHaveLength(16);
        await click([...host.querySelectorAll('button')].find(button => button.textContent === 'New Chat'));
        await click(host.querySelectorAll('.forge-task-filters button')[1]);
        await click([...host.querySelectorAll('button')].find(button => button.textContent === 'Browse all 16 tasks'));
        expect(host.querySelectorAll('.forge-task-row')).toHaveLength(16);
        await render(<StarterTaskBrowser tasks={[{id: 'report', title: 'Example', resultLabel: 'Saved output'}]} onSelect={select}/>);
        await change(host.querySelector('input[type=search]'), 'saved output');
        expect(host.querySelectorAll('.forge-task-row')).toHaveLength(1);
    });

    it('shows preparation, progress, failure recovery and blocks Send until files are ready', async () => {
        const cancel = vi.fn(), retry = vi.fn(), submit = vi.fn();
        const file = new File(['example'], 'Example.csv');
        const view = (status, progress = 0, attachments = []) => <Composer appearance="document" showUpload uploads={[{id:'one',name:file.name,file,status,progress}]}
            attachments={attachments} onCancelUpload={cancel} onRetryUpload={retry} onSubmit={submit}/>;
        await render(view('idle'));
        await change(host.querySelector('textarea'),'Retained draft');
        expect(host.textContent).toContain('Preparing…');
        expect(host.textContent).toContain(file.name);
        expect(host.querySelector('textarea').disabled).toBe(false);
        expect(host.querySelector('[data-testid=chat-composer-send]').disabled).toBe(true);
        await press(host.querySelector('textarea'),'Enter'); expect(submit).not.toHaveBeenCalled();
        await render(view('uploading', .5));
        expect(host.textContent).toContain('Uploading 50%');
        expect(host.querySelector('[role=progressbar]').getAttribute('aria-valuenow')).toBe('50');
        await click(host.querySelector('[aria-label="Cancel upload of Example.csv"]'));
        expect(cancel).toHaveBeenCalledWith('one');
        await render(view('uploading', 1)); expect(host.textContent).toContain('Finishing upload…');
        await render(view('error'));
        expect(host.querySelector('[role=alert]').textContent).toBe('Upload failed');
        await click(host.querySelector('[aria-label="Retry upload of Example.csv"]'));
        expect(retry).toHaveBeenCalledWith(expect.objectContaining({id:'one',file}));
        await click(host.querySelector('[aria-label="Remove failed upload Example.csv"]'));
        expect(cancel).toHaveBeenCalledWith('one');
        await render(view('done',1,[{name:file.name}]));
        expect(host.querySelector('[aria-label="File uploads"]')).toBeNull();
        expect(host.textContent).toContain('Ready to send');
        expect(host.querySelector('[data-testid=chat-composer-send]').disabled).toBe(false);
        expect(host.querySelector('textarea').value).toBe('Retained draft');
    });

    it('retains attachment elements and file order through out-of-order completion', async () => {
        const remove = vi.fn();
        const files = [{id:'a',name:'First.txt',status:'uploading',progress:.4},{id:'b',name:'Second.txt',status:'uploading',progress:.4}];
        const view = (uploads, attachments) => <Composer appearance="document" showUpload uploads={uploads} attachments={attachments} onRemoveAttachment={remove}/>;
        await render(view(files, []));
        const [first,second] = host.querySelectorAll('.forge-upload-chip');
        await render(view([files[0],{...files[1],status:'done'}],[{name:'Second.txt',uploadId:'b'}]));
        expect([...host.querySelectorAll('.forge-upload-chip')]).toEqual([first,second]);
        await render(view(files.map(file => ({...file,status:'done'})),[{name:'Second.txt',uploadId:'b'},{name:'First.txt',uploadId:'a'}]));
        expect([...host.querySelectorAll('.forge-upload-chip')]).toEqual([first,second]);
        expect(first.textContent).toContain('Ready to send');
        expect(host.querySelector('[role=progressbar]:not([aria-hidden=true])')).toBeNull();
        await click(host.querySelector('[aria-label="Remove First.txt"]'));
        expect(remove).toHaveBeenCalledWith(1);
        await render(view(files.map(file => ({...file,status:'done'})),[{name:'Second.txt',uploadId:'b'}]));
        expect(host.querySelectorAll('.forge-upload-chip')).toHaveLength(1);
        expect(host.querySelector('.forge-upload-chip')).toBe(second);
    });

    it('keeps the shared recipe semantic and rejects hardcoded styling bypasses', () => {
        const css = fs.readFileSync('src/components/chat/documentChat.css', 'utf8');
        const bypass = /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(|!important|(?:^|[;{])\s*(?:font-size|font-weight|line-height|letter-spacing)\s*:\s*-?\d/i;
        expect(bypass.test(css)).toBe(false); expect(bypass.test('.bad {font-size: 13px}')).toBe(true);
        for (const path of ['./DocumentComposer.jsx', './StarterTaskBrowser.jsx', './AttachmentDialog.jsx']) {
            const source = fs.readFileSync(`src/components/chat/${path.slice(2)}`, 'utf8');
            expect(source).not.toMatch(/Viant|Steward|IBM Plex|fontSize\s*:|fontFamily\s*:/);
            expect(source).toContain("typographyProps('body')");
        }
    });

    it('uploads dropped files once, keeps the draft and clears nested drag feedback', async () => {
        const upload = vi.fn(), submit = vi.fn();
        await render(<Composer appearance="document" showUpload onDropFiles={upload} onSubmit={submit}/>);
        const shell = host.querySelector('[data-testid=chat-composer-shell]'), input = host.querySelector('textarea');
        await change(input, 'Keep this draft');
        const files = [new File(['example'], 'Example.csv'), new File([], 'Empty.txt')];
        const transfer = {types:['Files'],files,dropEffect:'none'};
        await act(async () => Simulate.dragEnter(shell, {dataTransfer:transfer}));
        await act(async () => Simulate.dragEnter(input, {dataTransfer:transfer}));
        await act(async () => Simulate.dragLeave(input, {dataTransfer:transfer}));
        expect(shell.textContent).toContain('Drop files to upload');
        await act(async () => Simulate.dragOver(input, {dataTransfer:transfer}));
        expect(transfer.dropEffect).toBe('copy');
        await act(async () => Simulate.drop(input, {dataTransfer:transfer}));
        expect(upload).toHaveBeenCalledExactlyOnceWith(files);
        expect(submit).not.toHaveBeenCalled();
        expect(input.value).toBe('Keep this draft');
        expect(shell.textContent).not.toContain('Drop files to upload');
        await act(async () => Simulate.dragEnter(shell, {dataTransfer:transfer}));
        await act(async () => Simulate.dragLeave(shell, {dataTransfer:transfer}));
        expect(shell.textContent).not.toContain('Drop files to upload');
        await act(async () => Simulate.dragEnter(shell, {dataTransfer:transfer}));
        await act(async () => Simulate.dragEnd(shell));
        expect(shell.textContent).not.toContain('Drop files to upload');
    });

    it('leaves text drops alone and blocks empty or unavailable file uploads', async () => {
        const upload = vi.fn();
        const view = props => <Composer appearance="document" showUpload onDropFiles={upload} {...props}/>;
        const drag = async (type, transfer) => {
            const event = new Event(type, {bubbles:true,cancelable:true});
            Object.defineProperty(event, 'dataTransfer', {value:transfer});
            await act(async () => host.querySelector('[data-testid=chat-composer-shell]').dispatchEvent(event));
            return event;
        };
        await render(view({}));
        const text = {types:['text/plain'],files:[]};
        expect((await drag('dragover',text)).defaultPrevented).toBe(false);
        expect((await drag('drop',text)).defaultPrevented).toBe(false);
        const empty = {types:['Files'],files:[],dropEffect:'none'};
        await drag('drop',empty); expect(upload).not.toHaveBeenCalled();
        const file = {types:['Files'],files:[new File(['example'],'Example.csv')],dropEffect:'copy'};
        await drag('dragenter',file);
        expect(host.textContent).toContain('Drop files to upload');
        for (const props of [{disabled:true},{showUpload:false},{onDropFiles:undefined}]) {
            await render(view(props));
            expect(host.textContent).not.toContain('Drop files to upload');
            expect((await drag('dragover',file)).defaultPrevented).toBe(true);
            expect(file.dropEffect).toBe('none');
            expect((await drag('drop',file)).defaultPrevented).toBe(true);
            expect(upload).not.toHaveBeenCalled();
        }
    });
});


describe('attachment dialog', () => {
    const selected = () => document.querySelector('.forge-attachment-dialog');
    const pick = async files => act(async () => Simulate.change(selected().querySelector('input[type=file]'), {target:{files,value:''}}));
    const files = [new File(['example'], 'Example.csv', {lastModified:1}), new File([], 'Empty.txt', {lastModified:2})];

    it('retains native selection, exact-file deduplication, removal, upload and fresh reopen', async () => {
        const upload = vi.fn(), close = vi.fn();
        const view = isOpen => <AttachmentDialog isOpen={isOpen} onSelect={upload} onClose={close}/>;
        await render(view(true));
        const uploadButton = () => [...selected().querySelectorAll('button')].find(node => node.textContent === 'Upload');
        expect(uploadButton().disabled).toBe(true);
        expect(selected().querySelector('input').multiple).toBe(true);
        await pick(files); await pick([files[0]]); await pick([]);
        expect(selected().querySelectorAll('li')).toHaveLength(2);
        expect(selected().textContent).toContain('0 B');
        const changed = new File(['example'], 'Example.csv', {lastModified:3});
        await pick([changed]);
        expect(selected().querySelectorAll('li')).toHaveLength(3);
        await click(selected().querySelector('[aria-label="Remove Empty.txt"]'));
        await click(uploadButton());
        expect(upload).toHaveBeenCalledExactlyOnceWith([files[0], changed]);
        await click([...selected().querySelectorAll('button')].find(node => node.textContent === 'Close'));
        expect(close).toHaveBeenCalledOnce();
        await render(view(false)); await render(view(true));
        expect(selected().querySelectorAll('li')).toHaveLength(0);
        expect(uploadButton().disabled).toBe(true);
    });

    it('retains progress and distinguishes failed, completed and canceled uploads', async () => {
        const view = status => <AttachmentDialog isOpen onClose={() => {}} uploads={[{name:files[0].name,size:files[0].size,status,progress:0.4,error:new Error('Example failure')}]}/>;
        await render(view('uploading')); await pick([files[0]]);
        expect(selected().querySelector('[role=progressbar]').getAttribute('aria-valuenow')).toBe('40');
        expect(selected().querySelector('[role=status]').textContent).toBe('40%');
        await render(view('error')); expect(selected().querySelector('[role=alert]').textContent).toBe('Example failure');
        await render(view('done')); expect(selected().querySelector('[role=status]').textContent).toBe('Uploaded');
        await render(view('aborted')); expect(selected().querySelector('[role=status]').textContent).toBe('Upload canceled');
        expect(selected().querySelector('li').textContent).toContain(files[0].name);
    });

    it('adds dropped files to the picker selection and waits for Upload', async () => {
        const upload = vi.fn();
        const view = isOpen => <AttachmentDialog isOpen={isOpen} onClose={() => {}} onSelect={upload}/>;
        await render(view(true));
        const input = selected().querySelector('input[type=file]');
        const body = selected().querySelector('.bp6-dialog-body');
        const transfer = {types:['Files'],files,dropEffect:'none'};
        await pick([files[0]]);
        await act(async () => Simulate.dragEnter(body, {dataTransfer:transfer}));
        await act(async () => Simulate.dragEnter(input, {dataTransfer:transfer}));
        await act(async () => Simulate.dragLeave(input, {dataTransfer:transfer}));
        expect(selected().textContent).toContain('Release to add files');
        await act(async () => Simulate.dragOver(input, {dataTransfer:transfer}));
        expect(transfer.dropEffect).toBe('copy');
        await act(async () => Simulate.drop(input, {dataTransfer:transfer}));
        expect(selected().querySelectorAll('li')).toHaveLength(2);
        expect(selected().textContent).toContain('2 files selected');
        expect(selected().textContent).toContain('Drop more files here');
        expect(upload).not.toHaveBeenCalled();
        await pick(files);
        expect(selected().querySelectorAll('li')).toHaveLength(2);
        await click(selected().querySelector('[aria-label="Remove Empty.txt"]'));
        expect(selected().textContent).toContain('1 file selected');
        await click([...selected().querySelectorAll('button')].find(node => node.textContent === 'Upload'));
        expect(upload).toHaveBeenCalledExactlyOnceWith([files[0]]);
        await act(async () => Simulate.dragEnter(body, {dataTransfer:transfer}));
        await render(view(false)); await render(view(true));
        expect(selected().querySelectorAll('li')).toHaveLength(0);
        expect(selected().textContent).toContain('Drop files here');
        expect(selected().textContent).not.toContain('Release to add files');
    });

    it('keeps the shared attachment recipe free of local appearance overrides', () => {
        const css = fs.readFileSync('src/components/chat/AttachmentDialog.css', 'utf8');
        expect(css).not.toMatch(/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(|!important/);
        expect(fs.readFileSync('src/components/chat/AttachmentDialog.jsx', 'utf8')).not.toMatch(/style=|fontSize\s*:|fontFamily\s*:/);
    });
});
