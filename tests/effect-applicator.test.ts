import { describe, expect, it } from "vitest";

import {
  applyEffect,
  CONDITION_CONTRACT_VERSION,
  EFFECT_CONTRACT_VERSION,
  inspectEffect
} from "../packages/engine-contracts/src/index.js";

function makeState() {
  return {
    contractVersion: "engine-state@0.1.0",
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.run.example",
    revision: 4,
    run: {
      activeModules: ["module.core"],
      domains: [
        {
          domainId: "state-domain.core.clock",
          schemaId: "state-clock",
          schemaVersion: 1,
          owner: "engine",
          authority: "engine",
          persistence: "run",
          data: {
            tick: 3
          }
        },
        {
          domainId: "state-domain.core.flags",
          schemaId: "state-flags",
          schemaVersion: 1,
          owner: "game",
          authority: "game",
          persistence: "run",
          data: {
            paused: false,
            optionalFlag: true,
            tags: ["alpha", "beta"],
            settings: {
              alpha: 1,
              beta: 2
            }
          }
        },
        {
          domainId: "state-domain.core.inventory",
          schemaId: "state-inventory",
          schemaVersion: 1,
          owner: "game",
          authority: "game",
          persistence: "run",
          data: {
            items: ["one"]
          }
        }
      ]
    }
  } as const;
}

function baseEffect(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: EFFECT_CONTRACT_VERSION,
    schemaId: "effect",
    schemaVersion: 1,
    type: "set",
    target: {
      domainId: "state-domain.core.flags",
      path: "/paused"
    },
    ...overrides
  } as Record<string, unknown>;
}

function guardFalseEffect(overrides: Record<string, unknown> = {}) {
  return baseEffect({
    value: true,
    guard: {
      contractVersion: CONDITION_CONTRACT_VERSION,
      schemaId: "condition",
      schemaVersion: 1,
      type: "constant",
      value: false
    },
    ...overrides
  });
}

