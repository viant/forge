// Blueprint Select restores its old trigger in the next animation frame. Keep
// that keyboard behavior, but preserve a control the user has already moved to.
export function preserveSelectExternalFocus(popover, trigger, schedule = requestAnimationFrame) {
 const doc=trigger?.ownerDocument;if(!doc)return;
 const external=element=>element&&element!==doc.body&&element!==trigger&&!popover?.contains(element);
 let next=external(doc.activeElement)?doc.activeElement:null;
 const changed=event=>{if(external(event.target))next=event.target;};
 doc.addEventListener('focusin',changed,true);
 schedule(()=>{
  doc.removeEventListener('focusin',changed,true);
  if(next?.isConnected&&(doc.activeElement===trigger||popover?.contains(doc.activeElement)||doc.activeElement===doc.body))next.focus();
 });
}
