// One owner per composite child. Missing references and cyclic edges cannot
// remove otherwise-renderable content or create recursive render loops.
export function resolveReportRuntimeCompositeOwnership(blocks = []) {
  const index = new Map(blocks.map((block) => [String(block.id || '').trim(), block]));
  const parentById = new Map();
  const childrenById = new Map();
  for (const block of blocks) {
    if (block.kind !== 'compositeBlock') continue;
    const parent = String(block.id || '').trim();
    if (!parent) continue;
    const references = block.content?.childBlockIds ?? block.childBlockIds ?? [];
    for (const reference of Array.isArray(references) ? references : []) {
      const child = typeof reference === 'string' ? reference.trim() : '';
      if (!child || !index.has(child) || parentById.has(child)) continue;
      let ancestor = parent;
      while (ancestor && ancestor !== child) ancestor = parentById.get(ancestor);
      if (ancestor === child) continue;
      parentById.set(child, parent);
      childrenById.set(parent, [...(childrenById.get(parent) || []), child]);
    }
  }
  return { parentById, childrenById, childBlockIdSet: new Set(parentById.keys()) };
}
