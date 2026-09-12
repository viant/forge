import React, {createContext, useContext, useEffect, useLayoutEffect, useMemo, useState} from 'react';
import {Classes, PortalProvider} from '@blueprintjs/core';

const ThemeContext = createContext(null);
const useClientLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

// The host owns selection and asset loading. Forge owns DOM/portal propagation.
export function ForgeThemeProvider({themeId = '', mode = 'light', scopeClassName = 'agently-workspace', portalContainer, children}) {
    const value = useMemo(() => ({themeId, mode: mode === 'dark' ? 'dark' : 'light', scopeClassName, portalContainer}), [themeId, mode, scopeClassName, portalContainer]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function themeBoundaryProps(theme, windowKey) {
    if (!theme) return {};
    return {
        className: [theme.scopeClassName, theme.themeId && theme.mode === 'dark' ? Classes.DARK : ''].filter(Boolean).join(' '),
        'data-forge-window-key': String(windowKey || '').split('?')[0],
        'data-forge-theme': theme.themeId || undefined,
        'data-forge-color-mode': theme.themeId ? theme.mode : undefined,
    };
}

export function ForgeThemeBoundary({windowKey, portalContainer, children}) {
    const theme = useContext(ThemeContext);
    const [portal, setPortal] = useState(null);
    const props = themeBoundaryProps(theme, windowKey);
    const parent = portalContainer ?? theme?.portalContainer ?? (typeof document === 'undefined' ? null : document.body);
    useClientLayoutEffect(() => {
        if (!theme || typeof document === 'undefined') return;
        if (!parent || parent.ownerDocument !== document) throw new Error('Theme portal mounts must belong to the current document');
        const element = document.createElement('div');
        element.dataset.forgeThemePortal = '';
        parent.appendChild(element);
        setPortal(element);
        return () => { element.remove(); setPortal(null); };
    }, [!!theme]);
    useClientLayoutEffect(() => {
        if (!portal || !parent) return;
        if (parent.ownerDocument !== document) throw new Error('Theme portal mounts must belong to the current document');
        // Move the owned scope node rather than replacing it, preserving portal state.
        if (portal.parentElement !== parent) parent.appendChild(portal);
    }, [portal, parent]);
    useClientLayoutEffect(() => {
        if (!portal) return;
        portal.className = props.className || '';
        for (const name of ['data-forge-window-key', 'data-forge-theme', 'data-forge-color-mode']) {
            if (props[name] === undefined) portal.removeAttribute(name);
            else portal.setAttribute(name, props[name]);
        }
    }, [portal, props.className, props['data-forge-window-key'], props['data-forge-theme'], props['data-forge-color-mode']]);
    if (!theme) return children;
    return <PortalProvider portalContainer={portal || undefined}>
        <div {...props} style={{display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, minHeight: 0, height: '100%'}}>
            {children}
        </div>
    </PortalProvider>;
}
