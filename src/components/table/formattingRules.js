import {resolveKey} from "../../utils/selector.js";

export const normalizeRuleList = (rules) => {
    if (!Array.isArray(rules)) return [];
    return rules.filter((rule) => rule && typeof rule === "object");
};

const asComparable = (value) => {
    if (value === undefined || value === null) return "";
    return String(value).trim().toLowerCase();
};

export const ruleField = (rule) => rule.field || rule.columnId || rule.column || rule.id;

export const ruleMatches = (row, rule) => {
    const field = ruleField(rule);
    if (!field) return false;
    const actual = resolveKey(row, field);
    const operator = String(rule.operator || rule.op || "equals").trim().toLowerCase();
    const expected = rule.value;
    const expectedValues = Array.isArray(rule.values) ? rule.values : (Array.isArray(expected) ? expected : [expected]);
    if (!Array.isArray(rule.values) && expected === undefined) return false;
    const actualNumber = Number(actual);
    const firstExpectedNumber = Number(expectedValues[0]);

    switch (operator) {
        case "=":
        case "eq":
        case "equal":
        case "equals":
            return expectedValues.some((value) => asComparable(actual) === asComparable(value));
        case "!=":
        case "neq":
        case "not_equal":
        case "not-equal":
        case "not_equals":
        case "not-equals":
            return expectedValues.every((value) => asComparable(actual) !== asComparable(value));
        case "in":
            return expectedValues.some((value) => asComparable(actual) === asComparable(value));
        case "contains":
            return expectedValues.some((value) => asComparable(actual).includes(asComparable(value)));
        case ">":
        case "gt":
        case "greater_than":
        case "greater-than":
            return Number.isFinite(actualNumber) && Number.isFinite(firstExpectedNumber) && actualNumber > firstExpectedNumber;
        case ">=":
        case "gte":
        case "greater_or_equal":
        case "greater-or-equal":
            return Number.isFinite(actualNumber) && Number.isFinite(firstExpectedNumber) && actualNumber >= firstExpectedNumber;
        case "<":
        case "lt":
        case "less_than":
        case "less-than":
            return Number.isFinite(actualNumber) && Number.isFinite(firstExpectedNumber) && actualNumber < firstExpectedNumber;
        case "<=":
        case "lte":
        case "less_or_equal":
        case "less-or-equal":
            return Number.isFinite(actualNumber) && Number.isFinite(firstExpectedNumber) && actualNumber <= firstExpectedNumber;
        default:
            return false;
    }
};

export const mergeStyles = (rules) => {
    return rules.reduce((acc, rule) => ({...acc, ...(rule.style || {})}), {});
};

export const mergeClassNames = (rules) => {
    return rules
        .map((rule) => rule.className)
        .filter(Boolean)
        .join(" ");
};

export const matchingRules = (row, rules, target, colId) => {
    return normalizeRuleList(rules).filter((rule) => {
        const appliesTo = String(rule.target || "row").trim().toLowerCase();
        if (target === "row" && appliesTo !== "row") return false;
        if (target === "cell") {
            if (appliesTo !== "cell" && appliesTo !== "column") return false;
            const ruleCol = rule.columnId || rule.column || rule.cell;
            if (ruleCol && ruleCol !== colId) return false;
            if (!ruleCol && ruleField(rule) !== colId) return false;
        }
        return ruleMatches(row, rule);
    });
};
