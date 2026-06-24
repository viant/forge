export const reportFillSchema = {
  $id: "report://schema/report-fill/v1",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "kind",
    "specVersion",
    "specHash",
    "source",
    "parameters",
    "refinements",
    "calculatedFields",
    "datasets",
    "blocks",
    "diagnostics",
  ],
  properties: {
    version: { type: "integer", minimum: 1 },
    kind: { const: "reportFill" },
    specVersion: { type: "integer", minimum: 1 },
    specHash: { type: "string" },
    source: { $ref: "#/$defs/source" },
    parameters: { $ref: "#/$defs/parameters" },
    refinements: {
      type: "array",
      items: { $ref: "#/$defs/refinement" },
    },
    calculatedFields: {
      type: "array",
      items: { $ref: "#/$defs/calculatedField" },
    },
    datasets: {
      type: "array",
      items: { $ref: "#/$defs/datasetFill" },
    },
    blocks: {
      type: "array",
      items: { $ref: "#/$defs/block" },
    },
    diagnostics: {
      type: "array",
      items: { $ref: "#/$defs/diagnostic" },
    },
  },
  $defs: {
    source: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "containerId", "stateKey", "dataSourceRef"],
      properties: {
        kind: { type: "string" },
        containerId: { type: "string" },
        stateKey: { type: "string" },
        dataSourceRef: { type: "string" },
      },
    },
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["viewMode", "groupBy", "pageSize", "orderField", "orderDir"],
      properties: {
        viewMode: { type: "string" },
        groupBy: { type: "string" },
        pageSize: { type: "integer", minimum: 1 },
        orderField: { type: "string" },
        orderDir: { enum: ["asc", "desc"] },
      },
    },
    jsonScalar: {
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "integer" },
        { type: "boolean" },
        { type: "null" },
      ],
    },
    jsonArray: {
      type: "array",
      items: { $ref: "#/$defs/jsonValue" },
    },
    jsonObject: {
      type: "object",
      additionalProperties: { $ref: "#/$defs/jsonValue" },
    },
    jsonValue: {
      anyOf: [
        { $ref: "#/$defs/jsonScalar" },
        { $ref: "#/$defs/jsonArray" },
        { $ref: "#/$defs/jsonObject" },
      ],
    },
    refinement: {
      type: "object",
      additionalProperties: false,
      required: ["id", "op", "field", "values"],
      properties: {
        id: { type: "string" },
        op: { enum: ["keep", "exclude", "drill", "detail"] },
        field: { type: "string" },
        values: {
          type: "array",
          items: { $ref: "#/$defs/jsonValue" },
        },
        sourceBlockId: { type: "string" },
        label: { type: "string" },
        targetRef: { type: "string" },
      },
    },
    calculatedField: {
      type: "object",
      additionalProperties: false,
      required: ["id", "key", "kind", "label", "dataType", "dependencies"],
      oneOf: [
        {
          required: ["expr"],
          properties: {
            kind: { const: "rowCalc" },
          },
        },
        {
          required: ["compute"],
        },
      ],
      properties: {
        id: { type: "string" },
        key: { type: "string" },
        kind: { enum: ["rowCalc", "tableCalc"] },
        label: { type: "string" },
        dataType: { type: "string" },
        format: { type: "string" },
        datasetRef: { type: "string" },
        dependencies: {
          type: "array",
          items: { type: "string" },
        },
        expr: { type: "string" },
        compute: { $ref: "#/$defs/calculatedFieldCompute" },
      },
    },
    calculatedFieldCompute: {
      anyOf: [
        { $ref: "#/$defs/ratioCompute" },
        { $ref: "#/$defs/percentOfTotalCompute" },
        { $ref: "#/$defs/deltaFromPreviousCompute" },
        { $ref: "#/$defs/runningTotalCompute" },
        { $ref: "#/$defs/movingAverageCompute" },
        { $ref: "#/$defs/rankCompute" },
      ],
    },
    orderByItem: {
      type: "object",
      additionalProperties: false,
      required: ["field", "direction"],
      properties: {
        field: { type: "string" },
        direction: { enum: ["asc", "desc"] },
      },
    },
    ratioCompute: {
      type: "object",
      additionalProperties: false,
      required: ["type", "numerator", "denominator"],
      properties: {
        type: { const: "ratio" },
        numerator: { type: "string" },
        denominator: { type: "string" },
        scale: { type: "number" },
        decimals: { type: "integer", minimum: 0 },
      },
    },
    percentOfTotalCompute: {
      type: "object",
      additionalProperties: false,
      required: ["type", "sourceField"],
      properties: {
        type: { const: "percentOfTotal" },
        sourceField: { type: "string" },
        partitionBy: {
          type: "array",
          items: { type: "string" },
        },
        scale: { type: "number" },
        decimals: { type: "integer", minimum: 0 },
      },
    },
    deltaFromPreviousCompute: {
      type: "object",
      additionalProperties: false,
      required: ["type", "sourceField", "orderBy"],
      properties: {
        type: { const: "deltaFromPrevious" },
        sourceField: { type: "string" },
        orderBy: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/orderByItem" },
        },
        partitionBy: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    runningTotalCompute: {
      type: "object",
      additionalProperties: false,
      required: ["type", "sourceField", "orderBy"],
      properties: {
        type: { const: "runningTotal" },
        sourceField: { type: "string" },
        orderBy: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/orderByItem" },
        },
        partitionBy: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    movingAverageCompute: {
      type: "object",
      additionalProperties: false,
      required: ["type", "sourceField", "orderBy", "windowSize"],
      properties: {
        type: { const: "movingAverage" },
        sourceField: { type: "string" },
        orderBy: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/orderByItem" },
        },
        windowSize: { type: "integer", minimum: 1 },
        decimals: { type: "integer", minimum: 0 },
        partitionBy: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    rankCompute: {
      type: "object",
      additionalProperties: false,
      required: ["type", "sourceField", "orderBy", "tieMode"],
      properties: {
        type: { const: "rank" },
        sourceField: { type: "string" },
        orderBy: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/orderByItem" },
        },
        tieMode: { const: "dense" },
        partitionBy: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    diagnostic: {
      type: "object",
      additionalProperties: false,
      required: ["code", "severity", "message"],
      properties: {
        id: { type: "string" },
        code: { type: "string" },
        severity: { type: "string" },
        blockId: { type: "string" },
        path: { type: "string" },
        message: { type: "string" },
        suggestedFix: { type: "string" },
      },
    },
    provenance: {
      type: "object",
      additionalProperties: false,
      required: ["requestHash", "rowCount", "truncated", "hasMore", "diagnostics"],
      properties: {
        requestHash: { type: "string" },
        rowCount: { type: "integer", minimum: 0 },
        truncated: { type: "boolean" },
        hasMore: { type: "boolean" },
        diagnostics: {
          type: "array",
          items: { $ref: "#/$defs/diagnostic" },
        },
      },
    },
    datasetFill: {
      type: "object",
      additionalProperties: false,
      required: ["id", "dataSourceRef", "request", "provenance", "rows"],
      properties: {
        id: { type: "string" },
        dataSourceRef: { type: "string" },
        request: { $ref: "#/$defs/requestPayload" },
        provenance: { $ref: "#/$defs/provenance" },
        rows: {
          type: "array",
          items: { $ref: "#/$defs/jsonObject" },
        },
      },
    },
    requestValue: {
      $ref: "#/$defs/jsonValue",
    },
    semanticSelectionRequest: {
      type: "object",
      additionalProperties: false,
      required: ["modelRef", "entity", "selection", "refinements", "parameters"],
      properties: {
        modelRef: { type: "string" },
        entity: { type: "string" },
        selection: {
          type: "object",
          additionalProperties: false,
          required: ["dimensions", "measures"],
          properties: {
            dimensions: {
              type: "array",
              items: { type: "string" },
            },
            measures: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        refinements: {
          type: "array",
          items: { $ref: "#/$defs/refinement" },
        },
        parameters: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/requestValue" },
        },
        unmapped: {
          type: "object",
          additionalProperties: false,
          properties: {
            dimensions: {
              type: "array",
              items: { type: "string" },
            },
            measures: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
    requestPayload: {
      type: "object",
      additionalProperties: false,
      required: ["limit", "offset"],
      properties: {
        measures: {
          type: "object",
          additionalProperties: { type: "boolean" },
        },
        dimensions: {
          type: "object",
          additionalProperties: { type: "boolean" },
        },
        filters: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/requestValue" },
        },
        semanticSelection: { $ref: "#/$defs/semanticSelectionRequest" },
        refinements: {
          type: "array",
          items: { $ref: "#/$defs/refinement" },
        },
        limit: { type: "integer", minimum: 1 },
        offset: { type: "integer", minimum: 0 },
        timeoutMs: { type: "integer", minimum: 0 },
        orderBy: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    tableColumn: {
      type: "object",
      additionalProperties: false,
      required: ["key", "label"],
      properties: {
        key: { type: "string" },
        sourceKey: { type: "string" },
        displayKey: { type: "string" },
        label: { type: "string" },
        kind: { type: "string" },
        format: { type: "string" },
        align: { type: "string" },
        runtimeFilterable: { type: "boolean" },
        cellVisual: { $ref: "#/$defs/tableCellVisual" },
      },
    },
    cellVisualRange: {
      type: "object",
      additionalProperties: false,
      properties: {
        mode: { type: "string" },
        min: { type: "number" },
        max: { type: "number" },
      },
    },
    cellVisualRule: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { $ref: "#/$defs/jsonValue" },
        tone: { type: "string" },
        label: { type: "string" },
        color: { type: "string" },
        background: { type: "string" },
      },
    },
    tableCellVisual: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind"],
          properties: {
            kind: { const: "dataBar" },
            valueField: { type: "string" },
            range: { $ref: "#/$defs/cellVisualRange" },
            palette: { type: "array", items: { type: "string" } },
            nullBehavior: { type: "string" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind"],
          properties: {
            kind: { enum: ["tone", "badge"] },
            valueField: { type: "string" },
            range: { $ref: "#/$defs/cellVisualRange" },
            palette: { type: "array", items: { type: "string" } },
            nullBehavior: { type: "string" },
            rules: { type: "array", items: { $ref: "#/$defs/cellVisualRule" } },
          },
        },
      ],
    },
    geoMetric: {
      type: "object",
      additionalProperties: false,
      required: ["key", "label"],
      properties: {
        key: { type: "string" },
        selector: { type: "string" },
        label: { type: "string" },
        format: { enum: ["currency", "number", "percent", "compact"] },
      },
    },
    geoColorConfig: {
      type: "object",
      additionalProperties: false,
      properties: {
        field: { type: "string" },
        palette: {
          type: "array",
          items: { type: "string" },
        },
        empty: { type: "string" },
        rules: {
          type: "array",
          items: { $ref: "#/$defs/geoColorRule" },
        },
      },
    },
    geoColorRule: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { $ref: "#/$defs/jsonValue" },
        equals: { $ref: "#/$defs/jsonValue" },
        when: { $ref: "#/$defs/jsonValue" },
        label: { type: "string" },
        color: { type: "string" },
      },
    },
    geoConfig: {
      type: "object",
      additionalProperties: false,
      required: ["key", "metric"],
      properties: {
        shape: { enum: ["us-states", "us-state-tiles"] },
        key: { type: "string" },
        codeKey: { type: "string" },
        regionKey: { type: "string" },
        labelKey: { type: "string" },
        nameKey: { type: "string" },
        dimension: { type: "string" },
        metric: { $ref: "#/$defs/geoMetric" },
        metricKey: { type: "string" },
        valueKey: { type: "string" },
        valueLabel: { type: "string" },
        format: { enum: ["currency", "number", "percent", "compact"] },
        aggregate: { enum: ["sum", "avg", "min", "max", "first"] },
        limit: { type: "number", minimum: 1 },
        legend: { type: "boolean" },
        palette: {
          type: "array",
          items: { type: "string" },
        },
        emptyColor: { type: "string" },
        color: { $ref: "#/$defs/geoColorConfig" },
      },
    },
    resolvedTableCell: {
      type: "object",
      additionalProperties: false,
      required: ["key", "sourceKey", "displayKey", "value", "displayValue", "visualState"],
      properties: {
        key: { type: "string" },
        sourceKey: { type: "string" },
        displayKey: { type: "string" },
        value: { $ref: "#/$defs/jsonValue" },
        displayValue: { $ref: "#/$defs/jsonValue" },
        visualState: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "value", "percent", "palette"],
              properties: {
                kind: { const: "dataBar" },
                value: { type: "number" },
                percent: { type: "number" },
                palette: { type: "array" },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "tone", "label"],
              properties: {
                kind: { enum: ["badge", "tone"] },
                tone: { type: "string" },
                label: { type: "string" },
              },
            },
          ],
        },
      },
    },
    resolvedTableRow: {
      type: "object",
      additionalProperties: false,
      required: ["rowIndex", "cells"],
      properties: {
        rowIndex: { type: "integer", minimum: 0 },
        cells: {
          type: "array",
          items: { $ref: "#/$defs/resolvedTableCell" },
        },
      },
    },
    resolvedChart: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "type", "nameKey", "valueKey", "rows", "seriesKeys"],
          properties: {
            kind: { const: "category" },
            type: { type: "string" },
            nameKey: { type: "string" },
            valueKey: { type: "string" },
            rows: {
              type: "array",
              items: { $ref: "#/$defs/jsonObject" },
            },
            seriesKeys: { type: "array", items: { type: "string" } },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "type", "xAxisKey", "seriesKeys", "rows"],
          properties: {
            kind: { const: "directSeries" },
            type: { type: "string" },
            xAxisKey: { type: "string" },
            seriesKeys: { type: "array", items: { type: "string" } },
            rows: {
              type: "array",
              items: { $ref: "#/$defs/jsonObject" },
            },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "type", "xAxisKey", "nameKey", "valueKey", "rows", "seriesKeys"],
          properties: {
            kind: { const: "groupedSeries" },
            type: { type: "string" },
            xAxisKey: { type: "string" },
            nameKey: { type: "string" },
            valueKey: { type: "string" },
            rows: {
              type: "array",
              items: { $ref: "#/$defs/jsonObject" },
            },
            seriesKeys: { type: "array", items: { type: "string" } },
          },
        },
      ],
    },
    resolvedGeoRegion: {
      type: "object",
      additionalProperties: false,
      required: ["key", "label", "rawValue", "displayValue", "color", "statusColor", "statusLabel", "rowCount"],
      properties: {
        key: { type: "string" },
        label: { type: "string" },
        rawValue: { anyOf: [{ type: "null" }, { type: "number" }] },
        displayValue: { type: "string" },
        color: { type: "string" },
        statusColor: { type: "string" },
        statusLabel: { type: "string" },
        rowCount: { type: "integer", minimum: 0 },
      },
    },
    resolvedGeoLegendRules: {
      type: "object",
      additionalProperties: false,
      required: ["rules"],
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["color", "label"],
            properties: {
              color: { type: "string" },
              label: { type: "string" },
            },
          },
        },
      },
    },
    resolvedGeoLegendRange: {
      type: "object",
      additionalProperties: false,
      required: ["min", "max", "palette"],
      properties: {
        min: { type: "string" },
        max: { type: "string" },
        palette: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    resolvedGeo: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["shape", "keyField", "labelField", "metricKey", "metricLabel", "format", "aggregate", "regions", "ranking", "activeRegion", "summary", "legend"],
          properties: {
            shape: { type: "string" },
            keyField: { type: "string" },
            labelField: { type: "string" },
            metricKey: { type: "string" },
            metricLabel: { type: "string" },
            format: { type: "string" },
            aggregate: { type: "string" },
            regions: {
              type: "array",
              items: { $ref: "#/$defs/resolvedGeoRegion" },
            },
            ranking: {
              type: "array",
              items: { $ref: "#/$defs/resolvedGeoRegion" },
            },
            activeRegion: {
              anyOf: [
                { type: "null" },
                { $ref: "#/$defs/resolvedGeoRegion" },
              ],
            },
            summary: {
              type: "object",
              additionalProperties: false,
              required: ["regionCount", "totalValue", "topKey"],
              properties: {
                regionCount: { type: "integer", minimum: 0 },
                totalValue: { type: "string" },
                topKey: { type: "string" },
              },
            },
            legend: {
              anyOf: [
                { type: "null" },
                { $ref: "#/$defs/resolvedGeoLegendRules" },
                { $ref: "#/$defs/resolvedGeoLegendRange" },
              ],
            },
          },
        },
      ],
    },
    tableBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "datasetRef", "columns", "content"],
      properties: {
        id: { type: "string" },
        kind: { const: "tableBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        columns: {
          type: "array",
          items: { $ref: "#/$defs/tableColumn" },
        },
        content: {
          type: "object",
          additionalProperties: false,
          required: ["columns", "rowCount", "resolvedRows"],
          properties: {
            columns: {
              type: "array",
              items: { $ref: "#/$defs/tableColumn" },
            },
            rowCount: { type: "integer", minimum: 0 },
            resolvedRows: {
              type: "array",
              items: { $ref: "#/$defs/resolvedTableRow" },
            },
          },
        },
      },
    },
    chartBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "datasetRef", "chartSpec", "chartModel", "content"],
      properties: {
        id: { type: "string" },
        kind: { const: "chartBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        chartSpec: { $ref: "#/$defs/chartSpec" },
        chartModel: { $ref: "#/$defs/chartModel" },
        content: {
          type: "object",
          additionalProperties: false,
          required: ["chartSpec", "chartModel", "rowCount", "resolvedChart"],
          properties: {
            chartSpec: { $ref: "#/$defs/chartSpec" },
            chartModel: { $ref: "#/$defs/chartModel" },
            rowCount: { type: "integer", minimum: 0 },
            resolvedChart: { $ref: "#/$defs/resolvedChart" },
          },
        },
      },
    },
    chartSpec: {
      type: "object",
      additionalProperties: false,
      required: ["type", "xField", "yFields"],
      properties: {
        title: { type: "string" },
        eyebrow: { type: "string" },
        accentTone: { type: "string" },
        highlights: {
          type: "array",
          items: { type: "string" },
        },
        type: { type: "string" },
        xField: { type: "string" },
        yFields: {
          type: "array",
          minItems: 1,
          items: { type: "string" },
        },
        seriesField: { type: "string" },
        seriesOptions: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string" },
              axis: { enum: ["left", "right"] },
              stackId: { type: "string" },
            },
          },
        },
      },
    },
    chartAxis: {
      type: "object",
      additionalProperties: false,
      required: ["dataKey"],
      properties: {
        dataKey: { type: "string" },
        tickFormat: { type: "string" },
      },
    },
    chartYAxis: {
      type: "object",
      additionalProperties: false,
      properties: {
        format: { type: "string" },
      },
    },
    chartSeriesValue: {
      type: "object",
      additionalProperties: false,
      required: ["value", "label", "color", "type"],
      properties: {
        value: { type: "string" },
        label: { type: "string" },
        color: { type: "string" },
        format: { type: "string" },
        type: { type: "string" },
        axis: { enum: ["left", "right"] },
        stackId: { type: "string" },
      },
    },
    chartSeriesGrouped: {
      type: "object",
      additionalProperties: false,
      required: ["nameKey", "valueKey", "values", "palette"],
      properties: {
        nameKey: { type: "string" },
        valueKey: { type: "string" },
        values: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/chartSeriesValue" },
        },
        palette: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    chartSeriesDirect: {
      type: "object",
      additionalProperties: false,
      required: ["values", "palette"],
      properties: {
        values: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/chartSeriesValue" },
        },
        palette: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    chartSeriesCategory: {
      type: "object",
      additionalProperties: false,
      required: ["nameKey", "valueKey", "palette"],
      properties: {
        nameKey: { type: "string" },
        valueKey: { type: "string" },
        palette: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    chartModel: {
      type: "object",
      additionalProperties: false,
      required: ["type", "series"],
      properties: {
        type: { type: "string" },
        xAxis: { $ref: "#/$defs/chartAxis" },
        yAxis: { $ref: "#/$defs/chartYAxis" },
        series: {
          anyOf: [
            { $ref: "#/$defs/chartSeriesGrouped" },
            { $ref: "#/$defs/chartSeriesDirect" },
            { $ref: "#/$defs/chartSeriesCategory" },
          ],
        },
      },
    },
    geoMapBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "title", "datasetRef", "geo", "content"],
      properties: {
        id: { type: "string" },
        kind: { const: "geoMapBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        geo: { $ref: "#/$defs/geoConfig" },
        content: {
          type: "object",
          additionalProperties: false,
          required: ["geo", "rowCount", "resolvedGeo"],
          properties: {
            geo: { $ref: "#/$defs/geoConfig" },
            rowCount: { type: "integer", minimum: 0 },
            resolvedGeo: { $ref: "#/$defs/resolvedGeo" },
          },
        },
      },
    },
    kpiBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "title", "datasetRef", "valueField", "valueLabel", "content"],
      properties: {
        id: { type: "string" },
        kind: { const: "kpiBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        valueField: { type: "string" },
        valueLabel: { type: "string" },
        secondaryField: { type: "string" },
        secondaryLabel: { type: "string" },
        description: { type: "string" },
        emptyLabel: { type: "string" },
        content: {
          type: "object",
          additionalProperties: false,
          required: ["title", "valueField", "valueLabel", "value", "rowCount"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            valueField: { type: "string" },
            valueLabel: { type: "string" },
            value: { $ref: "#/$defs/jsonValue" },
            rowCount: { type: "integer", minimum: 0 },
            secondaryField: { type: "string" },
            secondaryLabel: { type: "string" },
            secondaryValue: { $ref: "#/$defs/jsonValue" },
            emptyLabel: { type: "string" },
          },
        },
      },
    },
    filterBarBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "content"],
      properties: {
        id: { type: "string" },
        kind: { const: "filterBarBlock" },
        title: { type: "string" },
        paramIds: {
          type: "array",
          items: { type: "string" },
        },
        content: {
          type: "object",
          additionalProperties: false,
          required: ["title", "params"],
          properties: {
            title: { type: "string" },
            params: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "value"],
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  description: { type: "string" },
                  value: {},
                },
              },
            },
          },
        },
      },
    },
    refinementBarBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "content"],
      properties: {
        id: { type: "string" },
        kind: { const: "refinementBarBlock" },
        title: { type: "string" },
        actionKinds: {
          type: "array",
          items: { type: "string" },
        },
        emptyLabel: { type: "string" },
        content: {
          type: "object",
          additionalProperties: false,
          required: ["refinements"],
          properties: {
            title: { type: "string" },
            actionKinds: {
              type: "array",
              items: { type: "string" },
            },
            emptyLabel: { type: "string" },
            refinements: {
              type: "array",
              items: { $ref: "#/$defs/refinement" },
            },
          },
        },
      },
    },
    markdownBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "content"],
      properties: {
        id: { type: "string" },
        kind: { const: "markdownBlock" },
        title: { type: "string" },
        markdown: { type: "string" },
        content: {
          type: "object",
          additionalProperties: false,
          required: ["title", "markdown"],
          properties: {
            title: { type: "string" },
            markdown: { type: "string" },
          },
        },
      },
    },
    block: {
      anyOf: [
        { $ref: "#/$defs/tableBlock" },
        { $ref: "#/$defs/chartBlock" },
        { $ref: "#/$defs/geoMapBlock" },
        { $ref: "#/$defs/kpiBlock" },
        { $ref: "#/$defs/filterBarBlock" },
        { $ref: "#/$defs/refinementBarBlock" },
        { $ref: "#/$defs/markdownBlock" },
      ],
    },
  },
};
