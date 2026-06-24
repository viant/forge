import { buildCapacityKpiBlendByDateLandscapeSavedReportRecord } from "./capacityPreviewSavedReportRecordBuilder.js";
import {
  buildReportBuilderGetReportDocumentResponse,
  buildReportBuilderListReportDocumentsResponse,
} from "../../components/dashboard/reportBuilderReportDocumentReadResponse.js";
import { buildReportBuilderCreateReportDocumentPayload } from "../../components/dashboard/reportBuilderCreateReportDocumentPayload.js";
import { buildReportBuilderGetReportDocumentRequest } from "../../components/dashboard/reportBuilderGetReportDocumentRequest.js";
import { buildReportBuilderUpdateReportDocumentPayload } from "../../components/dashboard/reportBuilderUpdateReportDocumentPayload.js";

function findPrimaryBuilderBlock(record = null) {
  return record?.savedReportPayload?.reportDocument?.blocks
    ?.find((block) => block?.id === "primaryBuilder" && block?.kind === "reportBuilderBlock") || null;
}

export function buildCapacityDirectSeriesFixtureState() {
  const record = buildCapacityKpiBlendByDateLandscapeSavedReportRecord();
  const documentVersion = record?.documentVersion || 0;
  const savedAt = record?.savedAt || 0;
  const savedReportPayload = record.savedReportPayload;
  const listReportDocumentsResponse = buildReportBuilderListReportDocumentsResponse(savedReportPayload, {
    documentVersion,
    savedAt,
  });
  return {
    record,
    savedReportRecord: record,
    exportRequest: record.exportRequest,
    pdfExportRequest: record.exportRequest,
    reportPrint: record.reportPrint,
    pdfReportPrint: record.reportPrint,
    reportFill: record.reportFill,
    savedReportPayload,
    documentVersion,
    savedAt,
    getReportDocumentResponse: buildReportBuilderGetReportDocumentResponse(savedReportPayload, {
      documentVersion,
      savedAt,
    }),
    listReportDocumentsResponse,
    createReportDocumentPayload: buildReportBuilderCreateReportDocumentPayload(savedReportPayload, {
      createdAt: savedAt + 1,
    }),
    getReportDocumentRequest: buildReportBuilderGetReportDocumentRequest(listReportDocumentsResponse, {
      entryReportId: savedReportPayload?.reportDocument?.id || "",
    }),
    updateReportDocumentPayload: buildReportBuilderUpdateReportDocumentPayload(savedReportPayload, {
      expectedVersion: documentVersion,
      updatedAt: savedAt + 2,
    }),
    primaryBuilderBlock: findPrimaryBuilderBlock(record),
  };
}
