import assert from "node:assert/strict";

import {
    buildReportBuilderReportDocument,
    lowerReportDocumentToReportSpec,
} from "../../reporting/reportDocumentModel.js";
import {
    buildBlankReportBuilderDocumentState,
    instantiateReportBuilderDocumentTemplate,
    normalizeReportBuilderDocumentTemplate,
    normalizeReportBuilderDocumentTemplates,
} from "./reportBuilderDocumentTemplates.js";

const config = {
    title: "Report Builder Demo",
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["available_impressions"],
    },
    measures: [
        { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
    dimensions: [
        { id: "eventDate", key: "eventDate", label: "Date", default: true, chartAxis: true, format: "date" },
        { id: "channelV2", key: "channelV2", label: "Channel", default: true },
        { id: "country", key: "country", label: "Country" },
    ],
    staticFilters: [
        { id: "dateRange", label: "Date Range", type: "dateRange", required: true, default: { start: "2026-05-01", end: "2026-05-04" } },
        {
            id: "channelsFilter",
            label: "Channels",
            multiple: true,
            options: [
                { label: "Display", value: "Display" },
                { label: "CTV", value: "CTV" },
            ],
        },
    ],
    dynamicFilterGroups: [
        {
            id: "scope",
            filters: [
                {
                    id: "advertiserIds",
                    label: "Advertiser",
                    multiple: true,
                    emitArray: true,
                    manualValueType: "int",
                    valueSelector: "advertiserId",
                    labelSelector: "advertiserName",
                },
            ],
        },
    ],
    result: {
        chartCreationMode: "explicit",
        defaultMode: "table",
        viewModes: ["table", "chart"],
        supportedChartTypes: ["line", "horizontal_bar"],
        orderFields: [
            { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            { value: "avails", field: "avails", defaultDirection: "desc" },
        ],
        pageSize: 50,
    },
};

const template = normalizeReportBuilderDocumentTemplate({
    id: "market_brief",
    label: "Market Brief",
    description: "Seeds a market-first authored report.",
    statePatch: {
        selectedDimensions: ["country"],
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        viewMode: "table",
        orderField: "avails",
        orderDir: "desc",
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-02",
            },
            channelsFilter: ["Display"],
        },
        localCalculatedFields: [
            {
                id: "reachRate",
                key: "reachRate",
                kind: "rowCalc",
                label: "Reach Rate",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["hhUniqs", "avails"],
                expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
            },
        ],
    },
    documentPatch: {
        title: "Market Brief",
        subtitle: "Q2 Coverage",
        description: "Template-seeded authored market brief.",
        blocks: [
            {
                id: "scopeFilters",
                kind: "filterBarBlock",
                title: "Scope",
                paramIds: ["dateRange", "channelsFilter"],
            },
            {
                id: "narrativeIntro",
                kind: "markdownBlock",
                title: "Executive Summary",
                markdown: "## Executive Summary\nTemplate-authored narrative.",
            },
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "reachRate",
                valueLabel: "Reach Rate",
                secondaryField: "country",
                secondaryLabel: "Country",
            },
        ],
        layout: {
            type: "stack",
            items: [
                { blockId: "scopeFilters" },
                { blockId: "primaryBuilder" },
                { blockId: "narrativeIntro", size: "half" },
                { blockId: "headlineKpi", size: "half" },
            ],
        },
    },
});

assert.deepEqual(template, {
    id: "market_brief",
    label: "Market Brief",
    description: "Seeds a market-first authored report.",
    statePatch: {
        selectedDimensions: ["country"],
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        viewMode: "table",
        orderField: "avails",
        orderDir: "desc",
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-02",
            },
            channelsFilter: ["Display"],
        },
        localCalculatedFields: [
            {
                id: "reachRate",
                key: "reachRate",
                kind: "rowCalc",
                label: "Reach Rate",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["hhUniqs", "avails"],
                expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
            },
        ],
    },
    documentPatch: {
        title: "Market Brief",
        subtitle: "Q2 Coverage",
        description: "Template-seeded authored market brief.",
        blocks: [
            {
                id: "scopeFilters",
                kind: "filterBarBlock",
                title: "Scope",
                paramIds: ["dateRange", "channelsFilter"],
            },
            {
                id: "narrativeIntro",
                kind: "markdownBlock",
                title: "Executive Summary",
                markdown: "## Executive Summary\nTemplate-authored narrative.",
            },
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "reachRate",
                valueLabel: "Reach Rate",
                secondaryField: "country",
                secondaryLabel: "Country",
            },
        ],
        layout: {
            type: "stack",
            items: [
                { blockId: "scopeFilters" },
                { blockId: "primaryBuilder" },
                { blockId: "narrativeIntro", size: "half" },
                { blockId: "headlineKpi", size: "half" },
            ],
        },
    },
});

