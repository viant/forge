import React,{useEffect,useRef,useState} from 'react';
import {Button,Callout,FormGroup,HTMLSelect,InputGroup,Spinner} from '@blueprintjs/core';
import {assignmentPlan,releaseRootID,releaseArtifactID,releaseName} from './releaseAssignments.js';
import './ReleaseManager.css';

// The host supplies producer-resolved roots. This UI cannot turn component IDs
// into artifact identities and never changes policies or connection dependencies.
export default function ReleaseAssignments({api,roots,disabled=false,onDirtyChange,onApplied}){
 const [channels,setChannels]=useState([]),[rootID,setRootID]=useState(''),[selected,setSelected]=useState([]);
 const [loading,setLoading]=useState(true),[pending,setPending]=useState(false),[review,setReview]=useState(null);
 const [valid,setValid]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState('');
 const generation=useRef(0),lock=useRef(false);
 const root=(roots||[]).find(item=>releaseRootID(item)===rootID);
 const load=async()=>{const ticket=++generation.current;setLoading(true);setValid(false);setError('');setReview(null);try{const value=await api.list();if(ticket!==generation.current)return;setChannels(value);setValid(true);setSelected([]);setRootID('');onDirtyChange?.(false);}catch(cause){if(ticket===generation.current)setError(cause.message);}finally{if(ticket===generation.current)setLoading(false);}};
 useEffect(()=>{load();return()=>{generation.current++;};},[api]);
 const choose=id=>{const next=(roots||[]).find(item=>releaseRootID(item)===id);setRootID(id);setSelected(next?channels.filter(channel=>channel.bundle?.roots?.some(item=>releaseArtifactID(item)===releaseArtifactID(next))).map(releaseName):[]);setReview(null);setNotice('');onDirtyChange?.(false);};
 let plan=[],planError='';try{if(root)plan=assignmentPlan(channels,root,selected);}catch(cause){planError=cause.message;}
 const publish=async()=>{
  if(lock.current||!review?.length)return;lock.current=true;setPending(true);setError('');setNotice('');
  const completed=[];
  try{
   for(const input of review){
    const result=await api.publish(input);
    if(result?.status!=='active'||result?.activated!==true||result.channel?.key?.name!==input.key.name||Number(result.channel.revision)<=Number(input.expectedRevision))throw new Error(`${input.key.name} has not been confirmed active. Reload its status before trying again.`);
    completed.push(input.key.name);
   }
   setNotice(`Assignments published to ${completed.join(', ')}.`);onDirtyChange?.(false);onApplied?.();await load();
  }catch(cause){setValid(false);setReview(null);setError(`${completed.length?`Published to ${completed.join(', ')}. Remaining changes were not confirmed. `:''}${cause.message} Reload before reviewing another attempt.`);}
  finally{lock.current=false;setPending(false);}
 };
 return <section className="forge-release-manager" aria-label="Named release assignments">
  <h2>Named release assignments</h2><p>Choose an exact linked artifact revision, then select the named releases that should include it. Other artifacts, connection roots and existing audience policies are preserved.</p>
  {loading&&<div role="status"><Spinner size={16}/> Loading named releases…</div>}
  {error&&<Callout intent="danger" role="alert">{error}</Callout>}{notice&&<Callout intent="success" role="status">{notice}</Callout>}
  <fieldset disabled={disabled||loading||pending}><FormGroup label="Linked artifact revision" labelFor="assignment-root"><HTMLSelect id="assignment-root" value={rootID} onChange={event=>choose(event.target.value)}><option value="">Choose an artifact revision</option>{(roots||[]).map(item=><option key={releaseRootID(item)} value={releaseRootID(item)}>{item.title||item.uri} · revision {item.version}</option>)}</HTMLSelect></FormGroup>
  <FormGroup label="Find named releases" labelFor="assignment-search"><InputGroup id="assignment-search" type="search" value={query} onChange={event=>setQuery(event.target.value)}/></FormGroup>
  {channels.filter(channel=>`${releaseName(channel)} ${channel.description||''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(channel=>{const name=releaseName(channel),prior=channel.bundle?.roots?.find(item=>root&&releaseArtifactID(item)===releaseArtifactID(root));return <label key={name} className="forge-release-manager-choice"><input type="checkbox" aria-label={`Include in ${name}`} checked={selected.includes(name)} disabled={!root||!Array.isArray(channel.bundle?.roots)||channel.releaseStatus!=='active'||channel.activated!==true} onChange={event=>{setSelected(previous=>event.target.checked?[...previous,name]:previous.filter(item=>item!==name));setReview(null);onDirtyChange?.(true);}}/><span>{name} · channel revision {channel.revision}{prior?` · includes artifact revision ${prior.version}`:''}</span></label>;})}
  {!channels.length&&!loading&&<p>No named releases are available. Create a release and its audience in Releases first.</p>}
  {planError&&<Callout intent="warning">{planError}</Callout>}
  <Button intent="primary" disabled={!valid||!plan.length||Boolean(planError)} onClick={()=>setReview(plan)}>Review assignments</Button><Button onClick={load}>Reload assignments</Button>
  </fieldset>
  {review&&<Callout intent="warning" title="Publish release assignment changes"><p>This immediately publishes new revisions of {review.map(item=>item.key.name).join(', ')} with their current audiences. It does not publish component source. Each release uses its reviewed revision; concurrent edits are rejected. Releases are applied separately, so a later failure may leave earlier releases updated.</p><Button intent="primary" loading={pending} disabled={disabled||pending} onClick={publish}>Apply and publish release assignments</Button><Button disabled={pending} onClick={()=>setReview(null)}>Keep editing</Button></Callout>}
 </section>;
}
