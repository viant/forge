import { resolveKey } from "../utils/selector.js";
import {
  REPORT_CALCULATED_FIELD_FUNCTION_SPECS,
  REPORT_CALCULATED_FIELD_TABLE_CALC_SPECS,
  listReportCalculatedFieldFunctionSpecs,
  listReportCalculatedFieldTableCalculationSpecs,
} from "./calculationContracts.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeStringArray(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function normalizeOrderBy(orderBy = []) {
  return (Array.isArray(orderBy) ? orderBy : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const field = normalizeString(entry.field);
      if (!field) {
        return null;
      }
      return {
        field,
        direction: normalizeString(entry.direction).toLowerCase() === "desc" ? "desc" : "asc",
      };
    })
    .filter(Boolean);
}

function normalizePartitionBy(partitionBy = []) {
  return normalizeStringArray(partitionBy);
}

function buildExpressionError(message = "", index = 0) {
  return new Error(`Invalid calculated field expression at ${Math.max(0, Number(index) || 0)}: ${message}`);
}

function tokenizeReportCalculatedFieldExpression(expression = "") {
  const input = String(expression || "");
  const tokens = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char, index });
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma", value: char, index });
      index += 1;
      continue;
    }
    if ((char === "!" || char === ">" || char === "<") && input[index + 1] === "=") {
      tokens.push({ type: "operator", value: `${char}=`, index });
      index += 2;
      continue;
    }
    if (char === "=" || char === "+" || char === "-" || char === "*" || char === "/" || char === "%" || char === ">" || char === "<") {
      tokens.push({ type: "operator", value: char, index });
      index += 1;
      continue;
    }
    if (char === "'" || char === "\"") {
      const quote = char;
      let cursor = index + 1;
      let value = "";
      while (cursor < input.length) {
        const current = input[cursor];
        if (current === "\\") {
          const next = input[cursor + 1];
          if (next == null) {
            throw buildExpressionError("unterminated escape sequence", cursor);
          }
          value += next;
          cursor += 2;
          continue;
        }
        if (current === quote) {
          tokens.push({ type: "string", value, index });
          index = cursor + 1;
          value = null;
          break;
        }
        value += current;
        cursor += 1;
      }
      if (value != null) {
        throw buildExpressionError("unterminated string literal", index);
      }
      continue;
    }
    if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(input[index + 1] || ""))) {
      let cursor = index + 1;
      while (cursor < input.length && /[0-9.]/.test(input[cursor])) {
        cursor += 1;
      }
      const rawNumber = input.slice(index, cursor);
      const numericValue = Number(rawNumber);
      if (!Number.isFinite(numericValue)) {
        throw buildExpressionError(`invalid number literal "${rawNumber}"`, index);
      }
      tokens.push({ type: "number", value: numericValue, index });
      index = cursor;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let cursor = index + 1;
      while (cursor < input.length && /[A-Za-z0-9_.]/.test(input[cursor])) {
        cursor += 1;
      }
      const rawIdentifier = input.slice(index, cursor);
      const lowered = rawIdentifier.toLowerCase();
      if (lowered === "and" || lowered === "or" || lowered === "not") {
        tokens.push({ type: "operator", value: lowered, index });
      } else if (lowered === "null") {
        tokens.push({ type: "literal", value: null, index });
      } else if (lowered === "true") {
        tokens.push({ type: "literal", value: true, index });
      } else if (lowered === "false") {
        tokens.push({ type: "literal", value: false, index });
      } else {
        tokens.push({ type: "identifier", value: rawIdentifier, index });
      }
      index = cursor;
      continue;
    }
    throw buildExpressionError(`unexpected character "${char}"`, index);
  }
  return tokens;
}