assert.deepEqual(
    normalizeReportBuilderDocumentTemplates([
        template,
        { ...template, label: "Duplicate label" },
        null,
    ]).map((entry) => entry.id),
    ["market_brief"],
);

const instantiated = instantiateReportBuilderDocumentTemplate(config, template);
assert.equal(instantiated.valid, true);
assert.equal(instantiated.nextState.reportDocumentTitle, "Market Brief");
assert.equal(instantiated.nextState.reportDocumentSubtitle, "Q2 Coverage");
assert.equal(instantiated.nextState.reportDocumentDescription, "Template-seeded authored market brief.");
assert.equal(instantiated.nextState.reportDocumentTemplateId, "market_brief");
assert.equal(instantiated.nextState.reportDocumentTemplateLabel, "Market Brief");
assert.deepEqual(instantiated.nextState.selectedDimensions, ["country"]);
assert.deepEqual(instantiated.nextState.selectedMeasures, ["avails"]);
assert.equal(instantiated.nextState.localCalculatedFields[0].id, "reachRate");
assert.deepEqual(instantiated.nextState.scopeParams, {
    dateRange: {
        start: "2026-05-01",
        end: "2026-05-02",
    },
    channelsFilter: ["Display"],
});
assert.deepEqual(instantiated.nextState.reportDocumentLayout, {
    type: "stack",
    items: [
        { blockId: "scopeFilters" },
        { blockId: "primaryBuilder" },
        { blockId: "narrativeIntro", size: "half" },
        { blockId: "headlineKpi", size: "half" },
    ],
});

const instantiatedWithPrefillPreserved = instantiateReportBuilderDocumentTemplate(config, template, {
    baseState: {
        scopeParams: {
            dateRange: {
                start: "2026-07-01",
                end: "2026-07-05",
            },
            channelsFilter: ["CTV"],
        },
        dynamicGroups: {
            scope: [
                {
                    id: "prefill_advertiser",
                    filterId: "advertiserIds",
                    selections: [
                        {
                            value: 8123,
                            label: "Acme Media",
                            group: "",
                            record: {
                                advertiserId: 8123,
                                advertiserName: "Acme Media",
                            },
                        },
                    ],
                },
            ],
        },
    },
    preserveInputState: true,
});
assert.equal(instantiatedWithPrefillPreserved.valid, true);
assert.deepEqual(instantiatedWithPrefillPreserved.nextState.scopeParams, {
    dateRange: {
        start: "2026-07-01",
        end: "2026-07-05",
    },
    channelsFilter: ["CTV"],
});
assert.deepEqual(instantiatedWithPrefillPreserved.nextState.dynamicGroups.scope, [
    {
        id: "prefill_advertiser",
        filterId: "advertiserIds",
        enabled: true,
        selections: [
            {
                value: 8123,
                label: "Acme Media",
                group: "",
                record: {
                    advertiserId: 8123,
                    advertiserName: "Acme Media",
                },
            },
        ],
    },
]);
assert.deepEqual(instantiatedWithPrefillPreserved.nextState.selectedDimensions, ["country"]);
assert.deepEqual(instantiatedWithPrefillPreserved.nextState.selectedMeasures, ["avails"]);
assert.equal(instantiatedWithPrefillPreserved.nextState.reportDocumentTemplateId, "market_brief");

