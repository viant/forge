import assert from 'node:assert/strict';

import {
  busSignals,
  findBusSignal,
  findMetricsSignal,
  findViewSignal,
  getBusSignal,
  getMetricsSignal,
  getViewSignal,
  metricsSignals,
  viewSignals,
} from './signals.js';

busSignals.value = {};
metricsSignals.value = {};
viewSignals.value = {};

assert.equal(findBusSignal('W1'), null);
assert.equal(findMetricsSignal('W1DSmetrics'), null);
assert.equal(findViewSignal('W1'), null);

assert.deepEqual(Object.keys(busSignals.peek()), []);
assert.deepEqual(Object.keys(metricsSignals.peek()), []);
assert.deepEqual(Object.keys(viewSignals.peek()), []);

const busSignal = getBusSignal('W1');
const metricsSignal = getMetricsSignal('W1DSmetrics');
const viewSignal = getViewSignal('W1');

assert.ok(busSignal);
assert.ok(metricsSignal);
assert.ok(viewSignal);

assert.equal(findBusSignal('W1'), busSignal);
assert.equal(findMetricsSignal('W1DSmetrics'), metricsSignal);
assert.equal(findViewSignal('W1'), viewSignal);
