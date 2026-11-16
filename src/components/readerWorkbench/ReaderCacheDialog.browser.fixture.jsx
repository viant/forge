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
const evidenceScenario=new URLSearchParams(location.search).get('evidence');
const recordedTarget=index=>({view:index?`children/${index}`:'',policyName:'stored-policy',policyRef:'stored-reference',origin:'host',connectorName:`stored-connector-${index}`,cacheName:`stored-cache-${index}`,cacheProvider:'afs',indexColumn:`ID${index}`,indexParameter:`Input${index}`});
const recordedRun=(runId,target,entries=80)=>({runId,target,entries,status:'completed',...version,requestedBy:runId,plannedCases:2,completedCases:2,duration:12000000});
const eightTargets=Array.from({length:8},(_,index)=>recordedTarget(index));
eightTargets[0].work=[{...recordedTarget(0),view:'summary/one'},{...recordedTarget(1),view:'summary/two',cacheProvider:'aerospike'}];
const recordedHistory={
 eight:[recordedRun('eight-target-run',{scheduledTargets:eightTargets})],
 single:[recordedRun('single-target-run',{scheduledTargets:[eightTargets[0]]})],
 legacy:[recordedRun('legacy-run',{view:'records',cacheName:'legacy-cache',indexColumn:'LegacyID',indexParameter:'LegacyInput'})],
 absent:[recordedRun('absent-target-run',{view:'records'})],
 history:[recordedRun('recent-run',{scheduledTargets:[recordedTarget(1)]}),recordedRun('historical-run',{scheduledTargets:[{...recordedTarget(0),cacheName:'historical-cache',connectorName:'historical-connector'}]},40)],
};
const api = {
  inspectVersion: async () => ({structure, effectiveWarmup: {
    status: 'resolved', reportId: report.id, ...version,
    targets: [{view: 'children', policyName: 'child-plan', origin: 'host', policyRef: 'child-policy', cacheName: 'child-storage', indexColumn: 'ID', rowLimit: 0}],
  }}),
  listWarmupRuns: async () => ({items: recordedHistory[evidenceScenario] || []}),
};
createRoot(document.getElementById('root')).render(<ReaderCacheDialog
  api={api} report={report} version={version} structure={structure} isOpen canEdit canWarmup
  onClose={() => {}} onApply={async operation => {proof.operations.push(operation);}}
  onWarmup={async () => {
    proof.runs.push({componentId: report.id, ...version});
    return {runId: 'synthetic-completed', status: 'completed', ...version, entries: 3};
  }}
/>);
