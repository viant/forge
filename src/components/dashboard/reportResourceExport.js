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

export function downloadReportArtifact(artifact,format) {
    if(!['pdf','csv','xlsx'].includes(format)||artifact?.format!==format)throw Error('The export provider returned a different file format.');
    if(artifact.incompleteDatasetIds?.length)throw Error('The export is incomplete. Narrow the filters and try again.');
    const bytes=decodeReportArtifact(artifact);
    const url=URL.createObjectURL(new Blob([bytes],{type:artifact.contentType||'application/octet-stream'}));
    try{const link=document.createElement('a');link.href=url;link.download=artifact.filename||artifact.fileName||`report.${format}`;link.click();}
    finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

export function reportResourceControls({canRun, canExport, result, progress}) {
    return {runDisabled: !!progress || !canRun, exportDisabled: !result || !!progress || !canExport};
}
