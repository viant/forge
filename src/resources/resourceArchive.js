const utf8 = new TextDecoder('utf-8', {fatal: true});
const text = bytes => utf8.decode(bytes).replace(/\0.*$/s, '');

// Read only a deterministic regular-file tar. Nothing is extracted to disk.
export function readResourceTar(bytes) {
  if (bytes.length % 512 !== 0) throw new Error('Truncated archive block');
  const files = new Map();
  for (let offset = 0; offset < bytes.length;) {
    if (offset + 512 > bytes.length) throw new Error('Truncated archive header');
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const octal = field => { const value = text(field).trim(); if (!/^[0-7]+$/.test(value)) throw new Error('Invalid archive number'); return Number.parseInt(value, 8); };
    const checksum = octal(header.subarray(148, 156));
    let actual = 0;
    for (let i = 0; i < 512; i++) actual += i >= 148 && i < 156 ? 32 : header[i];
    if (checksum !== actual) throw new Error('Invalid archive checksum');
    const prefix = text(header.subarray(345, 500));
    const name = (prefix ? `${prefix}/` : '') + text(header.subarray(0, 100));
    if (name !== 'manifest.json' && !/^resources\/[a-f0-9]{64}\.json$/.test(name)) throw new Error('Invalid archive path');
    if (![0, 48].includes(header[156]) || files.has(name)) throw new Error('Unsupported or duplicate archive entry');
    const size = octal(header.subarray(124, 136));
    const start = offset + 512;
    if (!Number.isSafeInteger(size) || start + size > bytes.length) throw new Error('Truncated archive entry');
    files.set(name, utf8.decode(bytes.subarray(start, start + size)));
    offset = start + Math.ceil(size / 512) * 512;
  }
  const manifest = JSON.parse(files.get('manifest.json') || 'null');
  if (!manifest || !Array.isArray(manifest.entries)) throw new Error('Archive manifest missing');
  const referenced = new Set(['manifest.json']);
  const entries = manifest.entries.map(entry => {
    if (entry.path !== `resources/${entry.contentFingerprint}.json` || !files.has(entry.path)) throw new Error('Archive definition missing');
    referenced.add(entry.path);
    return {...entry, definitionText: files.get(entry.path)};
  });
  if (referenced.size !== files.size) throw new Error('Unreferenced archive entry');
  return {...manifest, entries};
}

export async function decodeResourceArchive(content) {
  if (content?.mimeType !== 'application/gzip' || typeof content.blob !== 'string') throw new Error('Invalid binary archive response');
  const binary = atob(content.blob);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return readResourceTar(new Uint8Array(await new Response(stream).arrayBuffer()));
}
