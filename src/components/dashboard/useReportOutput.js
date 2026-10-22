import {useEffect, useRef, useState} from "react";
import {downloadReportArtifact} from "./reportResourceExport.js";

// One output belongs to the currently displayed report/scope. Hosts supply the
// transport; this hook owns cancellation, stale settlement and print visibility.
export function useReportOutput({scopeKey, disabled=false, onExport, onPrint}) {
    const callbacks = useRef({onExport,onPrint}); callbacks.current = {onExport,onPrint};
    const owner = useRef(null);
    const rendered=useRef({scopeKey,disabled});rendered.current={scopeKey,disabled};
    const [state,setState] = useState(null);
    const cancel = () => {owner.current?.controller.abort(); owner.current=null;};
    useEffect(() => {cancel();setState(null);return cancel;},[scopeKey,disabled]);
    const current = !disabled&&state?.scopeKey===scopeKey ? state : null;
    const start = async (format,tableBlockId) => {
        if(disabled)return;
        cancel();
        const operation={controller:new AbortController(),scopeKey};owner.current=operation;
        const isCurrent=()=>owner.current===operation&&!operation.controller.signal.aborted&&rendered.current.scopeKey===operation.scopeKey&&!rendered.current.disabled;
        setState({scopeKey,busy:format});
        try {
            const callback=format==='print'?callbacks.current.onPrint:callbacks.current.onExport;
            if(typeof callback!=='function')throw Error('Report output is unavailable.');
            const value=await callback({format,tableBlockId,signal:operation.controller.signal,isCurrent});
            if(!isCurrent())return;
            if(format==='print'){
                if(value?.kind!=='reportPrint'||!Array.isArray(value.pages)||!value.pageGeometry)throw Error('The provider did not return a canonical print layout.');
                setState({scopeKey,printModel:value});
            }else{
                downloadReportArtifact(value,format);
                setState({scopeKey});
            }
        }catch(error){if(isCurrent())setState({scopeKey,error:error?.message||'Report output failed.'});}
        finally{if(owner.current===operation)owner.current=null;}
    };
    return {busy:current?.busy||'',error:current?.error||'',printModel:current?.printModel||null,
        exportReport:(format,tableBlockId)=>start(format,tableBlockId),
        previewPrint:()=>current?.printModel?setState({scopeKey}):start('print'),
        cancelOutput:()=>{cancel();setState(null);}};
}
