// Independently authored synthetic metadata; no application captures or host access.
import React from 'react';
import {createRoot} from 'react-dom/client';
import '@blueprintjs/core/lib/css/blueprint.css';
import './ReaderWorkbench.css';
import {ReaderCacheDialog} from './ReaderCacheDialog.jsx';

const scenario = new URLSearchParams(location.search).get('scenario') || 'empty';
const report = {id: 'records', title: 'Records'};
const version = {versionNo: 2, sourceRevision: 4};
const cache = {
  inline: {enabled: true, name: 'records', ttl: '1m', location: '/synthetic/cache'},
  named: {enabled: true, name: 'host-storage'},
}[scenario];
const structure = {
  component: {
    rootView: {name: 'records', columns: [{name: 'ID'}], ...(scenario === 'bound' ? {source: {bindings: {cacheName: 'bound-storage'}}} : {})},
    settings: cache ? {cache} : {},
  },
};
const proof = window.__readerCacheProof = {operations: [], runs: []};
const api = {
  inspectVersion: async () => ({structure, effectiveWarmup: {
    status: 'resolved', reportId: report.id, ...version,
    targets: [{view: 'children', policyName: 'child-plan', origin: 'host', policyRef: 'child-policy', cacheName: 'child-storage', indexColumn: 'ID', rowLimit: 0}],
  }}),
  listWarmupRuns: async () => ({items: []}),
};
createRoot(document.getElementById('root')).render(<ReaderCacheDialog
  api={api} report={report} version={version} structure={structure} isOpen canEdit canWarmup
  onClose={() => {}} onApply={async operation => {proof.operations.push(operation);}}
  onWarmup={async () => {
    proof.runs.push({componentId: report.id, ...version});
    return {runId: 'synthetic-completed', status: 'completed', ...version, entries: 3};
  }}
/>);
