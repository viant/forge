import {useCallback, useState} from 'react';

const key = 'forge.composerDrafts.v1';
function read() {
    try {const value = JSON.parse(sessionStorage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {};} catch {return {};}
}

// Use the same durable per-chat store as the existing composer and host prefills.
export default function useComposerDraft(draftKey) {
    const id = String(draftKey || '__pending__');
    const [drafts, setDrafts] = useState(read);
    const update = useCallback(value => {
        setDrafts(previous => {
            const next = {...previous, [id]: String(typeof value === 'function' ? value(previous[id] || '') : value)};
            try {sessionStorage.setItem(key, JSON.stringify({...read(), [id]: next[id]}));} catch {}
            return next;
        });
    }, [id]);
    return [String(drafts[id] ?? read()[id] ?? ''), update];
}
