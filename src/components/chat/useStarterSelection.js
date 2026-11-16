import {useEffect, useMemo, useState} from 'react';

export const isNamespaceStarterTask = id => /^startertask:\/\/[^\s/#?:]{1,128}\/default#[^#|\r\n\t]{1,128}$/.test(id);
const validFingerprint = value => /^[0-9a-f]{64}$/.test(value);

// Prepare only the selected local template, on content changes. This is UI draft
// identity, never a namespace lookup receipt or an authorization decision.
export function useLocalStarterFingerprint(task) {
    const source = useMemo(() => task && !isNamespaceStarterTask(task.id)
        ? JSON.stringify([task.id, task.agentId || '', task.title || '', task.prompt || '']) : '',
    [task?.id, task?.agentId, task?.title, task?.prompt]);
    const [prepared, setPrepared] = useState(null);
    useEffect(() => {
        if (!source) return;
        let active = true;
        if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) {
            setPrepared({source, error: 'secureContext'});
            return;
        }
        Promise.resolve().then(() => crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)))
            .then(bytes => {
                if (active) setPrepared({source, fingerprint: Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')});
            }, () => {if (active) setPrepared({source, error: true});});
        return () => {active = false;};
    }, [source]);
    return prepared?.source === source ? prepared : null;
}

function read() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('starter') || '';
    const fingerprint = params.get('starterFingerprint') || '';
    const namespaceTask = isNamespaceStarterTask(id);
    if (!/^[\w.-]{1,128}(?:#[\w.-]{1,128})?$/.test(id) && !namespaceTask) return null;
    if (fingerprint && !validFingerprint(fingerprint)) return null;
    return {id, ...(fingerprint ? {fingerprint} : {}), source: {library: params.get('starterFrom') === 'library'}};
}

// Persist a bounded UI location, never a prompt or report payload, in the URL.
export default function useStarterSelection(conversationId) {
    const [selected, setSelected] = useState(read);
    const change = (next, replace = false) => {
        const url = new URL(window.location.href);
        if (next) {url.searchParams.set('starter', next.id); url.searchParams.set('starterFrom', next.source.library ? 'library' : 'suggestions');}
        else {url.searchParams.delete('starter'); url.searchParams.delete('starterFrom');}
        if (next?.fingerprint) url.searchParams.set('starterFingerprint', next.fingerprint);
        else url.searchParams.delete('starterFingerprint');
        if (url.href !== window.location.href) {
            window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', url);
            if (!replace) window.dispatchEvent(new CustomEvent('forge:chat-location'));
        }
        setSelected(next);
    };
    useEffect(() => {
        const restore = () => setSelected(read());
        window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);
    useEffect(() => {if (conversationId) change(null, true);}, [conversationId]);
    return [selected, change];
}
