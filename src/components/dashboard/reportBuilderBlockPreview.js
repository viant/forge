import { lowerReportDocumentToReportSpec } from "../../reporting/reportDocumentModel.js";
import { buildReportFillFromReportSpec, buildReportSpecHash } from "../../reporting/reportFillModel.js";

export function buildSelectedBlockPreview({ document, reportSpec, reportFill, blockId, draft } = {}) {
    if (!blockId || !reportSpec || !reportFill) return null;
    let spec = reportSpec;
    if (draft) {
        if (!document) return null;
        const blocks = document.blocks.filter((block) => block.id !== draft.id && !["sectionBlock", "tabGroupBlock"].includes(block.kind));
        blocks.push(draft);
        spec = lowerReportDocumentToReportSpec({ ...document, blocks }, { includePrimaryBlocks: false });
    }
    const index = new Map((spec.blocks || []).map((block) => [block.id, block]));
    if (!index.has(blockId)) return null;
    const ids = new Set();
    const visit = (id) => {
        if (ids.has(id) || !index.has(id)) return;
        ids.add(id);
        const block = index.get(id);
        (block.content?.childBlockIds || block.childBlockIds || []).forEach(visit);
    };
    visit(blockId);
    const selectedSpec = { ...spec, title: "", subtitle: "", blocks: spec.blocks.filter((block) => ids.has(block.id)),
        layoutIntent: { type: "stack", blockOrder: [...ids], items: [...ids].map((id) => ({ blockId: id, span: 12 })) } };
    if (!draft) return { reportSpec: selectedSpec, reportFill: { ...reportFill, specHash: buildReportSpecHash(selectedSpec), blocks: (reportFill.blocks || []).filter((block) => ids.has(block.id)) } };
    const payloads = Object.fromEntries((reportFill.datasets || []).map((dataset) => [dataset.id, {
        rows: dataset.rows || [], hasMore: dataset.provenance?.hasMore,
        diagnostics: dataset.provenance?.diagnostics || [],
    }]));
    return { reportSpec: selectedSpec, reportFill: buildReportFillFromReportSpec(selectedSpec, payloads) };
}
