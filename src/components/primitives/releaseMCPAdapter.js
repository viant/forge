export const releaseMethods = Object.freeze(['releases/list','releases/candidates','releases/publish','releases/promote','releases/history']);
export const releaseCapability = 'io.viant/artifact-releases/v1';

export function supportsReleaseTools(tools) {
  const names = new Set((Array.isArray(tools) ? tools : []).map(tool => typeof tool === 'string' ? tool : tool?.name));
  return releaseMethods.every(name => names.has(name));
}

export function supportsReleaseExtension(capabilities) {
  const extension = capabilities?.experimental?.[releaseCapability] || capabilities?.extensions?.[releaseCapability] || capabilities?.[releaseCapability];
  return extension?.schemaVersion === 1 && releaseMethods.every(name => extension.methods?.includes(name));
}

const array = (value, field) => {
  if (Array.isArray(value?.[field])) return value[field];
  throw new Error(`Invalid release ${field} response.`);
};

// callTool is the Studio's existing authenticated MCP transport. The verified
// actor and account scope remain server-owned; only namespace/name go on wire.
export function createReleaseMCPAdapter({callTool, namespace, listPolicies}) {
  if (typeof callTool !== 'function' || typeof listPolicies !== 'function' || !namespace) throw new TypeError('An authenticated release adapter and selected namespace are required.');
  const invoke = (method, input) => callTool(method, input);
  return {
    async list() {
      const result = await invoke('releases/list',{namespace});
      return array(result,'channels').map(item => ({...item.channel,bundle:item.bundle,releaseStatus:item.status,activated:item.activated,operationId:item.operationId}));
    },
    async candidates() {
      const result = await invoke('releases/candidates',{namespace});
      return array(result,'artifacts').map(item => ({...item.root,title:item.title}));
    },
    async policies() {
      const result = await listPolicies();
      return Array.isArray(result) ? result : array(result,'policies');
    },
    publish(input) {
      return invoke('releases/publish',{namespace,name:input.key.name,description:input.description,roots:input.roots,policies:input.policies,expectedRevision:input.expectedRevision});
    },
    promote(input) {
      return invoke('releases/promote',{namespace,name:input.key.name,bundleHash:input.bundleHash,expectedRevision:input.expectedRevision});
    },
    async history(key) {
      const result = await invoke('releases/history',{namespace,name:key.name});
      return array(result,'entries').filter(item => item.status === 'active').map(item => ({hash:item.bundleHash,revision:item.revision,description:item.description,activatedAt:item.appliedAt || item.createdAt}));
    },
  };
}
