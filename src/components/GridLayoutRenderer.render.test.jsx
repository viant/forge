import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Section} from '@blueprintjs/core';

import GridLayoutRenderer from './GridLayoutRenderer.jsx';
import AccessibleSection from './AccessibleSection.jsx';
import Container from './Container.jsx';
import {sectionAppearanceAttributes, sectionContentInsetAttributes} from './containerChrome.js';
import {registerWidget} from '../runtime/widgetRegistry.jsx';

function MultilineValue({id}) {
    return (
        <span id={id} data-alignment-fixture="multiline-value">
            <span>First strategy line</span>
            <br />
            <span>Second strategy line</span>
        </span>
    );
}

registerWidget('multiline-alignment-fixture', MultilineValue);

const html = renderToStaticMarkup(
    <GridLayoutRenderer
        context={{}}
        container={{layout: {kind: 'grid', columns: 1, labels: {mode: 'left'}}}}
        items={[{
            id: 'strategy',
            label: 'Strategy',
            scope: 'noop',
            widget: 'multiline-alignment-fixture',
        }]}
    />,
);

const container = html.match(/^<div\b[^>]*>/)?.[0];
const label = html.match(/<label\b[^>]*data-forge-part="label"[^>]*>/)?.[0];
const control = html.match(/<div\b[^>]*class="[^"]*forge-grid-control-cell[^"]*"[^>]*>/)?.[0];

assert.ok(container, html);
assert.ok(label, html);
assert.ok(control, html);
assert.match(container, /data-forge-label-mode="left"/);
assert.match(container, /data-forge-label-alignment="baseline"/);
assert.match(container, /data-forge-part="grid"/);
assert.doesNotMatch(container, /data-forge-layout-appearance=/);
assert.match(container, /align-items:baseline/);
assert.match(label, /align-items:baseline/);
assert.match(control, /align-items:baseline/);
assert.match(html, /data-alignment-fixture="multiline-value"/);
assert.match(html, /First strategy line<\/span><br\/><span>Second strategy line/);
assert.ok(html.indexOf('Strategy') < html.indexOf('First strategy line'), html);

const fieldTracksHtml = renderToStaticMarkup(
    <GridLayoutRenderer
        context={{}}
        container={{
            layout: {
                kind: 'grid',
                appearance: 'field-tracks',
                columns: 2,
                labels: {mode: 'top', align: 'start'},
                collapseAt: 'phone',
            },
        }}
        items={[
            {id: 'firstName', label: 'First name'},
            {id: 'lastName', label: 'Last name'},
        ]}
        controlWrapperMode="control-only"
        renderControl={({sourceItem}) => <input id={sourceItem.id} />}
    />,
);

assert.match(fieldTracksHtml, /^<div\b[^>]*data-forge-part="grid"/);
assert.match(fieldTracksHtml, /class="forge-grid-collapse-phone"/);
assert.equal((fieldTracksHtml.match(/data-forge-part="label"/g) || []).length, 2);
assert.equal((fieldTracksHtml.match(/data-forge-part="control"/g) || []).length, 2);
assert.equal((fieldTracksHtml.match(/data-forge-field-id="firstName"/g) || []).length, 2);
assert.match(fieldTracksHtml, /<label[^>]*for="firstName"[^>]*data-forge-field-id="firstName"/);
assert.match(fieldTracksHtml, /<input id="firstName"/);
assert.doesNotMatch(fieldTracksHtml, /data-forge-layout-appearance="field-tracks"/);

const dividedSectionsHtml = renderToStaticMarkup(
    <GridLayoutRenderer
        context={{}}
        container={{layout: {kind: 'grid', appearance: ' DIVIDED-SECTIONS ', columns: 2, labels: {mode: 'none'}}}}
        entries={[
            {id: 'first', section: {appearance: 'quiet'}},
            {id: 'second', section: {appearance: 'quiet'}},
        ]}
        renderEntry={({entry, css, layoutItemProps}) => (
            <section {...layoutItemProps} data-entry-id={entry.id} style={css.ctrl}>{entry.id}</section>
        )}
    />,
);

assert.match(dividedSectionsHtml, /^<div\b[^>]*data-forge-part="grid"/);
assert.match(dividedSectionsHtml, /^<div\b[^>]*data-forge-layout-appearance="divided-sections"/);
assert.equal((dividedSectionsHtml.match(/data-forge-part="grid-item"/g) || []).length, 2);
assert.equal((dividedSectionsHtml.match(/data-forge-grid-item-section-appearance="quiet"/g) || []).length, 2);
assert.ok(dividedSectionsHtml.indexOf('data-entry-id="first"') < dividedSectionsHtml.indexOf('data-entry-id="second"'));

