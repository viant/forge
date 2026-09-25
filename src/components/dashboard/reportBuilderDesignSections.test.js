import assert from "node:assert/strict";
import { buildReportBuilderDesignSections, resolveDesignSectionInsertion } from "./reportBuilderDesignSections.js";
import { upsertReportBuilderDocumentBlockState } from "./reportBuilderDocumentBlocks.js";

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
