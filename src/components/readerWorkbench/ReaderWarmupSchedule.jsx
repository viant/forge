import React, {useContext, useEffect, useRef, useState} from 'react';
import {Button, Callout, Checkbox, FormGroup, InputGroup, Tag} from '@blueprintjs/core';
import {WorkbenchAlert, WorkbenchMutationContext} from './WorkbenchMutationContext.jsx';

const draftFor=schedule=>({intervalSeconds:String(schedule?.intervalSeconds??3600),firstRunAt:schedule?.firstRunAt??'',enabled:schedule?.enabled??false});

// The dialog owns this lifecycle so closing portal transitions cannot retain requests.
// Scope is namespace/component/version, never reader source revision or selected view.
export function useReaderWarmupSchedule({api,reportId,versionNo,namespace,isOpen,canWarmup,history,onRunLoaded,onSelectRun}) {
  const key=JSON.stringify([namespace,reportId,versionNo]);
  const scope=useRef({key,isOpen,api,canWarmup});scope.current={key,isOpen,api,canWarmup};
  const [record,setRecord]=useState({key,status:'loading',schedule:null,draft:draftFor(null),error:null});
  const state=record.key===key?record:{key,status:'loading',schedule:null,draft:draftFor(null),error:null};
  const {draft,error}=state;
  const setState=update=>setRecord(current=>({...((typeof update==='function')?update(current.key===key?current:state):update),key}));
  const setDraft=update=>{if(currentScope())setRecord(current=>({...current,draft:update(current.draft)}));};
  const setError=error=>setRecord(current=>({...current,error}));
  const [busy,setBusy]=useState(false);
  const [confirmation,setConfirmation]=useState(null);
  const [linked,setLinked]=useState({});
  const generation=useRef(0),runGeneration=useRef(0),alive=useRef(false),pending=useRef(false);
  const latestHistory=useRef(history);latestHistory.current=history;
  const callbacks=useRef({onRunLoaded,onSelectRun});callbacks.current={onRunLoaded,onSelectRun};
  const confirmRef=useRef(null);confirmRef.current=confirmation;
  const {setExternalBusy}=useContext(WorkbenchMutationContext);
  const configured=Boolean(api?.getWarmupSchedule&&api?.saveWarmupSchedule&&api?.deleteWarmupSchedule);
  const schedule=state.schedule;
  const original=draftFor(schedule);
  const dirty=Object.keys(original).some(key=>draft[key]!==original[key]);
  const lastRunId=schedule?.lastRunId;
  const run=history.find(item=>item.runId===lastRunId);
  const currentRunId=useRef(lastRunId);currentRunId.current=lastRunId;
  const ready=state.status==='ready'&&canWarmup&&configured;

  useEffect(()=>{
    setExternalBusy('warmup-schedule',busy);
    return()=>setExternalBusy('warmup-schedule',false);
  },[busy,setExternalBusy]);

  const currentScope=()=>alive.current&&scope.current.key===key&&scope.current.isOpen&&scope.current.api===api&&scope.current.canWarmup;
  const load=async()=>{
    if(!currentScope())return;
    const request=++generation.current;
    setState(current=>({...current,status:'loading'}));setError(null);
    try {
      const result=await api.getWarmupSchedule(reportId,versionNo);
      if(!currentScope()||generation.current!==request)return;
      const value=result.schedule??null;
      if(value&&(value.reportId!==reportId||value.versionNo!==versionNo))throw new Error('Schedule does not match the requested saved version.');
      setState({status:'ready',schedule:value,draft:draftFor(value),error:null});
    } catch(cause){if(currentScope()&&generation.current===request){setState(current=>({...current,status:'error'}));setError(cause);}}
  };
  useEffect(()=>{
    alive.current=true;pending.current=false;setBusy(false);setConfirmation(null);
    if(isOpen&&canWarmup&&configured)load();
    else setState({status:!isOpen?'loading':canWarmup?'unconfigured':'forbidden',schedule:null,draft:draftFor(null),error:null});
    return()=>{alive.current=false;generation.current++;runGeneration.current++;confirmRef.current=null;};
  },[api,key,isOpen,canWarmup,configured]);

  const readRun=async()=>{
    if(!currentScope())return;
    const request=++runGeneration.current;
    setLinked({id:lastRunId,status:'loading'});
    try {
      const value=await api.getWarmupRun(reportId,lastRunId);
      if(!currentScope()||currentRunId.current!==lastRunId||runGeneration.current!==request)return;
      if(value.runId!==lastRunId||value.versionNo!==versionNo||(value.reportId&&value.reportId!==reportId))throw new Error('Linked run does not match this schedule’s version.');
      callbacks.current.onRunLoaded(value);setLinked({id:lastRunId,status:'ready'});
    } catch(cause){if(currentScope()&&currentRunId.current===lastRunId&&runGeneration.current===request)setLinked({id:lastRunId,status:'error',message:cause.message});}
  };
  useEffect(()=>{
    if(isOpen&&canWarmup&&lastRunId&&!latestHistory.current.some(item=>item.runId===lastRunId))readRun();
    return()=>{runGeneration.current++;};
  },[api,isOpen,canWarmup,lastRunId,key]);

  const mutate=async remove=>{
    if(pending.current||!currentScope()||!ready)return;
    pending.current=true;setBusy(true);setError(null);
    const request=++generation.current;
    const input=remove?{expectedRevision:schedule.revision}:{expectedRevision:schedule?schedule.revision:0,intervalSeconds:Number(draft.intervalSeconds),firstRunAt:draft.firstRunAt,enabled:draft.enabled};
    try {
      const result=remove?await api.deleteWarmupSchedule(reportId,versionNo,input):await api.saveWarmupSchedule(reportId,versionNo,input);
      // Ignoring a late response never implies cancellation of its server commit.
      if(!currentScope()||generation.current!==request)return;
      const value=result.schedule??null;
      if(value&&(value.reportId!==reportId||value.versionNo!==versionNo))throw new Error('Schedule response does not match the saved version. Reload the schedule before editing again.');
      setState({status:'ready',schedule:value,draft:draftFor(value),error:null});
    } catch(cause){if(currentScope()&&generation.current===request)setError(cause);}
    finally{if(currentScope()&&generation.current===request){pending.current=false;setBusy(false);setConfirmation(null);}}
  };
  const reload=()=>{
    if(dirty)setConfirmation('reload');
    else load();
  };
  return {state,draft,error,busy,confirmation,confirmRef,linked,schedule,dirty,lastRunId,run,ready,load,reload,readRun,mutate,setDraft,setConfirmation,currentScope,callbacks};
}

