import {fileToBlob} from './fileBlob.js';

const abort = signal => {
  if (signal?.aborted) throw new DOMException('File transfer was aborted.', 'AbortError');
};

// The application supplies its admitted transport callback. Parts are read and
// acknowledged sequentially; this helper never reads the original whole file.
export async function transferFileChunks(file, {chunkBytes, append, signal, onProgress} = {}) {
  if (!file || typeof file.slice !== 'function' || !Number.isSafeInteger(file.size) || file.size < 0) throw new TypeError('A browser file with a valid size is required.');
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0 || chunkBytes > 8 * 1024 * 1024) throw new Error('Chunk size must be between 1 byte and 8 MiB.');
  if (typeof append !== 'function') throw new TypeError('A chunk transport is required.');
  abort(signal);
  onProgress?.({sentBytes: 0, totalBytes: file.size});
  for (let offset = 0; offset < file.size;) {
    abort(signal);
    const end = Math.min(offset + chunkBytes, file.size);
    const part = file.slice(offset, end);
    const blob = await fileToBlob(part);
    abort(signal);
    // Browsers normally guarantee slice lengths. Reject custom/short reads
    // rather than accepting an acknowledgement for bytes that were not sent.
    const encodedSize = blob.data.length / 4 * 3 - (blob.data.endsWith('==') ? 2 : blob.data.endsWith('=') ? 1 : 0);
    if (encodedSize !== end - offset || blob.size !== end - offset || !blob.data || part.size !== end - offset) throw new Error('File part size does not match the selected range.');
    const accepted = await append({offset, data: blob.data, signal});
    abort(signal);
    if (accepted?.nextOffset !== end) throw new Error('Chunk acknowledgement does not match the sent range.');
    offset = end;
    onProgress?.({sentBytes: offset, totalBytes: file.size});
  }
  return {sentBytes: file.size, totalBytes: file.size};
}
