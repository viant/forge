import React, {act, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect, it} from 'vitest';
import DataStateBoundary from './DataStateBoundary.jsx';

it('mounts controls and independent loaders before data completes and preserves them on failure', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const control = signal({loading:true,loaded:false});
  const collection = signal([]);
  const context = {signals:{control,collection,form:signal({}),metrics:signal({})}};
  context.Context = () => context;
  let mounted = 0;
  function Content() {
    useEffect(() => { mounted++; }, []);
    return <><input aria-label="Filter" defaultValue="draft"/><span>Independent section</span></>;
  }
  try {
    await act(async () => root.render(<DataStateBoundary context={context} container={{dataSourceRef:'slow',dataStateBoundary:{dataSourceRefs:['slow'],loadingMessage:'Loading report data'}}}><Content/></DataStateBoundary>));
    const input = host.querySelector('input');
    expect(input).not.toBeNull();
    expect(host.textContent).toContain('Loading report data');
    expect(host.textContent).toContain('Independent section');
    input.value = 'user draft';
    await act(async () => {control.value={loaded:true,error:new Error('Failed upstream')};});
    expect(host.textContent).toContain('Unable to load data');
    expect(host.querySelector('input')).toBe(input);
    await act(async () => {collection.value=[{id:1}];control.value={loaded:true};});
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('user draft');
    expect(mounted).toBe(1);
  } finally {await act(async () => root.unmount());host.remove();}
});
