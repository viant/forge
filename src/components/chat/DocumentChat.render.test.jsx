import React, {act, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fs from 'node:fs';
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

    it('keeps the shared recipe semantic and rejects hardcoded styling bypasses', () => {
        const css = fs.readFileSync('src/components/chat/documentChat.css', 'utf8');
        const bypass = /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(|!important|(?:^|[;{])\s*(?:font-size|font-weight|line-height|letter-spacing)\s*:\s*-?\d/i;
        expect(bypass.test(css)).toBe(false); expect(bypass.test('.bad {font-size: 13px}')).toBe(true);
        for (const path of ['./DocumentComposer.jsx', './StarterTaskBrowser.jsx']) {
            const source = fs.readFileSync(`src/components/chat/${path.slice(2)}`, 'utf8');
            expect(source).not.toMatch(/Viant|Steward|IBM Plex|fontSize\s*:|fontFamily\s*:/);
            expect(source).toContain("typographyProps('body')");
        }
    });
});
