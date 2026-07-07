export const reportExportRequestSchema = {
  $id: "report://schema/report-export-request/v1",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "kind",
    "target",
    "source",
    "reportSpec",
    "reportFill",
  ],
  properties: {
    version: { type: "integer", minimum: 1 },
    kind: { const: "reportExportRequest" },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["format"],
      properties: {
        format: {
          enum: ["pdf", "csv", "xlsx", "html"],
        },
      },
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["from", "artifactKind", "artifactRef", "title"],
      properties: {
        from: {
          enum: ["draft", "savedPayload", "savedView", "publishedSnapshot"],
        },
        artifactKind: { type: "string" },
        artifactRef: { type: "string" },
        title: { type: "string" },
        reportId: { type: "string" },
        payloadId: { type: "string" },
        sourceArtifactId: { type: "string" },
        documentVersion: { type: "integer", minimum: 1 },
      },
    },
    reportSpec: { type: "object" },
    reportFill: { type: "object" },
    reportPrint: { type: "object" },
    metadata: { type: "object" },
  },
};
