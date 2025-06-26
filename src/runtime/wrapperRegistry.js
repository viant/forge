/* -------------------------------------------------------------
 * Wrapper registry – allows UI packs to provide their own outer
 * wrapper (e.g. Blueprint FormGroup).  Fallback is a simple div
 * with optional label.
 * ----------------------------------------------------------- */

const wrappers = new Map(); // key: framework => function

export function registerWrapper(framework, fn) {
    wrappers.set(framework, fn);
}

export function getWrapper(framework) {
    return wrappers.get(framework);
}
