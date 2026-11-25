import {evaluateCondition} from '../utils/evaluateCondition.js';
import {resolveSelectorParts} from '../utils/selector.js';

const bounds = new Set(['gt', 'gte', 'lt', 'lte']);
const peers = new Set(['gtField', 'gteField', 'ltField', 'lteField']);
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const plansBySchemas = new WeakMap();
const scalar = value => value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value);

function prepareRules(invariants) {
    const paths = new Map();
    const numericLeaves = new Set();
    function addPath(path) {
        if (paths.has(path)) return;
        const parts = typeof path === 'string' ? path.split('.') : [];
        if (!parts.length || parts.some(p => !p || p.trim() !== p || /[:/\[\]]/.test(p) || ['__proto__','constructor','prototype'].includes(p))) {
            throw new Error('Invalid invariant field path.');
        }
        paths.set(path, parts);
    }
    function inspect(rule) {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('Expected an invariant condition.');
        const keys = Object.keys(rule);
        for (const key of ['all','any','not']) {
            if (!Object.hasOwn(rule, key)) continue;
            if (keys.length !== 1) throw new Error('A grouped invariant must have a single operator.');
            if (key === 'not') inspect(rule.not);
            else {
                if (!Array.isArray(rule[key]) || !rule[key].length) throw new Error('Expected a non-empty invariant group.');
                rule[key].forEach(inspect);
            }
            return;
        }
        addPath(rule.field);
        if (Object.hasOwn(rule, 'source') && rule.source !== 'form') throw new Error('Invariants require canonical form data.');
        const operators = keys.filter(k => k !== 'source' && k !== 'field');
        if (!operators.length || (operators.length > 1 && !operators.every(k => bounds.has(k) || peers.has(k)))) {
            throw new Error('Expected one invariant predicate or combined numeric bounds.');
        }
        for (const op of operators) {
            const operand = rule[op];
            if (peers.has(op)) {
                if (Object.hasOwn(rule, op.slice(0,-5))) throw new Error('Conflicting literal and peer bounds.');
                addPath(operand);
                numericLeaves.add(rule);
            } else if (bounds.has(op) && Number.isFinite(operand)) numericLeaves.add(rule);
            else if (['exists','empty','notEmpty'].includes(op) && typeof operand === 'boolean') continue;
            else if (['equals','notEquals'].includes(op) && scalar(operand)) continue;
            else if (op === 'in' && Array.isArray(operand) && operand.length && operand.every(scalar)) continue;
            else throw new Error('Unsupported invariant predicate or operand.');
        }
    }
    if (!Array.isArray(invariants)) throw new Error('Expected an array of resource invariants.');
    for (const invariant of invariants) {
        if (typeof invariant?.message !== 'string' || !invariant.message.trim()) throw new Error('An invariant requires a message.');
        if (invariant.path !== undefined && invariant.path !== '') addPath(invariant.path);
        if (Object.hasOwn(invariant, 'when')) inspect(invariant.when);
        inspect(invariant.assert);
    }
    return {paths, numericLeaves};
}

// Window metadata is an immutable publication snapshot. A replacement revision
// supplies new schema objects. Standalone callers may use mutable schemas.
export function prepareWindowInvariants(schemas) {
    if (schemas && typeof schemas === 'object' && !plansBySchemas.has(schemas)) {
        plansBySchemas.set(schemas, new WeakMap());
    }
}

export function checkInvariants(value, invariants, schemas, path, errors) {
    if (invariants == null) return;
    let plan;
    try {
        const plans = plansBySchemas.get(schemas);
        plan = plans?.get(invariants);
        if (!plan) {
            plan = prepareRules(invariants);
            plans?.set(invariants, plan);
        }
    } catch (e) {
        errors.push(`${path}: ${e.message}`);
        return;
    }
    const read = field => resolveSelectorParts(value, plan.paths.get(field), true);
    const number = field => {
        const v = read(field);
        return typeof v === 'number' || (typeof v === 'string' && decimal.test(v.trim())) ? Number(v) : undefined;
    };
    const readLeaf = rule => plan.numericLeaves.has(rule) ? number(rule.field) : read(rule.field);
    for (const rule of invariants) {
        if (rule.when && !evaluateCondition(rule.when, readLeaf, number)) continue;
        if (!evaluateCondition(rule.assert, readLeaf, number)) errors.push(`${rule.path ? path + '.' + rule.path : path}: ${rule.message}`);
    }
}
