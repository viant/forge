import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import ContentCarousel from './ContentCarousel.jsx';
import CardRail from './CardRail.jsx';
import FilterChips from './FilterChips.jsx';
import {classify} from '../../runtime/widgetClassifier.js';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'http://127.0.0.1/'});
globalThis.window = dom.window;globalThis.document = dom.window.document;globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({matches: true, addEventListener() {}, removeEventListener() {}});
let resize;
globalThis.ResizeObserver = class {constructor(callback) {resize = callback;} observe() {} disconnect() {}};
const root = createRoot(document.getElementById('root'));
const render = async element => act(async () => root.render(element));
const click = async node => {assert.ok(node, 'Click target exists');await act(async () => node.click());};
const button = label => [...document.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label || node.textContent === label);
const slides = Object.freeze([{id: 10, title: 'First', description: 'Description', actionLabel: 'Open', image: 'javascript:bad()'}, {id: 20, title: 'Second', actionLabel: 'Open'}]);
let selected;
await render(<ContentCarousel value={slides} onClick={event => selected = event.detail.item} autoRotateMs={5000}/>);
assert.equal(document.querySelector('h2').textContent, 'First');
assert.equal(document.querySelector('img'), null, 'Unsafe media is not loaded');
assert.equal(button('Pause rotation'), undefined, 'Reduced motion prevents automatic rotation');
await click(button('Next featured item'));
assert.equal(document.querySelector('h2').textContent, 'Second');
await click(button('Open'));assert.equal(selected.id, 20);
await render(<ContentCarousel value={[slides[1], slides[0]]}/>);
assert.equal(document.querySelector('h2').textContent, 'Second', 'Reordering preserves selected identity');
await act(async () => document.querySelector('section').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true})));
assert.equal(document.querySelector('h2').textContent, 'First');
await render(<ContentCarousel value={[slides[0]]}/>);
assert.equal(button('Next featured item'), undefined);
await render(<ContentCarousel value={[]}/>);assert.equal(document.querySelector('section'), null);

let chips = [];
const options = [{value: 1, label: 'One'}, {value: '1', label: 'Text one'}, {value: 2, label: 'Unavailable', disabled: true}];
await render(<FilterChips value={chips} options={options} onChange={value => chips = value}/>);
await click(button('One'));assert.deepEqual(chips, [1]);
await render(<FilterChips value={chips} options={options} onChange={value => chips = value}/>);
assert.equal(button('One').getAttribute('aria-pressed'), 'true');
await click(button('Text one'));assert.deepEqual(chips, [1, '1']);
await click(button('Unavailable'));assert.deepEqual(chips, [1, '1']);
await render(<FilterChips value={chips} options={options} readOnly onChange={() => {throw Error('Readonly changed');}}/>);
assert.ok([...document.querySelectorAll('button')].every(node => node.disabled));

const cards = [{id: 7, title: '<img onerror=alert(1)>', subtitle: 'Reference', facts: [{label: 'Count', value: 12}], tags: ['Category']}];
await render(<CardRail value={cards} heading="Collection" onClick={event => selected = event.detail.item}/>);
assert.equal(document.querySelector('h3').textContent, cards[0].title, 'Text stays inert');
assert.equal(document.querySelector('h3 img'), null);
const track = document.querySelector('[role=list]');
Object.defineProperties(track, {clientWidth: {value: 400}, scrollWidth: {value: 1200}, scrollLeft: {value: 0, writable: true}});
track.scrollBy = ({left}) => {track.scrollLeft = Math.max(0, Math.min(800, track.scrollLeft + left));track.dispatchEvent(new window.Event('scroll'));};
await act(async () => resize());
assert.equal(button('Scroll left').disabled, true);assert.equal(button('Scroll right').disabled, false);
await click(button('Scroll right'));assert.equal(track.scrollLeft, 340);assert.equal(button('Scroll left').disabled, false);
await click(button('Scroll right'));await click(button('Scroll right'));assert.equal(button('Scroll right').disabled, true);
await click(document.querySelector('.forge-content-card__open'));assert.equal(selected.id, 7);
await render(<CardRail value={[]} heading="Empty"/>);assert.equal(document.querySelector('[role=status]').textContent, 'No items match these filters.');
for (const type of ['contentCarousel', 'cardRail', 'filterChips']) assert.equal(classify({type}), type);
// Verify authored metadata reaches the registered widgets and state/event adapters.
const {registerPack} = await import('../../packs/blueprint/index.jsx');
const {default: WidgetRenderer} = await import('../../runtime/WidgetRenderer.jsx');
const {signal} = await import('@preact/signals-react');
registerPack();
const context = {signals: {windowForm: signal({selected: [], featured: slides}), form: signal({}), control: signal({})}, handlers: {dataSource: {}}};
await render(<WidgetRenderer context={context} item={{id: 'filters', type: 'filterChips', scope: 'windowForm', dataField: 'selected', options, wrapper: 'none'}}/>);
await click(button('One'));
assert.deepEqual(context.signals.windowForm.peek().selected, [1]);
await render(<WidgetRenderer context={context} item={{id: 'feature', type: 'contentCarousel', scope: 'windowForm', dataField: 'featured', wrapper: 'none'}} events={{onClick: event => selected = event.detail.item}}/>);
await click(button('Open'));assert.equal(selected.id, 10);

// A refreshed collection of the same length must replace the timer's records.
const originalSetInterval = globalThis.setInterval, originalClearInterval = globalThis.clearInterval;
let rotate;
globalThis.setInterval = callback => {rotate = callback;return 1;};
globalThis.clearInterval = () => {rotate = null;};
window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
try {
    await render(<ContentCarousel value={slides} autoRotateMs={1000}/>);
    assert.equal(typeof rotate, 'function');
    await act(async () => rotate());
    assert.equal(document.querySelector('h2').textContent, 'Second');
    await render(<ContentCarousel value={[{id: 30, title: 'Replacement first'}, {id: 40, title: 'Replacement second'}]} autoRotateMs={1000}/>);
    await act(async () => rotate());
    assert.equal(document.querySelector('h2').textContent, 'Replacement second');
    await click(button('Pause rotation'));assert.equal(rotate, null);
    await render(<ContentCarousel value={slides} autoRotateMs={1000} disabled/>);
    assert.ok([...document.querySelectorAll('button')].every(node => node.disabled));
    await render(<div/>);
} finally {
    globalThis.setInterval = originalSetInterval;globalThis.clearInterval = originalClearInterval;
}
await act(async () => root.unmount());
dom.window.close();
console.log('Content carousel, chips, rail interaction and metadata classification pass');
