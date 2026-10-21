import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect, it} from 'vitest';
import DataStateBoundary from './DataStateBoundary.jsx';

it('releases an explicitly completed empty aggregate without fetching its idle enrichment, while preserving loading and errors', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const windowForm = signal({aggregateReady: false});
  const makeContext = (control) => ({signals: {control: signal(control), collection: signal([]), form: signal({}), metrics: signal({}), windowForm}});
  const base = makeContext({loaded: true, loading: false});
  const enrichment = makeContext({loaded: false, loading: false});
  base.Context = ref => ref === 'enrichment' ? enrichment : base;
  const container = {dataStateBoundary: {dataSourceRefs: ['base', 'enrichment'], renderEmptyContent: true,
    ignoreIdleWhen: {source: 'windowForm', field: 'aggregateReady', equals: true}}};
  try {
    await act(async () => root.render(<DataStateBoundary container={container} context={base}><input aria-label="Search" defaultValue="draft"/></DataStateBoundary>));
    const input = host.querySelector('input');
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    await act(async () => {windowForm.value = {aggregateReady: true};});
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
    expect(enrichment.signals.control.peek()).toEqual({loaded: false, loading: false});
    expect(host.querySelector('input')).toBe(input);
    await act(async () => {enrichment.signals.control.value = {loaded: false, loading: true};});
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    await act(async () => {enrichment.signals.control.value = {loaded: false, loading: false, error: new Error('Enrichment failed')};});
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Enrichment failed');
    expect(host.querySelector('input')).toBe(input);
    await act(async () => {enrichment.signals.control.value = {loaded: false, loading: false}; windowForm.value = {aggregateReady: false};});
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  } finally {await act(async () => root.unmount()); host.remove();}
});

it('keeps the existing loading contract when no explicit idle condition is authored', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const context = {signals: {control: signal({loaded: false, loading: false}), collection: signal([])}};
  context.Context = () => context;
  try {
    await act(async () => root.render(<DataStateBoundary container={{dataSourceRef: 'required', dataStateBoundary: {renderEmptyContent: true}}} context={context}><span>Controls</span></DataStateBoundary>));
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  } finally {await act(async () => root.unmount()); host.remove();}
});
