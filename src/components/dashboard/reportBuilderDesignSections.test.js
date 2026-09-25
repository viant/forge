import assert from "node:assert/strict";
import { buildReportBuilderDesignSections, resolveDesignSectionInsertion } from "./reportBuilderDesignSections.js";
import { upsertReportBuilderDocumentBlockState, addReportBuilderTabState, removeReportBuilderTabState } from "./reportBuilderDocumentBlocks.js";

const blocks = [
    { id: "tabs", kind: "tabGroupBlock", sectionIds: ["summary", "details"], defaultSectionId: "summary", includeUnlistedSections: false },
    { id: "summary", kind: "sectionBlock", title: "Summary", blockIds: ["metrics"] },
    { id: "metrics", kind: "compositeBlock", childBlockIds: ["cost"] },
    { id: "details", kind: "sectionBlock", title: "Details" },
    { id: "text", kind: "markdownBlock", title: "Detail text", markdown: "Details" },
    { id: "cost", kind: "kpiBlock", title: "Cost", valueField: "cost" },
];
const entries = blocks.map((block) => ({ ...block, children: [] }));
const model = buildReportBuilderDesignSections(blocks, entries);
assert.deepEqual(model.tabs.map((tab) => tab.id), ["summary", "details"]);
assert.deepEqual(model.tabs[0].entries.map((entry) => entry.id), ["summary", "metrics", "cost"]);
assert.deepEqual(model.tabs[1].entries.map((entry) => entry.id), ["details", "text"]);
assert.deepEqual(resolveDesignSectionInsertion(model.tabs[0], "tabs", "before"), {
    insertionAfterId: "summary", insertionPlacement: "after", sectionId: "summary",
});
const untabbed = buildReportBuilderDesignSections(blocks.slice(1), entries);
assert.equal(untabbed.group, null);
assert.equal(untabbed.tabs[0].label, "Main");
assert.deepEqual(untabbed.tabs[0].entries, entries);
assert.equal(resolveDesignSectionInsertion(untabbed.tabs[0], "text"), null);
assert.deepEqual(buildReportBuilderDesignSections().tabs[0].entries, []);

for (const anchor of ["summary", "cost"]) {
    const result = upsertReportBuilderDocumentBlockState({ reportDocumentBlocks: blocks }, {
        id: "new", kind: "markdownBlock", title: "New summary", markdown: "Summary text",
    }, { sectionId: "summary", insertionAfterId: anchor });
    assert.equal(result.valid, true);
    const next = result.nextState.reportDocumentBlocks;
    assert.ok(next.findIndex((block) => block.id === "new") < next.findIndex((block) => block.id === "details"));
    assert.ok(next.find((block) => block.id === "summary").blockIds.includes("new"));
    const reopened = buildReportBuilderDesignSections(next, next);
    assert.ok(reopened.tabs[0].entries.some((entry) => entry.id === "new"));
    assert.ok(!reopened.tabs[1].entries.some((entry) => entry.id === "new"));
}
console.log("reportBuilderDesignSections ✓ tab ownership, composite children, scoped insertion and reopen");

const initial = { reportDocumentBlocks: [{ id: 'intro', kind: 'markdownBlock', title: 'Intro', markdown: 'Keep me' }],
    reportDocumentLayout: { type: 'grid', items: [{ blockId: 'intro', span: 6 }] }, reportStaticDatasets: [{ id: 'source' }] };
const added = addReportBuilderTabState(initial, 'Deals');
const addedBlocks = added.nextState.reportDocumentBlocks;
const addedTabs = buildReportBuilderDesignSections(addedBlocks, addedBlocks).tabs;
assert.deepEqual(addedTabs.map((tab) => tab.label), ['Main', 'Deals']);
assert.ok(addedTabs[0].entries.some((block) => block.id === 'intro'));
assert.equal(addedTabs[1].sectionId, added.sectionId);
assert.equal(added.nextState.reportDocumentLayout.items.find((item) => item.blockId === 'intro').span, 6);
assert.equal(initial.reportDocumentBlocks.length, 1);
const removedEmpty = removeReportBuilderTabState(added.nextState, added.sectionId);
assert.equal(removedEmpty.removedCount, 0);
assert.equal(buildReportBuilderDesignSections(removedEmpty.nextState.reportDocumentBlocks, removedEmpty.nextState.reportDocumentBlocks).tabs.length, 1);
const mainSectionId = addedTabs[0].sectionId;
const removedLast = removeReportBuilderTabState(removedEmpty.nextState, mainSectionId);
assert.equal(removedLast.nextState.reportDocumentBlocks, undefined);
assert.deepEqual(removedLast.nextState.reportStaticDatasets, initial.reportStaticDatasets);
assert.equal(buildReportBuilderDesignSections().tabs[0].label, 'Main');
const removedMain = removeReportBuilderTabState(initial, '__main__');
assert.equal(removedMain.removedCount, 1);
assert.equal(removedMain.nextState.reportDocumentBlocks, undefined);

