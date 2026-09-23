const groups = new Map();

// Runtime-created navigation exposes the same IDs and callback as its rendered tabs.
export function registerNavigationGroup({windowId, containerId, tabs, select}) {
  if (!windowId || !containerId || typeof select !== 'function') return () => {};
  const key = JSON.stringify([windowId, containerId]);
  const group = {windowId, containerId, tabs, select};
  groups.set(key, group);
  return () => { if (groups.get(key) === group) groups.delete(key); };
}

export function listNavigationTabs(windowId) {
  return [...groups.values()].filter(group => group.windowId === windowId)
    .flatMap(group => group.tabs.map(tab => ({containerId:group.containerId, tabId:tab.id, title:tab.label})));
}

export function selectRegisteredTab({windowId, containerId, tabId}) {
  const candidates = [...groups.values()].filter(group => group.windowId === windowId &&
    (!containerId || group.containerId === containerId) && group.tabs.some(tab => tab.id === tabId));
  if (candidates.length > 1) throw new Error('ambiguous tab; specify containerId');
  if (candidates.length === 1) { candidates[0].select(tabId); return true; }
  if (containerId && [...groups.values()].some(group => group.windowId === windowId && group.containerId === containerId)) {
    throw new Error(`tab not available: ${tabId}`);
  }
  return false;
}
