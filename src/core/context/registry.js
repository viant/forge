const windowContextRegistry = new Map();

export function getWindowContext(windowId) {
  return windowContextRegistry.get(windowId);
}

export function setWindowContext(windowId, context) {
  windowContextRegistry.set(windowId, context);
}

export function clearWindowContext(windowId) {
  windowContextRegistry.delete(windowId);
}
