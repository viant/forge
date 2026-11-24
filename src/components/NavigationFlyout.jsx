import React, {useId, useRef, useState} from 'react';
import {MenuItem} from '@blueprintjs/core';
import Button from './Button.jsx';
import DropdownMenu from './DropdownMenu.jsx';
import Icon from './Icon.jsx';
import Typography, {typographyProps} from './Typography.jsx';
import {FLOATING_PANEL_GAP} from './anchoredPopoverProps.js';

// Compose the existing anchored menu: Blueprint owns hover timing, portal
// placement, Escape and option dismissal. This is the actual open state;
// selected paint comes from aria-expanded/aria-current in Global CSS.
export default function NavigationFlyout({title, icon, iconSvg, current = false, disabled = false, onActivate, children, popupKind = 'menu', className = ''}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const content = useRef(null);
  const focusOnOpen = useRef(null);
  const id = useId();
  const close = () => setOpen(false);
  const focusItem = edge => {
    const menu = content.current?.querySelector('[role="menu"]');
    const items = [...(menu?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)') || [])]
      .filter(item => item.closest('[role="menu"]') === menu);
    (edge === 'last' ? items.at(-1) : items[0])?.focus();
  };
  const leave = event => {
    if (!content.current?.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) close();
  };
  const keydown = event => {
    const menu = event.target.closest('[role="menu"]');
    if (!menu || !content.current?.contains(menu)) return;
    if (event.key === 'Tab') {
      close();
      trigger.current?.focus();
      return;
    }
    const items = [...menu.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)')]
      .filter(item => item.closest('[role="menu"]') === menu);
    const index = items.findIndex(item => item === document.activeElement || item.contains(document.activeElement));
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && items.length) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key === 'ArrowRight') {
      const submenu = items[index]?.closest('li')?.querySelector('[role="menu"]');
      if (submenu) {
        event.preventDefault();
        submenu.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
      }
    } else if (event.key === 'ArrowLeft' && menu !== content.current.querySelector('[role="menu"]')) {
      event.preventDefault();
      menu.closest('.bp6-menu-submenu')?.querySelector('[aria-haspopup="menu"]')?.focus();
    }
  };
  return <DropdownMenu menu interactionKind="hover" openOnTargetFocus={false} autoFocus={false} enforceFocus={false}
    placement="right-start" popupKind={popupKind} isOpen={open} disabled={disabled}
    popoverClassName="forge-navigation-flyout" hoverCloseDelay={180}
    modifiersCustom={[{name: 'offset', options: {offset: ({placement}) => {
      // The authored rail inset belongs to its surface. Let native Popper
      // measure from that edge while retaining the shared anchored-panel gap.
      const parent = trigger.current?.parentElement;
      const style = parent ? getComputedStyle(parent) : null;
      const inset = placement.startsWith('right') ? style?.paddingRight : placement.startsWith('left') ? style?.paddingLeft : 0;
      return [0, FLOATING_PANEL_GAP + (parseFloat(inset) || 0)];
    }}}]}
    onInteraction={(next, event) => {
      if (!next && event?.type === 'mouseleave' && content.current?.contains(document.activeElement)) return;
      if (!next) focusOnOpen.current = null;
      setOpen(next);
    }}
    onClose={event => {if ((event?.key || event?.nativeEvent?.key) === 'Escape') trigger.current?.focus();}}
    onOpened={() => {if (focusOnOpen.current && document.activeElement === trigger.current) focusItem(focusOnOpen.current); focusOnOpen.current = null;}}
    content={<div ref={content} id={id} className="forge-navigation-flyout-body" role={popupKind === 'dialog' ? 'dialog' : undefined}
      aria-label={popupKind === 'dialog' ? title : undefined} onBlur={leave} onKeyDown={keydown}>
      <Typography as="div" typeRole="label" className="forge-navigation-flyout-heading">{title}</Typography>
      {typeof children === 'function' ? children(close) : children}
    </div>}
    renderTarget={({isOpen, ref, ...targetProps}) => <Button {...targetProps} variant="ghost"
      ref={node => {trigger.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;}}
      {...typographyProps('metadata')} className={`forge-navigation-trigger ${targetProps.className || ''} ${className}`}
      disabled={disabled} aria-label={title} aria-haspopup={popupKind} aria-expanded={isOpen} aria-controls={isOpen ? id : undefined}
      aria-current={current ? 'true' : undefined} onBlur={leave}
      onClick={() => {onActivate?.(); setOpen(true);}}
      onKeyDown={event => {
        if (!['Enter', ' ', 'ArrowDown', 'ArrowUp', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Enter' || event.key === ' ') onActivate?.();
        focusOnOpen.current = event.key === 'ArrowUp' ? 'last' : 'first';
        if (open) {focusItem(focusOnOpen.current); focusOnOpen.current = null;}
        else setOpen(true);
      }}>
      <Icon name={icon || (iconSvg ? undefined : 'lucide:layout-grid')} iconSvg={iconSvg}/>
      <span className="forge-navigation-label">{title}</span>
    </Button>}/>
}

// Native inline submenus retain the parent's hover surface. Their actual open
// state also lets keyboard dismissal return to the existing native trigger.
export function NavigationSubmenu({children, ...props}) {
  const [open, setOpen] = useState(false);
  const item = useRef(null);
  const focusOnOpen = useRef(false);
  const getTrigger = () => item.current?.querySelector('[role="menuitem"]');
  const focusTrigger = () => getTrigger()?.focus();
  const focusFirst = () => item.current?.querySelector('[role="menu"]')?.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  const updateOpen = next => {if (!next) focusOnOpen.current = false; setOpen(next);};
  const dismiss = event => {
    if (!['Escape', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); updateOpen(false); focusTrigger();
  };
  return <MenuItem {...props} ref={item} submenuProps={{onKeyDown: dismiss}}
    popoverProps={{isOpen: open, onInteraction: updateOpen, openOnTargetFocus: false, hoverOpenDelay: 0,
      popoverClassName: 'forge-navigation-submenu',
      targetProps: {role: 'menuitem', tabIndex: 0, onKeyDown: event => {
        if (!['ArrowRight', 'Enter', ' '].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); focusOnOpen.current = true;
        if (open) focusFirst();
        else setOpen(true);
      }},
      onOpened: () => {if (focusOnOpen.current && document.activeElement === getTrigger()) focusFirst(); focusOnOpen.current = false;},
      onClose: event => {if ((event?.key || event?.nativeEvent?.key) === 'Escape') focusTrigger();},
    }}>{children}</MenuItem>;
}
