import {useMemo} from 'react';
import {computed} from '@preact/signals-react';

// The compatibility view document is window-wide, but subscribers belong to
// one tab rail or persisted section. Stable computed values suppress updates
// when a different visual partition changes in that document.
export function useViewPartition(viewSignal, partition, key = null) {
 return useMemo(()=>computed(()=>{
  const group=viewSignal?.value?.[partition];
  return key == null ? group : group?.[key];
 }),[viewSignal,partition,key]);
}
