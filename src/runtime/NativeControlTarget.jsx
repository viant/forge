import {evaluateOperationGuard} from './operationGuards.js';
import React from 'react';
import {useRegisteredControlActions} from './useRegisteredControlActions.js';
import {isLiveControlVisible} from '../core/ui/controlActions.js';
import {evaluatePlainVisibleWhen} from '../components/visibleWhen.js';

// Native primitives explicitly provide their normal callbacks. This component
// never clicks DOM, patches signals, resolves handlers or invokes a datasource.
export default function NativeControlTarget({context={},item={},controlId,disabled=false,readOnly=false,sensitive=false,value,options,constraints,actions={},validate,invokeState,row,children}) {
  const root=React.useRef(null),id=controlId || item.id;
  const node=()=>root.current?.querySelector?.('input,textarea,select,button,a[href],[role=button],[role=menuitem],[tabindex]:not([tabindex="-1"])');
  const passive=()=>{
    const element=node();
    const event=()=>({type:'click',target:element,currentTarget:element,preventDefault(){},stopPropagation(){}});
    const callbacks=Object.fromEntries(Object.entries(actions).filter(([,fn])=>typeof fn==='function').map(([key,fn])=>[key,params=>fn({...params,event:event()})]));
    if(element?.focus)callbacks.focus=()=>{element.focus();return document.activeElement===element;};
    return {visible:isLiveControlVisible(root.current),disabled:disabled||element?.disabled===true||element?.matches?.(':disabled')===true,
      readOnly:readOnly||element?.readOnly===true,sensitive:sensitive||item.sensitive===true||item.properties?.sensitive===true||/password|token|secret|credential/i.test(`${item.widget || ''} ${item.type || ''} ${item.properties?.type || ''} ${item.properties?.inputType || ''} ${element?.type || ''}`),value,options,constraints,actions:callbacks};
  };
  useRegisteredControlActions({windowId:context?.identity?.windowId,dataSourceRef:context?.identity?.dataSourceRef,controlId:id,type:item.widget || item.type,scope:item.scope,dataField:item.dataField,bindingPath:item.bindingPath},()=>{
    const state=passive(),condition=key=>item[key]&&evaluatePlainVisibleWhen(item[key],context,row);
    const extra=invokeState?.() || {},guard=name=>evaluateOperationGuard(name,item,context,value,{row});
    return {...state,...extra,visible:state.visible&&extra.visible!==false&&guard('onVisible')!==false&&(!item.visibleWhen||condition('visibleWhen'))&&!condition('hiddenWhen'),
      disabled:state.disabled||extra.disabled===true||guard('onDisabled')===true||condition('disabledWhen'),readOnly:state.readOnly||extra.readOnly===true||guard('onReadonly')===true||condition('readOnlyWhen'),
      validate:next=>validate?.(next) || evaluateOperationGuard('onValidate',item,context,next,{row})};
  },`${disabled}:${readOnly}`,passive);
  return <span ref={root} style={{display:'contents'}}>{children}</span>;
}
