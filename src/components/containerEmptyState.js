export function isPureBoundLabelSection(items = []) {
  const values = Array.isArray(items) ? items : [];
  return values.length > 0 && values.every((item) => item?.type === 'label' && !!item?.dataField);
}
