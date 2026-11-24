import React, {useContext, useEffect, useRef, useState} from 'react';
import {Button, Callout, Checkbox, FormGroup, HTMLSelect, InputGroup, Tag} from '@blueprintjs/core';
import {WorkbenchAlert, WorkbenchMutationContext} from './WorkbenchMutationContext.jsx';
import {instantToWallTime,wallTimeToInstant} from '../primitives/scheduleTimeZone.js';

const draftFor=(schedule,timeZone)=>{
  const wall=instantToWallTime(schedule?.firstRunAt||new Date().toISOString(),timeZone);
  return {intervalSeconds:String(schedule?.intervalSeconds??3600),firstRunAt:schedule?.firstRunAt??'',enabled:schedule?.enabled??false,date:wall.slice(0,10),time:schedule?wall.slice(11):'',firstRunEdited:false,occurrence:''};
};
const resolveFirstRun=(draft,timeZone)=>{
  if(!draft.firstRunEdited&&draft.firstRunAt)return {instant:draft.firstRunAt};
  if(!draft.date||!draft.time)return {error:'Choose a complete first-run date and time.'};
  try {
    const wall=`${draft.date}T${draft.time}`;
    const earlier=wallTimeToInstant(wall,timeZone,'earlier');
    const later=wallTimeToInstant(wall,timeZone,'later');
    const ambiguous=earlier!==later;
    if(ambiguous&&!draft.occurrence)return {ambiguous,earlier,later,error:'This local time occurs twice. Choose the earlier or later occurrence.'};
    return {ambiguous,earlier,later,instant:draft.occurrence==='later'?later:earlier};
  }catch(cause){return {error:cause.message};}
};
const localDisplay=(instant,timeZone)=>{
  if(!instant)return 'Not supplied';
  const date=new Date(instant);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(undefined,{timeZone,dateStyle:'medium',timeStyle:'long'}).format(date):instant;
};

// The dialog owns this lifecycle so closing portal transitions cannot retain requests.
// Scope is namespace/component/version, never reader source revision or selected view.
export function useReaderWarmupSchedule({api,reportId,versionNo,namespace,isOpen,canWarmup,history,onRunLoaded,onSelectRun}) {
  const [timeZone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone);
  const key=JSON.stringify([namespace,reportId,versionNo]);
  const scope=useRef({key,isOpen,api,canWarmup});scope.current={key,isOpen,api,canWarmup};
  const [record,setRecord]=useState({key,status:'loading',schedule:null,draft:draftFor(null,timeZone),error:null});
  const state=record.key===key?record:{key,status:'loading',schedule:null,draft:draftFor(null,timeZone),error:null};
  const {draft,error}=state;
  const setState=update=>setRecord(current=>({...((typeof update==='function')?update(current.key===key?current:state):update),key}));
  const setDraft=update=>{if(currentScope())setRecord(current=>({...current,draft:update(current.draft)}));};
  const setError=error=>setRecord(current=>({...current,error}));
  const [busy,setBusy]=useState(false);
  const [firstRunAttempted,setFirstRunAttempted]=useState(false);
  const [confirmation,setConfirmation]=useState(null);
  const [linked,setLinked]=useState({});
  const generation=useRef(0),runGeneration=useRef(0),alive=useRef(false),pending=useRef(false);
  const latestHistory=useRef(history);latestHistory.current=history;
  const callbacks=useRef({onRunLoaded,onSelectRun});callbacks.current={onRunLoaded,onSelectRun};
  const confirmRef=useRef(null);confirmRef.current=confirmation;
  const {setExternalBusy}=useContext(WorkbenchMutationContext);
  const configured=Boolean(api?.getWarmupSchedule&&api?.saveWarmupSchedule&&api?.deleteWarmupSchedule);
  const schedule=state.schedule;
  const dirty=draft.firstRunEdited||draft.intervalSeconds!==String(schedule?.intervalSeconds??3600)||draft.enabled!==(schedule?.enabled??false);
  const firstRun=resolveFirstRun(draft,timeZone);
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
      setState({status:'ready',schedule:value,draft:draftFor(value,timeZone),error:null});setFirstRunAttempted(false);
    } catch(cause){if(currentScope()&&generation.current===request){setState(current=>({...current,status:'error'}));setError(cause);}}
  };
  useEffect(()=>{
    alive.current=true;pending.current=false;setBusy(false);setConfirmation(null);setFirstRunAttempted(false);
    if(isOpen&&canWarmup&&configured)load();
    else setState({status:!isOpen?'loading':canWarmup?'unconfigured':'forbidden',schedule:null,draft:draftFor(null,timeZone),error:null});
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
    if(!remove&&firstRun.error){setFirstRunAttempted(true);return;}
    pending.current=true;setBusy(true);setError(null);
    const request=++generation.current;
    const input=remove?{expectedRevision:schedule.revision}:{expectedRevision:schedule?schedule.revision:0,intervalSeconds:Number(draft.intervalSeconds),firstRunAt:firstRun.instant,enabled:draft.enabled};
    try {
      const result=remove?await api.deleteWarmupSchedule(reportId,versionNo,input):await api.saveWarmupSchedule(reportId,versionNo,input);
      // Ignoring a late response never implies cancellation of its server commit.
      if(!currentScope()||generation.current!==request)return;
      const value=result.schedule??null;
      if(value&&(value.reportId!==reportId||value.versionNo!==versionNo))throw new Error('Schedule response does not match the saved version. Reload the schedule before editing again.');
      setState({status:'ready',schedule:value,draft:draftFor(value,timeZone),error:null});setFirstRunAttempted(false);
    } catch(cause){if(currentScope()&&generation.current===request)setError(cause);}
    finally{if(currentScope()&&generation.current===request){pending.current=false;setBusy(false);setConfirmation(null);}}
  };
  const reload=()=>{
    if(dirty)setConfirmation('reload');
    else load();
  };
  return {state,draft,error,busy,confirmation,confirmRef,linked,schedule,dirty,lastRunId,run,ready,load,reload,readRun,mutate,setDraft,setConfirmation,currentScope,callbacks,timeZone,firstRun,firstRunAttempted};
}

