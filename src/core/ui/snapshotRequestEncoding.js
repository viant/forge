// Lossless encoding only. The caller retains session/generation ownership and
// publishes exactly the same JSON-RPC object after decompression.
export const SNAPSHOT_GZIP_THRESHOLD = 32 * 1024;
const abortError = signal => signal?.reason || Object.assign(new Error('Snapshot encoding cancelled'), {name: 'AbortError'});

export async function encodeSnapshotRequest(text, {
  enabled = false,
  maxInflatedBytes = 32 * 1024 * 1024,
  maxCompressedBytes = 8 * 1024 * 1024,
  signal,
} = {}) {
  if (signal?.aborted) throw abortError(signal);
  if (!enabled || typeof CompressionStream !== 'function' || typeof TextEncoder !== 'function' || typeof Blob !== 'function') return {body: text};
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= SNAPSHOT_GZIP_THRESHOLD || bytes.length > maxInflatedBytes) return {body: text};
  let reader;
  const cancel = () => {
    try { reader?.cancel().catch(() => {}); } catch (_) {}
  };
  try {
    reader = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')).getReader();
    signal?.addEventListener('abort', cancel, {once: true});
    if (signal?.aborted) throw abortError(signal);
    const chunks = [];
    let length = 0;
    for (;;) {
      const {done, value} = await reader.read();
      if (signal?.aborted) throw abortError(signal);
      if (done) break;
      chunks.push(value);
      length += value.length;
      if (length > maxCompressedBytes) {
        await reader.cancel();
        return {body: text};
      }
    }
    // Compression can expand high-entropy input. Retain plain JSON in that case.
    if (length >= bytes.length) return {body: text};
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    return {body, contentEncoding: 'gzip'};
  } catch (error) {
    if (signal?.aborted) throw abortError(signal);
    return {body: text};
  } finally {
    signal?.removeEventListener('abort', cancel);
    try { reader?.releaseLock(); } catch (_) {}
  }
}