function parseReportCalculatedFieldExpressionTokens(tokens = []) {
  let position = 0;

  function current() {
    return tokens[position] || null;
  }

  function consume() {
    const token = current();
    position += 1;
    return token;
  }

  function match(type, value = undefined) {
    const token = current();
    if (!token || token.type !== type) {
      return false;
    }
    if (value !== undefined && token.value !== value) {
      return false;
    }
    return true;
  }

  function expect(type, value = undefined) {
    const token = current();
    if (!match(type, value)) {
      throw buildExpressionError(`expected ${value ?? type}`, token?.index ?? tokens[tokens.length - 1]?.index ?? 0);
    }
    return consume();
  }

  function parsePrimary() {
    const token = current();
    if (!token) {
      throw buildExpressionError("unexpected end of expression", tokens[tokens.length - 1]?.index ?? 0);
    }
    if (token.type === "number" || token.type === "string" || token.type === "literal") {
      consume();
      return { type: "literal", value: token.value };
    }
    if (token.type === "identifier") {
      consume();
      if (match("paren", "(")) {
        consume();
        const args = [];
        if (!match("paren", ")")) {
          while (true) {
            args.push(parseOr());
            if (match("comma")) {
              consume();
              continue;
            }
            break;
          }
        }
        expect("paren", ")");
        return {
          type: "call",
          callee: token.value,
          args,
        };
      }
      return {
        type: "identifier",
        name: token.value,
      };
    }
    if (match("paren", "(")) {
      consume();
      const node = parseOr();
      expect("paren", ")");
      return node;
    }
    throw buildExpressionError(`unexpected token "${token.value}"`, token.index);
  }

  function parseUnary() {
    if (match("operator", "-") || match("operator", "not")) {
      const token = consume();
      return {
        type: "unary",
        operator: token.value,
        argument: parseUnary(),
      };
    }
    return parsePrimary();
  }

  function parseMultiplicative() {
    let node = parseUnary();
    while (match("operator", "*") || match("operator", "/") || match("operator", "%")) {
      const token = consume();
      node = {
        type: "binary",
        operator: token.value,
        left: node,
        right: parseUnary(),
      };
    }
    return node;
  }

  function parseAdditive() {
    let node = parseMultiplicative();
    while (match("operator", "+") || match("operator", "-")) {
      const token = consume();
      node = {
        type: "binary",
        operator: token.value,
        left: node,
        right: parseMultiplicative(),
      };
    }
    return node;
  }

  function parseComparison() {
    let node = parseAdditive();
    if (
      match("operator", "=")
      || match("operator", "!=")
      || match("operator", ">")
      || match("operator", ">=")
      || match("operator", "<")
      || match("operator", "<=")
    ) {
      const token = consume();
      node = {
        type: "binary",
        operator: token.value,
        left: node,
        right: parseAdditive(),
      };
    }
    return node;
  }

  function parseAnd() {
    let node = parseComparison();
    while (match("operator", "and")) {
      consume();
      node = {
        type: "binary",
        operator: "and",
        left: node,
        right: parseComparison(),
      };
    }
    return node;
  }

  function parseOr() {
    let node = parseAnd();
    while (match("operator", "or")) {
      consume();
      node = {
        type: "binary",
        operator: "or",
        left: node,
        right: parseAnd(),
      };
    }
    return node;
  }

  const ast = parseOr();
  if (position < tokens.length) {
    throw buildExpressionError(`unexpected token "${tokens[position].value}"`, tokens[position].index);
  }
  return ast;
}

function collectReportCalculatedFieldExpressionDependencies(node = null, dependencies = new Set()) {
  if (!node || typeof node !== "object") {
    return dependencies;
  }
  if (node.type === "identifier") {
    dependencies.add(normalizeString(node.name));
    return dependencies;
  }
  if (node.type === "unary") {
    return collectReportCalculatedFieldExpressionDependencies(node.argument, dependencies);
  }
  if (node.type === "binary") {
    collectReportCalculatedFieldExpressionDependencies(node.left, dependencies);
    collectReportCalculatedFieldExpressionDependencies(node.right, dependencies);
    return dependencies;
  }
  if (node.type === "call") {
    (Array.isArray(node.args) ? node.args : []).forEach((arg) => {
      collectReportCalculatedFieldExpressionDependencies(arg, dependencies);
    });
  }
  return dependencies;
}

function validateReportCalculatedFieldExpressionAst(node = null) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (node.type === "literal" || node.type === "identifier") {
    return;
  }
  if (node.type === "unary") {
    validateReportCalculatedFieldExpressionAst(node.argument);
    return;
  }
  if (node.type === "binary") {
    validateReportCalculatedFieldExpressionAst(node.left);
    validateReportCalculatedFieldExpressionAst(node.right);
    return;
  }
  if (node.type === "call") {
    const normalizedCallee = normalizeString(node.callee).toLowerCase();
    const spec = REPORT_CALCULATED_FIELD_FUNCTION_SPECS[normalizedCallee];
    if (!spec) {
      throw buildExpressionError(`unsupported function "${node.callee}"`);
    }
    const argCount = Array.isArray(node.args) ? node.args.length : 0;
    if (Number.isFinite(spec.minArgs) && argCount < spec.minArgs) {
      throw buildExpressionError(`function "${node.callee}" requires at least ${spec.minArgs} argument${spec.minArgs === 1 ? "" : "s"}`);
    }
    if (Number.isFinite(spec.maxArgs) && argCount > spec.maxArgs) {
      throw buildExpressionError(`function "${node.callee}" accepts at most ${spec.maxArgs} argument${spec.maxArgs === 1 ? "" : "s"}`);
    }
    (Array.isArray(node.args) ? node.args : []).forEach((arg) => {
      validateReportCalculatedFieldExpressionAst(arg);
    });
    return;
  }
  throw buildExpressionError(`unsupported expression node "${String(node.type || "unknown")}"`);
}

