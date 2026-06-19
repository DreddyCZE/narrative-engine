import { describe, expect, it } from "vitest";

import {
  assertJsonSafe,
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  isJsonSafe
} from "../../packages/core/src/index.js";

class ExampleInstance {
  public readonly value = 1;
}

describe("JSON-safe utilities", () => {
  it("accepts primitive values", () => {
    expect(isJsonSafe(null)).toBe(true);
    expect(isJsonSafe(true)).toBe(true);
    expect(isJsonSafe("hello")).toBe(true);
    expect(isJsonSafe(42)).toBe(true);
  });

  it("accepts nested objects and arrays", () => {
    const value = {
      alpha: 1,
      beta: ["x", { gamma: true }]
    };

    expect(isJsonSafe(value)).toBe(true);
    expect(inspectJsonSafety(value)).toEqual([]);
  });

  it("canonicalizes with deterministic object key ordering", () => {
    const first = canonicalizeJson({
      b: 2,
      a: 1,
      nested: {
        z: 3,
        y: 2
      }
    });
    const second = canonicalizeJson({
      nested: {
        y: 2,
        z: 3
      },
      a: 1,
      b: 2
    });

    expect(first).toBe('{"a":1,"b":2,"nested":{"y":2,"z":3}}');
    expect(second).toBe(first);
  });

  it("preserves array order during canonicalization", () => {
    expect(canonicalizeJson([3, 2, 1])).toBe("[3,2,1]");
  });

  it("rejects forbidden keys", () => {
    const values = [
      JSON.parse('{ "__proto__": 1 }'),
      JSON.parse('{ "prototype": 1 }'),
      JSON.parse('{ "constructor": 1 }')
    ];

    for (const value of values) {
      const issues = inspectJsonSafety(value);
      expect(issues[0]?.code).toBe("FORBIDDEN_KEY");
      expect(isJsonSafe(value)).toBe(false);
    }
  });

  it("rejects cycles", () => {
    const value: Record<string, unknown> = { name: "cycle" };
    value.self = value;

    const issues = inspectJsonSafety(value);

    expect(issues.some((issue) => issue.code === "CYCLIC_VALUE")).toBe(true);
    expect(isJsonSafe(value)).toBe(false);
  });

  it("rejects undefined, function, symbol, bigint, Date, RegExp, Map, Set, and class instances", () => {
    const cases: Array<[unknown, string]> = [
      [undefined, "NON_JSON_VALUE"],
      [() => undefined, "NON_JSON_VALUE"],
      [Symbol("x"), "NON_JSON_VALUE"],
      [1n, "NON_JSON_VALUE"],
      [new Date("2024-01-01T00:00:00.000Z"), "NON_JSON_VALUE"],
      [/x/, "NON_JSON_VALUE"],
      [new Map(), "NON_JSON_VALUE"],
      [new Set(), "NON_JSON_VALUE"],
      [new ExampleInstance(), "NON_JSON_VALUE"]
    ];

    for (const [value, code] of cases) {
      const issues = inspectJsonSafety(value);
      expect(issues[0]?.code).toBe(code);
      expect(isJsonSafe(value)).toBe(false);
    }
  });

  it("rejects unsafe numbers", () => {
    const issues = inspectJsonSafety({
      bad: Number.NaN,
      worse: Number.POSITIVE_INFINITY,
      lower: Number.NEGATIVE_INFINITY
    });

    expect(issues.filter((issue) => issue.code === "UNSAFE_NUMBER")).toHaveLength(3);
  });

  it("enforces depth and node limits", () => {
    const nested = { a: { b: { c: 1 } } };
    expect(inspectJsonSafety(nested, { maxDepth: 1 }).some((issue) => issue.code === "DEPTH_LIMIT_EXCEEDED")).toBe(
      true
    );

    expect(inspectJsonSafety([1, 2, 3], { maxNodes: 2 }).some((issue) => issue.code === "NODE_LIMIT_EXCEEDED")).toBe(
      true
    );
  });

  it("formats JSON paths as JSON Pointers", () => {
    expect(formatJsonPath([])).toBe("");
    expect(formatJsonPath(["alpha", 2, "beta/gamma", "delta~epsilon"])).toBe("/alpha/2/beta~1gamma/delta~0epsilon");
  });

  it("supports assertion helpers and canonical output stability", () => {
    const value = {
      c: 3,
      a: [{ z: 1, y: 2 }],
      b: { d: true, c: false }
    };

    expect(() => {
      assertJsonSafe(value);
    }).not.toThrow();
    expect(canonicalizeJson(value)).toBe('{"a":[{"y":2,"z":1}],"b":{"c":false,"d":true},"c":3}');
    expect(canonicalizeJson(value)).toBe(canonicalizeJson(value));
  });
});
