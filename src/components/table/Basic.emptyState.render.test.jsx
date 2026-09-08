import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {signal} from "@preact/signals-react";

import Basic from "./Basic.jsx";

const context = {
    dataSource: {
        filterMode: "client",
        paginationMode: "client",
        paging: {enabled: true, size: 5},
        selectionMode: "single",
    },
    signals: {
        collection: signal([]),
        control: signal({loading: false, error: null, loaded: true}),
        selection: signal({selected: null, rowIndex: -1}),
        input: signal({filter: {}, page: 1}),
        message: signal([]),
    },
    handlers: {
        dataSource: {
            getFilterSets: () => [],
            getFilterSet: () => [],
            getCollection: () => [],
            peekFilter: () => ({}),
        },
    },
    tableSettingKey: (id) => id,
};

const markup = renderToStaticMarkup(
    <Basic
        context={context}
        container={{
            id: "empty-segments",
            table: {
                emptyState: {title: "No 3rd Party Segments yet", body: "Create a segment to get started."},
                toolbar: {items: []},
            },
        }}
        columns={[{id: "id", name: "ID"}, {id: "name", name: "Name"}]}
    />,
);

assert.match(markup, /forge-table-empty-state/);
assert.match(markup, /No 3rd Party Segments yet/);
assert.doesNotMatch(markup, /empty-row|basic-table-paginationbar|<tbody/);

console.log("basic table configured empty-state render ✓");
