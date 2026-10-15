export function isHostedRegionWindow(win) {
  const presentation = String(win?.presentation || '').trim().toLowerCase();
  const region = String(win?.region || '').trim().toLowerCase();
  return presentation === 'hosted' && (region === 'chat.top' || region === 'chat.bottom');
}

export function resolveTabWindows(windows = [], {includeHosted = false} = {}) {
  return (Array.isArray(windows) ? windows : []).filter((win) => win.inTab !== false && (includeHosted || !isHostedRegionWindow(win)));
}

export function resolveVisibleTabId(tabWindows = [], selectedTabId = null) {
  const nextSelected = String(selectedTabId || '').trim();
  if (nextSelected && tabWindows.some((win) => String(win?.windowId || '').trim() === nextSelected)) {
    return nextSelected;
  }
  return String(tabWindows[0]?.windowId || '').trim() || null;
}
