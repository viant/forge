/* -------------------------------------------------------------------------
 * Widget Registry – core runtime (Phase 1)
 * -------------------------------------------------------------------------
 * Maintains a mapping from widget **keys** (string) to **factory functions**
 * `(props) => ReactNode`.
 *
 *  – `registerWidget` can be called multiple times; the **last registration
 *    wins** which allows packs or user code to override defaults.
 *  – `getWidget` always returns *something*: if the key is unknown the
 *    function falls back to a minimal <input> widget and emits a console
 *    warning.  This guarantees that the runtime never crashes during the
 *    incremental migration.
 * ---------------------------------------------------------------------- */

import React from 'react';

const registry = new Map();

/**
 * Register (or override) a widget factory.
 *
 * @param {string} key              Widget id (e.g. "text", "number").
 * @param {(props:object)=>JSX.Element} factory React functional component.
 * @param {object} [options]
 * @param {object} [options.defaults]   Default props merged in each render.
 * @param {string} [options.framework]  Informational tag ("blueprint", "mui" …).
 */
export function registerWidget(key, factory, { defaults = {}, framework = 'core' } = {}) {
    if (!key || typeof factory !== 'function') {
        console.warn('[widgetRegistry] invalid registration', key, factory);
        return;
    }
    registry.set(key, { factory, defaults, framework });
}

/**
 * Resolve a widget key to the registered factory.
 */
export function getWidgetEntry(key) {
    if (registry.has(key)) return registry.get(key);
    return { factory: FallbackInput, framework: 'core', defaults: {} };
}

export function getWidget(key) {
    return getWidgetEntry(key).factory;
}

/** List all registered keys (for debugging / devtools). */
export function listWidgets() {
    return Array.from(registry.keys());
}

/* ---------------------------------------------------------------------
 * Minimal fallback widget so the UI never crashes when a key is missing.
 * ------------------------------------------------------------------ */

function FallbackInput({ value = '', onChange = () => {}, readOnly, ...rest }) {
    return (
        <input
            {...rest}
            className="bp4-input"
            readOnly={readOnly}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

// Pre-register the fallback as explicit key so developers can opt into it.
registerWidget('input', FallbackInput, { framework: 'core' });

// Default export for compatibility – allows both named and default import styles.
const widgetRegistryDefault = {
    registerWidget,
    getWidget,
    getWidgetEntry,
    listWidgets,
};

export default widgetRegistryDefault;
