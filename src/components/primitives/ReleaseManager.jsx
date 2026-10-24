import React, {useEffect, useRef, useState} from 'react';
import {Button, Callout, FormGroup, HTMLSelect, InputGroup, Spinner, TextArea} from '@blueprintjs/core';
import './ReleaseManager.css';

const rows = (value, field) => Array.isArray(value) ? value : (value?.[field] || []);
const rootID = root => `${root.uri}\u0000${root.kind}\u0000${root.version}\u0000${root.hash}`;
const rootOption = root => encodeURIComponent(rootID(root));
const artifactID = root => `${root.kind}\u0000${root.uri}`;
const policyID = policy => `${policy.resource?.tenant || ''}\u0000${policy.resource?.kind || ''}\u0000${policy.resource?.id || ''}\u0000${policy.resource?.version || ''}\u0000${policy.revision}`;
const artifactTitle = root => root.title || root.displayName || root.name || root.uri.split('/').pop() || root.uri;
const policyLabel = policy => policy.displayName || policy.name || policy.resource?.id || 'Policy';
const shortHash = hash => hash?.length > 14 ? `${hash.slice(0, 12)}…` : hash;
const historyEntry = item => item.bundle ? {...item.bundle, revision:item.revision ?? item.channelRevision, description:item.description, activatedAt:item.activatedAt || item.publishedAt} : item;
const historyLabel = item => [item.description, item.revision != null ? `Revision ${item.revision}` : '', item.activatedAt ? new Date(item.activatedAt).toLocaleDateString() : ''].filter(Boolean).join(' · ') || `Retained release ${item.hash?.slice(0, 8) || ''}`;
const channelName = channel => channel.key?.name || channel.name || '';
const activated = (result, expectedRevision) => {
  if (result?.status !== 'active' || result?.activated !== true) return null;
  const channel = result.channel;
  return channel?.activeBundleHash && Number(channel.revision) > Number(expectedRevision) ? channel : null;
};