export function parseReportCalculatedFieldExpression(expression = "") {
  const normalizedExpression = normalizeString(expression);
  if (!normalizedExpression) {
    return null;
  }
  const tokens = tokenizeReportCalculatedFieldExpression(normalizedExpression);
  const ast = parseReportCalculatedFieldExpressionTokens(tokens);
  validateReportCalculatedFieldExpressionAst(ast);
  return {
    expr: normalizedExpression,
    ast,
    dependencies: Array.from(collectReportCalculatedFieldExpressionDependencies(ast)),
  };
}

function isNullishValue(value) {
  return value === undefined || value === null;
}

function toFiniteNumber(value) {
  if (isNullishValue(value) || value === "") {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function coerceBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (isNullishValue(value) || value === "") {
    return false;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const trimmed = normalizeString(value);
  if (!trimmed) {
    return false;
  }
  if (trimmed.toLowerCase() === "true") {
    return true;
  }
  if (trimmed.toLowerCase() === "false") {
    return false;
  }
  const numericValue = toFiniteNumber(trimmed);
  if (numericValue != null) {
    return numericValue !== 0;
  }
  return true;
}

function compareValues(left, right, operator = "=") {
  if (isNullishValue(left) || isNullishValue(right)) {
    return false;
  }
  const leftNumber = toFiniteNumber(left);
  const rightNumber = toFiniteNumber(right);
  if (leftNumber != null && rightNumber != null) {
    switch (operator) {
      case "=":
        return leftNumber === rightNumber;
      case "!=":
        return leftNumber !== rightNumber;
      case ">":
        return leftNumber > rightNumber;
      case ">=":
        return leftNumber >= rightNumber;
      case "<":
        return leftNumber < rightNumber;
      case "<=":
        return leftNumber <= rightNumber;
      default:
        return false;
    }
  }
  const leftValue = typeof left === "boolean" ? String(left) : String(left);
  const rightValue = typeof right === "boolean" ? String(right) : String(right);
  switch (operator) {
    case "=":
      return leftValue === rightValue;
    case "!=":
      return leftValue !== rightValue;
    case ">":
      return leftValue > rightValue;
    case ">=":
      return leftValue >= rightValue;
    case "<":
      return leftValue < rightValue;
    case "<=":
      return leftValue <= rightValue;
    default:
      return false;
  }
}

function evaluateReportCalculatedFieldFunction(node = {}, row = {}) {
  const callee = normalizeString(node?.callee).toLowerCase();
  const args = Array.isArray(node?.args) ? node.args : [];
  switch (callee) {
    case "if": {
      if (args.length !== 3) {
        return null;
      }
      return coerceBoolean(evaluateReportCalculatedFieldExpression(args[0], row))
        ? evaluateReportCalculatedFieldExpression(args[1], row)
        : evaluateReportCalculatedFieldExpression(args[2], row);
    }
    case "case": {
      if (args.length < 3) {
        return null;
      }
      const hasElseValue = args.length % 2 === 1;
      const pairLimit = hasElseValue ? args.length - 1 : args.length;
      for (let index = 0; index < pairLimit; index += 2) {
        if (coerceBoolean(evaluateReportCalculatedFieldExpression(args[index], row))) {
          return evaluateReportCalculatedFieldExpression(args[index + 1], row);
        }
      }
      return hasElseValue ? evaluateReportCalculatedFieldExpression(args[args.length - 1], row) : null;
    }
    case "coalesce": {
      for (const arg of args) {
        const value = evaluateReportCalculatedFieldExpression(arg, row);
        if (!isNullishValue(value)) {
          return value;
        }
      }
      return null;
    }
    case "isnull": {
      if (args.length !== 1) {
        return null;
      }
      return isNullishValue(evaluateReportCalculatedFieldExpression(args[0], row));
    }
    case "nullif": {
      if (args.length !== 2) {
        return null;
      }
      const left = evaluateReportCalculatedFieldExpression(args[0], row);
      const right = evaluateReportCalculatedFieldExpression(args[1], row);
      return compareValues(left, right, "=") ? null : left;
    }
    default:
      break;
  }

  const values = args.map((arg) => evaluateReportCalculatedFieldExpression(arg, row));
  switch (callee) {
    case "abs": {
      const numericValue = toFiniteNumber(values[0]);
      return numericValue == null ? null : Math.abs(numericValue);
    }
    case "round": {
      const numericValue = toFiniteNumber(values[0]);
      if (numericValue == null) {
        return null;
      }
      const decimals = values.length > 1 ? toFiniteNumber(values[1]) : 0;
      if (decimals == null) {
        return null;
      }
      const factor = 10 ** Math.max(0, Math.trunc(decimals));
      return Math.round(numericValue * factor) / factor;
    }
    case "floor": {
      const numericValue = toFiniteNumber(values[0]);
      return numericValue == null ? null : Math.floor(numericValue);
    }
    case "ceil": {
      const numericValue = toFiniteNumber(values[0]);
      return numericValue == null ? null : Math.ceil(numericValue);
    }
    case "min":
    case "least": {
      if (values.length === 0 || values.some((value) => toFiniteNumber(value) == null)) {
        return null;
      }
      return Math.min(...values.map((value) => toFiniteNumber(value)));
    }
    case "max":
    case "greatest": {
      if (values.length === 0 || values.some((value) => toFiniteNumber(value) == null)) {
        return null;
      }
      return Math.max(...values.map((value) => toFiniteNumber(value)));
    }
    case "concat": {
      if (values.some((value) => isNullishValue(value))) {
        return null;
      }
      return values.map((value) => String(value)).join("");
    }
    case "lower": {
      if (isNullishValue(values[0])) {
        return null;
      }
      return String(values[0]).toLowerCase();
    }
    case "upper": {
      if (isNullishValue(values[0])) {
        return null;
      }
      return String(values[0]).toUpperCase();
    }
    default:
      return null;
  }
}

export function evaluateReportCalculatedFieldExpression(expressionOrNode = null, row = {}) {
  const node = typeof expressionOrNode === "string"
    ? parseReportCalculatedFieldExpression(expressionOrNode)?.ast
    : expressionOrNode;
  if (!node || typeof node !== "object") {
    return null;
  }
  switch (node.type) {
    case "literal":
      return cloneValue(node.value);
    case "identifier": {
      const value = resolveKey(row, node.name);
      return value === undefined ? null : cloneValue(value);
    }
    case "unary": {
      const value = evaluateReportCalculatedFieldExpression(node.argument, row);
      if (node.operator === "not") {
        return !coerceBoolean(value);
      }
      if (node.operator === "-") {
        const numericValue = toFiniteNumber(value);
        return numericValue == null ? null : -numericValue;
      }
      return null;
    }
    case "binary": {
      if (node.operator === "and") {
        return coerceBoolean(evaluateReportCalculatedFieldExpression(node.left, row))
          && coerceBoolean(evaluateReportCalculatedFieldExpression(node.right, row));
      }
      if (node.operator === "or") {
        return coerceBoolean(evaluateReportCalculatedFieldExpression(node.left, row))
          || coerceBoolean(evaluateReportCalculatedFieldExpression(node.right, row));
      }
      const left = evaluateReportCalculatedFieldExpression(node.left, row);
      const right = evaluateReportCalculatedFieldExpression(node.right, row);
      if (node.operator === "+" || node.operator === "-" || node.operator === "*" || node.operator === "/" || node.operator === "%") {
        const leftNumber = toFiniteNumber(left);
        const rightNumber = toFiniteNumber(right);
        if (leftNumber == null || rightNumber == null) {
          return null;
        }
        if ((node.operator === "/" || node.operator === "%") && rightNumber === 0) {
          return null;
        }
        switch (node.operator) {
          case "+":
            return leftNumber + rightNumber;
          case "-":
            return leftNumber - rightNumber;
          case "*":
            return leftNumber * rightNumber;
          case "/":
            return leftNumber / rightNumber;
          case "%":
            return leftNumber % rightNumber;
          default:
            return null;
        }
      }
      return compareValues(left, right, node.operator);
    }
    case "call":
      return evaluateReportCalculatedFieldFunction(node, row);
    default:
      return null;
  }
}

function normalizeRatioCalculation(compute = {}) {
  const numerator = normalizeString(compute?.numerator);
  const denominator = normalizeString(compute?.denominator);
  if (!numerator || !denominator) {
    return null;
  }
  const next = {
    type: "ratio",
    numerator,
    denominator,
  };
  if (Number.isFinite(Number(compute?.scale))) {
    next.scale = Number(compute.scale);
  }
  if (Number.isFinite(Number(compute?.decimals))) {
    next.decimals = Number(compute.decimals);
  }
  return next;
}

function normalizePercentOfTotalCalculation(compute = {}) {
  const sourceField = normalizeString(compute?.sourceField);
  if (!sourceField) {
    return null;
  }
  const next = {
    type: "percentOfTotal",
    sourceField,
  };
  const partitionBy = normalizePartitionBy(compute?.partitionBy);
  if (partitionBy.length > 0) {
    next.partitionBy = partitionBy;
  }
  if (Number.isFinite(Number(compute?.scale))) {
    next.scale = Number(compute.scale);
  }
  if (Number.isFinite(Number(compute?.decimals))) {
    next.decimals = Number(compute.decimals);
  }
  return next;
}

function normalizeDeltaFromPreviousCalculation(compute = {}) {
  const sourceField = normalizeString(compute?.sourceField);
  const orderBy = normalizeOrderBy(compute?.orderBy);
  if (!sourceField || orderBy.length === 0) {
    return null;
  }
  const next = {
    type: "deltaFromPrevious",
    sourceField,
    orderBy,
  };
  const partitionBy = normalizePartitionBy(compute?.partitionBy);
  if (partitionBy.length > 0) {
    next.partitionBy = partitionBy;
  }
  return next;
}

function normalizeRunningTotalCalculation(compute = {}) {
  const sourceField = normalizeString(compute?.sourceField);
  const orderBy = normalizeOrderBy(compute?.orderBy);
  if (!sourceField || orderBy.length === 0) {
    return null;
  }
  const next = {
    type: "runningTotal",
    sourceField,
    orderBy,
  };
  const partitionBy = normalizePartitionBy(compute?.partitionBy);
  if (partitionBy.length > 0) {
    next.partitionBy = partitionBy;
  }
  return next;
}

function normalizeMovingAverageCalculation(compute = {}) {
  const sourceField = normalizeString(compute?.sourceField);
  const orderBy = normalizeOrderBy(compute?.orderBy);
  const windowSize = Math.max(1, Number(compute?.windowSize || 0) || 0);
  if (!sourceField || orderBy.length === 0 || !windowSize) {
    return null;
  }
  const next = {
    type: "movingAverage",
    sourceField,
    orderBy,
    windowSize,
  };
  if (Number.isFinite(Number(compute?.decimals))) {
    next.decimals = Number(compute.decimals);
  }
  const partitionBy = normalizePartitionBy(compute?.partitionBy);
  if (partitionBy.length > 0) {
    next.partitionBy = partitionBy;
  }
  return next;
}

function normalizeRankCalculation(compute = {}) {
  const sourceField = normalizeString(compute?.sourceField);
  const orderBy = normalizeOrderBy(compute?.orderBy);
  const tieMode = normalizeString(compute?.tieMode).toLowerCase();
  if (!sourceField || orderBy.length === 0 || orderBy[0]?.field !== sourceField) {
    return null;
  }
  if (tieMode && tieMode !== "dense") {
    return null;
  }
  const next = {
    type: "rank",
    sourceField,
    orderBy,
    tieMode: "dense",
  };
  const partitionBy = normalizePartitionBy(compute?.partitionBy);
  if (partitionBy.length > 0) {
    next.partitionBy = partitionBy;
  }
  return next;
}

function buildCalculatedFieldDependencies(definition = {}, inferredDependencies = []) {
  return Array.from(new Set([
    ...normalizeStringArray(definition?.dependencies),
    ...normalizeStringArray(inferredDependencies),
  ]));
}

function normalizeReportCalculatedFieldExpressionDefinition(definition = {}) {
  const expr = normalizeString(definition?.expr);
  if (!expr) {
    return null;
  }
  const parsed = parseReportCalculatedFieldExpression(expr);
  if (!parsed?.ast) {
    return null;
  }
  return {
    expr,
    dependencies: buildCalculatedFieldDependencies(definition, parsed.dependencies),
  };
}

function normalizeReportCalculatedFieldCompute(definition = {}) {
  const computeType = normalizeString(definition?.compute?.type).toLowerCase();
  let compute = null;
  if (computeType === "ratio") {
    compute = normalizeRatioCalculation(definition.compute);
  } else if (computeType === "percentoftotal") {
    compute = normalizePercentOfTotalCalculation(definition.compute);
  } else if (computeType === "deltafromprevious") {
    compute = normalizeDeltaFromPreviousCalculation(definition.compute);
  } else if (computeType === "runningtotal") {
    compute = normalizeRunningTotalCalculation(definition.compute);
  } else if (computeType === "movingaverage") {
    compute = normalizeMovingAverageCalculation(definition.compute);
  } else if (computeType === "rank") {
    compute = normalizeRankCalculation(definition.compute);
  }
  if (!compute) {
    return null;
  }
  const inferredDependencies = computeType === "percentoftotal"
    ? [compute.sourceField, ...normalizePartitionBy(compute.partitionBy)]
    : ((computeType === "deltafromprevious" || computeType === "runningtotal" || computeType === "movingaverage" || computeType === "rank")
      ? [compute.sourceField, ...compute.orderBy.map((entry) => entry.field), ...normalizePartitionBy(compute.partitionBy)]
      : [compute.numerator, compute.denominator]);
  return {
    compute,
    dependencies: buildCalculatedFieldDependencies(definition, inferredDependencies),
  };
}

export function normalizeReportCalculatedField(definition = {}, {
  datasetRef = "",
} = {}) {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return null;
  }
  const id = normalizeString(definition?.id || definition?.key);
  if (!id) {
    return null;
  }
  const normalizedExpression = normalizeReportCalculatedFieldExpressionDefinition(definition);
  const normalizedCompute = normalizedExpression ? null : normalizeReportCalculatedFieldCompute(definition);
  if (!normalizedExpression && !normalizedCompute) {
    return null;
  }
  const kind = normalizedExpression
    ? "rowCalc"
    : (normalizeString(normalizedCompute?.compute?.type).toLowerCase() === "percentoftotal"
      || normalizeString(normalizedCompute?.compute?.type).toLowerCase() === "deltafromprevious"
      || normalizeString(normalizedCompute?.compute?.type).toLowerCase() === "runningtotal"
      || normalizeString(normalizedCompute?.compute?.type).toLowerCase() === "movingaverage"
      || normalizeString(normalizedCompute?.compute?.type).toLowerCase() === "rank"
      ? "tableCalc"
      : "rowCalc");
  if (normalizedExpression && normalizeString(definition?.kind) && normalizeString(definition.kind) !== "rowCalc") {
    return null;
  }
  return {
    id,
    key: normalizeString(definition?.key || id),
    kind,
    label: normalizeString(definition?.label || id),
    dataType: normalizeString(definition?.dataType || "number") || "number",
    ...(normalizeString(definition?.format) ? { format: normalizeString(definition.format) } : {}),
    ...(normalizeString(datasetRef || definition?.datasetRef) ? { datasetRef: normalizeString(datasetRef || definition?.datasetRef) } : {}),
    dependencies: normalizedExpression?.dependencies || normalizedCompute?.dependencies || [],
    ...(normalizedExpression ? { expr: normalizedExpression.expr } : { compute: normalizedCompute.compute }),
  };
}

export function normalizeReportCalculatedFields(definitions = [], options = {}) {
  return (Array.isArray(definitions) ? definitions : [])
    .map((definition) => normalizeReportCalculatedField(definition, options))
    .filter(Boolean);
}

function buildPartitionGroups(rowsToPartition = [], partitionBy = []) {
  const normalizedPartitionBy = normalizePartitionBy(partitionBy);
  if (normalizedPartitionBy.length === 0) {
    return [[...rowsToPartition]];
  }
  const groups = new Map();
  rowsToPartition.forEach((row) => {
    const key = JSON.stringify(normalizedPartitionBy.map((field) => resolveKey(row, field)));
    const current = groups.get(key) || [];
    current.push(row);
    groups.set(key, current);
  });
  return Array.from(groups.values());
}

function sortRowsByOrder(rowsToSort = [], orderBy = []) {
  return [...rowsToSort].sort((left, right) => {
    for (const order of normalizeOrderBy(orderBy)) {
      const leftValue = resolveKey(left, order.field);
      const rightValue = resolveKey(right, order.field);
      if (leftValue === rightValue) {
        continue;
      }
      const comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { numeric: true });
      return order.direction === "desc" ? -comparison : comparison;
    }
    return 0;
  });
}

