import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {ForgeThemeProvider,ForgeThemeBoundary} from './ThemeBoundary.jsx';

it('inherits host portal ownership, permits explicit overrides and preserves caller mounts',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div'),parent=document.createElement('div'),override=document.createElement('div');
 document.body.append(host,parent,override);const root=createRoot(host);
 try {
  const view=mount=><ForgeThemeProvider portalContainer={parent}><ForgeThemeProvider portalContainer={mount}><ForgeThemeBoundary windowKey="sample"><span>Content</span></ForgeThemeBoundary></ForgeThemeProvider></ForgeThemeProvider>;
  await act(async()=>root.render(view(undefined)));
  const scope=parent.querySelector('[data-forge-theme-portal]');expect(scope).not.toBeNull();
  expect(scope.dataset.forgeWindowKey).toBe('sample');
  await act(async()=>root.render(view(override)));
  expect(override.querySelector('[data-forge-theme-portal]')).toBe(scope);
  expect(parent.querySelector('[data-forge-theme-portal]')).toBeNull();
  await act(async()=>root.render(view(undefined)));
  expect(parent.querySelector('[data-forge-theme-portal]')).toBe(scope);
  await act(async()=>root.unmount());
  expect(parent.isConnected).toBe(true);expect(override.isConnected).toBe(true);
  expect(parent.childElementCount).toBe(0);expect(override.childElementCount).toBe(0);
 }finally {host.remove();parent.remove();override.remove();}
});
