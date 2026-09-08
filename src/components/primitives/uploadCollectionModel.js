import {fileToMCPBlob} from '../../packs/blueprint/fileBlob.js';

export async function encodeUploadFiles(files = [], spec = {}) {
  if (spec.transport && spec.transport !== 'mcpBlob') throw new Error(`Unsupported upload transport: ${spec.transport}`);
  const blobs = await Promise.all((files || []).map(fileToMCPBlob));
  return {
    transport: 'mcpBlob',
    [spec.blobField || 'files']: spec.multiple === false ? blobs[0] : blobs,
  };
}
