export type JsonPrimitive = string | number | boolean | null;

export type JsonArray = readonly JsonValue[];

export type JsonObject = {
  readonly [key: string]: JsonValue;
};

export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

export type JsonPathSegment = string | number;

export type JsonPath = readonly JsonPathSegment[];

export type JsonSafetyIssueCode =
  | "NON_JSON_VALUE"
  | "UNSAFE_NUMBER"
  | "FORBIDDEN_KEY"
  | "CYCLIC_VALUE"
  | "DEPTH_LIMIT_EXCEEDED"
  | "NODE_LIMIT_EXCEEDED";

export type JsonSafetyIssue = {
  readonly code: JsonSafetyIssueCode;
  readonly path: JsonPath;
  readonly message: string;
};

export type JsonSafetyOptions = {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly forbiddenKeys?: readonly string[];
};

export class JsonSafetyError extends TypeError {
  public readonly issues: readonly JsonSafetyIssue[];

  public constructor(issues: readonly JsonSafetyIssue[]) {
    super(formatJsonSafetyErrorMessage(issues));
    this.name = "JsonSafetyError";
    this.issues = issues;
  }
}

const DEFAULT_FORBIDDEN_KEYS = ["__proto__", "prototype", "constructor"] as const;

function normalizeLimit(value: number | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }

  return value;
}

function isPlainObject(value: object): value is JsonObject {
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function formatValueKind(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (value instanceof Date) {
    return "Date";
  }

  if (value instanceof RegExp) {
    return "RegExp";
  }

  if (value instanceof Map) {
    return "Map";
  }

  if (value instanceof Set) {
    return "Set";
  }

  return typeof value;
}

function issue(
  code: JsonSafetyIssueCode,
  path: JsonPath,
  message: string,
  issues: JsonSafetyIssue[]
): void {
  issues.push({
    code,
    path: path.slice(),
    message
  });
}

type JsonSafetyState = {
  readonly forbiddenKeys: ReadonlySet<string>;
  maxDepth?: number;
  maxNodes?: number;
  nodes: number;
  stack: WeakSet<object>;
};

function inspectNode(
  value: unknown,
  path: JsonPath,
  issues: JsonSafetyIssue[],
  state: JsonSafetyState,
  containerDepth: number
): void {
  state.nodes += 1;

  if (state.maxNodes !== undefined && state.nodes > state.maxNodes) {
    issue(
      "NODE_LIMIT_EXCEEDED",
      path,
      `Maximum node count ${String(state.maxNodes)} exceeded.`,
      issues
    );
    return;
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      issue("UNSAFE_NUMBER", path, "Number must be finite.", issues);
    }
    return;
  }

  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    issue("NON_JSON_VALUE", path, `Value of type ${typeof value} is not JSON-safe.`, issues);
    return;
  }

  if (value instanceof Date || value instanceof RegExp || value instanceof Map || value instanceof Set) {
    issue("NON_JSON_VALUE", path, `Value of type ${formatValueKind(value)} is not JSON-safe.`, issues);
    return;
  }

  if (typeof value !== "object") {
    issue("NON_JSON_VALUE", path, `Value of type ${typeof value} is not JSON-safe.`, issues);
    return;
  }

  if (state.stack.has(value)) {
    issue("CYCLIC_VALUE", path, "Cyclic value detected.", issues);
    return;
  }

  if (Array.isArray(value)) {
    if (state.maxDepth !== undefined && containerDepth > state.maxDepth) {
      issue("DEPTH_LIMIT_EXCEEDED", path, `Maximum depth ${String(state.maxDepth)} exceeded.`, issues);
      return;
    }

    state.stack.add(value);
    for (let index = 0; index < value.length; index += 1) {
      inspectNode(value[index], [...path, index], issues, state, containerDepth + 1);
    }
    state.stack.delete(value);
    return;
  }

  if (!isPlainObject(value)) {
    issue(
      "NON_JSON_VALUE",
      path,
      `Value with prototype ${Object.prototype.toString.call(value).slice(8, -1)} is not JSON-safe.`,
      issues
    );
    return;
  }

  if (state.maxDepth !== undefined && containerDepth > state.maxDepth) {
    issue("DEPTH_LIMIT_EXCEEDED", path, `Maximum depth ${String(state.maxDepth)} exceeded.`, issues);
    return;
  }

  state.stack.add(value);
  for (const key of Object.keys(value).sort()) {
    if (state.forbiddenKeys.has(key)) {
      issue("FORBIDDEN_KEY", [...path, key], `Forbidden key "${key}" is not allowed.`, issues);
      continue;
    }

    inspectNode(value[key], [...path, key], issues, state, containerDepth + 1);
  }
  state.stack.delete(value);
}

export function inspectJsonSafety(
  value: unknown,
  options: JsonSafetyOptions = {}
): readonly JsonSafetyIssue[] {
  const maxDepth = normalizeLimit(options.maxDepth, "maxDepth");
  const maxNodes = normalizeLimit(options.maxNodes, "maxNodes");
  const forbiddenKeys = new Set(options.forbiddenKeys ?? DEFAULT_FORBIDDEN_KEYS);
  const issues: JsonSafetyIssue[] = [];
  const state: JsonSafetyState = {
    forbiddenKeys,
    nodes: 0,
    stack: new WeakSet<object>()
  };

  if (maxDepth !== undefined) {
    state.maxDepth = maxDepth;
  }

  if (maxNodes !== undefined) {
    state.maxNodes = maxNodes;
  }

  inspectNode(value, [], issues, state, 0);
  return issues;
}

export function isJsonSafe(value: unknown, options: JsonSafetyOptions = {}): value is JsonValue {
  return inspectJsonSafety(value, options).length === 0;
}

export function assertJsonSafe(
  value: unknown,
  options: JsonSafetyOptions = {}
): asserts value is JsonValue {
  const issues = inspectJsonSafety(value, options);
  if (issues.length > 0) {
    throw new JsonSafetyError(issues);
  }
}

export function formatJsonSafetyErrorMessage(issues: readonly JsonSafetyIssue[]): string {
  const firstIssue = issues[0];
  if (!firstIssue) {
    return "Value is JSON-safe.";
  }

  return `${firstIssue.code}: ${firstIssue.message}`;
}
