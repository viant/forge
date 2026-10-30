import Popover from './Popover.jsx';
import React from 'react';

import {useSignals} from '@preact/signals-react/runtime';
import NativeControlTarget from '../runtime/NativeControlTarget.jsx';

// The same controlled interaction callback serves pointer and typed operations.
export default function RegisteredPopover({context,item,disabled=false,readOnly=false,value,options,actions={},validate,placement='bottom-end',renderContent,children}) {
  useSignals();
  const [open,setOpen]=React.useState(false);
  const interact=next=>{if(next&&(disabled||readOnly))return false;setOpen(next);return true;};
  return <NativeControlTarget context={context} item={item} disabled={disabled} readOnly={readOnly} value={value} options={options} validate={validate} actions={{click:()=>interact(!open),...actions}}>
    <Popover placement={placement} interactionKind="click" minimal isOpen={open} onInteraction={interact} disabled={disabled||readOnly} content={renderContent(()=>interact(false))}>{children}</Popover>
  </NativeControlTarget>;
}
