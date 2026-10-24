import assert from 'node:assert/strict';
import {resourceWindowMetadata} from './resourceWindowMetadata.js';

const variants = {
    shared: {window: {windowKey: 'released', parameters: [{name: 'Id', required: true}], view: {content: {id: 'released'}}}, dataSources: {}},
    phone: {window: {windowKey: 'phone', parameters: [{name: 'MobileId', required: true}], view: {content: {id: 'phone'}}}, dataSources: {}},
};
const targets = [
    {target: {}, variant: 'shared'},
    {target: {platform: 'web', formFactor: 'desktop'}, variant: 'shared'},
    {target: {platform: 'ios', formFactor: 'phone'}, variant: 'phone'},
];
for (const [schemaVersion, format] of [[2, 'window.bundle'], [3, 'window.references']]) {
    const envelope = {schemaVersion, format, targets, variants};
    assert.equal(resourceWindowMetadata(envelope, {platform: 'web', formFactor: 'desktop'}).parameters[0].name, 'Id');
    assert.equal(resourceWindowMetadata(envelope, {platform: 'ios', formFactor: 'phone'}).parameters[0].name, 'MobileId');
}
for (const invalid of [
    {schemaVersion: 2, format: 'window.references'},
    {schemaVersion: 3, format: 'window.bundle'},
    {schemaVersion: 2, format: 'window.bundle', targets: []},
]) {
    const envelope = {...invalid, targets: invalid.targets ?? targets, variants};
    assert.throws(() => resourceWindowMetadata(envelope), /Invalid window resource|no matching target/);
}
console.log('resourceWindowMetadata ✓ compiled bundle and reference target selection');
