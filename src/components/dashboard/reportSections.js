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

