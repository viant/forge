import {WorkbenchDialog as Dialog, WorkbenchAlert as Alert} from './WorkbenchMutationContext.jsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Callout, Dialog as BlueprintDialog, DialogBody, DialogFooter, FormGroup, HTMLSelect, HTMLTable, InputGroup, NumericInput, Tag, TextArea } from '@blueprintjs/core';
import { parseWarmupCases, validateWarmupCases, warmupCaseCount, warmupCaseExpression } from './warmupPlan.js';

export function ReaderCacheDialog({ api, report, version, canWarmup, canEdit = true, isOpen, structure, onClose, onApply, onWarmup }) {
  const cache = structure?.component?.settings?.cache;
  const warmupConfig = cache?.warmup;
  const root = structure?.component?.rootView;
  const rootCacheBinding = root?.source?.bindings?.cacheName;
  const inspectionKey = JSON.stringify([report?.id, version?.versionNo, version?.sourceRevision]);
  const [inspectionResult, setInspectionResult] = useState({});
  const [inspectionAttempt, setInspectionAttempt] = useState(0);
  const currentInspection = inspectionResult.key === inspectionKey ? inspectionResult : {};
  const inspecting = inspectionResult.key !== inspectionKey || currentInspection.loading === true;
  const discoveredStructure = currentInspection.value?.structure;
  const warmupInspectionError = currentInspection.error || '';
  const effectiveWarmup = currentInspection.value?.effectiveWarmup;
  const effectiveResolved = effectiveWarmup?.status === 'resolved' && Array.isArray(effectiveWarmup.targets)
    && effectiveWarmup.reportId === report?.id && effectiveWarmup.versionNo === version?.versionNo
    && effectiveWarmup.sourceRevision === version?.sourceRevision;
  const inspectedStructure = discoveredStructure || structure;
  const columns = inspectedStructure?.component?.rootView?.columns ?? [];
  const connectors = inspectedStructure?.availableConnectors ?? structure?.availableConnectors ?? [];
  const namedCache = Boolean(rootCacheBinding || (cache?.name && !cache?.provider && !cache?.location));
  const hasRootCache = Boolean(rootCacheBinding || cache?.name || cache?.provider || cache?.location);
  const [name, setName] = useState('');
  const [ttl, setTTL] = useState('');
  const [location, setLocation] = useState('');
  const [backend, setBackend] = useState('');
  const [provider, setProvider] = useState('');
  const [indexColumn, setIndexColumn] = useState('');
  const [indexParameter, setIndexParameter] = useState('');
  const [connector, setConnector] = useState('');
  const [maxCases, setMaxCases] = useState(undefined);
  const [limit, setLimit] = useState(undefined);
  const [fieldNames, setFieldNames] = useState('');
  const [caseLines, setCaseLines] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [warming, setWarming] = useState(false);
  const inlineEditor = useRef(null);
  const mutationPending = useRef(false);
  const [rootEdit, setRootEdit] = useState(null);
  const [replacement, setReplacement] = useState(null);
  // Blueprint can retain the closing alert's handlers during its exit transition.
  const replacementRef = useRef(null);
  replacementRef.current = isOpen && replacement?.key===inspectionKey ? replacement : null;
  const rootBinding = root?.source?.bindings?.cacheWarmup;
  const reference = rootWarmupReference(structure);
  const rootHasNoPolicy = Boolean(root) && effectiveResolved && !warmupConfig && !rootBinding && !effectiveWarmup.targets.some(target=>target.view==='');
  const editingReference = rootEdit?.key === inspectionKey && rootEdit.reference;
  const rootStorage = Boolean(cache?.enabled || root?.source?.bindings?.cacheName);
  const openRootEditor = () => {
    setError('');
    setRootEdit(reference ? {key:inspectionKey,reference,binding:rootBinding,version:{versionNo:version.versionNo,sourceRevision:version.sourceRevision}} : null);
    if (inlineEditor.current) inlineEditor.current.open = true;
  };
  const cancelRootEdit = () => { setRootEdit(null); setReplacement(null); if(inlineEditor.current)inlineEditor.current.open=false; };

  useEffect(() => {
    if (!isOpen) { setRootEdit(null); setReplacement(null); return; }
    setName(cache?.name ?? ''); setTTL(cache?.ttl ?? ''); setLocation(cache?.location ?? '');
    setBackend(cache?.provider ? 'aerospike' : cache?.location ? 'afs' : ''); setProvider(cache?.provider ?? '');
    setIndexColumn(warmupConfig?.indexColumn ?? '');
    setIndexParameter(warmupConfig?.indexParameter ?? ''); setConnector(warmupConfig?.connector ?? '');
    setMaxCases(warmupConfig?.maxCases); setLimit(warmupConfig?.limit);
    setFieldNames((warmupConfig?.fieldNames ?? []).join(', ')); setCaseLines(renderCases(warmupConfig));
    setSaving(false); setError(''); setRootEdit(null); setReplacement(null);
  }, [isOpen, report?.id, version?.versionNo, version?.sourceRevision, cache, warmupConfig]);

  useEffect(() => {
    if (!isOpen) return;
    setInspectionResult({key:inspectionKey, loading:true});
    if (!api?.inspectVersion || !report?.id || !version?.versionNo) {
      setInspectionResult({key:inspectionKey, loading:false});
      return;
    }
    let cancelled = false;
    api.inspectVersion(report.id, version.versionNo, { discoverColumns: false, includePreviewInput: false, includeEffectiveWarmup: true }).then((inspected) => {
      if(cancelled)return;
      const identities=[inspected?.version,inspected?.effectiveWarmup].filter(Boolean);
      if(!identities.length||!identities.every(item=>item.reportId===report.id&&item.versionNo===version.versionNo&&item.sourceRevision===version.sourceRevision)) {
        setInspectionResult({key:inspectionKey,loading:false,error:'Warmup metadata does not match the inspected saved revision. Refresh the reader and try again.'});
        return;
      }
      setInspectionResult({key:inspectionKey, loading:false, value:inspected});
    }).catch((cause) => {
      if (!cancelled) setInspectionResult({key:inspectionKey, loading:false, error:cause.message});
    });
    return () => { cancelled = true; };
  }, [isOpen, api, inspectionKey, inspectionAttempt]);

  useEffect(() => {
    if (!isOpen || !api || !report?.id || !version?.versionNo) return undefined;
    let cancelled = false;
    setHistory([]); setSelectedRunId(null); setHistoryLoading(true);
    api.listWarmupRuns(report.id,version.versionNo,{limit:10}).then((page) => { if (!cancelled) { const items=page?.items??[]; setHistory(current=>[...current,...items.filter(item=>!current.some(existing=>existing.runId===item.runId))]); setSelectedRunId(current=>current??items[0]?.runId??null); } }).catch((cause) => !cancelled && setError(cause.message)).finally(() => !cancelled && setHistoryLoading(false));
    return () => { cancelled = true; };
  }, [api, isOpen, report?.id, version?.versionNo]);

  const cases = useMemo(() => parseWarmupCases(caseLines), [caseLines]);
  const caseErrors = useMemo(() => validateWarmupCases(cases), [cases]);
  const caseCount = useMemo(() => warmupCaseCount(cases), [cases]);
  const caseExpression = useMemo(() => warmupCaseExpression(cases), [cases]);
  const warmup = history.find(run=>run.runId===selectedRunId);
  // Evidence selection must not change which persisted work is being polled.
  const pollingRun = history.find(run=>['accepted','running'].includes(run.status));
  const activeRun = Boolean(pollingRun);
  const maxCasesLabel = maxCases ?? 'native default';
  const limitLabel = limit ?? 'native default';
  const ready = namedCache || (name.trim() && /^\d+(ms|s|m|h)$/.test(ttl) && location.trim() && (backend === 'afs' || provider.trim()));

  const saveCache = async () => {
    if (namedCache) return;
    if (!ready || location.includes("'")) { setError('Provide a cache name, duration, location, and host-approved provider reference for Aerospike.'); return; }
    setSaving(true); setError('');
    const options = [{ name: 'WithLocation', args: [quote(location.trim())] }];
    if (backend === 'aerospike') options.unshift({ name: 'WithProvider', args: [quote(provider.trim())] });
    try { await onApply({ type: 'setSetting', setting: { name: 'cache', args: [quote(name.trim()), quote(ttl)], options } }); }
    catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };

  const submitWarmup = async (operation, targetVersion) => {
    if (mutationPending.current) return;
    mutationPending.current=true; setSaving(true); setError('');
    try {
      if(targetVersion)await onApply(operation,targetVersion);else await onApply(operation);
      setRootEdit(null); setInspectionAttempt(attempt=>attempt+1);
    } catch (cause) { setError(cause.message); }
    finally { setReplacement(null); mutationPending.current=false; setSaving(false); }
  };
  const saveWarmup = async () => {
    if (!rootStorage) { setError('Save an enabled cache before authoring warmup.'); return; }
    if (caseErrors.length) { setError(caseErrors[0]); return; }
    if (!indexColumn.trim()) { setError('Warmup needs an index column.'); return; }
    const args = serializeWarmupArgs(warmupConfig, {indexColumn, indexParameter, connector, maxCases, limit, fieldNames, cases});
    const setting={type:'setSetting',setting:{name:'cache_warmup',args}};
    if(editingReference){
      const fn=editingReference;
      setReplacement({key:inspectionKey,binding:rootEdit.binding,version:rootEdit.version,operation:{type:'batch',operations:[
        {type:'removeFunction',function:{name:fn.name,occurrence:fn.occurrence,expectedArgs:[...fn.args]}},setting,
      ]}});
      return;
    }
    await submitWarmup(setting);
  };

  const removeWarmup = () => submitWarmup({type:'setSetting',setting:{name:'cache_warmup',remove:true}});

  const executeWarmup = async () => {
    setWarming(true); setError('');
    try { const run=await onWarmup(); setSelectedRunId(run.runId); setHistory((current)=>[run,...current.filter((item)=>item.runId!==run.runId)]); }
    catch (cause) { setError(cause.message); }
    finally { setWarming(false); }
  };

  useEffect(() => {
    if (!isOpen || !api || !report?.id || !pollingRun?.runId) return undefined;
    let cancelled=false; let timer;
    const poll=async()=>{try{const run=await api.getWarmupRun(report.id,pollingRun.runId);if(cancelled)return;setHistory(current=>current.map(item=>item.runId===run.runId?run:item));if(['accepted','running'].includes(run.status))timer=setTimeout(poll,500);}catch(cause){if(!cancelled)setError(cause.message);}};
    timer=setTimeout(poll,350);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[api,isOpen,report?.id,pollingRun?.runId,pollingRun?.status]);

  return <Dialog portalClassName="forge-reader-workbench-dialog" className="studio-connector-dialog studio-cache-dialog" isOpen={isOpen} onClose={onClose} title="Cache & warmup" icon="database" canOutsideClickClose={!saving && !warming}>
    <DialogBody className="studio-connector-dialog-body">
      <p className="studio-dialog-lead">Configure Datly’s native prepared-view cache and edit its inline warmup plan. Browser values never contain cache credentials.</p>
      {error && <Callout intent="danger" role="alert">{error}</Callout>}
      {warmupInspectionError && <Callout intent="warning">Warmup inspection failed; the configured index column was retained. {warmupInspectionError}</Callout>}
      <div className="studio-cache-layout"><div className="studio-cache-configuration">
      <section className="studio-cache-section" aria-label="Effective warmup plans">
        <h3>Effective warmup plans</h3>
        <p>Resolved using current host configuration for the saved version. Host configuration may change before execution.</p>
        {inspecting ? <p role="status">Loading effective warmup plans…</p> : effectiveResolved ? <EffectiveWarmupPlans targets={effectiveWarmup.targets}/> : <Callout intent="warning" role="status">Effective warmup plans are unavailable for this saved revision.</Callout>}
        {(currentInspection.value?.diagnostics ?? []).map((item,index)=><Callout key={index} intent={item.severity==='error'?'danger':item.severity==='info'?'primary':'warning'} title={item.code}>{item.message}</Callout>)}
        {!effectiveResolved && !inspecting && <Button icon="refresh" onClick={()=>setInspectionAttempt(attempt=>attempt+1)}>Retry</Button>}
        <p>Run all effective plans uses the saved version and excludes unsaved edits.</p>
        <div className="studio-warmup-actions"><Button icon="play" loading={warming||activeRun} disabled={!canWarmup||saving||activeRun} title={!canWarmup?'Publish permission is required to run warmup':''} onClick={executeWarmup}>Run all effective plans</Button></div>
      </section>
      <section className="studio-cache-section" aria-label="Root view cache"><div className="studio-panel-heading"><div><h3>Root view cache</h3></div>{rootStorage && <Tag minimal intent="success">enabled</Tag>}</div>
        {namedCache ? <p role="status">Host-configured cache: {rootCacheBinding || cache.name}.</p> : <>{hasRootCache && <p>{cache.name || 'Inline cache'}{cache.provider && <> · {cache.provider}</>}{cache.location && <> · {cache.location}</>}{cache.ttl && <> · TTL {cache.ttl}</>}</p>}<details key={inspectionKey}><summary>{hasRootCache ? 'Inline cache settings' : 'Add root cache…'}</summary><div className="studio-form-grid"><FormGroup label="Backend" labelFor="cache-backend"><HTMLSelect id="cache-backend" value={backend} onChange={(event)=>setBackend(event.target.value)} fill disabled={saving}><option value="">Select backend</option><option value="afs">AFS</option><option value="aerospike">Aerospike</option></HTMLSelect></FormGroup><FormGroup label="TTL" labelFor="cache-ttl" helperText="ms, s, m, or h"><InputGroup id="cache-ttl" value={ttl} onChange={(event)=>setTTL(event.target.value)} disabled={saving}/></FormGroup></div>
          <FormGroup label="Cache name" labelFor="cache-name"><InputGroup id="cache-name" value={name} onChange={(event)=>setName(event.target.value)} placeholder="product-status" disabled={saving}/></FormGroup>
          {backend === 'aerospike' && <FormGroup label="Approved provider" labelFor="cache-provider" helperText="Host-owned provider reference; never credentials."><InputGroup id="cache-provider" value={provider} onChange={(event)=>setProvider(event.target.value)} placeholder="aerospike://approved-provider" disabled={saving}/></FormGroup>}
          <FormGroup label="Location" labelFor="cache-location"><InputGroup id="cache-location" value={location} onChange={(event)=>setLocation(event.target.value)} placeholder={backend==='afs'?'/var/cache/datly/products':'namespace/set'} disabled={saving}/></FormGroup>
          <Button intent="primary" icon="floppy-disk" loading={saving} disabled={!ready} onClick={saveCache}>Save cache storage</Button></details></>}
      </section>

      <section className="studio-cache-section" aria-label="Root warmup authoring">
        <div className="studio-warmup-actions">
          {reference ? <Button disabled={!canEdit||!rootStorage||saving||warming||activeRun} onClick={openRootEditor}>Replace root reference with inline…</Button> : warmupConfig ? <Button disabled={!canEdit||saving} onClick={openRootEditor}>Edit root inline warmup plan</Button> : rootHasNoPolicy ? <Button disabled={!canEdit||!rootStorage||saving} onClick={openRootEditor}>Add root inline warmup plan</Button> : <p>Root policy authoring is unavailable without a resolved empty root or an exact authored reference.</p>}
        </div>
        <details ref={inlineEditor} key={inspectionKey} open={Boolean(warmupConfig)}><summary>Root inline warmup plan</summary><div className="studio-panel-heading"><div><p>This form edits the inline component plan. Run all effective plans executes the saved version’s effective policies, including host-named policies. Unsaved form changes are not included.</p></div><Tag minimal intent={maxCases == null || caseCount <= maxCases ? 'success' : 'danger'}>{caseCount} / {maxCasesLabel} cases</Tag></div>
        <div className="studio-form-grid"><FormGroup label="Index column" labelFor="warmup-index"><HTMLSelect id="warmup-index" value={indexColumn} onChange={(event)=>setIndexColumn(event.target.value)} fill disabled={saving}><option value="">Select a column</option>{indexColumn && !columns.some((column)=>column.source===indexColumn || column.name===indexColumn) && <option value={indexColumn}>{indexColumn}</option>}{columns.map((column)=><option key={column.source||column.name} value={column.source||column.name}>{column.name}</option>)}</HTMLSelect></FormGroup><FormGroup label="Index parameter" labelFor="warmup-parameter"><InputGroup id="warmup-parameter" value={indexParameter} onChange={(event)=>setIndexParameter(event.target.value)} placeholder="TenantID" disabled={saving}/></FormGroup></div>
        <div className="studio-form-grid"><FormGroup label="Warmup connector" labelFor="warmup-connector"><HTMLSelect id="warmup-connector" value={connector} onChange={(event)=>setConnector(event.target.value)} fill disabled={saving}><option value="">Component connector</option>{connectors.map((name)=><option key={name} value={name}>{name}</option>)}</HTMLSelect></FormGroup><FormGroup label="Selected fields" labelFor="warmup-fields"><InputGroup id="warmup-fields" value={fieldNames} onChange={(event)=>setFieldNames(event.target.value)} placeholder="id, status, total" disabled={saving}/></FormGroup></div>
        <div className="studio-form-grid"><FormGroup label="Max cases" labelFor="warmup-max"><NumericInput id="warmup-max" min={0} value={maxCases ?? ''} onValueChange={(value)=>setMaxCases(Number.isNaN(value)?undefined:value)} fill disabled={saving}/></FormGroup><FormGroup label="Row limit" labelFor="warmup-limit"><NumericInput id="warmup-limit" min={0} value={limit ?? ''} onValueChange={(value)=>setLimit(Number.isNaN(value)?undefined:value)} fill disabled={saving}/></FormGroup></div>
        <FormGroup label="Case dimensions" labelFor="warmup-cases" helperText="One Name=value1,value2 dimension per line. Case count is the Cartesian product."><TextArea id="warmup-cases" value={caseLines} onChange={(event)=>setCaseLines(event.target.value)} fill rows={4} className="studio-code-input" placeholder={'Period=today,yesterday\nGranularity=hour,day'} disabled={saving}/></FormGroup>
        <div className={`studio-case-product ${caseErrors.length?'invalid':''}`}><strong>Inline warmup plan estimate: {caseExpression} = {caseCount} {caseCount===1?'case':'cases'}</strong><span>MaxCases {maxCasesLabel} · row limit {limitLabel}</span>{caseErrors.length>0&&<span>{caseErrors[0]}</span>}</div>
        <div className="studio-warmup-actions"><Button intent="primary" icon="heatmap" loading={saving} disabled={!canEdit||!rootStorage||caseErrors.length>0||(!editingReference&&(Boolean(rootBinding)||(!warmupConfig&&!rootHasNoPolicy)))} onClick={saveWarmup}>{editingReference?'Review root reference replacement':'Save warmup plan'}</Button>{warmupConfig && <Button icon="trash" intent="danger" disabled={!canEdit||saving||warming||activeRun} onClick={removeWarmup}>Remove inline plan</Button>}<Button disabled={saving} onClick={cancelRootEdit}>Cancel root edit</Button></div>
      </details></section>
      </div><aside className="studio-warmup-evidence-panel" aria-label="Warmup operation evidence"><div className="studio-panel-heading"><div><h3>Operation evidence</h3><p>Server-owned runs survive this dialog and client disconnects.</p></div>{historyLoading&&<Tag minimal>Loading</Tag>}</div>
        {!warmup&&!historyLoading?<div className="studio-empty-compact">No warmup has been run for this version.</div>:warmup&&<WarmupEvidence run={warmup}/>}
        {history.length>0&&<div className="studio-warmup-history"><h4>Run history</h4>{history.slice(0,8).map((run)=><button type="button" key={run.runId} className={warmup?.runId===run.runId?'selected':''} onClick={()=>setSelectedRunId(run.runId)}><Tag minimal intent={runIntent(run.status)}>{run.status}</Tag><span><strong>{run.plannedCases||0} planned · {run.entries||0} prepared</strong><small>{formatDate(run.requestedAt)} · {run.requestedBy}</small></span></button>)}</div>}
      </aside></div>
    </DialogBody>
    <Alert portalClassName="forge-reader-workbench-dialog" isOpen={Boolean(isOpen && replacement && replacement.key===inspectionKey)} intent="warning" confirmButtonText="Replace root reference" cancelButtonText="Keep editing" loading={saving} onCancel={()=>setReplacement(null)} onConfirm={()=>{const pending=replacementRef.current;if(pending&&pending===replacement)return submitWarmup(pending.operation,pending.version);}} canEscapeKeyCancel={!saving} canOutsideClickCancel={!saving}>
      <p>Replace root reference <strong>{replacement?.binding}</strong> on <strong>{report?.title||report?.id}</strong>, version {replacement?.version.versionNo}, source revision {replacement?.version.sourceRevision}, with the inline plan you entered?</p>
      <p>The shared host policy, child references, and cache storage remain unchanged.</p>
    </Alert>
    <DialogFooter actions={<Button onClick={onClose} disabled={saving||warming}>Close</Button>}/>
  </Dialog>;
}


// These are native authoring occurrences, not inferred effective-policy names.
function rootWarmupReference(structure) {
  const root=structure?.component?.rootView;
  if(!root?.source?.bindings?.cacheWarmup)return null;
  const alias=root.namespace||root.name;
  const matches=(structure.functions??[]).filter(fn=>fn.name?.toLowerCase()==='cache_warmup'&&fn.args?.[0]===alias);
  return matches.length===1 ? {...matches[0],args:[...matches[0].args]} : null;
}

function EffectiveWarmupPlans({targets}) {
  if (!targets.length) return <p>No effective warmup plans for this saved version.</p>;
  return <div className="studio-column-table-wrap"><HTMLTable className="studio-data-table" aria-label="Effective warmup targets" striped>
    <thead><tr><th scope="col">View path</th><th scope="col">Policy</th><th scope="col">Origin</th><th scope="col">Cache</th><th scope="col">Connector</th><th scope="col">Settings</th></tr></thead>
    <tbody>{targets.map((target,index)=><tr key={index}>
      <td>{target.view === '' ? 'Root' : target.view}</td><td>{target.policyName || 'Unnamed policy'}<small> · Policy reference: {target.policyRef || 'Not supplied'}</small></td><td>{target.origin || 'Not supplied'}</td>
      <td>{target.cacheName || 'Not supplied'}{target.cacheProvider && <small> · {target.cacheProvider}</small>}</td><td>{target.connectorName || 'Native default'}</td>
      <td><details><summary>Settings</summary><dl>
        <dt>Index column</dt><dd>{target.indexColumn || 'Not supplied'}</dd>
        <dt>Index parameter</dt><dd>{target.indexParameter || 'Native default'}</dd>
        <dt>Index metadata</dt><dd>{target.indexMeta ? 'Enabled' : 'Disabled'}</dd>
        <dt>Max cases</dt><dd>{target.maxCases ?? 'Native default'}</dd>
        <dt>Row limit</dt><dd>{target.rowLimit === 0 ? 'Unlimited' : target.rowLimit ?? 'Native default'}</dd>
      </dl><h4>Case dimensions</h4>{target.cases?.length ? <ul>{target.cases.map((item,caseIndex)=><li key={caseIndex}>Case {caseIndex+1}<ul>{item.dimensions.map((dimension,dimensionIndex)=><li key={dimensionIndex}>{dimension.name}: {dimension.valueCount} values · Exclude default: {dimension.excludeDefault ? 'Yes' : 'No'}</li>)}</ul></li>)}</ul> : <p>No case dimensions supplied.</p>}
      {target.work?.length>0 && <><h4>Population</h4><ul>{target.work.map((work,workIndex)=><li key={workIndex}>{work.view === '' ? 'Root' : work.view} · {work.policyName || 'Unnamed policy'} · Origin: {work.origin || 'Not supplied'} · Policy reference: {work.policyRef || 'Not supplied'} · {work.cacheName || 'Not supplied'} · {work.connectorName || 'Native default'}</li>)}</ul></>}
      </details></td>
    </tr>)}</tbody>
  </HTMLTable></div>;
}

function renderCases(warmup) { return (warmup?.cases?.[0]?.set ?? []).map((item)=>`${item.name}=${(item.values??[]).join(',')}`).join('\n'); }
export function serializeWarmupArgs(warmup, edits) {
  const args = [quote(edits.indexColumn.trim())];
  const add = (name, value) => { if (value !== undefined && value !== null && value !== '') args.push(quote(`${name}=${value}`)); };
  add('Name', warmup?.name); add('Priority', warmup?.priority); add('CaseRefs', Array.isArray(warmup?.caseRefs) ? warmup.caseRefs.join(',') : warmup?.caseRefs);
  if (warmup?.indexMeta !== undefined) add('IndexMeta', warmup.indexMeta ? 'true' : 'false');
  add('Connector', edits.connector?.trim()); add('IndexParameter', edits.indexParameter?.trim());
  add('MaxCases', edits.maxCases); add('Limit', edits.limit);
  const fields = edits.fieldNames.split(',').map((item) => item.trim()).filter(Boolean);
  if (fields.length) add('FieldNames', fields.join(','));
  const existingParams = new Map((warmup?.cases?.[0]?.set ?? []).map((item) => [String(item.name).toLowerCase(), item]));
  const excluded = [];
  for (const item of edits.cases) {
    if (item.excludeDefault || existingParams.get(item.name.toLowerCase())?.excludeDefault) excluded.push(item.name);
    args.push(quote(`${item.name}=${item.values.join(',')}`));
  }
  if (excluded.length) add('ExcludeDefault', excluded.join(','));
  return args;
}
function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function formatDuration(value) { const nanoseconds=Number(value);if(!Number.isFinite(nanoseconds))return'completed';if(nanoseconds<1e6)return`${Math.round(nanoseconds/1e3)}µs`;return`${(nanoseconds/1e6).toFixed(1)}ms`; }
function formatDate(value){if(!value)return'—';const date=new Date(value);return Number.isNaN(date.valueOf())?value:new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);}
function runIntent(status){return status==='completed'?'success':status==='failed'?'danger':status==='partial'||status==='canceled'?'warning':'primary';}
function WarmupRecordedTarget({target}) {
  const fields=[
    ['View path',target.view===''?'Root':target.view],
    ['Policy',target.policyName],['Policy reference',target.policyRef],['Origin',target.origin],
    ['Connector override',target.connectorName],['Cache',target.cacheName],['Backend',target.cacheProvider],
    ['Index column',target.indexColumn],['Index parameter',target.indexParameter],
  ];
  return <dl>{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not supplied'}</dd></div>)}</dl>;
}
function WarmupEvidence({run}) {
  const terminal=['completed','partial','failed','canceled'].includes(run.status);
  const targets=run.target?.scheduledTargets;
  // The legacy root view alone does not establish resolved target settings.
  const legacy=['connectorName','cacheName','cacheProvider','indexColumn','indexParameter'].some(name=>run.target?.[name]);
  return <div className="studio-warmup-run" aria-live="polite">
    <div><Tag intent={runIntent(run.status)}>{run.status}</Tag><code>{run.runId}</code></div>
    <dl aria-label="Operation totals">
      <div><dt>Version</dt><dd>v{run.versionNo} · rev {run.sourceRevision}</dd></div>
      <div><dt>Plan</dt><dd>{run.completedCases||0} / {run.plannedCases||0} cases</dd></div>
      <div><dt>Plan key</dt><dd><code>{run.planKey?.slice(0,16)||'—'}</code></dd></div>
      <div><dt>Budgets</dt><dd>MaxCases {run.maxCases??'—'} · rows {run.rowLimit??'—'}</dd></div>
      <div><dt>Prepared</dt><dd>{run.entries||0} entries</dd></div>
      <div><dt>Duration</dt><dd>{terminal?formatDuration(run.duration):'Running'}</dd></div>
      <div><dt>Requested</dt><dd>{formatDate(run.requestedAt)} · {run.requestedBy}</dd></div>
    </dl>
    {targets?.length ? <details aria-label="Run targets">
      <summary>Run targets · {targets.length}</summary>
      <ol className="studio-warmup-targets" aria-label="Scheduled warmup targets">{targets.map((target,index)=><li key={index}>
        <details><summary>{target.view===''?'Root':target.view||'Not supplied'} · {target.policyName||target.policyRef||'Not supplied'}</summary>
          <WarmupRecordedTarget target={target}/>
          {target.work?.length>0 && <><h4>Population</h4><ul className="studio-warmup-work" aria-label="Target population">{target.work.map((work,workIndex)=><li key={workIndex}><WarmupRecordedTarget target={work}/></li>)}</ul></>}
        </details>
      </li>)}</ol>
    </details> : legacy ? <dl aria-label="Legacy target evidence">
      <div><dt>Connector</dt><dd>{run.target.connectorName||'Not supplied'}</dd></div>
      <div><dt>Cache</dt><dd>{run.target.cacheName||'Not supplied'} · {run.target.cacheProvider||'Not supplied'}</dd></div>
      <div><dt>Index</dt><dd>{run.target.indexColumn||'Not supplied'}</dd></div>
      <div><dt>Index parameter</dt><dd>{run.target.indexParameter||'Not supplied'}</dd></div>
    </dl> : <p>Target metadata unavailable.</p>}
    {(run.diagnostics??[]).map((item,index)=><Callout key={`${item.code}-${index}`} intent="danger" title={item.code}>{item.message}</Callout>)}
  </div>;
}
