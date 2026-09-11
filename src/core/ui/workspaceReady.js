// Wait for the renderer's permission/metadata preflight before acknowledging an open.
// Legacy windows keep their existing command contract.
export function waitForWorkspaceReady(windows, windowId, timeoutMs = 14000) {
  return new Promise((resolve, reject) => {
    let unsubscribe;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe?.();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('Workspace readiness timed out')), timeoutMs);
    unsubscribe = windows.subscribe((entries) => {
      const entry = entries.find((item) => item.windowId === windowId);
      if (!entry) return finish(new Error('Workspace closed before becoming ready'));
      const state = entry.workspaceObject?.lifecycle?.state;
      if (state === 'ready') finish(null, entry.workspaceObject);
      else if (state === 'failed') finish(new Error('Workspace could not be opened'));
    });
    if (settled) unsubscribe?.();
  });
}
