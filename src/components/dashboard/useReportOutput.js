import {useEffect, useRef, useState} from "react";
import {downloadReportArtifact,validateReportArtifact,withReportArtifactFilename} from "./reportResourceExport.js";

// One output belongs to the currently displayed report/scope. Hosts supply the
// transport; this hook owns cancellation, stale settlement and print visibility.
// Title is already-present display metadata used only for an unnamed XLSX download.
export function useReportOutput({scopeKey, title='', disabled=false, onExport, onPrint, onDownload}) {
    const callbacks = useRef({onExport,onPrint,onDownload}); callbacks.current = {onExport,onPrint,onDownload};
    const owner = useRef(null);
    const rendered=useRef({scopeKey,disabled});rendered.current={scopeKey,disabled};
    const [state,setState] = useState(null);
    const cancel = () => {owner.current?.controller.abort(); owner.current=null;};
    useEffect(() => {cancel();setState(null);return cancel;},[scopeKey,disabled]);
    const current = !disabled&&state?.scopeKey===scopeKey ? state : null;
    const start = async (format,tableBlockId) => {
        if(disabled)return {status:'blocked',error:{message:'Report output is unavailable.'}};
        cancel();
        const operation={controller:new AbortController(),scopeKey};owner.current=operation;
        const isCurrent=()=>owner.current===operation&&!operation.controller.signal.aborted&&rendered.current.scopeKey===operation.scopeKey&&!rendered.current.disabled;
        setState({scopeKey,busy:format});
        try {
            const callback=format==='print'?callbacks.current.onPrint:callbacks.current.onExport;
            if(typeof callback!=='function')throw Error('Report output is unavailable.');
            const value=await callback({format,tableBlockId,signal:operation.controller.signal,isCurrent});
            if(!isCurrent())return {status:'cancelled'};
            if(format==='print'){
                if(value?.kind!=='reportPrint'||!Array.isArray(value.pages)||!value.pageGeometry)throw Error('The provider did not return a canonical print layout.');
                setState({scopeKey,printModel:value});
            }else{
                const artifact=withReportArtifactFilename(value,format,title);
                const download=callbacks.current.onDownload;
                if(download==null)downloadReportArtifact(artifact,format);
                else{
                    validateReportArtifact(artifact,format);
                    if(typeof download!=='function')throw Error('Report download is unavailable.');
                    await download(artifact,format,{signal:operation.controller.signal,isCurrent});
                }
                if(!isCurrent())return {status:'cancelled'};
                setState({scopeKey});
                return {status:'succeeded',receipt:{status:'succeeded',format,...(value.artifactId?{artifactId:value.artifactId}:{}),...(value.jobId?{jobId:value.jobId}:{})}};
            }
        }catch(error){if(!isCurrent())return {status:'cancelled'};const message=error?.message||'Report output failed.';setState({scopeKey,error:message});return {status:'failed',error:{message}};}
        finally{if(owner.current===operation)owner.current=null;}
    };
    return {busy:current?.busy||'',error:current?.error||'',printModel:current?.printModel||null,
        exportReport:(format,tableBlockId)=>start(format,tableBlockId),
        previewPrint:()=>current?.printModel?setState({scopeKey}):start('print'),
        cancelOutput:()=>{cancel();setState(null);}};
}