describe("Effect applicator", () => {
  it("applies a set effect and leaves the input unchanged", () => {
    const state = makeState();
    const before = JSON.stringify(state);
    const result = applyEffect(baseEffect({ value: true }), state);

    expect(result.status).toBe("applied");
    expect(result.applied).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.state.run.domains[1].data.paused).toBe(true);
    expect(state.run.domains[1].data.paused).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(result.changes).toEqual([
      {
        path: "/paused",
        before: false,
        after: true
      }
    ]);
  });

  it("treats canonical set no-ops as no-op", () => {
    const state = makeState();
    const result = applyEffect(
      baseEffect({
        type: "set",
        target: { domainId: "state-domain.core.flags", path: "/settings" },
        value: { beta: 2, alpha: 1 }
      }),
      state
    );

    expect(result.status).toBe("no-op");
    expect(result.applied).toBe(false);
    expect(result.changes).toEqual([]);
    expect(result.state.run.domains[1].data.settings).toEqual({ alpha: 1, beta: 2 });
  });

  it("creates a missing object leaf with set", () => {
    const state = makeState();
    const result = applyEffect(
      baseEffect({
        type: "set",
        target: { domainId: "state-domain.core.flags", path: "/settings/gamma" },
        value: 3
      }),
      state
    );

    expect(result.status).toBe("applied");
    expect(result.applied).toBe(true);
    expect(result.state.run.domains[1].data.settings).toEqual({ alpha: 1, beta: 2, gamma: 3 });
    expect(state.run.domains[1].data.settings).toEqual({ alpha: 1, beta: 2 });
  });

  it("supports unset and increment", () => {
    const state = makeState();
    const unset = applyEffect(
      baseEffect({
        type: "unset",
        target: { domainId: "state-domain.core.flags", path: "/optionalFlag" }
      }),
      state
    );
    const increment = applyEffect(
      baseEffect({
        type: "increment",
        target: { domainId: "state-domain.core.clock", path: "/tick" },
        delta: 2
      }),
      state
    );

    expect(unset.status).toBe("applied");
    expect(unset.state.run.domains[1].data.optionalFlag).toBeUndefined();
    expect(increment.status).toBe("applied");
    expect(increment.state.run.domains[0].data.tick).toBe(5);
  });

  it("treats missing unset targets as no-op", () => {
    const state = makeState();
    const result = applyEffect(
      baseEffect({
        type: "unset",
        target: { domainId: "state-domain.core.flags", path: "/missingOptional" }
      }),
      state
    );

    expect(result.status).toBe("no-op");
    expect(result.applied).toBe(false);
    expect(result.changes).toEqual([]);
    expect(result.state).not.toBe(state);
    expect(result.state).toEqual(state);
  });

  it("supports append, remove-at, add-unique, and remove-value", () => {
    const state = makeState();
    const append = applyEffect(
      baseEffect({
        type: "append",
        target: { domainId: "state-domain.core.flags", path: "/tags" },
        value: "gamma"
      }),
      state
    );
    const removeAt = applyEffect(
      baseEffect({
        type: "remove-at",
        target: { domainId: "state-domain.core.flags", path: "/tags" },
        index: 1
      }),
      state
    );
    const addUnique = applyEffect(
      baseEffect({
        type: "add-unique",
        target: { domainId: "state-domain.core.inventory", path: "/items" },
        value: "two"
      }),
      state
    );
    const removeValue = applyEffect(
      baseEffect({
        type: "remove-value",
        target: { domainId: "state-domain.core.flags", path: "/tags" },
        value: "beta"
      }),
      state
    );

    expect(append.status).toBe("applied");
    expect(append.state.run.domains[1].data.tags).toEqual(["alpha", "beta", "gamma"]);
    expect(removeAt.status).toBe("applied");
    expect(removeAt.state.run.domains[1].data.tags).toEqual(["alpha"]);
    expect(addUnique.status).toBe("applied");
    expect(addUnique.state.run.domains[2].data.items).toEqual(["one", "two"]);
    expect(removeValue.status).toBe("applied");
    expect(removeValue.state.run.domains[1].data.tags).toEqual(["alpha"]);
  });

  it("skips when the guard resolves false", () => {
    const state = makeState();
    const result = applyEffect(guardFalseEffect(), state);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("guard-false");
    expect(result.applied).toBe(false);
    expect(result.state).not.toBe(state);
    expect(result.state.run.domains[1].data.paused).toBe(false);
  });

  it("rejects invalid shapes, paths, values, and unknown operators", () => {
    expect(inspectEffect("not-an-effect")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EFFECT_NOT_OBJECT"
        })
      ])
    );

    const unknownOperator = inspectEffect(baseEffect({ type: "unexpected" }));
    expect(unknownOperator[0]).toMatchObject({
      code: "EFFECT_UNKNOWN_OPERATOR",
      path: ["type"]
    });

    const invalidPath = inspectEffect(
      baseEffect({
        target: { domainId: "state-domain.core.flags", path: "missing-slash" }
      })
    );
    expect(invalidPath[0]).toMatchObject({
      code: "EFFECT_INVALID_PATH",
      path: ["target", "path"]
    });

    const nonJson = inspectEffect(
      baseEffect({
        value: () => undefined
      })
    );
    expect(nonJson.some((issue) => issue.code === "EFFECT_NON_JSON_VALUE")).toBe(true);

    const forbidden = inspectEffect(
      baseEffect({
        value: JSON.parse('{"__proto__":{"polluted":true}}')
      })
    );
    expect(forbidden.some((issue) => issue.code === "EFFECT_FORBIDDEN_KEY")).toBe(true);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const cyclicIssues = inspectEffect(baseEffect({ value: cyclic }));
    expect(cyclicIssues.some((issue) => issue.code === "EFFECT_NON_JSON_VALUE")).toBe(true);
  });

  it("reports missing state paths and preserves deterministic results", () => {
    const state = makeState();
    const effect = baseEffect({
      type: "append",
      target: { domainId: "state-domain.core.flags", path: "/missing" },
      value: "gamma"
    });
    const first = applyEffect(effect, state);
    const second = applyEffect(effect, state);

    expect(first.status).toBe("error");
    expect(first.issues[0]).toMatchObject({
      code: "EFFECT_STATE_PATH_NOT_FOUND",
      path: ["target", "path"]
    });
    expect(first).toEqual(second);
  });

  it("keeps the input immutable across repeated application", () => {
    const state = makeState();
    const before = JSON.stringify(state);
    const effect = baseEffect({
      type: "remove-value",
      target: { domainId: "state-domain.core.flags", path: "/tags" },
      value: "alpha"
    });

    const first = applyEffect(effect, state);
    const second = applyEffect(effect, state);

    expect(first.state).not.toBe(second.state);
    expect(JSON.stringify(state)).toBe(before);
    expect(first.state.run.domains[1].data.tags).toEqual(["beta"]);
    expect(second.state.run.domains[1].data.tags).toEqual(["beta"]);
  });

  it("keeps stable diagnostic paths for guard failures", () => {
    const state = makeState();
    const result = applyEffect(
      baseEffect({
        guard: {
          contractVersion: CONDITION_CONTRACT_VERSION,
          schemaId: "condition",
          schemaVersion: 1,
          type: "exists",
          selector: { domainId: "state-domain.core.flags", path: "missing-slash" }
        }
      }),
      state
    );

    expect(result.status).toBe("error");
    expect(result.issues[0]).toMatchObject({
      code: "EFFECT_INVALID_PATH",
      path: ["guard", "selector", "path"]
    });
  });
});
