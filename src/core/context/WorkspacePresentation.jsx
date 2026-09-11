import React, {createContext, useContext} from 'react';
const WorkspacePresentation = createContext(null);
export const WorkspacePresentationProvider = WorkspacePresentation.Provider;
export const useWorkspacePresentation = () => useContext(WorkspacePresentation);
export function distinctWorkspaceTitle(title, workspaceLabel) {
  const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(title) && normalize(title) === normalize(workspaceLabel) ? '' : title;
}
