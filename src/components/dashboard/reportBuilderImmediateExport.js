import {downloadBytes} from '../readerWorkbench/downloadBytes.js';

export const MAX_IMMEDIATE_REPORT_EXPORT_BYTES = 12 << 20;

const mediaTypes = Object.freeze({
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

// Advisory labels only. The server rebuilds the held window and independently
// validates the selected authored table before any data fetch.
export function advisoryReportExportTables(reportSpec) {
    const seen = new Set();
    return (Array.isArray(reportSpec?.blocks) ? reportSpec.blocks : []).filter(block => block?.kind === 'tableBlock').map(block => {
        if (typeof block.id !== 'string' || !block.id || seen.has(block.id)) throw new Error('The current report contains ambiguous table identities.');
        seen.add(block.id);
        return {id: block.id, title: typeof block.title === 'string' && block.title.trim() ? block.title : block.id};
    });
}

// A completed in-memory download is not a durable export job. The host must
// validate its resource authority before returning this presentation contract.
export function immediateReportExportDownload(value, expectedFormat = '') {
    if (value?.kind !== 'immediateReportExport') return null;
    if (Object.hasOwn(value, 'jobId') || Object.hasOwn(value, 'artifactId')) throw new Error('An immediate report export cannot contain a queued job identity.');
    const format = typeof value.format === 'string' ? value.format.toLowerCase() : '';
    if (!mediaTypes[format] || expectedFormat && format !== String(expectedFormat).toLowerCase()) {
        throw new Error('The downloaded report format does not match the requested export.');
    }
    if (value.contentType !== mediaTypes[format]) throw new Error('The downloaded report has an unexpected media type.');
    const filename = typeof value.filename === 'string'
        ? value.filename.split(/[\\/]/).at(-1).replace(/[\u0000-\u001f\u007f]/g, '_')
        : '';
    if (!filename || filename.length > 240 || !filename.toLowerCase().endsWith('.' + format)) {
        throw new Error('The downloaded report has an invalid filename.');
    }
    const data = value.data;
    if (typeof data === 'string' && data.length > 4 * Math.ceil(MAX_IMMEDIATE_REPORT_EXPORT_BYTES / 3)
        || (Array.isArray(data) || data instanceof Uint8Array) && data.length > MAX_IMMEDIATE_REPORT_EXPORT_BYTES) {
        throw new Error('The downloaded report exceeds the export size limit.');
    }
    const bytes = data instanceof Uint8Array ? new Uint8Array(data) : downloadBytes(data);
    if (!bytes.length || bytes.length > MAX_IMMEDIATE_REPORT_EXPORT_BYTES) throw new Error('The server did not return a complete downloadable report.');
    const signature = format === 'pdf' ? [37,80,68,70,45] : [80,75,3,4];
    if (signature.some((value,index)=>bytes[index]!==value)) throw new Error('The server returned an invalid report file signature.');
    return {filename, mimeType: mediaTypes[format], payload: bytes, format};
}