// The host supplies the verified namespace scope. This component only submits
// exact server-provided references; it never computes membership or admission.
export default function ReleaseManager({api, channelKey, disabled = false, onActivated}) {
  const scopeID = JSON.stringify([channelKey?.tenant, channelKey?.account, channelKey?.workspace, channelKey?.namespace]);
  const [channels, setChannels] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [availablePolicies, setAvailablePolicies] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roots, setRoots] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [promotionTarget, setPromotionTarget] = useState('');
  const [rollbackHash, setRollbackHash] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState('');
  const request = useRef(0);
  const submitLock = useRef(false);
  const pendingName = useRef('');
  const current = channels.find(channel => channelName(channel) === selected);
  const expectedRevision = current?.revision ?? 0;
  const key = releaseName => ({...channelKey, name: releaseName});

  const load = async () => {
    const ticket = ++request.current;
    setLoading(true);
    setError('');
    try {
      const [nextChannels, nextCandidates, nextPolicies] = await Promise.all([
        api.list(channelKey), api.candidates(channelKey), api.policies(channelKey),
      ]);
      if (ticket !== request.current) return;
      const listed = rows(nextChannels, 'channels');
      setChannels(listed);
      setCandidates(rows(nextCandidates, 'roots'));
      setAvailablePolicies(rows(nextPolicies, 'policies'));
      if (pendingName.current) {
        const outcome = listed.find(channel => channelName(channel) === pendingName.current);
        if (outcome?.releaseStatus === 'active' && outcome.activated === true) {
          setSelected(channelName(outcome));setName(channelName(outcome));setDescription(outcome.description || '');setPolicies(outcome.policies || []);
          setRoots(outcome.bundle?.roots || []);
          setProgress('');setNotice('Release activated.');pendingName.current='';
        } else if (outcome?.releaseStatus === 'failed') {
          setProgress('');setError('The release failed to activate. Your selections are preserved.');pendingName.current='';
        }
      }
    } catch (cause) {
      if (ticket === request.current) setError(cause?.message || 'Releases could not load.');
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  };
  useEffect(() => { load(); return () => { request.current++; }; }, [api, scopeID]);

  const choose = async releaseName => {
    if (pending) return;
    const ticket = ++request.current;
    const channel = channels.find(item => channelName(item) === releaseName);
    setSelected(releaseName);
    setName(releaseName);
    setDescription(channel?.description || '');
    setPolicies(channel?.policies || []);
    setRoots([]);
    setHistory([]);
    setPromotionTarget('');
    setRollbackHash('');
    setError('');
    setNotice('');
    setProgress('');
    if (!channel) return;
    setLoading(true);
    try {
      const value = rows(await api.history(channel.key), 'bundles').map(historyEntry);
      if (ticket !== request.current) return;
      setHistory(value);
      setRoots(channel.bundle?.roots || value.find(bundle => bundle.hash === channel.activeBundleHash)?.roots || []);
    } catch (cause) {
      if (ticket === request.current) setError(cause?.message || 'Release history could not load.');
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  };
  const toggle = (list, setList, item, identity) => {
    const id = identity(item);
    setList(list.some(value => identity(value) === id) ? list.filter(value => identity(value) !== id) : [...list, item]);
    setNotice('');
  };
  const refreshAfterActivation = async (channel, message, selectedRoots) => {
    setChannels(previous => [...previous.filter(item => channelName(item) !== channelName(channel)), channel]);
    setSelected(channelName(channel));
    setName(channelName(channel));
    setDescription(channel.description || '');
    setPolicies(channel.policies || []);
    setRoots(selectedRoots || []);
    setNotice(message);
    try { onActivated?.(channel); }
    catch (cause) { setError(`Release activated, but the host could not update: ${cause?.message || 'try reloading.'}`); }
    try {
      const next = rows(await api.list(channelKey), 'channels');
      const listed = next.find(item => channelName(item) === channelName(channel));
      const active = listed?.activeBundleHash === channel.activeBundleHash && Number(listed.revision) >= Number(channel.revision) ? listed : channel;
      setChannels([...next.filter(item => channelName(item) !== channelName(channel)), active]);
      setHistory(rows(await api.history(active.key), 'bundles').map(historyEntry));
      if (active.bundle?.roots) setRoots(active.bundle.roots);
    } catch (cause) {
      setError(`Release activated, but its current list could not refresh: ${cause?.message || 'try reloading.'}`);
    }
  };
  const submit = async mode => {
    if (submitLock.current || disabled || loading) return;
    const releaseName = name.trim();
    const target = mode === 'promote' ? channels.find(channel => channelName(channel) === promotionTarget) : current;
    const chosenRollback = history.find(bundle => bundle.hash === rollbackHash);
    if (!releaseName || (mode === 'publish' && (!currentRootsKnown || !policiesAssignable || !roots.length || !policies.length)) || (mode === 'promote' && (!current?.activeBundleHash || !target || target === current)) || (mode === 'rollback' && !chosenRollback)) return;
    submitLock.current = true;
    setPending(true);
    setPendingAction(mode);
    setError('');
    setNotice('');
    setProgress('');
    try {
      const input = mode === 'publish'
        ? {key: key(releaseName), description: description.trim(), roots: roots.map(({uri, kind, version, hash}) => ({uri, kind, version, hash})), policies: policies.map(({resource, revision}) => ({resource, revision})), expectedRevision}
        : {key: target.key, expectedRevision: target.revision, bundleHash: mode === 'promote' ? current.activeBundleHash : rollbackHash};
      const result = await (mode === 'publish' ? api.publish(input) : api.promote(input));
      if (result?.status === 'pending' && result?.activated === false) {
        pendingName.current = input.key.name;
        setProgress(`${mode === 'publish' ? 'Publishing' : mode === 'promote' ? 'Promoting' : 'Rolling back'} is in progress. Refresh releases to check activation.`);
        return;
      }
      if (result?.status === 'failed') throw new Error('The release failed to activate. Your selections are preserved.');
      const channel = activated(result, input.expectedRevision);
      if (!channel || channelName(channel) !== input.key.name || (mode !== 'publish' && channel.activeBundleHash !== input.bundleHash)) throw new Error('The release has not been confirmed active. Reload its current state before trying again.');
      await refreshAfterActivation(channel, mode === 'publish' ? 'Release activated.' : mode === 'promote' ? `Promoted to ${input.key.name}.` : `Rolled back ${input.key.name}.`, result.bundle?.roots || (mode === 'rollback' ? chosenRollback.roots : roots));
    } catch (cause) {
      setError(cause?.message || 'The release did not activate. Your selections are preserved.');
    } finally {
      submitLock.current = false;
      setPending(false);
      setPendingAction('');
    }
  };
  const rootChoices = [...candidates, ...roots.filter(root => !candidates.some(candidate => rootID(candidate) === rootID(root)))];
  const policyChoices = [...availablePolicies, ...policies.filter(policy => !availablePolicies.some(candidate => policyID(candidate) === policyID(policy)))];
  const policiesAssignable = policies.every(policy => availablePolicies.some(candidate => policyID(candidate) === policyID(policy)));
  const artifactGroups = [...new Set(rootChoices.map(artifactID))].map(id => ({id, choices:rootChoices.filter(root => artifactID(root) === id).sort((a,b) => Number(b.version)-Number(a.version))}));
  const currentRootsKnown = !current?.activeBundleHash || Array.isArray(current?.bundle?.roots) || history.some(bundle => bundle.hash === current.activeBundleHash && Array.isArray(bundle.roots));
  const priorReleases = history.filter(bundle => bundle.hash !== current?.activeBundleHash);
  const promotionChannels = channels.filter(channel => channelName(channel) !== selected);

  return <section className="forge-release-manager" aria-label="Releases">
    <h2>Releases</h2>
    <p>Name a release, choose exact artifact revisions, and assign who can use it. Publishing activates the selected bundle.</p>
    {loading && <div role="status"><Spinner size={16}/> Loading releases…</div>}
    {error && <Callout intent="danger" role="alert">{error} <Button minimal disabled={pending} onClick={load}>Reload</Button></Callout>}
    {notice && <Callout intent="success" role="status">{notice}</Callout>}
    {progress && <Callout intent="primary" role="status">{progress} <Button minimal disabled={pending} onClick={load}>Refresh releases</Button></Callout>}
    {current?.releaseStatus === 'pending' && <Callout intent="primary" role="status">This channel has a release in progress. Refresh releases to check activation.</Callout>}
    <FormGroup label="Release channel" labelFor="release-channel">
      <HTMLSelect id="release-channel" fill value={selected} disabled={disabled || pending || loading} onChange={event => choose(event.target.value)}>
        <option value="">New release</option>
        {channels.map(channel => <option key={channelName(channel)} value={channelName(channel)}>{channelName(channel)} · revision {channel.revision}</option>)}
      </HTMLSelect>
    </FormGroup>
    <FormGroup label="Name" labelFor="release-name">
      <InputGroup id="release-name" value={name} disabled={disabled || pending || loading || Boolean(current)} onChange={event => { setName(event.target.value); setNotice(''); }}/>
    </FormGroup>
    <FormGroup label="Description" labelFor="release-description">
      <TextArea id="release-description" fill value={description} disabled={disabled || pending || loading} onChange={event => { setDescription(event.target.value); setNotice(''); }}/>
    </FormGroup>
    <fieldset disabled={disabled || pending || loading}><legend>Who can use this?</legend>
      {policyChoices.length ? policyChoices.map(policy => <label key={policyID(policy)} className="forge-release-manager-choice">
        <input type="checkbox" checked={policies.some(item => policyID(item) === policyID(policy))} disabled={!availablePolicies.some(candidate => policyID(candidate) === policyID(policy)) && !policies.some(item => policyID(item) === policyID(policy))} onChange={() => toggle(policies, setPolicies, policy, policyID)}/>
        <span>{policyLabel(policy)}{!availablePolicies.some(candidate => policyID(candidate) === policyID(policy)) ? ' · Unavailable for new releases' : ''}</span>
      </label>) : !error && <p>No policies are available for this release. Create an account policy in Security, then reload.</p>}
    </fieldset>
    {!policiesAssignable && <Callout intent="warning">Remove unavailable policies before publishing. The server will verify every chosen policy again.</Callout>}
    <fieldset disabled={disabled || pending || loading}><legend>Included artifacts</legend>
      {artifactGroups.length ? artifactGroups.map(({id, choices}, index) => {
        const selectedRoot = roots.find(root => artifactID(root) === id);
        const title = `${choices[0].kind} · ${artifactTitle(choices[0])}`;
        return <FormGroup key={id} label={title} labelFor={`release-artifact-${index}`} className="forge-release-manager-artifact">
          <HTMLSelect id={`release-artifact-${index}`} fill aria-label={`Revision for ${title}`} value={selectedRoot ? rootOption(selectedRoot) : ''} onChange={event => {
            const chosen = choices.find(root => rootOption(root) === event.target.value);
            setRoots(previous => [...previous.filter(root => artifactID(root) !== id), ...(chosen ? [chosen] : [])]);
            setNotice('');
          }}>
            <option value="">Not included</option>
            {choices.map(root => <option key={rootID(root)} value={rootOption(root)}>Revision {root.version}{root.description ? ` · ${root.description}` : ''}</option>)}
          </HTMLSelect>
        </FormGroup>;
      }) : <p>No artifact revisions are available.</p>}
    </fieldset>
    {!currentRootsKnown && <Callout intent="warning">This server has not supplied the active release’s included artifacts. Refresh its history before changing the bundle.</Callout>}
    {current && <p>Current release revision {current.revision}</p>}
    <details><summary>Technical details</summary>
      {current?.activeBundleHash && <p>Active bundle hash: <code title={current.activeBundleHash}>{shortHash(current.activeBundleHash)}</code></p>}
      {!!policies.length && <ul>{policies.map(policy => <li key={policyID(policy)}>{policyLabel(policy)} · {policy.resource?.kind}:{policy.resource?.id} · resource v{policy.resource?.version} · policy revision {policy.revision}</li>)}</ul>}
      {!!roots.length && <ul>{roots.map(root => <li key={rootID(root)}>{root.kind} · {root.uri} · revision {root.version} · hash <code title={root.hash}>{shortHash(root.hash)}</code></li>)}</ul>}
    </details>
    <Button intent="primary" loading={pendingAction === 'publish'} disabled={disabled || pending || loading || !currentRootsKnown || !policiesAssignable || !name.trim() || !roots.length || !policies.length} onClick={() => submit('publish')}>Publish</Button>
    {current && <section aria-label="Promotion and rollback">
      <h3>Promotion and rollback</h3>
      <FormGroup label="Promote to…" labelFor="release-promotion-target">
        <HTMLSelect id="release-promotion-target" fill value={promotionTarget} disabled={disabled || pending || loading || !promotionChannels.length} onChange={event => setPromotionTarget(event.target.value)}>
          <option value="">Choose a channel</option>
          {promotionChannels.map(channel => <option key={channelName(channel)} value={channelName(channel)}>{channelName(channel)}{channel.description ? ` · ${channel.description}` : ''}</option>)}
        </HTMLSelect>
      </FormGroup>
      <Button disabled={disabled || pending || loading || !promotionTarget || !current.activeBundleHash} loading={pendingAction === 'promote'} onClick={() => submit('promote')}>Promote to {promotionTarget || 'channel'}</Button>
      <FormGroup label="Roll back to…" labelFor="release-rollback-target">
        <HTMLSelect id="release-rollback-target" fill value={rollbackHash} disabled={disabled || pending || loading || !priorReleases.length} onChange={event => setRollbackHash(event.target.value)}>
          <option value="">Choose a prior release</option>
          {priorReleases.map(bundle => <option key={bundle.hash} value={bundle.hash}>{historyLabel(bundle)}</option>)}
        </HTMLSelect>
      </FormGroup>
      <Button disabled={disabled || pending || loading || !rollbackHash} loading={pendingAction === 'rollback'} onClick={() => submit('rollback')}>Roll back {selected}</Button>
    </section>}
  </section>;
}
