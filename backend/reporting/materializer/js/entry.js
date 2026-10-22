// Envelope adapter restored from the previously embedded implementation.
// All report lowering and rendering algorithms are imported from canonical Forge.
import "./intl-global.js";
import "@formatjs/intl-getcanonicallocales/polyfill-force.js";
import "@formatjs/intl-locale/polyfill-force.js";
import "@formatjs/intl-pluralrules/polyfill-force.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-numberformat/polyfill-force.js";
import "@formatjs/intl-numberformat/locale-data/en.js";
import "@formatjs/intl-datetimeformat/polyfill-force.js";
import "@formatjs/intl-datetimeformat/locale-data/en.js";
import "@formatjs/intl-datetimeformat/add-all-tz.js";
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from "../../../../src/reporting/reportDocumentModel.js";
import {buildReportFillFromReportSpec} from "../../../../src/reporting/reportFillModel.js";
import {buildReportPrintFromReportFill} from "../../../../src/reporting/reportPrintModel.js";
  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function mergeObject(base, patch) {
    const result = isObject(base) ? clone(base) : {};
    if (!isObject(patch)) return result;
    Object.keys(patch).forEach((key) => {
      if (isObject(result[key]) && isObject(patch[key])) {
        result[key] = mergeObject(result[key], patch[key]);
      } else {
        result[key] = clone(patch[key]);
      }
    });
    return result;
  }
  function normalizeDataSources(dataSources) {
    if (dataSources == null) return [];
    if (!isObject(dataSources)) throw new Error("Report envelope dataSources must be an object map.");
    return Object.keys(dataSources).sort().map((id) => {
      const descriptor = dataSources[id];
      if (!isObject(descriptor)) throw new Error(`Report datasource '${id}' must be a trusted descriptor object.`);
      return Object.assign({}, clone(descriptor), {
        id,
        dataSourceRef: String(descriptor.dataSourceRef || descriptor.value || id)
      });
    });
  }
  function authoredReportDocument(envelope) {
    var _a5;
    if (!isObject(envelope) || envelope.schemaVersion !== 1 || envelope.format !== "forge.authoredReport") {
      throw new Error("Expected a schema version 1 forge.authoredReport envelope.");
    }
    const sourceDocument = envelope.reportDocument;
    const builderDefinition = envelope.builderDefinition;
    const builder = isObject(builderDefinition) ? builderDefinition.reportBuilder : null;
    if (!isObject(sourceDocument) || !isObject(builder)) {
      throw new Error("Authored reports require a report document and complete reportBuilder definition.");
    }
    const config = clone(builder);
    delete config.document;
    delete config.reportDocument;
    delete config.state;
    const sources = normalizeDataSources(envelope.dataSources);
    if (sources.length > 0 && (!Array.isArray(config.dataSources) || config.dataSources.length === 0)) config.dataSources = sources;
    const sourceBlock = (Array.isArray(sourceDocument.blocks) ? sourceDocument.blocks : []).find((block) => (block == null ? void 0 : block.kind) === "reportBuilderBlock") || null;
    const source = isObject(sourceBlock == null ? void 0 : sourceBlock.source) ? sourceBlock.source : {};
    const containerId = String(source.containerId || source.stateKey || sourceDocument.id || envelope.builderRef || "authoredReport");
    const container = {
      id: containerId,
      stateKey: String(source.stateKey || containerId),
      title: String(sourceDocument.title || (sourceBlock == null ? void 0 : sourceBlock.title) || config.title || "Report"),
      dataSourceRef: String(source.dataSourceRef || ((_a5 = sourceDocument.scope) == null ? void 0 : _a5.dataSourceRef) || config.dataSourceRef || builderDefinition.dataSourceRef || "")
    };
    const authoredBlocks = (Array.isArray(sourceDocument.blocks) ? sourceDocument.blocks : []).filter((block) => (block == null ? void 0 : block.kind) !== "reportBuilderBlock").map((block) => clone(block));
    const generated = buildReportBuilderReportDocument({
      container,
      config,
      state: isObject(envelope.state) ? clone(envelope.state) : {},
      additionalBlocks: authoredBlocks,
      refinements: Array.isArray(sourceDocument.refinements) ? sourceDocument.refinements : [],
      semanticSummary: isObject(sourceDocument.semanticSummary) ? sourceDocument.semanticSummary : null
    });
    const generatedBlock = generated.blocks.find((block) => (block == null ? void 0 : block.kind) === "reportBuilderBlock");
    const finalDocument = mergeObject(generated, sourceDocument);
    const sourceBlocks = Array.isArray(sourceDocument.blocks) ? sourceDocument.blocks : [];
    let inserted = false;
    finalDocument.blocks = sourceBlocks.map((block) => {
      if ((block == null ? void 0 : block.kind) !== "reportBuilderBlock") return clone(block);
      inserted = true;
      return clone(generatedBlock);
    });
    if (!inserted) finalDocument.blocks.push(clone(generatedBlock));
    return finalDocument;
  }
  export function lower(envelopeJSON) {
    if (typeof envelopeJSON !== "string") throw new Error("Authored report input must be JSON text.");
    const envelope = JSON.parse(envelopeJSON);
    const document = authoredReportDocument(envelope);
    return JSON.stringify(lowerReportDocumentToReportSpec(document));
  }
  export function materialize(inputJSON) {
    const input = JSON.parse(inputJSON);
    if (!isObject(input.reportSpec) || input.reportSpec.kind !== "reportSpec" || !isObject(input.datasets)) throw new Error("Trusted reportSpec and executed datasets required.");
    const reportFill = buildReportFillFromReportSpec(input.reportSpec, input.datasets);
    const reportPrint = buildReportPrintFromReportFill({ reportSpec: input.reportSpec, reportFill });
    if (!reportPrint) throw new Error("Trusted report print materialization failed.");
    return JSON.stringify({ reportFill, reportPrint });
  }

globalThis.ForgeAuthoredLowerer = {lower, materialize};
