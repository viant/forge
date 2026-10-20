import React from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {resolveSelector} from '../../utils/selector.js';
import {createWorkbenchAPI} from './apiBindings.js';
import {ReaderBuilder} from './ReaderBuilder.jsx';
import {WorkbenchMutationContext} from './WorkbenchMutationContext.jsx';

export default function ReaderWorkbenchPanel({container,context}) {
 useSignals();const spec=container.readerWorkbench||{},ref=spec.dataSourceRef||container.dataSourceRef;
 const scoped=ref?context.Context(ref):context,form=scoped.signals.form.value||{};
 const [pending,setPending]=React.useState(0),[external,setExternal]=React.useState({}),[local,setLocal]=React.useState({dirty:false,busy:false});
 const localChanged=React.useCallback(value=>setLocal(current=>current.dirty===value.dirty&&current.busy===value.busy?current:value),[]);
 const api=React.useMemo(()=>createWorkbenchAPI(context,spec,{onPendingChange:setPending}),[context,spec]);
 api.namespaceId=resolveSelector(form,spec.namespaceField||'namespaceId');
 const busy=pending>0||local.busy||Object.values(external).some(Boolean);
 const setExternalBusy=React.useCallback((key,value)=>setExternal(current=>current[key]===value?current:{...current,[key]:value}),[]);
 const lifecycle=React.useMemo(()=>({busy,setExternalBusy}),[busy,setExternalBusy]);
 React.useEffect(()=>{context.services.hostWindow?.setDirty?.(Boolean(busy||local.dirty));},[busy,local.dirty,context]);
 const invoke=(name,value)=>spec[name]?context.lookupHandler?.(spec[name])?.({context,value}):undefined;
 const report=resolveSelector(form,spec.reportField||'report');
 if(!report)return null;
 return <WorkbenchMutationContext.Provider value={lifecycle}><ReaderBuilder onStateChange={localChanged} api={api} report={report} defaults={spec.defaults} openResources={Boolean(resolveSelector(form,spec.openResourcesField||'openResources'))} resourceAction={resolveSelector(form,spec.resourceActionField||'resourceAction')||''} onBack={()=>invoke('onBack')} onReportUpdated={value=>invoke('onReportUpdated',value)} onResourcesClosed={()=>invoke('onResourcesClosed')}/></WorkbenchMutationContext.Provider>;
}
