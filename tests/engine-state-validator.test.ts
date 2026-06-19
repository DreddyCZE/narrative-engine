import { describe, expect, it } from "vitest";

import {
  assertEngineStateSnapshot,
  inspectEngineStateSnapshot,
  isEngineStateSnapshot,
  validateEngineStateSnapshot
} from "../packages/engine-contracts/src/index.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeValidState() {
  return {
    contractVersion: "engine-state@0.1.0",
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.demo.current",
    revision: 0,
    requiredDomains: ["state-domain.core.clock"],
    run: {
      seed: "demo-seed",
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
            heroId: "room.demo.start",
            entities: [
              {
                contractVersion: "entity-identity@0.1.0",
                id: "room.demo.start",
                entityType: "room",
                namespace: "demo",
                schemaVersion: 1
              }
            ]
          }
        }
      ]
    }
  } as const;
}

describe("Engine State validator", () => {
  it("accepts a valid minimal snapshot", () => {
    const state = makeValidState();

    expect(isEngineStateSnapshot(state)).toBe(true);
    expect(inspectEngineStateSnapshot(state)).toEqual([]);
    expect(validateEngineStateSnapshot(state)).toEqual({ valid: true, issues: [] });
  });

  it("reports missing root object and non-JSON values", () => {
    expect(inspectEngineStateSnapshot(undefined as unknown)[0]?.code).toBe("ENGINE_STATE_NOT_OBJECT");
    expect(
      inspectEngineStateSnapshot(
        JSON.parse(
          '{"contractVersion":"engine-state@0.1.0","schemaId":"engine-state","schemaVersion":1,"stateId":"state.demo.current","revision":0,"run":{"domains":[]},"__proto__":1}'
        )
      ).some((issue) => issue.code === "ENGINE_STATE_FORBIDDEN_KEY")
    ).toBe(true);
  });

  it("rejects cyclic state values and keeps diagnostics stable", () => {
    const state: Record<string, unknown> = clone(makeValidState());
    state.self = state;

    const first = inspectEngineStateSnapshot(state);
    const second = inspectEngineStateSnapshot(state);

    expect(first).toEqual(second);
    expect(first.some((issue) => issue.code === "ENGINE_STATE_NON_JSON_VALUE")).toBe(true);
  });

  it("rejects invalid schema metadata and revision values", () => {
    const missingRevision = clone(makeValidState());
    delete (missingRevision as Partial<typeof missingRevision>).revision;

    expect(inspectEngineStateSnapshot(missingRevision).some((issue) => issue.code === "ENGINE_STATE_MISSING_REVISION")).toBe(true);
    expect(
      inspectEngineStateSnapshot({
        ...makeValidState(),
        schemaVersion: 2
      }).some((issue) => issue.code === "ENGINE_STATE_INVALID_SCHEMA_VERSION")
    ).toBe(true);
    expect(
      inspectEngineStateSnapshot({
        ...makeValidState(),
        revision: -1
      }).some((issue) => issue.code === "ENGINE_STATE_INVALID_REVISION")
    ).toBe(true);
  });

  it("rejects missing domain collections and invalid entity references", () => {
    expect(
      inspectEngineStateSnapshot({
        ...makeValidState(),
        run: {
          seed: "demo-seed",
          activeModules: ["module.core"]
        },
        requiredDomains: ["state-domain.core.clock"]
      }).some((issue) => issue.code === "ENGINE_STATE_MISSING_ENTITIES")
    ).toBe(true);

    expect(
      inspectEngineStateSnapshot({
        ...makeValidState(),
        run: {
          seed: "demo-seed",
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
                mainEntityId: "not-a-canonical-id"
              }
            }
          ]
        }
      }).some((issue) => issue.code === "ENGINE_STATE_INVALID_ENTITY_IDENTITY")
    ).toBe(true);
  });

  it("rejects duplicate entity ids and preserves input immutability", () => {
    const state = makeValidState();
    const mutable = clone(state);
    mutable.run.domains[0].data.entities = [
      {
        contractVersion: "entity-identity@0.1.0",
        id: "room.demo.start",
        entityType: "room",
        namespace: "demo",
        schemaVersion: 1
      },
      {
        contractVersion: "entity-identity@0.1.0",
        id: "room.demo.start",
        entityType: "room",
        namespace: "demo",
        schemaVersion: 1
      }
    ];

    const before = JSON.stringify(mutable);
    const result = validateEngineStateSnapshot(mutable);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "ENGINE_STATE_DUPLICATE_ENTITY_ID")).toBe(true);
    expect(JSON.stringify(mutable)).toBe(before);
  });

  it("asserts successfully for valid snapshots and throws for invalid snapshots", () => {
    expect(() => {
      assertEngineStateSnapshot(makeValidState());
    }).not.toThrow();
    expect(() => {
      assertEngineStateSnapshot({
        ...makeValidState(),
        stateId: "bad"
      });
    }).toThrowError(/ENGINE_STATE_INVALID_ENTITIES/);
  });

  it("keeps diagnostic paths stable", () => {
    const issues = inspectEngineStateSnapshot({
      ...makeValidState(),
      run: {
        seed: "demo-seed",
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
              mainEntityId: "not-a-canonical-id"
            }
          }
        ]
      }
    });

    expect(issues[0]?.path).toEqual(["run", "domains", 0, "data", "mainEntityId"]);
  });
});
