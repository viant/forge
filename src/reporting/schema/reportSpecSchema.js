export const reportSpecSchema = {
  $id: "report://schema/report-spec/v1",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "kind",
    "source",
    "title",
    "parameters",
    "layoutIntent",
    "refinements",
    "calculatedFields",
    "datasets",
    "blocks",
  ],
  properties: {
    version: { type: "integer", minimum: 1 },
    kind: { const: "reportSpec" },
    source: { $ref: "#/$defs/source" },
    title: { type: "string" },
    binding: { $ref: "#/$defs/binding" },
    semanticSummary: { $ref: "#/$defs/semanticSummary" },
    parameters: { $ref: "#/$defs/parameters" },
    layoutIntent: { $ref: "#/$defs/layoutIntent" },
    scope: { $ref: "#/$defs/scope" },
    drillMetadata: { $ref: "#/$defs/drillMetadata" },
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
      minItems: 1,
      items: { $ref: "#/$defs/datasetDeclaration" },
    },
    blocks: {
      type: "array",
      minItems: 1,
      items: { $ref: "#/$defs/block" },
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
    binding: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "modelRef", "entity", "selectedDimensions", "selectedMeasures"],
      properties: {
        mode: { type: "string" },
        modelRef: { type: "string" },
        entity: { type: "string" },
        selectedDimensions: { type: "array", items: { type: "string" } },
        selectedMeasures: { type: "array", items: { type: "string" } },
      },
    },
    semanticGovernance: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string" },
        certification: { type: "string" },
        ownerRef: { type: "string" },
        classification: { type: "string" },
        deprecation: { type: "string" },
      },
    },
    semanticSummaryField: {
      type: "object",
      additionalProperties: false,
      required: ["id", "label"],
      properties: {
        id: { type: "string" },
        rawId: { type: "string" },
        label: { type: "string" },
        description: { type: "string" },
        format: { type: "string" },
        category: { type: "string" },
        definitionRef: { type: "string" },
        governance: { $ref: "#/$defs/semanticGovernance" },
      },
    },
    semanticSummary: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "modelRef", "entity", "selectedDimensions", "selectedMeasures"],
      properties: {
        kind: { const: "semantic" },
        modelRef: { type: "string" },
        modelLabel: { type: "string" },
        modelDescription: { type: "string" },
        entity: { type: "string" },
        entityLabel: { type: "string" },
        entityDescription: { type: "string" },
        selectedDimensions: {
          type: "array",
          items: { $ref: "#/$defs/semanticSummaryField" },
        },
        selectedMeasures: {
          type: "array",
          items: { $ref: "#/$defs/semanticSummaryField" },
        },
        selectedParameters: {
          type: "array",
          items: { $ref: "#/$defs/semanticSummaryField" },
        },
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
    layoutIntent: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "resultPanePosition", "blockOrder"],
      properties: {
        kind: { type: "string" },
        resultPanePosition: { type: "string" },
        blockOrder: {
          type: "array",
          items: { type: "string" },
        },
        items: {
          type: "array",
          items: { $ref: "#/$defs/layoutIntentItem" },
        },
      },
    },
    layoutIntentItem: {
      type: "object",
      additionalProperties: false,
      required: ["blockId"],
      properties: {
        blockId: { type: "string" },
        size: { enum: ["half"] },
        span: { type: "integer", minimum: 1, maximum: 12 },
      },
    },
    scope: {
      type: "object",
      additionalProperties: false,
      required: ["params", "dataSourceRef"],
      properties: {
        params: {
          type: "array",
          items: { $ref: "#/$defs/scopeParam" },
        },
        dataSourceRef: { type: "string" },
      },
    },
    scopeParam: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "label", "required", "value"],
      properties: {
        id: { type: "string" },
        kind: { type: "string" },
        label: { type: "string" },
        description: { type: "string" },
        datasetRef: { type: "string" },
        required: { type: "boolean" },
        multiple: { type: "boolean" },
        presentation: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "value"],
            properties: {
              label: { type: "string" },
              value: { $ref: "#/$defs/jsonValue" },
              icon: { type: "string" },
              default: { type: "boolean" },
              description: { type: "string" },
            },
          },
        },
        value: { $ref: "#/$defs/jsonValue" },
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
    datasetDeclaration: {
      type: "object",
      additionalProperties: false,
      required: ["id", "dataSourceRef", "request"],
      properties: {
        id: { type: "string" },
        dataSourceRef: { type: "string" },
        request: { $ref: "#/$defs/requestPayload" },
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
        displayValueMap: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/jsonValue" },
        },
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
    chartBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "datasetRef", "chartSpec", "chartModel"],
      properties: {
        id: { type: "string" },
        kind: { const: "chartBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        chartSpec: { $ref: "#/$defs/chartSpec" },
        chartModel: { $ref: "#/$defs/chartModel" },
      },
    },
    geoMapBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "title", "datasetRef", "geo"],
      properties: {
        id: { type: "string" },
        kind: { const: "geoMapBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        geo: { $ref: "#/$defs/geoConfig" },
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
        sourceDataKey: { type: "string" },
        displayValueMap: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/jsonValue" },
        },
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
        sourceNameKey: { type: "string" },
        displayValueMap: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/jsonValue" },
        },
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
        sourceNameKey: { type: "string" },
        displayValueMap: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/jsonValue" },
        },
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
    tableBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "datasetRef", "columns"],
      properties: {
        id: { type: "string" },
        kind: { const: "tableBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        columns: {
          type: "array",
          items: { $ref: "#/$defs/tableColumn" },
        },
      },
    },
    kpiBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "title", "datasetRef", "valueField", "valueLabel"],
      properties: {
        id: { type: "string" },
        kind: { const: "kpiBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        valueField: { type: "string" },
        valueLabel: { type: "string" },
        secondaryField: { type: "string" },
        secondaryLabel: { type: "string" },
        secondaryDisplayKey: { type: "string" },
        secondaryDisplayValueMap: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/jsonValue" },
        },
        description: { type: "string" },
        emptyLabel: { type: "string" },
      },
    },
    filterBarBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "title", "paramIds"],
      properties: {
        id: { type: "string" },
        kind: { const: "filterBarBlock" },
        title: { type: "string" },
        datasetRef: { type: "string" },
        paramIds: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    refinementBarBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind"],
      properties: {
        id: { type: "string" },
        kind: { const: "refinementBarBlock" },
        title: { type: "string" },
        actionKinds: {
          type: "array",
          items: { type: "string" },
        },
        emptyLabel: { type: "string" },
      },
    },
    markdownBlock: {
      type: "object",
      additionalProperties: false,
      required: ["id", "kind", "title", "markdown"],
      properties: {
        id: { type: "string" },
        kind: { const: "markdownBlock" },
        title: { type: "string" },
        markdown: { type: "string" },
      },
    },
    drillHierarchy: {
      type: "object",
      additionalProperties: false,
      required: ["id", "levels"],
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        levels: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "field", "label"],
            properties: {
              id: { type: "string" },
              field: { type: "string" },
              label: { type: "string" },
            },
          },
        },
      },
    },
    detailTarget: {
      type: "object",
      additionalProperties: false,
      required: ["targetRef", "navigationMode", "parameters"],
      properties: {
        targetRef: { type: "string" },
        navigationMode: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        parameters: { type: "object" },
      },
    },
    fieldActionEntry: {
      type: "object",
      additionalProperties: false,
      required: ["fieldRef", "actions"],
      properties: {
        fieldRef: { type: "string" },
        actions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "kind"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              kind: { enum: ["keep", "exclude", "drill", "detail"] },
              nextFieldRef: { type: "string" },
              targetRef: { type: "string" },
            },
          },
        },
      },
    },
    drillMetadata: {
      type: "object",
      additionalProperties: false,
      required: ["hierarchies", "detailTargets", "fieldActions"],
      properties: {
        hierarchies: {
          type: "array",
          items: { $ref: "#/$defs/drillHierarchy" },
        },
        detailTargets: {
          type: "array",
          items: { $ref: "#/$defs/detailTarget" },
        },
        fieldActions: {
          type: "array",
          items: { $ref: "#/$defs/fieldActionEntry" },
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
