import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { applyEffect } from "../packages/engine-contracts/src/index.js";
import { materializeDomainEvents, planCommand, runCommandTransaction, runTransaction } from "../packages/engine-kernel/src/index.js";

type EngineStateSnapshot = {
  contractVersion: "engine-state@0.1.0";
  schemaId: "engine-state";
  schemaVersion: 1;
  stateId: string;
  revision: number;
  requiredDomains: string[];
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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
              main: { state: "closed" },
              side: { state: "closed" }
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

function makeCommand() {
  return {
    contractVersion: "command@0.1.0" as const,
    schemaId: "command" as const,
    schemaVersion: 1 as const,
    commandId: "command.runtime.open-main-door",
    commandType: "core.set-value",
    expectedRevision: 42,
    initiator: {
      kind: "system"
    },
    targets: [
      {
        id: "device.example.main-door",
        entityType: "device"
      }
    ],
    preconditions: [
      {
        contractVersion: "condition@0.1.0" as const,
        schemaId: "condition" as const,
        schemaVersion: 1 as const,
        type: "constant",
        value: true
      }
    ],
    payload: {
      value: "open"
    },
    correlationId: "corr.runtime.open-main-door",
    causationId: "cause.runtime.open-main-door"
  };
}

function makeFalsePreconditionCommand() {
  const command = makeCommand();
  command.preconditions = [
    {
      contractVersion: "condition@0.1.0" as const,
      schemaId: "condition" as const,
      schemaVersion: 1 as const,
      type: "constant",
      value: false
    }
  ];
  return command;
}

function makeTransactionRequest(plan: { baseRevision: number; effects: readonly unknown[] }, commandId: string) {
  return {
    contractVersion: "transaction@0.1.0" as const,
    schemaId: "transaction" as const,
    schemaVersion: 1 as const,
    transactionId: "transaction.runtime.open-main-door",
    baseRevision: plan.baseRevision,
    source: {
      kind: "command-plan" as const,
      commandId,
      commandType: "core.set-value",
      allowNoOp: false
    },
    effects: plan.effects
  };
}

function makeCommittedCandidateEvent() {
  return {
    contractVersion: "domain-event@0.1.0" as const,
    schemaId: "domain-event" as const,
    schemaVersion: 1 as const,
    eventId: "domain-event.engine.main-door-opened-0",
    eventType: "core.door-opened",
    transactionId: "transaction.runtime.open-main-door",
    previousRevision: 42,
    revision: 43,
    sequence: 0,
    commandId: "command.runtime.open-main-door",
    correlationId: "corr.runtime.open-main-door",
    causationKind: "command" as const,
    causationId: "cause.runtime.open-main-door",
    payload: {
      door: {
        id: "device.example.main-door",
        entityType: "device"
      },
      state: "open"
    }
  };
}

function readDoorState(state: EngineStateSnapshot): unknown {
  return state.run.domains[0]?.data.doors && (state.run.domains[0].data.doors as Record<string, unknown>).main
    ? ((state.run.domains[0].data.doors as Record<string, unknown>).main as Record<string, unknown>).state
    : undefined;
}

describe("Minimal e2e contract pipeline", () => {
  it("minimal e2e pipeline commits state and materializes deterministic events", () => {
    const state = makeState();
    const command = makeCommand();
    const beforeState = canonicalizeJson(state);
    const beforeCommand = canonicalizeJson(command);

    const planned = planCommand(command, state);
    expect(planned.status).toBe("accepted");
    if (planned.status !== "accepted") {
      throw new Error("expected accepted plan");
    }

    const candidate = applyEffect(planned.plan.effects[0], state);
    expect(candidate.status).toBe("applied");
    expect(readDoorState(candidate.state as EngineStateSnapshot)).toBe("open");
    expect(readDoorState(state)).toBe("closed");

    const transaction = makeTransactionRequest(planned.plan, command.commandId);
    const beforeTransaction = canonicalizeJson(transaction);
    const committed = runTransaction(transaction, state);

    expect(committed.status).toBe("committed");
    if (committed.status !== "committed") {
      throw new Error("expected committed transaction");
    }
    expect(committed.baseRevision).toBe(42);
    expect(committed.newRevision).toBe(43);
    expect(committed.changes).toEqual([
      {
        path: "/doors/main/state",
        before: "closed",
        after: "open"
      }
    ]);

    const eventCandidate = makeCommittedCandidateEvent();
    const beforeCandidate = canonicalizeJson(eventCandidate);
    const materialized = materializeDomainEvents({
      transaction: {
        status: committed.status,
        transactionId: transaction.transactionId,
        baseRevision: committed.baseRevision,
        newRevision: committed.newRevision,
        source: {
          kind: "command-plan",
          commandId: command.commandId
        },
        commandId: command.commandId,
        correlationId: command.correlationId,
        causationKind: "command",
        causationId: command.causationId
      },
      candidate: eventCandidate
    });
    const repeated = materializeDomainEvents({
      transaction: {
        status: committed.status,
        transactionId: transaction.transactionId,
        baseRevision: committed.baseRevision,
        newRevision: committed.newRevision,
        source: {
          kind: "command-plan",
          commandId: command.commandId
        },
        commandId: command.commandId,
        correlationId: command.correlationId,
        causationKind: "command",
        causationId: command.causationId
      },
      candidate: cloneJson(eventCandidate)
    });

    expect(materialized.status).toBe("materialized");
    expect(repeated.status).toBe("materialized");
    if (materialized.status !== "materialized" || repeated.status !== "materialized") {
      throw new Error("expected materialized events");
    }
    expect(materialized.events).toHaveLength(1);
    expect(materialized.events[0]?.eventType).toBe("core.door-opened");
    expect(materialized.events[0]?.sequence).toBe(0);
    expect(materialized.batch.revision).toBe(43);
    expect(canonicalizeJson(materialized.batch)).toBe(canonicalizeJson(repeated.batch));

    expect(canonicalizeJson(state)).toBe(beforeState);
    expect(canonicalizeJson(command)).toBe(beforeCommand);
    expect(canonicalizeJson(transaction)).toBe(beforeTransaction);
    expect(canonicalizeJson(eventCandidate)).toBe(beforeCandidate);
  });

  it("minimal e2e pipeline rejects failed precondition without mutating state or events", () => {
    const state = makeState();
    const command = makeFalsePreconditionCommand();
    const beforeState = canonicalizeJson(state);
    const beforeCommand = canonicalizeJson(command);

    const planned = planCommand(command, state);
    expect(planned.status).toBe("rejected");
    if (planned.status !== "rejected") {
      throw new Error("expected rejected plan");
    }
    expect(planned.reason).toBe("precondition-false");
    expect(planned.diagnostics).toEqual([]);

    const rejected = runCommandTransaction(command, state);
    expect(rejected.status).toBe("rejected");
    if (rejected.status !== "rejected") {
      throw new Error("expected rejected transaction");
    }
    expect(rejected.reason).toBe("precondition-false");

    const materialized = materializeDomainEvents({
      transaction: {
        status: rejected.status,
        transactionId: "transaction.runtime.open-main-door",
        baseRevision: 42,
        source: {
          kind: "command-plan",
          commandId: command.commandId
        },
        commandId: command.commandId
      },
      candidate: makeCommittedCandidateEvent()
    });

    expect(materialized.status).toBe("error");
    if (materialized.status !== "error") {
      throw new Error("expected materialization error");
    }
    expect(materialized.diagnostics[0]?.code).toBe("CONFIRMATION_BOUNDARY_VIOLATION");
    expect(materialized.diagnostics[0]?.path).toBe("/transaction/status");
    expect(canonicalizeJson(state)).toBe(beforeState);
    expect(canonicalizeJson(command)).toBe(beforeCommand);
  });

  it("minimal e2e pipeline remains in-memory and boundary clean", () => {
    const productionFiles = [
      "packages/engine-kernel/src/command/command.ts",
      "packages/engine-kernel/src/transaction/transaction.ts",
      "packages/engine-kernel/src/domain-event/domain-event.ts"
    ];

    for (const file of productionFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/from\s+["'][^"']*(docs|tests|fixtures)[^"']*["']/u);
      expect(source).not.toMatch(/from\s+["'][^"']*(ui|editor|plugin)[^"']*["']/iu);
      expect(source).not.toMatch(/from\s+["']node:(fs|path|os|http|https|net)["']/u);
      expect(source).not.toContain("EventStore");
      expect(source).not.toContain("event bus");
      expect(source).not.toContain("Save system");
    }
  });
});
