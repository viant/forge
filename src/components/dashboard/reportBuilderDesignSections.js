import { buildRuntimeSections } from "./reportSections.js";

// Use runtime ordering, while retaining otherwise hidden blocks for editing.
export function buildReportBuilderDesignSections(blocks = [], entries = []) {
    const group = blocks.find((block) => block.kind === "tabGroupBlock");
    if (!group) return { group: null, tabs: [{ id: "__main__", label: "Main", sectionId: "", entries }] };
    const index = new Map(blocks.map((block) => [block.id, block]));
    const children = (block) => block?.childBlockIds || block?.content?.childBlockIds || [];
    const childIds = new Set(blocks.flatMap(children));
    const sections = buildRuntimeSections(blocks, childIds);
    const tabs = sections.map((section) => {
        const ids = new Set(section.block ? [section.id] : []);
        const visit = (id) => {
            if (ids.has(id)) return;
            ids.add(id);
            children(index.get(id)).forEach(visit);
        };
        section.items.forEach((block) => visit(block.id));
        return { id: section.id, label: section.navigationLabel, sectionId: section.block?.id || "",
            entries: entries.filter((entry) => ids.has(entry.id)) };
    });
    const assigned = new Set(tabs.flatMap((tab) => tab.entries.map((entry) => entry.id)));
    const remaining = entries.filter((entry) => entry.id !== group.id && !assigned.has(entry.id));
    if (remaining.length) tabs.push({ id: "__other_blocks__", label: "Other blocks", sectionId: "", entries: remaining });
    return { group, tabs };
}

export function resolveDesignSectionInsertion(section, selectedId, placement = "after") {
    if (!section?.sectionId) return null;
    const selected = section.entries.find((entry) => entry.id === selectedId);
    const anchor = selected || section.entries.find((entry) => entry.id === section.sectionId);
    return { insertionAfterId: anchor?.id || section.sectionId,
        insertionPlacement: anchor?.id === section.sectionId ? "after" : placement,
        sectionId: section.sectionId };
}
