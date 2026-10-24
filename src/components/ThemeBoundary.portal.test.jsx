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

it('keeps provider namespace markers aligned between each window and its portal',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  const render=namespace=><ForgeThemeProvider><ForgeThemeBoundary windowKey="records" resource={{providerIdentity:'studio',uri:`window://${namespace}/records`}}><span>Records</span></ForgeThemeBoundary></ForgeThemeProvider>;
  await act(async()=>root.render(render('first')));
  expect(host.querySelector('[data-forge-resource-namespace="first"]')).not.toBeNull();
  const portal=document.body.querySelector('[data-forge-theme-portal][data-forge-resource-provider="studio"]');
  expect(portal.dataset.forgeResourceNamespace).toBe('first');
  await act(async()=>root.render(render('second')));
  expect(portal.dataset.forgeResourceNamespace).toBe('second');
  expect(host.querySelector('[data-forge-resource-namespace="first"]')).toBeNull();
 } finally {await act(async()=>root.unmount());host.remove();}
});

it('scopes document presentation to its content and owned portal without changing the theme',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  const view=presentation=><ForgeThemeProvider themeId="example"><ForgeThemeBoundary windowKey="reading" presentation={presentation}><span>Document</span></ForgeThemeBoundary></ForgeThemeProvider>;
  await act(async()=>root.render(view('document')));
  const content=host.querySelector('.agently-workspace'),portal=document.body.querySelector('[data-forge-theme-portal][data-forge-window-key="reading"]');
  expect(content.dataset.forgeTheme).toBe('example');expect(content.dataset.forgePresentation).toBe('document');expect(portal.dataset.forgePresentation).toBe('document');
  await act(async()=>root.render(view(undefined)));
  expect(content.hasAttribute('data-forge-presentation')).toBe(false);expect(portal.hasAttribute('data-forge-presentation')).toBe(false);
 } finally {await act(async()=>root.unmount());host.remove();}
});
