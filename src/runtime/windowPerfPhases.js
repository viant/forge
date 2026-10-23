// Fixed phase names only. Window IDs are correlation keys inside the opt-in
// collector and never leave it; normal URLs do not install a recorder.
const phases=new Set([
  'metadata-request-scheduled','metadata-response-parsed','metadata-signal-published',
  'metadata-prime-complete','datasource-mounted','datasource-fetch-start',
]);
export function recordWindowPerfPhase(phase,windowId) {
  if (!phases.has(phase) || !windowId) return;
  try {globalThis.window?.__forgeWindowPerfPhaseRecorder?.(phase,String(windowId),performance.now());}
  catch { /* Timing must never affect a window request. */ }
}
