import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import './index.jsx';
import {getWidget} from '../../runtime/widgetRegistry.jsx';
import {resolveNumericInputMinorStepSize} from './numericInputSteps.js';

assert.equal(resolveNumericInputMinorStepSize(0.01, undefined), 0.01);
assert.equal(resolveNumericInputMinorStepSize(1, undefined), 0.1);
assert.equal(resolveNumericInputMinorStepSize(0.01, 0.005), 0.005);
assert.equal(resolveNumericInputMinorStepSize(undefined, undefined), undefined);

const CurrencyInput = getWidget('currency');
const NumberInput = getWidget('number');
const emptyNullableNumber = NumberInput({value: '', nullable: true, min: 1});
assert.equal(emptyNullableNumber.props.value, '');
assert.equal(emptyNullableNumber.props.min, undefined);
let clearedNumber = 'not-cleared';
NumberInput({value: '', nullable: true, min: 1, onValueChange: (value) => { clearedNumber = value; }}).props.onValueChange(NaN, '');
assert.equal(clearedNumber, null);

const defaultStepElement = CurrencyInput({value: 12.34, stepSize: 0.01, currency: 'USD'});
assert.equal(defaultStepElement.props.stepSize, 0.01);
assert.equal(defaultStepElement.props.minorStepSize, 0.01);

const explicitStepElement = CurrencyInput({
    value: 12.34,
    stepSize: 0.01,
    minorStepSize: 0.005,
    majorStepSize: 1,
    currency: 'USD',
});
assert.equal(explicitStepElement.props.stepSize, 0.01);
assert.equal(explicitStepElement.props.minorStepSize, 0.005);
assert.equal(explicitStepElement.props.majorStepSize, 1);
const emptyNullableCurrency = CurrencyInput({value: '', nullable: true, min: 0.01, currency: 'USD'});
assert.equal(emptyNullableCurrency.props.value, '');
assert.equal(emptyNullableCurrency.props.min, undefined);

const validationErrors = [];
const originalError = console.error;
console.error = (...args) => validationErrors.push(args.map(String).join(' '));
try {
    const markup = renderToStaticMarkup(<CurrencyInput value={12.34} stepSize={0.01} currency="USD"/>);
    assert.match(markup, /Amount \(USD\)/);
    renderToStaticMarkup(
        <CurrencyInput value={12.34} stepSize={0.01} minorStepSize={0.005} majorStepSize={1} currency="USD"/>,
    );
} finally {
    console.error = originalError;
}
assert.doesNotMatch(validationErrors.join('\n'), /NumericInput.*minorStepSize/);

console.log('currency input step/render contract passed');