const defaultSectionHtml = renderToStaticMarkup(
    <Section data-forge-part="container-section" title="Default section">Body</Section>,
);
assert.doesNotMatch(defaultSectionHtml, /data-forge-section-appearance=/);

const primarySectionHtml = renderToStaticMarkup(
    <Section
        {...sectionAppearanceAttributes({appearance: ' PRIMARY '})}
        {...sectionContentInsetAttributes({contentInset: ' FLUSH '})}
        data-forge-part="container-section"
        title="Primary section"
    >
        Body
    </Section>,
);
assert.match(primarySectionHtml, /data-forge-section-appearance="primary"/);
assert.match(primarySectionHtml, /data-forge-section-content-inset="flush"/);

const quietSectionHtml = renderToStaticMarkup(
    <AccessibleSection
        {...sectionAppearanceAttributes({appearance: 'quiet'})}
        collapsible
        collapseProps={{defaultIsOpen: true}}
        data-forge-part="container-section"
        title="Quiet section"
    >
        Body
    </AccessibleSection>,
);
assert.match(quietSectionHtml, /data-forge-section-appearance="quiet"/);
assert.match(quietSectionHtml, /aria-expanded="true"/);

const signal = (value) => ({value, peek: () => value});
const integrationContext = {
    identity: {dataSourceRef: 'fixture'},
    signals: {message: signal([])},
    handlers: {dataSource: {}},
    Context() {
        return this;
    },
    lookupHandler: () => () => true,
};
const integrationItem = (id) => ({
    id,
    label: id,
    scope: 'noop',
    widget: 'multiline-alignment-fixture',
});
const containerIntegrationHtml = renderToStaticMarkup(
    <Container
        context={integrationContext}
        isActive
        sizingMode="content"
        container={{
            id: 'surface-contract-root',
            title: 'Surface contract root',
            section: {appearance: ' PRIMARY ', contentInset: ' FLUSH '},
            layout: {
                kind: 'grid',
                appearance: ' DIVIDED-SECTIONS ',
                columns: 3,
                labels: {mode: 'none'},
            },
            containers: [
                {
                    id: 'valid-child',
                    title: 'Valid child',
                    section: {appearance: ' QUIET ', contentInset: 'flush'},
                    items: [integrationItem('valid-child-value')],
                },
                {
                    id: 'invalid-child',
                    title: 'Invalid child',
                    section: {
                        appearance: 'card',
                        contentInset: 'compact',
                        properties: {className: 'invalid-section-fixture'},
                    },
                    items: [integrationItem('invalid-child-value')],
                },
                {
                    id: 'default-child',
                    title: 'Default child',
                    section: {properties: {className: 'default-section-fixture'}},
                    items: [integrationItem('default-child-value')],
                },
            ],
        }}
    />,
);

assert.match(containerIntegrationHtml, /data-forge-section-appearance="primary"/);
assert.match(containerIntegrationHtml, /data-forge-section-content-inset="flush"/);
assert.match(containerIntegrationHtml, /data-forge-layout-appearance="divided-sections"/);
assert.equal((containerIntegrationHtml.match(/data-forge-part="grid-item"/g) || []).length, 3);
assert.equal((containerIntegrationHtml.match(/data-forge-grid-item-section-appearance="quiet"/g) || []).length, 1);
assert.match(containerIntegrationHtml, /data-forge-section-appearance="quiet"/);
assert.equal((containerIntegrationHtml.match(/data-forge-section-content-inset="flush"/g) || []).length, 2);

const invalidSectionTag = containerIntegrationHtml.match(
    /<div\b[^>]*class="[^"]*invalid-section-fixture[^"]*"[^>]*>/,
)?.[0];
const defaultSectionTag = containerIntegrationHtml.match(
    /<div\b[^>]*class="[^"]*default-section-fixture[^"]*"[^>]*>/,
)?.[0];
assert.ok(invalidSectionTag, containerIntegrationHtml);
assert.ok(defaultSectionTag, containerIntegrationHtml);
assert.doesNotMatch(invalidSectionTag, /data-forge-section-(?:appearance|content-inset)=/);
assert.doesNotMatch(defaultSectionTag, /data-forge-section-(?:appearance|content-inset)=/);

console.log('grid and Section hierarchy render contracts passed');