const cascade = removeReportBuilderTabState({ reportDocumentBlocks: blocks, reportDocumentLayout: { items: blocks.map((block) => ({ blockId: block.id })) } }, 'summary');
assert.equal(cascade.removedCount, 2);
assert.deepEqual(cascade.nextState.reportDocumentBlocks.map((block) => block.id), ['tabs', 'details', 'text']);
assert.deepEqual(cascade.nextState.reportDocumentBlocks[0].sectionIds, ['details']);
assert.equal(cascade.nextState.reportDocumentBlocks[0].defaultSectionId, 'details');
assert.ok(!cascade.nextState.reportDocumentLayout.items.some((item) => ['summary', 'metrics', 'cost'].includes(item.blockId)));
const sharedBlocks = [...blocks.slice(0, 5), { id: 'sharedMetrics', kind: 'compositeBlock', childBlockIds: ['cost'] }, blocks[5]];
const shared = removeReportBuilderTabState({ reportDocumentBlocks: sharedBlocks }, 'summary');
assert.ok(shared.nextState.reportDocumentBlocks.some((block) => block.id === 'cost'));
assert.equal(shared.removedCount, 1);
console.log('reportBuilderDesignSections ✓ add tab, preserve Main, cascade removal, shared children and last-tab cleanup');

const { renameReportBuilderTabState, reorderReportBuilderTabState, transferReportBuilderBlockState } = await import('./reportBuilderDocumentBlocks.js');
const { captureDesignDocument, restoreDesignDocument, designDocumentsEqual } = await import('./reportBuilderDesignHistory.js');
const original = { reportDocumentBlocks: blocks, reportDocumentLayout: { items: blocks.map((block) => ({ blockId: block.id, span: 6 })) }, scopeParams: { advertiser: 12 } };
const renamed = renameReportBuilderTabState(original, 'summary', 'Executive summary');
assert.equal(renamed.reportDocumentBlocks.find((block) => block.id === 'summary').navigationLabel, 'Executive summary');
const reordered = reorderReportBuilderTabState(original, 'summary', 'details');
assert.deepEqual(buildReportBuilderDesignSections(reordered.reportDocumentBlocks, reordered.reportDocumentBlocks).tabs.map((tab) => tab.id), ['details', 'summary']);
assert.deepEqual(reordered.reportDocumentBlocks.map((block) => block.id), blocks.map((block) => block.id));
const moved = transferReportBuilderBlockState(original, 'metrics', 'details');
assert.equal(moved.valid, true);
const movedTabs = buildReportBuilderDesignSections(moved.nextState.reportDocumentBlocks, moved.nextState.reportDocumentBlocks).tabs;
assert.ok(!movedTabs[0].entries.some((block) => block.id === 'metrics' || block.id === 'cost'));
assert.ok(movedTabs[1].entries.some((block) => block.id === 'cost'));
const copy = transferReportBuilderBlockState(original, 'metrics', 'details', { duplicate: true });
const copiedRoot = copy.nextState.reportDocumentBlocks.find((block) => block.id === copy.blockId);
assert.notEqual(copiedRoot.childBlockIds[0], 'cost');
assert.ok(copy.nextState.reportDocumentBlocks.some((block) => block.id === copiedRoot.childBlockIds[0]));
assert.equal(copy.nextState.reportDocumentLayout.items.find((item) => item.blockId === copy.blockId).span, 6);
assert.deepEqual(copy.nextState.reportDocumentBlocks.find((block) => block.id === 'metrics').childBlockIds, ['cost']);
const detach = transferReportBuilderBlockState(original, 'cost', 'details');
assert.deepEqual(detach.nextState.reportDocumentBlocks.find((block) => block.id === 'metrics').childBlockIds, []);
const snapshot = captureDesignDocument(original);
const undone = restoreDesignDocument({ ...moved.nextState, scopeParams: { advertiser: 99 } }, snapshot);
assert.ok(designDocumentsEqual(undone, original));
assert.deepEqual(undone.scopeParams, { advertiser: 99 });
assert.deepEqual(original.reportDocumentBlocks, blocks);
console.log('reportBuilderDesignSections ✓ rename/reorder, nested move/copy, layout preservation and document-only undo');
