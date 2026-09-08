export function isCurrentBindingGeneration(currentGeneration, requestGeneration) {
  return requestGeneration == null || String(currentGeneration ?? '') === String(requestGeneration);
}

export function bindingFinalizationAction(bindingIsCurrent, hasQueuedRequest) {
  if (bindingIsCurrent) return 'complete';
  return hasQueuedRequest ? 'continue' : 'close';
}
