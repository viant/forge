import React from 'react';
import {Button, Callout, Popover} from '@blueprintjs/core';
import './DisabledActionShell.css';

export function nextDisabledReasonOpen(current, eventType) {
  if (eventType === 'focus') return true;
  if (eventType === 'activate') return !current;
  if (eventType === 'escape' || eventType === 'close') return false;
  return current;
}

export function shouldOpenDisabledReasonOnFocus(focusVisible) {
  return focusVisible === true;
}

export default function DisabledActionShell({reason = '', label = 'Action', className = '', style, children}) {
  const explanation = String(reason || '').trim();
  const [open, setOpen] = React.useState(false);
  if (!explanation) return <span className={className || undefined} style={style}>{children}</span>;
  const update = (eventType) => setOpen((current) => nextDisabledReasonOpen(current, eventType));
  return (
    <Popover
      isOpen={open}
      onInteraction={(nextOpen) => setOpen(nextOpen)}
      interactionKind="click"
      placement="bottom"
      minimal
      content={(
        <Callout className="forge-disabled-reason-popover" title={`${label} unavailable`} intent="warning" role="status">
          <div>{explanation}</div>
          <Button minimal small text="Close explanation" onClick={() => update('close')}/>
        </Callout>
      )}
    >
      <span
        className={`forge-disabled-action-shell${className ? ` ${className}` : ''}`}
        style={style}
        title={explanation}
        tabIndex={0}
        aria-label={`${label}. ${explanation}`}
        aria-expanded={open}
        data-disabled-reason={explanation}
        onFocus={(event) => {
          if (shouldOpenDisabledReasonOnFocus(event.currentTarget.matches?.(':focus-visible') === true)) update('focus');
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); update('escape'); }
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); update('activate'); }
        }}
      >
        {children}
      </span>
    </Popover>
  );
}
