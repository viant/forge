// User-requested closes only. Authorization/session cleanup must continue to
// use the unconditional removeWindow path so a prompt cannot retain denied data.
export function windowCloseDecision(context, settings = context?.metadata?.window || {}) {
  const message = typeof settings.confirmDiscardOnClose === 'string' ? settings.confirmDiscardOnClose.trim() : '';
  if (!message) return {requiresConfirmation:false,dirtySources:[],message:''};
  const refs = Array.isArray(settings.dirtyDataSourceRefs) ? settings.dirtyDataSourceRefs : [];
  const dirtySources=[];
  for (const ref of new Set(refs.filter(ref=>typeof ref==='string'&&ref.trim()))) {
    const source=context?.identity?.dataSourceRef===ref?context:context?.Context?.(ref);
    const status=source?.signals?.formStatus?.peek?.() || source?.signals?.formStatus?.value;
    if(status?.dirty===true || source?.handlers?.dataSource?.isFormDirty?.()===true)dirtySources.push(ref);
  }
  return {requiresConfirmation:dirtySources.length>0,dirtySources,message};
}

export function preventDirtyWindowUnload(event, contexts) {
  if(!(contexts || []).some(context=>windowCloseDecision(context).requiresConfirmation))return false;
  event.preventDefault();
  event.returnValue='';
  return true;
}
