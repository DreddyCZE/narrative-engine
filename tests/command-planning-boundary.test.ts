import { describe, expect, it } from "vitest";

import {
  COMMAND_CONTRACT_VERSION,
  COMMAND_SCHEMA_ID,
  COMMAND_SCHEMA_VERSION,
  inspectCommand,
  planCommand,
  type PlanningHistory
} from "../packages/engine-kernel/src/index.js";

type Command = {
  contractVersion: typeof COMMAND_CONTRACT_VERSION;
  schemaId: typeof COMMAND_SCHEMA_ID;
  schemaVersion: typeof COMMAND_SCHEMA_VERSION;
  commandId?: string;
  commandType: string;
  expectedRevision?: number;
  actor?: { id: string; entityType: string };
  initiator?: { kind: string; sourceId?: string };
  targets?: { id: string; entityType: string }[];
  preconditions?: unknown[];
  payload: unknown;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
};

type EngineStateSnapshot = {
  contractVersion: "engine-state@0.1.0";
  schemaId: "engine-state";
  schemaVersion: number;
  stateId: string;
  revision: number;
  run: {
    seed: string;
    activeModules: string[];
    domains: Array<{
      domainId: string;
      schemaId: string;
      schemaVersion: number;
      owner: string;
      authority: string;
      persistence: string;
      data: Record<string, unknown>;
    }>;
  };
};

const conditionContractVersion = "condition@0.1.0" as const;

function makeState(): EngineStateSnapshot {
  return {
    contractVersion: "engine-state@0.1.0",
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.runtime.current",
    revision: 42,
    requiredDomains: ["state-domain.core.world"],
    run: {
      seed: "seed-42",
      activeModules: ["module.core"],
      domains: [
        {
          domainId: "state-domain.core.world",
          schemaId: "state-world",
          schemaVersion: 1,
          owner: "engine",
          authority: "engine",
          persistence: "run",
          data: {
            doors: {
              main: {
                state: "closed"
              },
              side: {
                state: "closed"
              }
            },
            flags: {
              paused: false
            }
          }
        }
      ]
    }
  };
}

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    contractVersion: COMMAND_CONTRACT_VERSION,
    schemaId: COMMAND_SCHEMA_ID,
    schemaVersion: COMMAND_SCHEMA_VERSION,
    commandType: "core.validate-only",
    initiator: {
      kind: "system"
    },
    payload: {},
    ...overrides
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeForbiddenPayload(): unknown {
  return { ["__proto__"]: { polluted: true } };
}

function makeCyclicPayload(): unknown {
  const payload: Record<string, unknown> = {};
  payload.self = payload;
  return payload;
}

function makeFalsePrecondition(): unknown {
  return {
    contractVersion: conditionContractVersion,
    schemaId: "condition",
    schemaVersion: 1,
    type: "constant",
    value: false
  };
}

function makeInvalidPrecondition(): unknown {
  return {
    contractVersion: conditionContractVersion,
    schemaId: "condition",
    schemaVersion: 1,
    type: "not",
    operands: []
  };
}

