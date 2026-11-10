import {useEffect, useState} from 'react';

function read() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('starter') || '';
    const fingerprint = params.get('starterFingerprint') || '';
    const namespaceTask = /^startertask:\/\/[^\s/#?:]{1,128}\/default#[^#|\r\n\t]{1,128}$/.test(id);
    if (!/^[\w.-]{1,128}$/.test(id) && !namespaceTask) return null;
    if (fingerprint && (!namespaceTask || !/^[0-9a-f]{64}$/.test(fingerprint))) return null;
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
