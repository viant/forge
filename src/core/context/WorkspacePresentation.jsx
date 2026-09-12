import './WorkspacePresentation.css';
import React, {createContext, useContext} from 'react';
const WorkspacePresentation = createContext(null);
export const WorkspacePresentationProvider = WorkspacePresentation.Provider;
export const useWorkspacePresentation = () => useContext(WorkspacePresentation);
export function distinctWorkspaceTitle(title, workspaceLabel) {
  const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(title) && normalize(title) === normalize(workspaceLabel) ? '' : title;
}

export function workspaceToolbarItem(item = {}, workspace = null) {
  if (!workspace) return item;
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