describe("Command planning boundary", () => {
  it("inspects a valid command envelope", () => {
    expect(inspectCommand(makeCommand())).toEqual([]);
  });

  it("plans a validate-only command without effects", () => {
    const result = planCommand(makeCommand(), makeState());

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") {
      throw new Error("expected accepted");
    }
    expect(result.plan.baseRevision).toBe(42);
    expect(result.plan.effects).toEqual([]);
    expect(Object.keys(result).sort()).toEqual(["plan", "status"]);
  });

  it("plans a single set-value command", () => {
    const result = planCommand(
      makeCommand({
        commandType: "core.set-value",
        payload: {
          value: "open"
        }
      }),
      makeState()
    );

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") {
      throw new Error("expected accepted");
    }
    expect(result.plan.effects).toEqual([
      {
        contractVersion: "effect@0.1.0",
        schemaId: "effect",
        schemaVersion: 1,
        type: "set",
        target: {
          domainId: "state-domain.core.world",
          path: "/doors/main/state"
        },
        value: "open"
      }
    ]);
  });

  it("plans double-set commands deterministically", () => {
    const command = makeCommand({
      commandId: "command.runtime.open-main-door",
      commandType: "core.double-set",
      payload: {
        values: ["open", "open"]
      }
    });
    const state = makeState();

    const first = planCommand(command, state);
    const second = planCommand(cloneJson(command), cloneJson(state));

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("accepted");
    expect(first).toEqual(second);
    if (first.status === "accepted") {
      expect(first.plan.effects).toHaveLength(2);
    }
  });

  it("rejects false preconditions", () => {
    const result = planCommand(
      makeCommand({
        commandType: "core.set-value",
        preconditions: [makeFalsePrecondition()],
        payload: {
          value: "open"
        }
      }),
      makeState()
    );

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected rejected");
    }
    expect(result.reason).toBe("precondition-false");
    expect(result.diagnostics).toEqual([]);
  });

  it("reports invalid preconditions with stable diagnostics paths", () => {
    const result = planCommand(
      makeCommand({
        commandType: "core.set-value",
        preconditions: [makeInvalidPrecondition()],
        payload: {
          value: "open"
        }
      }),
      makeState()
    );

    expect(result.status).toBe("error");
    if (result.status !== "error") {
      throw new Error("expected error");
    }
    expect(result.diagnostics[0]?.path).toBe("/preconditions");
  });

  it("errors on missing handler and unknown type", () => {
    expect(
      planCommand(
        makeCommand({
          commandType: "core.missing-handler"
        }),
        makeState()
      ).status
    ).toBe("error");

    expect(
      planCommand(
        makeCommand({
          commandType: "core.unknown-handler"
        }),
        makeState()
      ).status
    ).toBe("error");
  });

  it("errors on invalid effect plans", () => {
    const result = planCommand(
      makeCommand({
        commandType: "core.invalid-effect-plan"
      }),
      makeState()
    );

    expect(result.status).toBe("error");
    if (result.status !== "error") {
      throw new Error("expected error");
    }
    expect(result.diagnostics[0]?.path).toBe("/plan/effects");
  });

  it("rejects invalid, non-JSON, forbidden-key, and cyclic commands", () => {
    expect(planCommand(null, makeState()).status).toBe("error");

    const forbidden = makeCommand();
    forbidden.payload = makeForbiddenPayload();
    expect(planCommand(forbidden, makeState()).status).toBe("error");

    const cyclic = makeCommand();
    cyclic.payload = makeCyclicPayload();
    expect(planCommand(cyclic, makeState()).status).toBe("error");
  });

  it("detects duplicate command IDs and idempotency keys", () => {
    const history: PlanningHistory = {
      commandIds: new Map<string, string>(),
      idempotencyKeys: new Map<string, string>()
    };
    const command = makeCommand({
      commandId: "command.runtime.open-main-door",
      idempotencyKey: "idem-1",
      commandType: "core.validate-only"
    });

    const first = planCommand(command, makeState(), { history });
    const second = planCommand(cloneJson(command), makeState(), { history });

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("duplicate");
  });

  it("preserves command and state immutability", () => {
    const command = deepFreeze(
      makeCommand({
        commandType: "core.set-value",
        commandId: "command.runtime.open-main-door",
        payload: {
          value: "open"
        }
      })
    );
    const state = deepFreeze(makeState());

    const beforeCommand = cloneJson(command);
    const beforeState = cloneJson(state);
    const result = planCommand(command, state);

    expect(result.status).toBe("accepted");
    expect(command).toEqual(beforeCommand);
    expect(state).toEqual(beforeState);
  });

  it("exposes only planning data and no transaction/runtime side effects", () => {
    const result = planCommand(makeCommand(), makeState());

    expect(Object.keys(result).sort()).toEqual(["plan", "status"]);
    if (result.status !== "accepted") {
      throw new Error("expected accepted");
    }
    expect(Object.keys(result.plan).sort()).toEqual(["baseRevision", "effects"]);
  });
});
