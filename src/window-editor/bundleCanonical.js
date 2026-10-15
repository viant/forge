import { documentJSON } from './documentJSON';
// Exact backend fingerprints through the canonical Go model, compiled to WASM.
let loading;
let trustedAdapter;
const verifiedInputs = new Map();
export function loadBundleCanonicalizer(baseURL = new URL(/* @vite-ignore */ '../../..', import.meta.url), requireCompiler = false) {
  if (globalThis.forgeWindowCanonicalize && (!requireCompiler || globalThis.forgeWindowCompile)) return Promise.resolve();
  if (requireCompiler && globalThis.forgeWindowCanonicalize && !globalThis.forgeWindowCompile) loading = undefined;
  return loading ||= (async () => {
    if (!globalThis.Go) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('window-editor/wasm_exec.js', baseURL).href;
      script.onload = resolve; script.onerror = () => reject(new Error('Cannot load canonical bundle runtime.'));
      document.head.append(script);
    });
    const go = new globalThis.Go();
    const response = await fetch(new URL('window-editor/canonical.wasm', baseURL));
    if (!response.ok) throw new Error('Cannot load canonical bundle fingerprints.');
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), go.importObject);
    go.run(instance);
    if (!globalThis.forgeWindowCanonicalize) throw new Error('Canonical bundle runtime did not initialize.');
    trustedAdapter = globalThis.forgeWindowCanonicalize;
  })();
}
function invokeCanonicalizer(input, canonicalizer) {
  const adapter = canonicalizer || globalThis.forgeWindowCanonicalize;
  if (!adapter) throw new Error('Bundle canonicalizer must load before editing bundles.');
  // Only this module's immutable Go runtime is memoized. Custom host hooks and
  // externally supplied globals always execute; source eligibility is unchanged.
  if (!canonicalizer && adapter === trustedAdapter && verifiedInputs.has(input)) {
    const result = verifiedInputs.get(input);
    verifiedInputs.delete(input); verifiedInputs.set(input, result);
    return JSON.parse(result);
  }
  const response = adapter(input);
  if (response.error) throw new Error(response.error);
  if (!canonicalizer && adapter === trustedAdapter && response.result && input.length <= 16_000_000) {
    verifiedInputs.set(input, response.result);
    while (verifiedInputs.size > 3) verifiedInputs.delete(verifiedInputs.keys().next().value);
  }
  return response.result ? JSON.parse(response.result) : response;
}
export function canonicalBundleMetadata(source, canonicalizer, document) {
  const preciseJSON = !canonicalizer && document ? documentJSON(document) : null;
  return invokeCanonicalizer(preciseJSON ?? source, canonicalizer);
}
export function canonicalDocumentMetadata(document, canonicalizer) {
  const preciseJSON = !canonicalizer ? documentJSON(document) : null;
  return invokeCanonicalizer(preciseJSON ?? document.toString({lineWidth:0}), canonicalizer);
}
