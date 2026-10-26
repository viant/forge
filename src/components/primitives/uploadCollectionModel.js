import {fileToMCPBlob} from '../../packs/blueprint/fileBlob.js';

export async function encodeUploadFiles(files = [], spec = {}) {
  if (spec.transport === 'files') {
    if (!String(spec.upload?.prepare || '').trim()) throw new Error('File transport requires a command preparation handler.');
    return {transport: 'files', [spec.blobField || 'files']: spec.multiple === false ? files[0] : files};
  }
  if (spec.transport && spec.transport !== 'mcpBlob') throw new Error(`Unsupported upload transport: ${spec.transport}`);
  const blobs = await Promise.all((files || []).map(fileToMCPBlob));
  return {
    transport: 'mcpBlob',
    [spec.blobField || 'files']: spec.multiple === false ? blobs[0] : blobs,
  };
}
