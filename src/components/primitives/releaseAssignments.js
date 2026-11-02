// Exact root identity includes its immutable revision and hash. A family groups
// revisions only for the producer-supplied artifact, never for a component alias.
export const releaseRootID = root => JSON.stringify([root.kind,root.uri,root.version,root.hash]);
export const releaseArtifactID = root => JSON.stringify([root.kind,root.uri]);
export const releaseName = channel => channel.key?.name || '';

export function assignmentPlan(channels, root, selectedNames) {
  if(!root?.uri || !root.kind || !root.version || !root.hash)throw new Error('An exact published artifact revision is required.');
  const desired=new Set(selectedNames),known=new Set(channels.map(releaseName));
  for(const name of desired)if(!known.has(name))throw new Error('A selected release no longer exists. Reload before applying.');
  const changes=[];
  for(const channel of channels){
    const name=releaseName(channel);
    if(!Array.isArray(channel.bundle?.roots))throw new Error(`Included artifacts for ${name} are unavailable. Reload before applying.`);
    const prior=channel.bundle.roots.filter(item=>releaseArtifactID(item)===releaseArtifactID(root));
    const wants=desired.has(name);
    if(wants && prior.length===1 && releaseRootID(prior[0])===releaseRootID(root) || !wants&&!prior.length)continue;
    if(channel.releaseStatus!=='active'||channel.activated!==true)throw new Error(`${name} is not active. Reload its release status before changing assignments.`);
    if(!Array.isArray(channel.policies)||!channel.policies.length)throw new Error(`${name} has no verified audience. Open Releases to configure it.`);
    const roots=channel.bundle.roots.filter(item=>releaseArtifactID(item)!==releaseArtifactID(root));
    if(wants)roots.push(root);
    if(!roots.length)throw new Error(`Removing this artifact would leave ${name} empty. Edit that release before removing its last artifact.`);
    changes.push({key:channel.key,description:channel.description||'',policies:channel.policies,roots,expectedRevision:channel.revision});
  }
  return changes;
}
