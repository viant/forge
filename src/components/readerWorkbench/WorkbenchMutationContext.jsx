import React from 'react';
import {Dialog as BlueprintDialog,Alert as BlueprintAlert} from '@blueprintjs/core';
export const WorkbenchMutationContext=React.createContext({busy:false,setExternalBusy:()=>{}});
export function WorkbenchDialog(props) {
 const {busy}=React.useContext(WorkbenchMutationContext);
 return <BlueprintDialog {...props} onClose={event=>!busy&&props.onClose?.(event)} canEscapeKeyClose={!busy&&props.canEscapeKeyClose!==false} canOutsideClickClose={!busy&&props.canOutsideClickClose!==false} isCloseButtonShown={!busy&&props.isCloseButtonShown!==false}/>;
}
export function WorkbenchAlert(props) {
 const {busy}=React.useContext(WorkbenchMutationContext);
 return <BlueprintAlert {...props} loading={busy||props.loading} onConfirm={event=>!busy&&props.onConfirm?.(event)} onCancel={event=>!busy&&props.onCancel?.(event)} cancelButtonText={props.cancelButtonText} canEscapeKeyCancel={!busy&&props.canEscapeKeyCancel===true} canOutsideClickCancel={!busy&&props.canOutsideClickCancel===true}/>;
}
