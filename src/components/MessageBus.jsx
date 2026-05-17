import React, {useEffect} from "react";
import {useSignals} from '@preact/signals-react/runtime';



/**
 * Executes actions for `messageBus`.
 */
const onMessage = async (context, message) => {
    const { execution } = message ;
        try {
            // Execute `init` if defined
            if (execution.init) {
                const initHandler = context.lookupHandler(execution.init);
                if (initHandler) {
                    await initHandler(message);
                }
            }
            let output = null;
            // Execute `handler`
            if (execution.handler) {
                const handler = context.lookupHandler(execution.handler);
                if (handler) {
                    output = await handler(message);
                }
            }
            // Execute `onDone`
            if (execution.onDone) {
                const onDoneHandler = context.lookupHandler(execution.onDone);
                if (onDoneHandler) {
                     return await onDoneHandler(message, output);
                }
            }

        } catch (error) {
            console.error(`Error in messageBus handler for event="${execution.event}":`, error);

            // Execute `onError` if defined
            if (execution.onError) {
                const errorHandler = context.lookupHandler(execution.onError);
                if (errorHandler) {
                    await errorHandler(message, error);
                }
            }
        }

};




/**
 * MessageBus Component.
 */
export default function MessageBus({ context }) {
    useSignals();
    const {identity, signals} = context;
    const {message} = signals;
    const queue = Array.isArray(message.value) ? message.value : [];
    useEffect(() => {
        if (queue.length === 0) return;
        const [nextMessage, ...rest] = queue;
        if (!nextMessage) return;
        message.value = rest;
        void onMessage(context, nextMessage);
    }, [queue, context, message]);
    return null;
}
