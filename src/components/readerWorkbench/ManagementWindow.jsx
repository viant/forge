import React from 'react';
import {ResourceWindow} from '../ResourceWindow.jsx';
import {WorkbenchMutationContext} from './WorkbenchMutationContext.jsx';
export function ManagementWindow({api,uri,instanceKey,...props}) {
 const lifecycle=React.useContext(WorkbenchMutationContext),key=instanceKey||uri;
 const hostServices=React.useMemo(()=>({...api.windowServices,hostWindow:{...api.windowServices?.hostWindow,setBusy:value=>lifecycle.setExternalBusy(key,Boolean(value))}}),[api.windowServices,lifecycle.setExternalBusy,key]);
 React.useEffect(()=>()=>lifecycle.setExternalBusy(key,false),[lifecycle.setExternalBusy,key]);
 return <ResourceWindow uri={uri} instanceKey={instanceKey} {...props} hostServices={hostServices}/>;
}
