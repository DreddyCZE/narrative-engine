import { describe, expect, it } from "vitest";

import {
  CONDITION_CONTRACT_VERSION,
  evaluateCondition,
  inspectCondition,
  type ConditionEvaluationOptions
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
            zero: 0,
            empty: "",
            nullable: null,
            tags: ["alpha", "beta"],
            actorId: "npc.example.guard"
          }
        },
        {
          domainId: "state-domain.world.rooms",
          schemaId: "state-rooms",
          schemaVersion: 1,
          owner: "game",
          authority: "game",
          persistence: "run",
          data: {
            roomId: "room.example.hall",
            unlocked: true
          }
        }
      ]
    },
    meta: {
      domains: [
        {
          domainId: "state-domain.meta.profile",
          schemaId: "state-profile",
          schemaVersion: 1,
          owner: "engine",
          authority: "engine",
          persistence: "meta",
          data: {
            unlockedModes: ["story"]
          }
        }
      ]
    }
  } as const;
}

function baseCondition(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: CONDITION_CONTRACT_VERSION,
    schemaId: "condition",
    schemaVersion: 1,
    type: "constant",
    value: true,
    ...overrides
  } as Record<string, unknown>;
}

function mapNames(...pairs: Array<[string, Record<string, unknown>]>): ReadonlyMap<string, unknown> {
  return new Map(pairs);
}

