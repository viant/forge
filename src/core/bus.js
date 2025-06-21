// bus.js – lightweight client-side message bus implemented on
// top of window-scoped signals.

import {useSignalEffect} from '@preact/signals-react';
import {getBusSignal} from './store/signals.js';


// Maximum number of messages kept in each bus buffer.
const MAX_BUFFER = 500;


/**
 * Publish `message` on the window-local bus.
 * The bus is **not** intended for durable storage – it is cleared when the
 * window closes (see removeSignalsForKey in signals.js).
 *
 * @param {string} windowId  – unique window key as used by Context
 * @param {object} message   – arbitrary JSON-serialisable payload
 */
export function sendBusMessage(windowId, message) {
    const bus = getBusSignal(windowId);
    // Keep a bounded buffer so memory does not grow unboundedly.
    bus.value = [...bus.peek(), message].slice(-MAX_BUFFER);
}


/**
 * React hook that invokes `handler` each time a **new** message satisfying
 * `filterFn` arrives on the bus.
 *
 * Usage:
 *   useBusListener(windowId,
 *       (m) => m.type === 'form.submitted',   // filter
 *       (m) => console.log('Payload', m.payload));
 */
export function useBusListener(windowId, filterFn, handler) {
    const bus = getBusSignal(windowId);

    useSignalEffect(() => {
        const messages = bus.value;
        if (!messages || messages.length === 0) return;
        const last = messages[messages.length - 1];
        if (!filterFn || filterFn(last)) {
            handler(last);
        }
    });
}

function useOneShotBusListener(windowId, filter, handler) {
    const done = useRef(false);
    useBusListener(windowId,
        (m) => !done.current && filter(m),
        (m) => {
            done.current = true;   // block subsequent messages
            handler(m);
        });
}

