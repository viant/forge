import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import '../packs/blueprint/index.jsx';
import LookupSelectionInput from '../components/lookup/LookupSelectionInput.jsx';
import {getWidget} from '../runtime/widgetRegistry.jsx';
import SchemaBasedForm from './SchemaBasedForm.jsx';

function elementTag(html, tagName, id) {
    const tag = html.match(new RegExp(`<${tagName}\\b[^>]*id="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `Missing <${tagName}> with id="${id}" in ${html}`);
    return tag;
}

function assertAttribute(tag, name, value) {
    assert.match(tag, new RegExp(`${name}="${value}"`));
}

const fields = [
    {
        id: 'advertiserId',
        name: 'advertiserId',
        label: 'Advertiser',
        widget: 'lookup',
        required: true,
        lookup: {
            dialogId: 'advertiserLookup',
            display: '${advertiserName}',
        },
    },
    {
        id: 'objective',
        name: 'objective',
        label: 'Objective',
        widget: 'select',
        required: true,
        options: [
            {value: 'awareness', label: 'Awareness'},
            {value: 'engagement', label: 'Engagement'},
        ],
        helperText: 'Choose one campaign objective.',
    },
    {
        id: 'totalBudget',
        name: 'totalBudget',
        label: 'Total budget',
        widget: 'number',
        required: true,
        helperText: 'Enter the planned spend.',
    },
    {
        id: 'flight',
        name: 'flight',
        label: 'Flight dates',
        widget: 'dateRange',
        required: true,
        helperText: 'Choose campaign start and end dates.',
    },
    {
        id: 'adultOnly',
        name: 'adultOnly',
        label: 'Adult only',
        widget: 'booleanPill',
        required: true,
        helperText: 'Restrict delivery to adults.',
    },
    {
        id: 'productURL',
        name: 'productURL',
        label: 'Product URL',
        widget: 'text',
        helperText: 'Optional landing page.',
    },
];

const fieldTracksHtml = renderToStaticMarkup(
    <SchemaBasedForm
        id="campaign-form"
        fields={fields}
        data={{
            advertiserId: 42,
            advertiserName: 'Fender',
            objective: 'awareness',
            totalBudget: 1000000,
            flight: {start: '2026-10-01', end: '2026-12-31'},
            adultOnly: false,
            productURL: 'https://www.fender.com',
        }}
        layout={{
            kind: 'grid',
            appearance: 'field-tracks',
            columns: 2,
            labels: {mode: 'top', align: 'start'},
            collapseAt: 'phone',
        }}
        showSubmit={false}
    />,
);

assert.match(fieldTracksHtml, /^<form\b[^>]*id="campaign-form"/);
assert.match(fieldTracksHtml, /^<form\b[^>]*data-forge-part="form"/);
assert.match(fieldTracksHtml, /^<form\b[^>]*data-forge-form-appearance="field-tracks"/);
assert.match(fieldTracksHtml, /data-forge-part="grid"/);
assert.match(fieldTracksHtml, /class="forge-grid-collapse-phone"/);
assert.match(fieldTracksHtml, /grid-template-columns:repeat\(2, 1fr\)/);
assert.equal((fieldTracksHtml.match(/data-forge-part="label"/g) || []).length, 6);
assert.equal((fieldTracksHtml.match(/data-forge-part="control"/g) || []).length, 6);
assert.equal((fieldTracksHtml.match(/data-forge-field-id="advertiserId"/g) || []).length, 2);
assert.match(fieldTracksHtml, /<label[^>]*id="advertiserId-label"[^>]*for="advertiserId"[^>]*data-forge-field-id="advertiserId"/);
const advertiserTag = elementTag(fieldTracksHtml, 'button', 'advertiserId');
assert.match(advertiserTag, /class="[^"]*forge-lookup-selection-input__trigger/);
assertAttribute(advertiserTag, 'aria-label', 'Advertiser');
assertAttribute(advertiserTag, 'aria-labelledby', 'advertiserId-label');
assertAttribute(advertiserTag, 'aria-required', 'true');
assertAttribute(advertiserTag, 'aria-haspopup', 'dialog');
assertAttribute(advertiserTag, 'data-forge-widget', 'lookup');
assertAttribute(advertiserTag, 'data-forge-control-id', 'advertiserId');
assertAttribute(advertiserTag, 'data-forge-part', 'input');
assertAttribute(advertiserTag, 'data-forge-field-track-control', 'true');
assert.match(fieldTracksHtml, /<span class="[^"]*\bbp6-button-text\b[^"]*">Fender<\/span>/);
assert.doesNotMatch(fieldTracksHtml, /<input[^>]*id="advertiserId"/);
assert.doesNotMatch(fieldTracksHtml, /forge-lookup-selection-input__end-button/);

for (const id of ['objective', 'totalBudget', 'flight', 'adultOnly', 'productURL']) {
    assert.match(fieldTracksHtml, new RegExp(`<label[^>]*id="${id}-label"[^>]*for="${id}"`));
    assert.match(fieldTracksHtml, new RegExp(`id="${id}"`));
}
const objectiveTag = elementTag(fieldTracksHtml, 'button', 'objective');
assertAttribute(objectiveTag, 'aria-labelledby', 'objective-label');
assert.match(objectiveTag, /aria-describedby="[^"]+"/);
assertAttribute(objectiveTag, 'aria-required', 'true');

const budgetTag = elementTag(fieldTracksHtml, 'input', 'totalBudget');
assertAttribute(budgetTag, 'aria-labelledby', 'totalBudget-label');
assert.match(budgetTag, /aria-describedby="[^"]+"/);
assertAttribute(budgetTag, 'aria-required', 'true');
assertAttribute(budgetTag, 'value', '1000000');

const flightGroupTag = elementTag(fieldTracksHtml, 'div', 'flight-group');
assertAttribute(flightGroupTag, 'role', 'group');
assertAttribute(flightGroupTag, 'aria-labelledby', 'flight-label');
assert.match(flightGroupTag, /aria-describedby="[^"]+"/);
assertAttribute(flightGroupTag, 'aria-required', 'true');

const flightStartTag = elementTag(fieldTracksHtml, 'input', 'flight');
assertAttribute(flightStartTag, 'aria-label', 'Start date');
assert.match(flightStartTag, /aria-describedby="[^"]+"/);
assertAttribute(flightStartTag, 'aria-required', 'true');
const flightEndTag = elementTag(fieldTracksHtml, 'input', 'flight-end');
assertAttribute(flightEndTag, 'aria-label', 'End date');
assert.match(flightEndTag, /aria-describedby="[^"]+"/);
assertAttribute(flightEndTag, 'aria-required', 'true');

const adultOnlyTag = elementTag(fieldTracksHtml, 'button', 'adultOnly');
assertAttribute(adultOnlyTag, 'role', 'switch');
assertAttribute(adultOnlyTag, 'aria-labelledby', 'adultOnly-label');
assert.match(adultOnlyTag, /aria-describedby="[^"]+"/);
assertAttribute(adultOnlyTag, 'aria-required', 'true');

const productURLTag = elementTag(fieldTracksHtml, 'input', 'productURL');
assertAttribute(productURLTag, 'aria-labelledby', 'productURL-label');
assert.match(productURLTag, /aria-describedby="[^"]+"/);
assertAttribute(productURLTag, 'value', 'https:\/\/www.fender.com');
assert.equal((fieldTracksHtml.match(/data-forge-part="helper-text"/g) || []).length, 5);
assert.match(fieldTracksHtml, /Choose one campaign objective\./);
assert.match(fieldTracksHtml, /value="2026-10-01"/);
assert.match(fieldTracksHtml, /value="2026-12-31"/);
assert.ok(fieldTracksHtml.indexOf('Advertiser') < fieldTracksHtml.indexOf('Objective'), fieldTracksHtml);
assert.ok(fieldTracksHtml.indexOf('Objective') < fieldTracksHtml.indexOf('Total budget'), fieldTracksHtml);

const scopedValues = {objective: 'awareness'};
const emptyContext = {
    identity: {dataSourceRef: 'empty'},
    signals: {form: {value: {}, peek: () => ({})}},
    handlers: {dataSource: {getFormData: () => ({})}},
    Context() {
        return this;
    },
};
const scopedContext = {
    identity: {dataSourceRef: 'editDraft'},
    signals: {
        form: {value: scopedValues, peek: () => scopedValues},
        formStatus: {peek: () => ({dirty: false})},
    },
    handlers: {
        dataSource: {
            getFormData: () => scopedValues,
            setFormField: () => {},
        },
    },
    Context(ref) {
        return ref === 'editDraft' ? this : emptyContext;
    },
};
const rootContext = {
    identity: {dataSourceRef: 'root'},
    Context(ref) {
        return ref === 'editDraft' ? scopedContext : emptyContext;
    },
};
const scopedFormHtml = renderToStaticMarkup(
    <SchemaBasedForm
        fields={[{id: 'objective', name: 'objective', label: 'Objective', widget: 'text'}]}
        context={rootContext}
        dataSourceRef="editDraft"
        layout={{kind: 'grid', appearance: 'field-tracks', columns: 1, labels: {mode: 'top'}}}
        showSubmit={false}
    />,
);
assert.match(scopedFormHtml, /<input[^>]*id="objective"[^>]*value="awareness"/);
assert.doesNotMatch(scopedFormHtml, /value=""/);

const erroredLookupHtml = renderToStaticMarkup(
    <SchemaBasedForm
        fields={[{
            ...fields[0],
            validationError: 'Choose an advertiser.',
        }]}
        layout={{kind: 'grid', appearance: 'field-tracks', columns: 1, labels: {mode: 'top'}}}
        showSubmit={false}
    />,
);
assert.match(erroredLookupHtml, /<button[^>]*id="advertiserId"[^>]*aria-describedby="[^"]+"/);
assert.match(erroredLookupHtml, /<button[^>]*aria-invalid="true"/);
assert.match(erroredLookupHtml, /class="forge-lookup-selection-input is-invalid"/);
assert.match(erroredLookupHtml, /data-forge-part="validation-message"/);
assert.match(erroredLookupHtml, /role="alert">Choose an advertiser\.<\/div>/);

const busySearchLookupHtml = renderToStaticMarkup(
    <LookupSelectionInput
        interactionMode="search"
        inputValue="fender"
        busy
        onInputChange={() => {}}
        onBrowse={() => {}}
    />,
);
assert.match(busySearchLookupHtml, /forge-lookup-selection-input--search/);
assert.match(busySearchLookupHtml, /<input[^>]*aria-busy="true"(?![^>]*disabled)/);
assert.match(busySearchLookupHtml, /role="status">Searching…<\/div>/);

const failedSearchLookupHtml = renderToStaticMarkup(
    <LookupSelectionInput
        interactionMode="search"
        inputValue="fender"
        error="Advertisers could not be loaded."
        onInputChange={() => {}}
        onBrowse={() => {}}
    />,
);
assert.match(failedSearchLookupHtml, /<input[^>]*aria-describedby="[^"]+"[^>]*aria-invalid="true"/);
assert.match(failedSearchLookupHtml, /role="alert">Advertisers could not be loaded\.<\/div>/);

const erroredSelectHtml = renderToStaticMarkup(
    <SchemaBasedForm
        fields={[{
            ...fields[1],
            validationError: 'Choose a supported objective.',
        }]}
        data={{objective: ''}}
        layout={{kind: 'grid', appearance: 'field-tracks', columns: 1, labels: {mode: 'top'}}}
        showSubmit={false}
    />,
);
assert.match(erroredSelectHtml, /<button[^>]*id="objective"[^>]*aria-describedby="[^"]+"/);
assert.match(erroredSelectHtml, /<button[^>]*aria-invalid="true"/);
assert.match(erroredSelectHtml, /data-forge-part="validation-message"/);
assert.match(erroredSelectHtml, /role="alert">Choose a supported objective\.<\/div>/);

const disabledDateRangeHtml = renderToStaticMarkup(
    <SchemaBasedForm
        fields={[{
            ...fields[3],
            disabled: true,
        }]}
        data={{flight: {start: '2026-10-01', end: '2026-12-31'}}}
        layout={{kind: 'grid', appearance: 'field-tracks', columns: 1, labels: {mode: 'top'}}}
        showSubmit={false}
    />,
);
const disabledFlightGroupTag = elementTag(disabledDateRangeHtml, 'div', 'flight-group');
assertAttribute(disabledFlightGroupTag, 'aria-disabled', 'true');
assert.match(elementTag(disabledDateRangeHtml, 'input', 'flight'), /disabled=""/);
assert.match(elementTag(disabledDateRangeHtml, 'input', 'flight-end'), /disabled=""/);

const manualFieldTrackLookupHtml = renderToStaticMarkup(
    <LookupSelectionInput
        id="manualLookup"
        inputValue="typed value"
        allowManualEntry
        onInputChange={() => {}}
        onBrowse={() => {}}
        data-forge-field-track-control="true"
    />,
);
assert.match(manualFieldTrackLookupHtml, /<input[^>]*id="manualLookup"/);
assert.match(manualFieldTrackLookupHtml, /forge-lookup-selection-input__end-button/);
assert.doesNotMatch(manualFieldTrackLookupHtml, /forge-lookup-selection-input__trigger/);

const searchLookupHtml = renderToStaticMarkup(
    <LookupSelectionInput
        id="searchLookup"
        interactionMode="search"
        browseLabel="Search"
        allowManualEntry
        onInputChange={() => {}}
        onInputCommit={() => {}}
        onBrowse={() => {}}
    />,
);
assert.match(searchLookupHtml, /forge-lookup-selection-input--search/);
assert.match(searchLookupHtml, /aria-label="Search"/);
assert.match(searchLookupHtml, /data-icon="search"/);

const legacyLookupHtml = renderToStaticMarkup(
    <LookupSelectionInput allowManualEntry onBrowse={() => {}} />,
);
assert.doesNotMatch(legacyLookupHtml, /forge-lookup-selection-input--search/);
assert.match(legacyLookupHtml, /data-icon="chevron-down"/);

const legacyProps = {
    id: 'ignored-by-legacy-markup',
    fields: [fields[0]],
    data: {advertiserId: 42, advertiserName: 'Fender'},
    showSubmit: false,
};
const legacyHtml = renderToStaticMarkup(<SchemaBasedForm {...legacyProps} />);
const unsupportedAppearanceHtml = renderToStaticMarkup(
    <SchemaBasedForm {...legacyProps} layout={{kind: 'grid', appearance: 'cards', columns: 4}} />,
);

assert.equal(unsupportedAppearanceHtml, legacyHtml);
assert.match(legacyHtml, /^<form style="display:grid;grid-template-columns:repeat\(2, 1fr\);gap:12px">/);
assert.doesNotMatch(legacyHtml, /data-forge-(?:part|form-appearance|field-id)=/);
assert.doesNotMatch(legacyHtml, /id="ignored-by-legacy-markup"/);
assert.match(legacyHtml, /<label style="grid-column:span 1;display:grid;gap:6px">/);
assert.match(legacyHtml, /forge-lookup-selection-input__field/);
assert.match(legacyHtml, /forge-lookup-selection-input__end-button/);
assert.doesNotMatch(legacyHtml, /forge-lookup-selection-input__trigger/);

const TextInput = getWidget('text');
const SelectInput = getWidget('select');
const NumberInput = getWidget('number');
const CurrencyInput = getWidget('currency');

for (const [name, renderWidget] of [
    ['text', (props) => {
        const textWidget = TextInput(props);
        return textWidget.type(textWidget.props);
    }],
    ['number', (props) => NumberInput(props)],
    ['currency', (props) => CurrencyInput(props)],
]) {
    const fieldTrackElement = renderWidget({'data-forge-field-track-control': 'true'});
    const optedOutElement = renderWidget({'data-forge-field-track-control': 'true', fill: false});
    const legacyElement = renderWidget({});
    assert.equal(fieldTrackElement.props.fill, true, `${name} should fill its field track by default`);
    assert.equal(optedOutElement.props.fill, false, `${name} should honor fill=false`);
    assert.equal(legacyElement.props.fill, undefined, `${name} should preserve its legacy fill default`);
    if (name !== 'text') {
        assert.match(fieldTrackElement.props.className, /forge-field-track-number/);
        assert.equal(legacyElement.props.className, undefined);
    }
}
assert.match(
    NumberInput({'data-forge-field-track-control': 'true', className: 'authored-number'}).props.className,
    /forge-field-track-number authored-number/,
);

for (const [name, Widget] of [
    ['number', NumberInput],
    ['currency', CurrencyInput],
]) {
    assert.equal(
        Widget({'data-forge-field-track-control': 'true'}).props.buttonPosition,
        'none',
        `${name} should omit stepper buttons in field tracks by default`,
    );
    assert.equal(
        Widget({'data-forge-field-track-control': 'true', buttonPosition: 'left'}).props.buttonPosition,
        'left',
        `${name} should honor an explicit button position`,
    );
    assert.equal(Widget({}).props.buttonPosition, 'right', `${name} should preserve legacy stepper placement`);
}

const searchableOptions = Array.from({length: 10}, (_, index) => ({
    value: `objective-${index + 1}`,
    label: `Objective ${index + 1}`,
}));
const onOpening = () => {};
const onKeyDown = () => {};
const searchableSelect = SelectInput({
    value: 'objective-2',
    options: searchableOptions,
    'aria-label': 'Objective',
    'data-forge-field-track-control': 'true',
    popoverProps: {
        matchTargetWidth: false,
        onOpening,
        popoverClassName: 'authored-popover',
        portalClassName: 'authored-portal',
    },
    popoverTargetProps: {className: 'authored-target', onKeyDown},
    menuProps: {className: 'authored-menu', 'aria-label': 'Campaign objectives'},
    inputProps: {className: 'authored-search', 'aria-label': 'Find an objective'},
});
assert.equal(searchableSelect.props.fill, true);
assert.equal(searchableSelect.props.filterable, true);
assert.equal(searchableSelect.props.popoverProps.matchTargetWidth, false);
assert.equal(searchableSelect.props.popoverProps.onOpening, onOpening);
assert.match(searchableSelect.props.popoverProps.popoverClassName, /forge-field-track-select-popover/);
assert.match(searchableSelect.props.popoverProps.popoverClassName, /authored-popover/);
assert.match(searchableSelect.props.popoverProps.portalClassName, /forge-field-track-select-portal/);
assert.match(searchableSelect.props.popoverProps.portalClassName, /authored-portal/);
assert.match(searchableSelect.props.popoverTargetProps.className, /forge-field-track-select-target/);
assert.match(searchableSelect.props.popoverTargetProps.className, /authored-target/);
assert.equal(searchableSelect.props.popoverTargetProps.onKeyDown, onKeyDown);
assert.match(searchableSelect.props.menuProps.className, /forge-field-track-select-menu/);
assert.match(searchableSelect.props.menuProps.className, /authored-menu/);
assert.equal(searchableSelect.props.menuProps['aria-label'], 'Campaign objectives');
assert.match(searchableSelect.props.inputProps.className, /forge-field-track-select-search/);
assert.match(searchableSelect.props.inputProps.className, /authored-search/);
assert.equal(searchableSelect.props.inputProps['aria-label'], 'Find an objective');
assert.equal(searchableSelect.props.children.props.fill, true);
assert.equal(searchableSelect.props.children.props.alignText, 'start');
assert.equal(searchableSelect.props.children.props.ellipsizeText, true);

const selectedOption = searchableSelect.props.itemRenderer(searchableOptions[1], {
    handleClick: () => {},
    handleFocus: () => {},
    id: 'objective-option-2',
    modifiers: {active: true},
    ref: () => {},
});
assert.equal(selectedOption.props.className, 'forge-field-track-select-option');
assert.equal(selectedOption.props.roleStructure, 'listoption');
assert.equal(selectedOption.props.selected, true);
assert.equal(selectedOption.props.id, 'objective-option-2');
const selectedOptionHtml = renderToStaticMarkup(selectedOption);
assert.match(selectedOptionHtml, /<li[^>]*role="option"[^>]*aria-selected="true"/);
assert.match(selectedOptionHtml, /class="[^"]*forge-field-track-select-option[^"]*"/);
assert.equal(searchableSelect.props.noResults.props.roleStructure, 'listoption');
assert.equal(searchableSelect.props.noResults.props.disabled, true);
assert.equal(searchableSelect.props.noResults.props.text, 'No matching options');
assert.equal(searchableSelect.props.itemPredicate('objective 2', searchableOptions[1]), true);
assert.equal(searchableSelect.props.itemPredicate('not present', searchableOptions[1]), false);

const compactFieldTrackSelect = SelectInput({
    options: searchableOptions.slice(0, 9),
    'data-forge-field-track-control': 'true',
});
assert.equal(compactFieldTrackSelect.props.filterable, false);
assert.equal(compactFieldTrackSelect.props.noResults, undefined);

const optedOutSelect = SelectInput({
    options: searchableOptions,
    fill: false,
    filterable: false,
    'data-forge-field-track-control': 'true',
});
assert.equal(optedOutSelect.props.fill, false);
assert.equal(optedOutSelect.props.children.props.fill, false);
assert.equal(optedOutSelect.props.filterable, false);

const legacySelect = SelectInput({options: searchableOptions});
assert.equal(legacySelect.props.fill, undefined);
assert.equal(legacySelect.props.filterable, false);
assert.equal(legacySelect.props.popoverTargetProps, undefined);
assert.equal(legacySelect.props.menuProps, undefined);
assert.equal(legacySelect.props.inputProps, undefined);
assert.equal(legacySelect.props.children.props.alignText, undefined);
assert.equal(legacySelect.props.children.props.ellipsizeText, undefined);
assert.equal(legacySelect.props.itemRenderer(searchableOptions[0], {
    handleClick: () => {},
    modifiers: {active: false},
}).props.roleStructure, undefined);

const disabledLegacySelect = SelectInput({options: searchableOptions, disabled: true});
assert.equal(disabledLegacySelect.props.disabled, true);
assert.equal(disabledLegacySelect.props.children.props.disabled, true);

console.log('SchemaBasedForm field-tracks render contract passed');
