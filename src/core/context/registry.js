const windowContextRegistry = new Map();

export function getWindowContext(windowId) {
  return windowContextRegistry.get(windowId);
}

export function setWindowContext(windowId, context) {
  windowContextRegistry.set(windowId, context);
}

export function clearWindowContext(windowId) {
  const context = windowContextRegistry.get(windowId);
  windowContextRegistry.delete(windowId);
  try {
    context?.dispose?.();
  } catch (_) {
    // Teardown is best-effort; the registry entry must stay cleared even when
    // a datasource-specific disposer fails.
  }
}
