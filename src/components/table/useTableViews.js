import {useCallback, useEffect, useRef, useState} from 'react';
import {createTableViewSession} from '../../core/preferences/tableViews.js';

export function useTableViews({adapter, config, active}) {
    const [state, setState] = useState({views: [], loading: false, error: null});
    const session = useRef(null);
    const key = config?.key;
    useEffect(() => {
        setState({views: [], loading: false, error: null, adapter, key});
        if (!active || !config) return;
        if (typeof adapter?.list !== 'function' || !key) {
            setState({views: [], loading: false, error: new Error('Configured saved view provider is unavailable'), adapter, key});
            return;
        }
        const current = createTableViewSession(adapter, key, next => setState({...next, adapter, key}));
        session.current = current;
        current.load();
        return () => {current.dispose(); if (session.current === current) session.current = null;};
    }, [adapter, key, !!config, active]);
    return {
        ...(state.adapter === adapter && state.key === key ? state : {views: [], loading: !!active, error: null}),
        canSave: typeof adapter?.save === 'function' && !!key,
        canRemove: typeof adapter?.remove === 'function' && !!key,
        save: useCallback(value => session.current?.save(value), []),
        remove: useCallback(id => session.current?.remove(id), []),
        reload: useCallback(() => session.current?.load(), []),
    };
}
