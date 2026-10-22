import React from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {isContainerVisible} from '../visibleWhen.js';

// The data producer owns resource and row authorization. Do not reintroduce
// authorization checks in the rendering runtime. Legacy declarations retain
// presentation predicates only.
export function permissionBoundaryAllows(spec = {}, context = {}) {
  return !spec.visibleWhen || isContainerVisible({visibleWhen: spec.visibleWhen}, context);
}

export function permissionBoundaryAllowsRows(spec = {}, context = {}, rows = []) {
  return permissionBoundaryAllows(spec, context);
}

export default function PermissionBoundary({container, context, children}) {
  useSignals();
  if (!permissionBoundaryAllows(container.permissionBoundary || {}, context)) return null;
  return <>{children}</>;
}
