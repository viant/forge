// Table page size is a presentation preference for an already server-paged
// datasource. Apply it before mounting fetchers so the first request agrees
// with the pager; never download extra rows and slice them in the browser.
export function applyTablePagingMetadata(metadata) {
  const sizes = new Map();
  const visit = (node, inheritedRef = '') => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(child => visit(child, inheritedRef)); return; }
    const ref = node.dataSourceRef || inheritedRef;
    const size = Number(node.table?.pagination?.pageSize);
    if (ref && node.table?.pagination?.enabled !== false && Number.isSafeInteger(size) && size > 0) {
      if (sizes.has(ref) && sizes.get(ref) !== size) throw new Error(`Conflicting table page sizes for datasource ${ref}; use separate datasource references.`);
      sizes.set(ref, size);
    }
    visit(node.containers, ref);
  };
  visit(metadata?.view?.content, metadata?.view?.dataSourceRef);
  let sources = metadata?.dataSource;
  for (const [ref, size] of sizes) {
    const source = sources?.[ref];
    if (!source?.paging?.enabled || source.paging.size === size) continue;
    if (sources === metadata.dataSource) sources = {...sources};
    sources[ref] = {...source, paging: {...source.paging, size}};
  }
  return sources === metadata?.dataSource ? metadata : {...metadata, dataSource: sources};
}
