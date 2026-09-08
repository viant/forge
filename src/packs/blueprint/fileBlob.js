const encodeBytes = (bytes) => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    if (typeof globalThis.btoa === 'function') {
        return globalThis.btoa(binary);
    }
    if (globalThis.Buffer) {
        return globalThis.Buffer.from(bytes).toString('base64');
    }
    throw new Error('Base64 encoding is unavailable in this runtime.');
};

export async function fileToMCPBlob(file) {
    if (!file) return null;
    if (typeof file.arrayBuffer !== 'function') {
        throw new TypeError('Selected file does not expose arrayBuffer().');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const filename = String(file.name || 'blob');
    const mimeType = String(file.type || 'application/octet-stream');
    return {
        name: filename,
        size: Number(file.size ?? bytes.byteLength),
        type: mimeType,
        data: encodeBytes(bytes),
        filename,
        mimeType,
    };
}