export function ReaderWarmupSchedule({model,versionNo,disabled}) {
  const {state,draft,error,busy,confirmation,confirmRef,linked,schedule,dirty,lastRunId,run,ready,load,reload,readRun,mutate,setDraft,setConfirmation,currentScope,callbacks}=model;
  const blocked=disabled||busy||state.status==='loading';
  return <section className="studio-cache-section" aria-label="Warmup schedule">
    <h3>Schedule</h3>
    <p>Recurring warmup applies to saved version {versionNo} and all its effective root and child plans. Unsaved reader edits are excluded.</p>
    {state.status==='forbidden'?<p>Publish-level warmup permission is required to manage this schedule.</p>:state.status==='unconfigured'?<p>Schedule operations are not configured by this host.</p>:<>
      {state.status==='loading'&&<p role="status">Loading schedule…</p>}
      {error&&<Callout intent="danger" role="alert" title={error.code==='conflict'?'Schedule revision conflict':undefined}>{error.message}</Callout>}
      {state.status==='error'&&<Button disabled={disabled||busy} onClick={()=>dirty?setConfirmation('reload'):load()}>Retry schedule load</Button>}
      {state.status==='ready'&&!schedule&&<p>No schedule for this saved version.</p>}
      {schedule&&<><Tag minimal>{schedule.enabled?'Schedule enabled':'Schedule disabled'}</Tag><dl><dt>Schedule revision</dt><dd>{schedule.revision}</dd><dt>Next due (UTC)</dt><dd><time dateTime={schedule.nextDueAt}>{schedule.nextDueAt}</time></dd></dl></>}
      <div className="studio-form-grid">
        <FormGroup label="First run (UTC)" labelFor="warmup-schedule-first" helperText="UTC ISO date/time, for example 2026-12-01T06:00:00Z."><InputGroup id="warmup-schedule-first" value={draft.firstRunAt} disabled={!ready||blocked} onChange={event=>setDraft(current=>({...current,firstRunAt:event.target.value}))}/></FormGroup>
        <FormGroup label="Interval (seconds)" labelFor="warmup-schedule-interval"><InputGroup id="warmup-schedule-interval" inputMode="numeric" value={draft.intervalSeconds} disabled={!ready||blocked} onChange={event=>setDraft(current=>({...current,intervalSeconds:event.target.value}))}/></FormGroup>
      </div>
      <Checkbox label="Schedule enabled" checked={draft.enabled} disabled={!ready||blocked} onChange={event=>setDraft(current=>({...current,enabled:event.target.checked}))}/>
      <p>Enabled records the schedule preference; it does not indicate host scheduler health. Saving does not run warmup immediately. Disabling or removing a schedule does not cancel accepted work.</p>
      <div className="studio-warmup-actions">
        <Button intent="primary" loading={busy} disabled={!ready||blocked||Boolean(schedule&&!dirty)} onClick={()=>mutate(false)}>Save schedule</Button>
        <Button intent="danger" disabled={!ready||blocked||!schedule} onClick={()=>setConfirmation('remove')}>Remove schedule</Button>
        <Button disabled={blocked} onClick={reload}>Reload schedule</Button>
      </div>
      {lastRunId&&<div aria-label="Latest scheduled run"><h4>Latest linked run</h4><code>{lastRunId}</code>
        {linked.id===lastRunId&&linked.status==='loading'&&<p role="status">Loading linked run…</p>}
        {linked.id===lastRunId&&linked.status==='error'&&<Callout intent="warning" role="alert">Linked run is unavailable: {linked.message}</Callout>}
        {run&&<p>Status: {run.status}</p>}
        <div className="studio-warmup-actions"><Button disabled={!run} onClick={()=>callbacks.current.onSelectRun(lastRunId)}>View linked run</Button><Button disabled={linked.id===lastRunId&&linked.status==='loading'} onClick={readRun}>Refresh linked run</Button></div>
      </div>}
    </>}
    <WorkbenchAlert portalClassName="forge-reader-workbench-dialog" isOpen={Boolean(confirmation)} intent="warning" cancelButtonText="Keep editing" confirmButtonText={confirmation==='remove'?'Remove schedule':'Discard and reload'} loading={busy} onCancel={()=>setConfirmation(null)} onConfirm={()=>{
      if(!currentScope()||confirmRef.current!==confirmation||!confirmation)return;
      if(confirmation==='remove')mutate(true);else{setConfirmation(null);load();}
    }}>
      {confirmation==='remove'?<p>Remove the schedule for version {versionNo}? Accepted work and run history remain unchanged.</p>:<p>Discard the entered schedule values and load the persisted schedule for version {versionNo}?</p>}
    </WorkbenchAlert>
  </section>;
}
