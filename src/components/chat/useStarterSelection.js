import {useEffect, useState} from 'react';

function read() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('starter') || '';
    return /^[\w.-]{1,128}$/.test(id) ? {id, source: {library: params.get('starterFrom') === 'library'}} : null;
}

// Persist a bounded UI location, never a prompt or report payload, in the URL.
export default function useStarterSelection(conversationId) {
    const [selected, setSelected] = useState(read);
    const change = (next, replace = false) => {
        const url = new URL(window.location.href);
        if (next) {url.searchParams.set('starter', next.id); url.searchParams.set('starterFrom', next.source.library ? 'library' : 'suggestions');}
        else {url.searchParams.delete('starter'); url.searchParams.delete('starterFrom');}
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
