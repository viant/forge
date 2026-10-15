import {buildReportResourceRunRequest} from "./reportBuilderResourceLifecycle.js";

export async function exportSelectedReport({pin, parameters, format, services, isCurrent, wait = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
    if (!["pdf", "csv", "xlsx"].includes(format)) throw new Error("Unsupported report export format.");
    const request = {...buildReportResourceRunRequest(pin, parameters), format};
    const job = await services.submitResource(request);
    if (!job?.jobId) throw new Error("Report export did not return a job.");
    for (let attempt = 0; attempt < 120; attempt++) {
        if (!isCurrent()) return null;
        const status = await services.getStatus({jobId: job.jobId});
        if (status.status === "failed") throw new Error(status.error || "Report export failed.");
        if (status.status === "succeeded") {
            const artifact = await services.getArtifact({artifactId: status.artifactId, includeData: true});
            if (!isCurrent()) return null;
            if (artifact?.jobId !== job.jobId || artifact?.format !== format || artifact?.artifactRef !== pin.uri || !artifact.data) throw new Error("The export service did not return the selected report artifact.");
            return artifact;
        }
        await wait(500);
    }
    throw new Error("Report export is still pending. Try again later.");
}

export function reportResourceControls({canRun, canExport, result, progress}) {
    return {runDisabled: !!progress || !canRun, exportDisabled: !result || !!progress || !canExport};
}