const blankState = buildBlankReportBuilderDocumentState(config, {
    baseState: {
        selectedDimensions: ["country"],
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        scopeParams: {
            dateRange: {
                start: "2026-07-01",
                end: "2026-07-05",
            },
            channelsFilter: ["CTV"],
        },
        dynamicGroups: {
            scope: [
                {
                    id: "prefill_advertiser",
                    filterId: "advertiserIds",
                    selections: [
                        {
                            value: 8123,
                            label: "Acme Media",
                            group: "",
                            record: {
                                advertiserId: 8123,
                                advertiserName: "Acme Media",
                            },
                        },
                    ],
                },
            ],
        },
        reportDocumentTitle: "Existing Report",
        reportDocumentSubtitle: "Existing Subtitle",
        reportDocumentDescription: "Existing Description",
        reportDocumentBlocks: [
            {
                id: "narrativeIntro",
                kind: "markdownBlock",
                title: "Narrative",
                markdown: "## Narrative",
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [{ blockId: "primaryBuilder" }, { blockId: "narrativeIntro" }],
        },
        reportDocumentTemplateId: "market_brief",
        reportDocumentTemplateLabel: "Market Brief",
    },
});
assert.equal(Object.prototype.hasOwnProperty.call(blankState, "reportDocumentTitle"), false);
assert.equal(Object.prototype.hasOwnProperty.call(blankState, "reportDocumentSubtitle"), false);
assert.equal(Object.prototype.hasOwnProperty.call(blankState, "reportDocumentDescription"), false);
assert.equal(Object.prototype.hasOwnProperty.call(blankState, "reportDocumentBlocks"), false);
assert.equal(Object.prototype.hasOwnProperty.call(blankState, "reportDocumentLayout"), false);
assert.equal(Object.prototype.hasOwnProperty.call(blankState, "reportDocumentTemplateId"), false);
assert.equal(Object.prototype.hasOwnProperty.call(blankState, "reportDocumentTemplateLabel"), false);
assert.deepEqual(blankState.scopeParams, {
    dateRange: {
        start: "2026-07-01",
        end: "2026-07-05",
    },
    channelsFilter: ["CTV"],
});
assert.deepEqual(blankState.dynamicGroups.scope, [
    {
        id: "prefill_advertiser",
        filterId: "advertiserIds",
        enabled: true,
        selections: [
            {
                value: 8123,
                label: "Acme Media",
                group: "",
                record: {
                    advertiserId: 8123,
                    advertiserName: "Acme Media",
                },
            },
        ],
    },
]);
assert.deepEqual(blankState.selectedDimensions, ["country"]);
assert.deepEqual(blankState.selectedMeasures, ["avails"]);

const blankStateWithInvalidRequiredFilter = buildBlankReportBuilderDocumentState(config, {
    baseState: {
        selectedDimensions: ["country"],
        selectedMeasures: ["avails"],
        scopeParams: {
            dateRange: {
                start: "",
                end: "2026-07-05",
            },
            channelsFilter: ["CTV"],
        },
    },
});
assert.deepEqual(blankStateWithInvalidRequiredFilter.scopeParams, {
    dateRange: {
        start: "2026-05-01",
        end: "2026-05-04",
    },
    channelsFilter: ["CTV"],
});

const document = buildReportBuilderReportDocument({
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config,
    state: instantiated.nextState,
});
assert.equal(document.title, "Market Brief");
assert.equal(document.subtitle, "Q2 Coverage");
assert.equal(document.description, "Template-seeded authored market brief.");
const loweredSpec = lowerReportDocumentToReportSpec(document);
assert.equal(loweredSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(loweredSpec.datasets[0].request.measures.avails, true);
assert.equal(loweredSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(loweredSpec.datasets[0].request.measures.reachRate, undefined);
assert.equal(loweredSpec.blocks.find((block) => block.id === "headlineKpi")?.valueField, "reachRate");

const invalidTemplate = instantiateReportBuilderDocumentTemplate(config, {
    id: "invalid_template",
    label: "Invalid Template",
    statePatch: {
        selectedDimensions: ["missingDimension"],
        selectedMeasures: ["missingMeasure"],
    },
});
assert.equal(invalidTemplate.valid, false);
assert.equal(invalidTemplate.validation.valid, false);
assert.deepEqual(
    invalidTemplate.diagnostics.map((entry) => entry.code),
    ["templateDimensionUnavailable", "templateMeasureUnavailable"],
);

console.log("reportBuilderDocumentTemplates ✓ normalizes and instantiates generic report-document templates");