function topologicallySortRowCalculatedFields(definitions = []) {
  const byKey = new Map(
    definitions
      .map((definition) => [normalizeString(definition?.key || definition?.id), definition])
      .filter(([key]) => !!key),
  );
  const pending = new Set(byKey.keys());
  const sorted = [];
  let progressed = true;
  while (pending.size > 0 && progressed) {
    progressed = false;
    Array.from(pending).forEach((key) => {
      const definition = byKey.get(key);
      const unresolved = normalizeStringArray(definition?.dependencies).filter((dependencyKey) => {
        if (dependencyKey === key || !byKey.has(dependencyKey)) {
          return false;
        }
        return pending.has(dependencyKey);
      });
      if (unresolved.length > 0) {
        return;
      }
      sorted.push(definition);
      pending.delete(key);
      progressed = true;
    });
  }
  Array.from(pending).forEach((key) => {
    sorted.push(byKey.get(key));
  });
  return sorted;
}

export function applyReportCalculatedFields(rows = [], calculatedFields = [], {
  datasetRef = "",
} = {}) {
  const applicableFields = normalizeReportCalculatedFields(calculatedFields).filter((definition) => {
    const targetDatasetRef = normalizeString(definition?.datasetRef);
    if (!targetDatasetRef) {
      return true;
    }
    return targetDatasetRef === normalizeString(datasetRef);
  });
  if (applicableFields.length === 0) {
    return Array.isArray(rows) ? rows : [];
  }

  const compiledExpressions = new Map(
    applicableFields
      .filter((definition) => normalizeString(definition?.expr))
      .map((definition) => [normalizeString(definition?.key || definition?.id), parseReportCalculatedFieldExpression(definition.expr)?.ast || null]),
  );

  const rowCalculated = (Array.isArray(rows) ? rows : []).map((row) => {
    const next = { ...(row || {}) };
    topologicallySortRowCalculatedFields(applicableFields.filter((definition) => definition.kind === "rowCalc")).forEach((definition) => {
      const outputKey = normalizeString(definition?.key || definition?.id);
      if (!outputKey) {
        return;
      }
      if (normalizeString(definition?.expr)) {
        next[outputKey] = evaluateReportCalculatedFieldExpression(compiledExpressions.get(outputKey), next);
        return;
      }
      if (normalizeString(definition?.compute?.type) === "ratio") {
        const numerator = Number(resolveKey(next, definition.compute.numerator));
        const denominator = Number(resolveKey(next, definition.compute.denominator));
        const scale = Number.isFinite(Number(definition?.compute?.scale)) ? Number(definition.compute.scale) : 1;
        const decimals = Number.isFinite(Number(definition?.compute?.decimals)) ? Number(definition.compute.decimals) : null;
        let value = 0;
        if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
          value = (numerator / denominator) * scale;
        }
        if (decimals != null) {
          value = Number(value.toFixed(decimals));
        }
        next[outputKey] = value;
      }
    });
    return next;
  });

  const withTableCalcs = rowCalculated.map((row) => ({ ...row }));
  applicableFields
    .filter((definition) => normalizeString(definition?.compute?.type) === "percentOfTotal")
    .forEach((definition) => {
      const outputKey = normalizeString(definition?.key || definition?.id);
      const sourceField = normalizeString(definition?.compute?.sourceField);
      if (!outputKey || !sourceField) {
        return;
      }
      const scale = Number.isFinite(Number(definition?.compute?.scale)) ? Number(definition.compute.scale) : 100;
      const decimals = Number.isFinite(Number(definition?.compute?.decimals)) ? Number(definition.compute.decimals) : null;
      buildPartitionGroups(withTableCalcs, definition?.compute?.partitionBy).forEach((groupRows) => {
        const total = groupRows.reduce((sum, row) => {
          const value = toFiniteNumber(resolveKey(row, sourceField));
          return value != null ? sum + value : sum;
        }, 0);
        groupRows.forEach((row) => {
          const sourceValue = toFiniteNumber(resolveKey(row, sourceField));
          let value = 0;
          if (sourceValue != null && total !== 0) {
            value = (sourceValue / total) * scale;
          }
          if (decimals != null) {
            value = Number(value.toFixed(decimals));
          }
          row[outputKey] = value;
        });
      });
    });
  applicableFields
    .filter((definition) => normalizeString(definition?.compute?.type) === "deltaFromPrevious")
    .forEach((definition) => {
      const outputKey = normalizeString(definition?.key || definition?.id);
      const sourceField = normalizeString(definition?.compute?.sourceField);
      const orderBy = normalizeOrderBy(definition?.compute?.orderBy);
      if (!outputKey || !sourceField || orderBy.length === 0) {
        return;
      }
      buildPartitionGroups(withTableCalcs, definition?.compute?.partitionBy).forEach((groupRows) => {
        const sortedRows = sortRowsByOrder(groupRows, orderBy);
        let previousValue = null;
        sortedRows.forEach((row) => {
          const sourceValue = toFiniteNumber(resolveKey(row, sourceField));
          let value = 0;
          if (sourceValue != null && previousValue != null) {
            value = sourceValue - previousValue;
          }
          row[outputKey] = value;
          previousValue = sourceValue != null ? sourceValue : previousValue;
        });
      });
    });
  applicableFields
    .filter((definition) => normalizeString(definition?.compute?.type) === "runningTotal")
    .forEach((definition) => {
      const outputKey = normalizeString(definition?.key || definition?.id);
      const sourceField = normalizeString(definition?.compute?.sourceField);
      const orderBy = normalizeOrderBy(definition?.compute?.orderBy);
      if (!outputKey || !sourceField || orderBy.length === 0) {
        return;
      }
      buildPartitionGroups(withTableCalcs, definition?.compute?.partitionBy).forEach((groupRows) => {
        const sortedRows = sortRowsByOrder(groupRows, orderBy);
        let runningValue = 0;
        sortedRows.forEach((row) => {
          const sourceValue = toFiniteNumber(resolveKey(row, sourceField));
          if (sourceValue != null) {
            runningValue += sourceValue;
          }
          row[outputKey] = runningValue;
        });
      });
    });
  applicableFields
    .filter((definition) => normalizeString(definition?.compute?.type) === "movingAverage")
    .forEach((definition) => {
      const outputKey = normalizeString(definition?.key || definition?.id);
      const sourceField = normalizeString(definition?.compute?.sourceField);
      const orderBy = normalizeOrderBy(definition?.compute?.orderBy);
      const windowSize = Math.max(1, Number(definition?.compute?.windowSize || 0) || 0);
      if (!outputKey || !sourceField || orderBy.length === 0 || !windowSize) {
        return;
      }
      buildPartitionGroups(withTableCalcs, definition?.compute?.partitionBy).forEach((groupRows) => {
        const sortedRows = sortRowsByOrder(groupRows, orderBy);
        sortedRows.forEach((row, index) => {
          const windowRows = sortedRows.slice(Math.max(0, index - windowSize + 1), index + 1);
          const numericValues = windowRows
            .map((entry) => toFiniteNumber(resolveKey(entry, sourceField)))
            .filter((value) => value != null);
          let value = 0;
          if (numericValues.length > 0) {
            value = numericValues.reduce((sum, entry) => sum + entry, 0) / numericValues.length;
          }
          const decimals = Number.isFinite(Number(definition?.compute?.decimals)) ? Number(definition.compute.decimals) : null;
          if (decimals != null) {
            value = Number(value.toFixed(decimals));
          }
          row[outputKey] = value;
        });
      });
    });
  applicableFields
    .filter((definition) => normalizeString(definition?.compute?.type) === "rank")
    .forEach((definition) => {
      const outputKey = normalizeString(definition?.key || definition?.id);
      const sourceField = normalizeString(definition?.compute?.sourceField);
      const orderBy = normalizeOrderBy(definition?.compute?.orderBy);
      const tieMode = normalizeString(definition?.compute?.tieMode).toLowerCase();
      if (!outputKey || !sourceField || orderBy.length === 0 || orderBy[0]?.field !== sourceField) {
        return;
      }
      if (tieMode && tieMode !== "dense") {
        return;
      }
      buildPartitionGroups(withTableCalcs, definition?.compute?.partitionBy).forEach((groupRows) => {
        const sortedRows = sortRowsByOrder(groupRows, orderBy);
        let rank = 0;
        let previousValue;
        let hasPreviousValue = false;
        sortedRows.forEach((row) => {
          const sourceValue = resolveKey(row, sourceField);
          if (sourceValue === undefined || sourceValue === null || sourceValue === "") {
            row[outputKey] = null;
            return;
          }
          const normalizedValue = String(sourceValue);
          if (!hasPreviousValue || normalizedValue !== previousValue) {
            rank += 1;
            previousValue = normalizedValue;
            hasPreviousValue = true;
          }
          row[outputKey] = rank;
        });
      });
    });
  return withTableCalcs;
}

export function cloneReportCalculatedFields(calculatedFields = []) {
  return normalizeReportCalculatedFields(calculatedFields).map((definition) => cloneValue(definition));
}