export function ReaderWarmupSchedule({model,versionNo,disabled}) {
  const {state,draft,error,busy,confirmation,confirmRef,linked,schedule,dirty,lastRunId,run,ready,load,reload,readRun,mutate,setDraft,setConfirmation,currentScope,callbacks,timeZone,firstRun,firstRunAttempted}=model;
  const blocked=disabled||busy||state.status==='loading';
  const timeError=(draft.firstRunEdited||firstRunAttempted)&&firstRun.error;
  const updateTime=(field,value)=>setDraft(current=>({...current,[field]:value,firstRunEdited:true,occurrence:''}));
  return <section className="studio-cache-section" aria-label="Warmup schedule">
    <h3>Schedule</h3>
    <p>Recurring warmup applies to saved version {versionNo} and all its effective root and child plans. Unsaved reader edits are excluded.</p>
    {state.status==='forbidden'?<p>Publish-level warmup permission is required to manage this schedule.</p>:state.status==='unconfigured'?<p>Schedule operations are not configured by this host.</p>:<>
      {state.status==='loading'&&<p role="status">Loading schedule…</p>}
      {error&&<Callout intent="danger" role="alert" title={error.code==='conflict'?'Schedule revision conflict':undefined}>{error.message}</Callout>}
      {state.status==='error'&&<Button disabled={disabled||busy} onClick={()=>dirty?setConfirmation('reload'):load()}>Retry schedule load</Button>}
      {state.status==='ready'&&!schedule&&<p>No schedule for this saved version.</p>}
      {schedule&&<><Tag minimal>{schedule.enabled?'Schedule enabled':'Schedule disabled'}</Tag><dl><dt>Schedule revision</dt><dd>{schedule.revision}</dd><dt>Saved first run ({timeZone})</dt><dd><time dateTime={schedule.firstRunAt}>{localDisplay(schedule.firstRunAt,timeZone)}</time></dd><dt>Next due ({timeZone})</dt><dd><time dateTime={schedule.nextDueAt}>{localDisplay(schedule.nextDueAt,timeZone)}</time></dd></dl></>}
      <div className="studio-form-grid">
        <FormGroup label={`First-run date (${timeZone})`} labelFor="warmup-schedule-date"><InputGroup type="date" id="warmup-schedule-date" value={draft.date} disabled={!ready||blocked} aria-invalid={Boolean(timeError)} aria-describedby={timeError?'warmup-schedule-time-error':undefined} onChange={event=>updateTime('date',event.target.value)}/></FormGroup>
        <FormGroup label={`First-run time (${timeZone})`} labelFor="warmup-schedule-first" helperText="Time uses the selected date, which defaults to today."><InputGroup type="time" step={60} id="warmup-schedule-first" value={draft.time} disabled={!ready||blocked} aria-invalid={Boolean(timeError)} aria-describedby={timeError?'warmup-schedule-time-error':undefined} onChange={event=>updateTime('time',event.target.value)}/></FormGroup>
        <FormGroup label="Interval (seconds)" labelFor="warmup-schedule-interval"><InputGroup id="warmup-schedule-interval" inputMode="numeric" value={draft.intervalSeconds} disabled={!ready||blocked} onChange={event=>setDraft(current=>({...current,intervalSeconds:event.target.value}))}/></FormGroup>
      </div>
      {firstRun.ambiguous&&<FormGroup label="Repeated local time" labelFor="warmup-schedule-occurrence"><HTMLSelect id="warmup-schedule-occurrence" value={draft.occurrence} disabled={!ready||blocked} onChange={event=>setDraft(current=>({...current,occurrence:event.target.value}))} options={[{value:'',label:'Choose an occurrence'},{value:'earlier',label:`Earlier — ${firstRun.earlier}`},{value:'later',label:`Later — ${firstRun.later}`}]}/></FormGroup>}
      {timeError&&<Callout intent="danger" role="alert" id="warmup-schedule-time-error">{timeError}</Callout>}
      {firstRun.instant&&Date.parse(firstRun.instant)<Date.now()&&<Callout intent="warning">The selected first-run time is in the past. The server determines missed occurrences using the saved cadence. Saving does not run warmup immediately.</Callout>}
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