describe("Condition evaluator", () => {
  it("accepts a valid constant condition", () => {
    const result = evaluateCondition(baseCondition({ value: true }), makeState());

    expect(result).toEqual({ matched: true, issues: [] });
  });

  it("rejects invalid shapes and unknown operators", () => {
    expect(inspectCondition("not-a-condition")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CONDITION_NOT_OBJECT"
        })
      ])
    );

    const unknownOperator = inspectCondition(baseCondition({ type: "unexpected" }));
    expect(unknownOperator[0]).toMatchObject({
      code: "CONDITION_UNKNOWN_OPERATOR",
      path: ["type"]
    });
  });

  it("rejects invalid paths and missing state paths", () => {
    const invalidPath = evaluateCondition(
      baseCondition({
        type: "exists",
        selector: { domainId: "state-domain.core.flags", path: "missing-slash" }
      }),
      makeState()
    );
    expect(invalidPath.issues[0]).toMatchObject({
      code: "CONDITION_INVALID_PATH",
      path: ["selector", "path"]
    });

    const missingPath = evaluateCondition(
      baseCondition({
        type: "exists",
        selector: { domainId: "state-domain.core.flags", path: "/missing" }
      }),
      makeState()
    );
    expect(missingPath.issues[0]).toMatchObject({
      code: "CONDITION_STATE_PATH_NOT_FOUND",
      path: ["selector", "path"]
    });
  });

  it("rejects non-json values and forbidden keys", () => {
    const cyclic: Record<string, unknown> = { nested: {} };
    (cyclic.nested as Record<string, unknown>).self = cyclic;

    const nonJson = inspectCondition(
      baseCondition({
        type: "constant",
        value: () => undefined
      })
    );
    expect(nonJson[0]).toMatchObject({
      code: "CONDITION_NON_JSON_VALUE"
    });

    const forbidden = inspectCondition(
      baseCondition({
        type: "constant",
        value: JSON.parse('{"__proto__":{"polluted":true}}')
      })
    );
    expect(forbidden.some((issue) => issue.code === "CONDITION_FORBIDDEN_KEY")).toBe(true);

    const cyclicIssues = inspectCondition(
      baseCondition({
        type: "constant",
        value: cyclic
      })
    );
    expect(cyclicIssues.some((issue) => issue.code === "CONDITION_NON_JSON_VALUE")).toBe(true);
  });

  it("supports all, any, and not semantics", () => {
    const all = evaluateCondition(
      baseCondition({
        type: "all",
        operands: [baseCondition({ type: "constant", value: true }), baseCondition({ type: "constant", value: true })]
      }),
      makeState()
    );
    const any = evaluateCondition(
      baseCondition({
        type: "any",
        operands: [baseCondition({ type: "constant", value: false }), baseCondition({ type: "constant", value: true })]
      }),
      makeState()
    );
    const not = evaluateCondition(
      baseCondition({
        type: "not",
        operands: [baseCondition({ type: "constant", value: false })]
      }),
      makeState()
    );

    expect(all).toEqual({ matched: true, issues: [] });
    expect(any).toEqual({ matched: true, issues: [] });
    expect(not).toEqual({ matched: true, issues: [] });
  });

  it("supports compare, contains, entity-is, domain-exists, and context-value operands", () => {
    const context = {
      actor: "npc.example.guard",
      mode: "story",
      schemaVersion: 1
    };

    const compare = evaluateCondition(
      baseCondition({
        type: "compare",
        operator: "eq",
        left: { kind: "literal", value: "npc.example.guard" },
        right: { kind: "context-value", key: "actor" }
      }),
      makeState(),
      { context } satisfies ConditionEvaluationOptions
    );

    const contains = evaluateCondition(
      baseCondition({
        type: "contains",
        collection: { kind: "literal", value: ["alpha", "beta"] },
        member: { kind: "literal", value: "beta" }
      }),
      makeState()
    );

    const entityIs = evaluateCondition(
      baseCondition({
        type: "entity-is",
        left: { kind: "entity-reference", id: "condition.core.one", entityType: "condition" },
        right: { kind: "entity-reference", id: "condition.core.one", entityType: "condition" }
      }),
      makeState()
    );

    const domainExists = evaluateCondition(
      baseCondition({
        type: "domain-exists",
        domainId: "state-domain.core.flags"
      }),
      makeState()
    );

    expect(compare).toEqual({ matched: true, issues: [] });
    expect(contains).toEqual({ matched: true, issues: [] });
    expect(entityIs).toEqual({ matched: true, issues: [] });
    expect(domainExists).toEqual({ matched: true, issues: [] });
  });

  it("resolves named condition references and detects cycles", () => {
    const named = mapNames(
      [
        "condition.core.always-true",
        {
          contractVersion: CONDITION_CONTRACT_VERSION,
          schemaId: "condition",
          schemaVersion: 1,
          conditionId: "condition.core.always-true",
          type: "constant",
          value: true
        }
      ],
      [
        "condition.core.entry",
        {
          contractVersion: CONDITION_CONTRACT_VERSION,
          schemaId: "condition",
          schemaVersion: 1,
          conditionId: "condition.core.entry",
          type: "condition-ref",
          targetConditionId: "condition.core.always-true"
        }
      ]
    );

    const result = evaluateCondition(named.get("condition.core.entry"), makeState(), { namedConditions: named });
    expect(result).toEqual({ matched: true, issues: [] });

    const cycle = mapNames([
      "condition.core.loop",
      {
        contractVersion: CONDITION_CONTRACT_VERSION,
        schemaId: "condition",
        schemaVersion: 1,
        conditionId: "condition.core.loop",
        type: "condition-ref",
        targetConditionId: "condition.core.loop"
      }
    ]);

    const cycleResult = evaluateCondition(cycle.get("condition.core.loop"), makeState(), { namedConditions: cycle });
    expect(cycleResult.issues[0]).toMatchObject({
      code: "CONDITION_REFERENCE_CYCLE",
      path: ["targetConditionId"]
    });
  });

  it("remains deterministic and does not mutate inputs", () => {
    const condition = baseCondition({
      type: "compare",
      operator: "eq",
      left: { kind: "literal", value: 3 },
      right: { kind: "state-value", selector: { domainId: "state-domain.core.clock", path: "/tick" } }
    });
    const state = makeState();
    const beforeCondition = JSON.stringify(condition);
    const beforeState = JSON.stringify(state);

    const first = evaluateCondition(condition, state);
    const second = evaluateCondition(condition, state);

    expect(first).toEqual(second);
    expect(JSON.stringify(condition)).toBe(beforeCondition);
    expect(JSON.stringify(state)).toBe(beforeState);
  });

  it("keeps stable diagnostic paths for invalid context and invalid operands", () => {
    const contextResult = evaluateCondition(
      baseCondition({
        type: "compare",
        operator: "eq",
        left: { kind: "context-value", key: "unknown" },
        right: { kind: "literal", value: "x" }
      }),
      makeState(),
      { context: { actor: "npc.example.guard", schemaVersion: 1 } }
    );

    expect(contextResult.issues[0]).toMatchObject({
      code: "CONDITION_INVALID_VALUE",
      path: ["left", "key"]
    });
  });
});
