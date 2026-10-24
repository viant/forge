import React, {useEffect, useRef, useState} from 'react';
import {Button, Callout, FormGroup, HTMLSelect, InputGroup, TextArea} from '@blueprintjs/core';

const initialRules = group => ({'*':{mode:'protected',rule:{kind:'group',value:group}}});
const simpleMembership = policies => {
 const keys=Object.keys(policies||{}), policy=policies?.['*'];
 return keys.length===1 && policy?.mode==='protected' && Object.keys(policy).every(key=>['mode','rule'].includes(key)) && policy.rule?.kind==='group' && Object.keys(policy.rule).every(key=>['kind','value'].includes(key)) ? policy.rule.value : null;
};
const reference = policy => ({resource:policy.resource, revision:policy.revision});

// Policy definitions and impact are server-owned. This surface edits a reusable
// definition; resource assignments retain its stable resource ID.
export function NamedPolicyManager({api, disabled=false, onChange}) {
 const [policies,setPolicies]=useState([]),[selected,setSelected]=useState(''),[name,setName]=useState(''),[group,setGroup]=useState(''),[raw,setRaw]=useState(''),[impacts,setImpacts]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[review,setReview]=useState(false),[creating,setCreating]=useState(false),[loaded,setLoaded]=useState(false),[simple,setSimple]=useState(false),[impactReady,setImpactReady]=useState(false);
 const sequence=useRef(0),current=policies.find(item=>item.resource.id===selected);
 const ticket=useRef(0);
 const load=async()=>{const seq=++sequence.current;setBusy(true);setError('');try{const value=await api.listNamedPolicies();if(seq===sequence.current){setPolicies(value);setLoaded(true);}}catch(cause){if(seq===sequence.current)setError(cause.message||'Named policies could not load.');}finally{if(seq===sequence.current)setBusy(false);}};
 useEffect(()=>{setSelected('');setCreating(false);setReview(false);setLoaded(false);load();return()=>{sequence.current++;ticket.current++;};},[api]);
 const choose=async value=>{if(busy)return;const item=policies.find(policy=>policy.resource.id===value);setSelected(value);setCreating(false);setReview(false);setError('');setName(item?.displayName||'');const membership=simpleMembership(item?.policies);setSimple(membership!==null);setGroup(membership||'');setImpactReady(false);setRaw(JSON.stringify(item?.policies||{},null,2));setImpacts([]);const seq=++ticket.current;if(item){setBusy(true);try{const affected=await api.namedPolicyImpact(reference(item));if(seq===ticket.current){setImpacts(affected);setImpactReady(true);}}catch(cause){if(seq===ticket.current)setError(cause.message||'Affected resources could not load.');}finally{if(seq===ticket.current)setBusy(false);}}};
 const edit=callback=>{callback();setReview(false);};
 const definition=()=>({displayName:name.trim(),policies:(creating||simple)?initialRules(group.trim()):JSON.parse(raw)});
 const save=async()=>{if(disabled||busy||!review||(!creating&&!impactReady))return;setBusy(true);setError('');try{const candidate=definition();if(creating){await api.createNamedPolicy(globalThis.crypto.randomUUID(),candidate);}else{await api.updateNamedPolicy(reference(current),candidate);}setSelected('');setCreating(false);setReview(false);setName('');setRaw('');setImpacts([]);await load();onChange?.();}catch(cause){setError(cause.message||'Policy could not be saved. Reload before trying again.');}finally{setBusy(false);}};
 const prepare=()=>{try{const candidate=definition();if(!candidate.displayName||!Object.keys(candidate.policies).length||(creating&&!group.trim()))throw new Error('Enter a name and a membership group.');setError('');setReview(true);}catch(cause){setError(cause.message||'Access rules must be valid JSON.');}};
 return <section className="forge-named-policy-manager" aria-label="Reusable named policies">
  <h3>Reusable named policies</h3><p>Name an access policy once, then assign it to resources. Editing a policy updates every assignment. Application roles and membership groups are separate conditions.</p>
  {error&&<Callout intent="danger" role="alert">{error}<Button minimal disabled={busy} onClick={load}>Reload policies</Button></Callout>}
  <FormGroup label="Existing policy" labelFor="named-policy-select"><HTMLSelect id="named-policy-select" disabled={busy||disabled} fill value={selected} onChange={event=>choose(event.target.value)}><option value="">Choose a policy</option>{policies.map(item=><option key={item.resource.id} value={item.resource.id}>{item.displayName} · revision {item.revision}</option>)}</HTMLSelect></FormGroup>
  <Button icon="add" disabled={busy||disabled||!loaded} onClick={()=>{ticket.current++;setCreating(true);setSimple(true);setSelected('');setName('');setGroup('');setImpacts([]);setReview(false);setError('');}}>Create named policy</Button>
  {loaded&&!policies.length&&!creating&&<p>No reusable policies are available yet.</p>}
  {(creating||current)&&<>
   {current&&<p>Policy ID: {current.resource.id} · revision {current.revision}</p>}
   <FormGroup label="Policy name" labelFor="named-policy-name"><InputGroup id="named-policy-name" value={name} disabled={busy||disabled} onChange={event=>edit(()=>setName(event.target.value))}/></FormGroup>
   {(creating||simple)?<FormGroup label="Verified membership group" labelFor="named-policy-group" helperText="Enter the exact group issued by your identity provider. A matching role does not grant group membership."><InputGroup id="named-policy-group" value={group} disabled={busy||disabled} onChange={event=>edit(()=>setGroup(event.target.value))}/></FormGroup>:<FormGroup label="Access rules" labelFor="named-policy-rules" helperText="Existing conditions, required scopes and entity restrictions are preserved in this complete definition."><TextArea id="named-policy-rules" fill autoResize value={raw} disabled={busy||disabled} onChange={event=>edit(()=>setRaw(event.target.value))}/></FormGroup>}
   {current&&<div aria-label="Affected resources"><h4>Affected assignments ({impacts.length})</h4>{!impactReady?<p>Affected assignments have not loaded.</p>:impacts.length?<ul>{impacts.map(item=><li key={JSON.stringify(item.resource)}>{item.resource.kind || 'resource'} · {item.resource.id} · version {item.resource.version} · {item.actions.join(', ')}</li>)}</ul>:<p>This policy has no current assignments.</p>}<p>Policy deletion is unavailable.</p></div>}
   {review?<Callout intent="warning"><p>{creating?'Create this reusable policy?':`Save revision ${current.revision+1} for ${impacts.length} affected assignments?`}</p><pre>{JSON.stringify(definition(),null,2)}</pre><Button disabled={busy||disabled} intent="primary" loading={busy} onClick={save}>Save named policy</Button><Button minimal disabled={busy} onClick={()=>setReview(false)}>Back to editing</Button></Callout>:<Button disabled={busy||disabled||!name.trim()||((creating||simple)&&!group.trim())||(!creating&&!impactReady)} onClick={prepare}>Review named policy</Button>}
  </>}
 </section>;
}
