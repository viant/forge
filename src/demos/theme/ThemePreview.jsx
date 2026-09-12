import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button, Popover, Dialog} from '@blueprintjs/core';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../../packs/blueprint/index.jsx';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../../components/ThemeBoundary.jsx';
import WidgetRenderer from '../../runtime/WidgetRenderer.jsx';
import '../../../../agently-core/protocol/ui/theme/testdata/baseline.css';

function App() {
    const [mode, setMode] = useState('light');
    const [portalRoot, setPortalRoot] = useState(null);
    const [portalStatus, setPortalStatus] = useState('Not checked');
    const [active, setActive] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [unwrapped, setUnwrapped] = useState(false);
    const state = useState({customer: '', amount: 7});
    const input = (id, widget, more = {}) => <WidgetRenderer key={id} state={state}
        item={{id, label: id, widget, scope: 'local', ...more}} container={{layout: {columns: 1}}} />;
    return <>
        <div style={{display: 'flex', gap: 12, padding: 16}}>
            <Button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>Switch mode</Button>
            <Button onClick={() => setUnwrapped(!unwrapped)}>Toggle wrapper</Button>
            <Button onClick={() => setActive(!active)}>Toggle surface</Button>
        </div>
        <div ref={setPortalRoot} data-custom-portal-host className="custom-portal-owner" />
        <Button onClick={() => setPortalStatus(portalRoot?.className === 'custom-portal-owner' && (active ? !!portalRoot.querySelector('[data-forge-theme-portal]') : portalRoot.childElementCount === 0) ? (active ? 'Custom portal scope is attached; owner attributes preserved' : 'Portal scope removed; caller mount preserved') : 'Custom portal check failed')}>Check custom portal</Button>
        <p role="status">{portalStatus}</p>
        <ForgeThemeProvider themeId="baseline" mode={mode} portalContainer={portalRoot}>
            {active && <ForgeThemeBoundary windowKey="theme-proof?instance=1">
                <div style={{padding: 24, display: 'grid', gap: 16, maxWidth: 500}}>
                    {input('customer', 'text', {wrapper: unwrapped ? 'none' : undefined})}
                    {input('amount', 'number')}
                    {input('notes', 'textarea')}
                    {input('disabled', 'text', {disabled: true})}
                    {input('invalid', 'text', {required: true})}
                    {input('save', 'button')}
                    {input('disabled-button', 'button', {disabled: true})}
                    <Popover content={<div style={{padding: 16}}>{input('portal', 'text')}<Button onClick={() => setDialogOpen(true)}>Open dialog</Button></div>}>
                        <Button>Open popup</Button>
                    </Popover>
                    <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title="Theme dialog">
                        <div style={{padding: 20}}>{input('dialog-input', 'text')}</div>
                    </Dialog>
                </div>
            </ForgeThemeBoundary>}
        </ForgeThemeProvider>
    </>;
}
createRoot(document.getElementById('root')).render(<App />);
