import test from "node:test";
import assert from "node:assert/strict";
import {dispatchReportBuilderDatasourceRequest, reportBuilderRequestMatchesExecutedScope,
    reportBuilderCursorNavigationFingerprint, shouldFetchReportBuilderRequest, reportBuilderDispatchFingerprint, matchesReportBuilderDatasourceDispatch} from "./reportBuilderDatasourceDispatch.js";
import {buildReportBuilderRequest, buildReportBuilderDefaultState} from "./reportBuilderUtils.js";
import {createCursorPagingSession} from "../../hooks/paging.js";
import {createTransportConnector} from "../../hooks/connectorTransport.js";
const paging = {enabled: true, mode: "cursor", size: 1, parameters: {page: "resumeToken", size: "batchSize"}};
const config = {dimensions: [{id: "channel", field: "channel", default: true}],
    measures: [{id: "spend", field: "spend", default: true}], request: {autoFetch: false}};
const state = buildReportBuilderDefaultState(config);
const request = page => buildReportBuilderRequest(config, {...state, page});
function context() {
    let value = {filter: {term: "original"}, untouched: "kept"};
    return {dataSource: {paging}, signals: {input: {peek: () => value, get value() {return value;}, set value(next) {value = next;}}}};
}
test("actual ReportBuilder dispatch drives existing datasource cursor connector through Next, end and Back", async () => {
    const ctx = context(), session = createCursorPagingSession(), calls = [];
    const connector = createTransportConnector({id: "rows", paging}, {transport: async ({options}) => {
        calls.push(options.inputParameters);
        const cursor = options.inputParameters.resumeToken;
        const index = cursor === "after-alpha" ? 1 : cursor === "after-beta" ? 2 : 0;
        return {rows: [{id: ["alpha", "beta", "gamma"][index]}], hasMore: index < 2,
            nextCursor: index === 0 ? "after-alpha" : index === 1 ? "after-beta" : undefined};
    }});
    for (const [page, expected] of [[1, "alpha"], [2, "beta"], [3, "gamma"], [2, "beta"]]) {
        dispatchReportBuilderDatasourceRequest(ctx, request(page), true, page);
        const input = ctx.signals.input.peek();
        assert.equal(input.page, page);
        assert.equal(input.untouched, "kept");
        const cursor = session.begin(input.page, {parameters: input.parameters, filter: input.filter, parent: "original", target: "phone"});
        const result = await connector.get({page: cursor.page, cursor: cursor.cursor, inputParameters: input.parameters});
        const info = session.finish(cursor, result);
        assert.equal(result.rows[0].id, expected);
        if (page === 3) assert.equal(info.hasNext, false);
    }
    assert.equal(calls[1].resumeToken, "after-alpha");
    assert.equal(calls[2].resumeToken, "after-beta");
    assert.equal(calls[3].resumeToken, "after-alpha");
});
test("explicit cursor navigation can fetch with autoFetch false, while a changed query requires Run", () => {
    const ctx = context(), executed = JSON.stringify(request(1)), next = request(2);
    assert.equal(reportBuilderRequestMatchesExecutedScope(next, executed, paging), true);
    const navigation = reportBuilderCursorNavigationFingerprint({paging, request: next, executedFingerprint: executed, blocked: false});
    assert.equal(shouldFetchReportBuilderRequest({autoFetch: false, canRun: true, blocked: false,
        fingerprint: JSON.stringify(next), navigationFingerprint: navigation}), true);
    assert.equal(shouldFetchReportBuilderRequest({autoFetch: false, canRun: true, blocked: false,
        fingerprint: JSON.stringify({...next, filter: {new: "query"}}), navigationFingerprint: navigation}), false);
    assert.equal(reportBuilderCursorNavigationFingerprint({paging, request: {...next, sort: "changed"}, executedFingerprint: executed}), "");
    assert.equal(reportBuilderCursorNavigationFingerprint({paging, request: next, executedFingerprint: executed, blocked: true}), "");
    dispatchReportBuilderDatasourceRequest(ctx, next, false, 2);
    assert.equal(ctx.signals.input.peek().fetch, false);
});
test("offset dispatch and exact executed-scope comparison remain unchanged", () => {
    const ctx = context();ctx.dataSource.paging = {enabled: true, mode: "offset"};
    const next = request(2);
    dispatchReportBuilderDatasourceRequest(ctx, next, true, 2);
    assert.deepEqual(ctx.signals.input.peek().parameters, next);
    assert.equal(reportBuilderRequestMatchesExecutedScope(next, JSON.stringify(request(1)), ctx.dataSource.paging), false);
});
test("ReportBuilder dispatch preserves non-paging arguments and generic cursor association resets", () => {
    for (const kind of ["query", "filter", "sort", "parent", "target"]) {
        const ctx = context(), session = createCursorPagingSession();
        const original = {...request(1), businessArgs: {account: "owned", opaque: "unchanged"}};
        dispatchReportBuilderDatasourceRequest(ctx, original, true);
        const association = {parameters: ctx.signals.input.peek().parameters, filter: {term: "original"},
            sort: ["id"], parent: {uri: "window://owned/one", contentFingerprint: "original"}, target: {formFactor: "phone"}};
        const first = session.begin(1, association);
        session.finish(first, {hasMore: true, nextCursor: "owned-original-token"});
        const next = {...original, offset: 50};
        if (kind === "query") next.businessArgs = {...next.businessArgs, query: "changed"};
        dispatchReportBuilderDatasourceRequest(ctx, next, true, 2);
        const changed = {...association, parameters: ctx.signals.input.peek().parameters};
        if (kind === "filter") changed.filter = {term: "changed"};
        if (kind === "sort") changed.sort = ["spend"];
        if (kind === "parent") changed.parent = {...association.parent, contentFingerprint: "new-source"};
        if (kind === "target") changed.target = {formFactor: "tablet"};
        const reset = session.begin(ctx.signals.input.peek().page, changed);
        assert.equal(reset.page, 1, kind);
        assert.equal(reset.cursor, undefined, kind);
        assert.deepEqual(original.businessArgs, {account: "owned", opaque: "unchanged"});
        assert.equal(original.offset, 0);
    }
});
test("cursor fallback handlers receive the page without altering filters, while blocked requests do not fetch", () => {
    const calls = [], context = {dataSource: {paging}, handlers: {dataSource: {
        setInputParameters: value => calls.push(["parameters", value]), fetchCollection: value => calls.push(["fetch", value]),
    }}};
    dispatchReportBuilderDatasourceRequest(context, {...request(2), filter: {term: "literal"}}, true, 2);
    assert.deepEqual(calls[1], ["fetch", {page: 2}]);
    assert.deepEqual(calls[0][1].filter, {term: "literal"});
    dispatchReportBuilderDatasourceRequest(context, request(3), false);
    assert.equal(calls.length, 3);
});

test("authored offset override cannot force cursor navigation back to page one", () => {
    const ctx = context();
    const original = buildReportBuilderRequest({...config, request: {...config.request, offset: 0}}, {...state, page: 2});
    assert.equal(original.offset, 0);
    dispatchReportBuilderDatasourceRequest(ctx, original, true, 2);
    assert.equal(ctx.signals.input.peek().page, 2);
    assert.equal(matchesReportBuilderDatasourceDispatch({fingerprint: "same::fetch", previousFingerprint: "same::fetch",
        paging, page: 2, previousPage: 1}), false);
    assert.equal(reportBuilderDispatchFingerprint(JSON.stringify(original), true), `${JSON.stringify(original)}::fetch`);
    assert.equal(reportBuilderDispatchFingerprint("original", true, {mode: "offset", enabled: true}, 2), "original::fetch");
});
