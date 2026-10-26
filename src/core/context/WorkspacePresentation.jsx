import './WorkspacePresentation.css';
import React, {createContext, useContext, useRef} from 'react';
const WorkspacePresentation = createContext(null);
// Hosts often recreate this small value while updating unrelated shell state.
// Preserve context identity when every field is unchanged; changed fields still
// notify consumers, including values beyond the standard label/kind pair.
export function WorkspacePresentationProvider({value, children}) {
  const previous = useRef(value);
  const held = previous.current;
  const equal = Object.is(held, value) || (held && value && typeof held === 'object' && typeof value === 'object'
    && Object.keys(held).length === Object.keys(value).length
    && Object.keys(value).every(key => Object.hasOwn(held, key) && Object.is(held[key], value[key])));
  if (!equal) previous.current = value;
  return <WorkspacePresentation.Provider value={previous.current}>{children}</WorkspacePresentation.Provider>;
}
export const useWorkspacePresentation = () => useContext(WorkspacePresentation);
export function distinctWorkspaceTitle(title, workspaceLabel) {
  const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(title) && normalize(title) === normalize(workspaceLabel) ? '' : title;
}

export function workspaceToolbarItem(item = {}, workspace = null) {
  if (!workspace || item.hideLabel === false) return item;
  const type = String(item.type || item.widget || 'button').toLowerCase();
  if (!['button', 'tableexport', 'menu', 'dropdown'].includes(type)) return item;
  const id = String(item.id || '').toLowerCase();
  const label = String(item.label || '').trim();
  const action = type === 'tableexport' || /^(export|download)/.test(id) || /^export\b/i.test(label) ? 'export'
    : ['filter', 'filters', 'filterlist'].includes(id) || /^filters?\b/i.test(label) ? 'filter'
    : /^refresh/.test(id) || /^refresh\b/i.test(label) ? 'refresh' : '';
  if (!action) return item;
  const accessibleLabel = item.ariaLabel || item.tooltip || label || {filter: 'Filters', refresh: 'Refresh', export: 'Export'}[action];
  return {...item, hideLabel: true, icon: item.icon || {filter: 'filter', refresh: 'refresh', export: 'download'}[action],
    ariaLabel: accessibleLabel, tooltip: item.tooltip || accessibleLabel,
    className: [item.className, 'forge-workspace-icon-action'].filter(Boolean).join(' ')};
}
