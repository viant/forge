import {sanitizeFilenameSegment} from "./reportBuilderExportLifecycle.js";
import {buildReportResourceRunRequest} from "./reportBuilderResourceLifecycle.js";

export async function exportSelectedReport({pin, parameters, format, tableBlockId, services, isCurrent, wait = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
    if (!["pdf", "csv", "xlsx"].includes(format)) throw new Error("Unsupported report export format.");
    if(typeof services?.submitResource!=='function')throw Error('Report export service is unavailable.');
    const request = {...buildReportResourceRunRequest(pin, parameters), format,...(tableBlockId?{tableBlockId}:{})};
    const job = await services.submitResource(request);
    if (!job?.jobId) throw new Error("Report export did not return a job.");
    if(typeof services?.getStatus!=='function')throw Error('Report export retrieval is unavailable.');
    for (let attempt = 0; attempt < 120; attempt++) {
        if (!isCurrent()) return null;
        const status = await services.getStatus({jobId: job.jobId});
        if (!isCurrent()) return null;
        if (status.status === "failed") throw new Error(status.error || "Report export failed.");
        if (status.status === "succeeded") {
            if(typeof services?.getArtifact!=='function')throw Error('Report export retrieval is unavailable.');
            const artifact = await services.getArtifact({artifactId: status.artifactId, includeData: true});
            if (!isCurrent()) return null;
            if (artifact?.jobId !== job.jobId || artifact?.format !== format || artifact?.artifactRef !== pin.uri || !artifact.data) throw new Error("The export service did not return the selected report artifact.");
            return artifact;
        }
        await wait(500);
    }
    throw new Error("Report export is still pending. Try again later.");
}

export function decodeReportArtifact(artifact) {
    const data=artifact?.data;
    if(typeof data!=='string'||!data.length||data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('The export provider did not return valid base64 file data.');
    return Uint8Array.from(atob(data),character=>character.charCodeAt(0));
}

export function validateReportArtifact(artifact,format) {
    if(!['pdf','csv','xlsx'].includes(format)||artifact?.format!==format)throw Error('The export provider returned a different file format.');
    if(artifact.incompleteDatasetIds?.length)throw Error('The export is incomplete. Narrow the filters and try again.');
    return decodeReportArtifact(artifact);
}

// Prepare the name once before choosing browser or host delivery. Explicit
// producer names remain authoritative; report.xlsx is the generated fallback.
export function withReportArtifactFilename(artifact, format, title = '') {
    if (format !== 'xlsx' || !artifact || typeof artifact !== 'object') return artifact;
    const explicit = [artifact.filename, artifact.fileName].find(name => typeof name === 'string' && name.trim() && name.trim().toLowerCase() !== 'report.xlsx');
    if (explicit) return !artifact.filename || artifact.filename === explicit ? artifact : {...artifact, filename: explicit};
    const base = sanitizeFilenameSegment(title).replace(/^[ .]+|[ .]+$/g, '') || 'Report';
    let name = '', byteLength = 0;
    // Filesystem limits apply to UTF-8 bytes, not JavaScript string length.
    for (const character of base) {
        const point = character.codePointAt(0);
        const bytes = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
        if (byteLength + bytes > 180) break;
        name += character;
        byteLength += bytes;
    }
    return {...artifact, filename: `${name}_${new Date().toISOString().slice(0, 10)}.xlsx`};
}

export function downloadReportArtifact(artifact,format) {
    const bytes=validateReportArtifact(artifact,format);
    const url=URL.createObjectURL(new Blob([bytes],{type:artifact.contentType||'application/octet-stream'}));
    try{const link=document.createElement('a');link.href=url;link.download=artifact.filename||artifact.fileName||`report.${format}`;link.click();}
    finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

export function reportResourceControls({canRun, canExport, result, progress}) {
    return {runDisabled: !!progress || !canRun, exportDisabled: !result || !!progress || !canExport};
}
