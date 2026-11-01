const normalizeString = (value) => String(value || "").trim();

export function buildRuntimeSections(blocks = [], hiddenBlockIds = new Set()) {
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  const explicitTabGroup = normalizedBlocks.find((block) => normalizeString(block?.kind) === "tabGroupBlock") || null;
  const explicitSectionIds = Array.isArray(explicitTabGroup?.content?.sectionIds)
    ? explicitTabGroup.content.sectionIds.map((sectionId) => normalizeString(sectionId)).filter(Boolean)
    : (Array.isArray(explicitTabGroup?.sectionIds) ? explicitTabGroup.sectionIds.map((sectionId) => normalizeString(sectionId)).filter(Boolean) : []);
  const includeUnlistedSections = explicitTabGroup?.content?.includeUnlistedSections
    ?? explicitTabGroup?.includeUnlistedSections
    ?? true;
  const sections = [];
  let current = null;
  normalizedBlocks.forEach((block, index) => {
    const kind = normalizeString(block?.kind);
    if (kind === "tabGroupBlock") {
      return;
    }
    if (hiddenBlockIds.has(normalizeString(block?.id))) {
      return;
    }
    if (kind === "sectionBlock") {
      const ownedBlockIds = (Array.isArray(block?.content?.blockIds)
        ? block.content.blockIds
        : (Array.isArray(block?.blockIds) ? block.blockIds : []))
        .map((ownedBlockId) => normalizeString(ownedBlockId))
        .filter(Boolean);
      current = {
        id: normalizeString(block?.id || `section_${index + 1}`) || `section_${index + 1}`,
        title: normalizeString(block?.title || block?.content?.title || `Section ${sections.length + 1}`) || `Section ${sections.length + 1}`,
        navigationLabel: normalizeString(block?.content?.navigationLabel || block?.navigationLabel || block?.title || `Section ${sections.length + 1}`) || `Section ${sections.length + 1}`,
        block,
        items: [],
        ownedBlockIds,
      };
      sections.push(current);
      return;
    }
    if (!current) {
      current = {
        id: "overview",
        title: "Overview",
        navigationLabel: "Overview",
        block: null,
        items: [],
        ownedBlockIds: [],
      };
      sections.push(current);
    }
    if (includeUnlistedSections === false && current.ownedBlockIds.length > 0 && !current.ownedBlockIds.includes(normalizeString(block?.id))) {
      return;
    }
    current.items.push(block);
  });
  if (includeUnlistedSections === false) {
    for (const section of sections) {
      if (!section.ownedBlockIds.length) continue;
      const owned = new Set(section.ownedBlockIds);
      // Layout order controls placement inside a section; declared membership
      // controls ownership even when a block precedes its heading in that order.
      section.items = normalizedBlocks.filter(block => owned.has(normalizeString(block?.id))
        && !hiddenBlockIds.has(normalizeString(block?.id))
        && normalizeString(block?.kind) !== 'sectionBlock'
        && normalizeString(block?.kind) !== 'tabGroupBlock');
    }
  }
  const filteredSections = sections.filter((section) => section.block || section.items.length > 0);
  if (explicitSectionIds.length === 0) {
    return filteredSections;
  }
  const sectionById = new Map(filteredSections.map((section) => [normalizeString(section?.id), section]));
  const orderedSections = explicitSectionIds
    .map((sectionId) => sectionById.get(sectionId) || null)
    .filter(Boolean);
  const trailingSections = filteredSections.filter((section) => !explicitSectionIds.includes(normalizeString(section?.id)));
  return includeUnlistedSections === false ? orderedSections : [...orderedSections, ...trailingSections];
}

// Filter bars share section ownership with content. Unowned bars remain global;
// exclusive tab groups use declared membership rather than layout position.
// Legacy nonexclusive bars retain global toolbar placement.
export function resolveRuntimeSectionFilterBars(blocks = [], activeSectionId = "", {
  tabbed = true,
  visibleSectionIds,
} = {}) {
  const sections = buildRuntimeSections(blocks);
  const tabGroup = blocks.find(block => normalizeString(block?.kind) === "tabGroupBlock");
  const exclusive = (tabGroup?.content?.includeUnlistedSections ?? tabGroup?.includeUnlistedSections) === false;
  const owners = new Map();
  const indexed = new Map(blocks.map(block => [normalizeString(block?.id), block]));
  const addOwner = (blockId, sectionId) => {
    if (!owners.has(blockId)) owners.set(blockId, new Set());
    owners.get(blockId).add(sectionId);
  };
  if (exclusive) {
    // Include owners omitted from the visible navigation, so their controls do
    // not become global merely because that section is hidden/unlisted.
    for (const section of blocks.filter(block => normalizeString(block?.kind) === "sectionBlock")) {
      const visited = new Set();
      const visit = id => {
        id = normalizeString(id);
        if (visited.has(id)) return;
        visited.add(id);
        addOwner(id, normalizeString(section.id));
        const child = indexed.get(id);
        for (const childId of [...(child?.content?.blockIds ?? child?.blockIds ?? []),
          ...(child?.content?.childBlockIds ?? child?.childBlockIds ?? [])]) visit(childId);
      };
      for (const id of section.content?.blockIds ?? section.blockIds ?? []) visit(id);
    }
  }
  const visible = visibleSectionIds ?? new Set(sections.map(section => section.id));
  return blocks.filter(block => {
    if (normalizeString(block?.kind) !== "filterBarBlock") return false;
    const ownedBy = owners.get(normalizeString(block.id));
    return !ownedBy || [...ownedBy].some(id => visible.has(id) && (!tabbed || id === activeSectionId));
  });
}
