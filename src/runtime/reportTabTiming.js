// Installed only by the opt-in diagnostics collector. Retain timing and outcome,
// never section names, filter values, or report content.
export function observeReportTabTimings({document, window, now, add}) {
    let sequence=0, stop=()=>{};
    const click=event=>{
        const tab=event.target?.closest?.('[role="tab"][data-section-id]');
        const root=tab?.closest?.('[data-forge-report-active-section]');
        if(!root || tab.getAttribute('aria-selected')==='true') return;
        stop();
        const selected=tab.getAttribute('data-section-id'), operation=++sequence;
        let firstFrame,secondFrame,timeout,closed=false;
        const current=()=>!closed && root.isConnected && root.getAttribute('data-forge-report-active-section')===selected;
        const observer=new MutationObserver(()=>{
            if(!current())return;
            const state=root.getAttribute('data-forge-report-section-state');
            if(state!=='ready' && state!=='error')return;
            observer.disconnect();clearTimeout(timeout);
            if(state==='error'){add({kind:'report-tab-error',operation,start:now()});close();return;}
            add({kind:'report-tab-dom',operation,start:now()});
            firstFrame=window.requestAnimationFrame(()=>{
                firstFrame=null;if(!current())return;
                secondFrame=window.requestAnimationFrame(()=>{
                    secondFrame=null;if(current())add({kind:'report-tab-frame',operation,start:now()});close();
                });
            });
        });
        const close=()=>{closed=true;observer.disconnect();clearTimeout(timeout);
            if(firstFrame!=null)window.cancelAnimationFrame(firstFrame);
            if(secondFrame!=null)window.cancelAnimationFrame(secondFrame);};
        stop=close;
        add({kind:'report-tab-click',operation,start:now()});
        observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['data-forge-report-active-section','data-forge-report-section-state']});
        timeout=setTimeout(close,30000);
    };
    document.addEventListener('click',click,true);
    return ()=>{stop();document.removeEventListener('click',click,true);};
}
