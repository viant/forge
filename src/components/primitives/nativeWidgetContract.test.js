import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify } from '../../runtime/widgetClassifier.js';
import { resolveDateRangePreset } from '../../packs/blueprint/dateRangePreset.js';
import { parsePercentFraction2Input } from '../../packs/blueprint/percentFractionInput.js';
const fixture = JSON.parse(fs.readFileSync(new URL('./nativeWidgetContract.fixtures.json', import.meta.url)));
for (const widget of fixture.widgets) assert.equal(classify({widget}),widget);
for (const {item,expected} of fixture.classification) assert.equal(classify(item).toLowerCase(), expected);
for (const entry of fixture.presets) assert.deepEqual(resolveDateRangePreset(entry.value,new Date(entry.now),'2026-01-01',entry.timeZone || 'UTC'),entry.expected);
for (const entry of fixture.inputs.filter((value) => value.kind === 'percentfraction2input')) assert.equal(parsePercentFraction2Input(Number(entry.text),entry.text),entry.expected);
console.log('Shared native/web widget and date contract ✓');

for (const entry of fixture.booleans) assert.equal(Boolean(entry.value), entry.expected);
