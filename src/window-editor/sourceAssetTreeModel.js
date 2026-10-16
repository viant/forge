// Paths are identities, never normalized or rewritten for display.
export function sourceAssetNodes(paths) {
  const roots = [], folders = new Map();
  for (const path of [...new Set(paths)].sort()) {
    const parts = path.split('/');
    let children = roots;
    for (let index = 0; index < parts.length; index++) {
      const key = parts.slice(0, index + 1).join('/');
      if (index === parts.length - 1) children.push({id: `file:${path}`, path, name: parts[index], kind: 'file'});
      else {
        if (!folders.has(key)) {
          const folder = {id: `folder:${key}`, path: key, name: parts[index], kind: 'folder', children: []};
          folders.set(key, folder); children.push(folder);
        }
        children = folders.get(key).children;
      }
    }
  }
  const sort = nodes => nodes.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1)).map(node => node.kind === 'folder' ? {...node, children: sort(node.children)} : node);
  return sort(roots);
}
export function sourceAssetAncestors(path) {
  return path ? path.split('/').slice(0, -1).map((_, index) => `folder:${path.split('/').slice(0, index + 1).join('/')}`) : [];
}
export function visibleSourceAssets(nodes, expanded, parentId = null, level = 1) {
  return nodes.flatMap((node, index) => [{...node, parentId, level, posInSet: index + 1, setSize: nodes.length}, ...(node.kind === 'folder' && expanded.has(node.id) ? visibleSourceAssets(node.children, expanded, node.id, level + 1) : [])]);
}
export function sourceAssetKey(key, focused, rows, expanded) {
  const index = rows.findIndex(row => row.id === focused);
  const node = rows[index];
  if (!node) return null;
  const next = new Set(expanded);
  let focus = focused, selected;
  if (key === 'ArrowDown') focus = rows[Math.min(index + 1, rows.length - 1)].id;
  else if (key === 'ArrowUp') focus = rows[Math.max(index - 1, 0)].id;
  else if (key === 'Home') focus = rows[0].id;
  else if (key === 'End') focus = rows.at(-1).id;
  else if (key === 'ArrowRight') {
    if (node.kind === 'folder' && !next.has(node.id)) next.add(node.id);
    else if (node.kind === 'folder' && rows[index + 1]?.parentId === node.id) focus = rows[index + 1].id;
  } else if (key === 'ArrowLeft') {
    if (node.kind === 'folder' && next.has(node.id)) next.delete(node.id);
    else focus = node.parentId || focused;
  } else if (key === 'Enter' || key === ' ') {
    if (node.kind === 'file') selected = node.path;
    else if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
  } else return null;
  return {focus, expanded: next, selected};
}
