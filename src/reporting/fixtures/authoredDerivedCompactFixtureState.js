import { buildReportBuilderCreateReportDocumentPayload } from "../../components/dashboard/reportBuilderCreateReportDocumentPayload.js";
import { buildReportBuilderGetReportDocumentRequest } from "../../components/dashboard/reportBuilderGetReportDocumentRequest.js";
import {
  buildReportBuilderGetReportDocumentResponse,
  buildReportBuilderListReportDocumentsResponse,
} from "../../components/dashboard/reportBuilderReportDocumentReadResponse.js";
import { buildReportBuilderUpdateReportDocumentPayload } from "../../components/dashboard/reportBuilderUpdateReportDocumentPayload.js";
import { buildAuthoredDerivedCompactSavedReportRecord } from "./authoredDerivedCompactSavedReportRecordBuilder.js";

function findPrimaryBuilderBlock(record = null) {
  return record?.savedReportPayload?.reportDocument?.blocks
    ?.find((block) => block?.id === "primaryBuilder" && block?.kind === "reportBuilderBlock") || null;
}

export function buildAuthoredDerivedCompactFixtureState() {
  const record = buildAuthoredDerivedCompactSavedReportRecord();
  const documentVersion = record?.documentVersion || 0;
  const savedAt = record?.savedAt || 0;
  const savedReportPayload = record?.savedReportPayload || null;
  const exportRequest = record?.exportRequest || null;
  const reportFill = exportRequest?.reportFill || null;
  const reportPrint = exportRequest?.reportPrint || null;
  const listReportDocumentsResponse = buildReportBuilderListReportDocumentsResponse(savedReportPayload, {
    documentVersion,
    savedAt,
  });

  return {
    record,
    savedReportRecord: record,
    exportRequest,
    pdfExportRequest: exportRequest,
    reportPrint,
    pdfReportPrint: reportPrint,
    reportFill,
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
