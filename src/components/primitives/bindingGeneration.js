export function isCurrentBindingGeneration(currentGeneration, requestGeneration) {
  return requestGeneration == null || String(currentGeneration ?? '') === String(requestGeneration);
}

export function bindingFinalizationAction(bindingIsCurrent, hasQueuedRequest) {
  if (bindingIsCurrent) return 'complete';
  return hasQueuedRequest ? 'continue' : 'close';
}

// A dependency revision owns publication, not a caller's completion promise.
export function isDependencyGeneration(generation) {
    return typeof generation === 'string' && generation.startsWith('selection-dependency-');
}

export function dataSourceRequestId(input) {
    return isDependencyGeneration(input?.bindingGeneration)
        ? input.invocationId : input?.bindingGeneration || input?.invocationId;
}
