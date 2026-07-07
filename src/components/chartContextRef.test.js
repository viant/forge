import assert from "node:assert/strict";

import {
    normalizeSelectorLookupKey,
    resolveChartDataSourceRef,
} from "./chartContextRef.js";

assert.equal(normalizeSelectorLookupKey(null), null);
assert.equal(normalizeSelectorLookupKey("forecast"), "forecast");
assert.equal(normalizeSelectorLookupKey(["forecast", "backup"]), "forecast");
assert.equal(normalizeSelectorLookupKey({ value: "forecast" }), "forecast");
assert.equal(normalizeSelectorLookupKey({ id: "forecast" }), "forecast");
assert.equal(normalizeSelectorLookupKey({ key: "forecast" }), "forecast");

const baseContext = {
    identity: {
        dataSourceRef: "defaultSource",
    },
    signals: {
        windowForm: {
            value: {
                reportWindow: {
                    activeRef: "forecasting",
                },
            },
        },
        form: {
            value: {
                activeRef: "formSource",
            },
        },
        input: {
            value: {
                selected: {
                    ref: "inputSource",
                },
            },
        },
    },
    handlers: {
        dataSource: {
            peekFilter() {
                return {
                    activeRef: "filterSource",
                };
            },
        },
    },
};

assert.equal(resolveChartDataSourceRef(baseContext, {}), "defaultSource");
assert.equal(resolveChartDataSourceRef(baseContext, { dataSourceRef: "explicitSource" }), "explicitSource");

assert.equal(resolveChartDataSourceRef(baseContext, {
    dataSourceRefSelector: "reportWindow.activeRef",
    dataSourceRefs: {
        forecasting: "forecastingSource",
    },
}), "forecastingSource");

assert.equal(resolveChartDataSourceRef(baseContext, {
    dataSourceRefSelector: "activeRef",
    dataSourceRefSource: "form",
    dataSourceRefs: {
        formSource: "formMappedSource",
    },
}), "formMappedSource");

assert.equal(resolveChartDataSourceRef(baseContext, {
    dataSourceRefSelector: "selected.ref",
    dataSourceRefSource: "input",
    dataSourceRefs: {
        inputSource: "inputMappedSource",
    },
}), "inputMappedSource");

assert.equal(resolveChartDataSourceRef(baseContext, {
    dataSourceRefSelector: "activeRef",
    dataSourceRefSource: "filters",
    dataSourceRefs: {
        filterSource: "filterMappedSource",
    },
}), "filterMappedSource");

assert.equal(resolveChartDataSourceRef(baseContext, {
    dataSourceRefSelector: "missing.ref",
    dataSourceRefs: {
        forecasting: "forecastingSource",
    },
}), "defaultSource");

console.log("chartContextRef ✓ resolves chart datasource refs and selector lookup keys deterministically");
