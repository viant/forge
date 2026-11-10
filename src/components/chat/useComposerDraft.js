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
            const stored = read();
            const current = String(previous[id] ?? stored[id] ?? '');
            const updated = String(typeof value === 'function' ? value(current) : value);
            if (typeof value === 'function' && current === updated) return previous;
            const next = {...previous, [id]: updated};
            try {sessionStorage.setItem(key, JSON.stringify({...stored, [id]: updated}));} catch {}
            return next;
        });
    }, [id]);
    // A newer draft can follow its first accepted turn into the conversation.
    // Preserve both drafts if the destination already has different text.
    const moveTo = useCallback((target, value) => {
        if (!target || target === id) return;
        setDrafts(previous => {
            const stored = read();
            const current = previous[id] ?? stored[id];
            const destination = previous[target] ?? stored[target];
            if (current !== value || (destination && destination !== value)) return previous;
            const moved = {[id]: '', [target]: value};
            try {sessionStorage.setItem(key, JSON.stringify({...stored, ...moved}));} catch {}
            return {...previous, ...moved};
        });
    }, [id]);
    return [String(drafts[id] ?? read()[id] ?? ''), update, moveTo];
}
