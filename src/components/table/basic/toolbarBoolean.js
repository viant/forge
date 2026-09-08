import {setSelector} from '../../../utils/selector.js';

export function toolbarBooleanValue(value) {
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  return value === true || value === 1;
}

export function toolbarBooleanField(item = {}) {
  return item.dataField || item.field || item.bind || item.id;
}

export function updateToolbarBoolean({signal, field, checked, event, onChange}) {
  if (!signal || !field) return false;
  const previous = signal.peek?.() || signal.value || {};
  signal.value = setSelector(previous, field, checked === true);
  onChange?.(event);
  return true;
}
