import { describe, expect, it } from "vitest";

import {
  TRANSACTION_CONTRACT_VERSION,
  TRANSACTION_SCHEMA_ID,
  TRANSACTION_SCHEMA_VERSION,
  inspectTransaction,
  runCommandTransaction,
  runTransaction,
  type TransactionHistory
} from "../packages/engine-kernel/src/index.js";

type Transaction = {
  contractVersion: typeof TRANSACTION_CONTRACT_VERSION;
  schemaId: typeof TRANSACTION_SCHEMA_ID;
  schemaVersion: typeof TRANSACTION_SCHEMA_VERSION;
  transactionId?: string;
  baseRevision: number;
  source:
    | {
        kind: "command-plan";
        commandId?: string;
        commandType?: string;
        allowNoOp?: boolean;
      }
    | {
        kind: "system";
        systemId: string;
        reason?: string;
        allowNoOp?: boolean;
      };
  effects: unknown[];
  context?: unknown;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
};

type State = {
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

const conditionContractVersion = "condition@0.1.0" as const;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeState(): State {
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
            entities: [
              {
                contractVersion: "entity-identity@0.1.0",
                id: "npc.example.guard",
                entityType: "npc",
                namespace: "example",
                schemaVersion: 1
              }
            ]
          }
        }
      ]
    }
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    contractVersion: TRANSACTION_CONTRACT_VERSION,
    schemaId: TRANSACTION_SCHEMA_ID,
    schemaVersion: TRANSACTION_SCHEMA_VERSION,
    transactionId: "transaction.runtime.open-main-door",
    baseRevision: 42,
    source: {
      kind: "command-plan",
      commandId: "command.runtime.open-main-door",
      commandType: "core.set-value",
      allowNoOp: true
    },
    effects: [
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
    ],
    ...overrides
  };
}

function makeCyclicTransaction(): Transaction {
  const transaction = makeTransaction();
  const payload = transaction as Record<string, unknown>;
  payload.self = payload;
  return transaction;
}

function makeForbiddenTransaction(): Transaction {
  return JSON.parse('{"contractVersion":"transaction@0.1.0","schemaId":"transaction","schemaVersion":1,"transactionId":"transaction.runtime.open-main-door","baseRevision":42,"source":{"kind":"command-plan","commandId":"command.runtime.open-main-door","commandType":"core.set-value","allowNoOp":true},"effects":[],"__proto__":{"polluted":true}}') as Transaction;
}

function makeInvalidCommand(): Record<string, unknown> {
  return {
    contractVersion: "command@0.1.0",
    schemaId: "command",
    schemaVersion: 1,
    commandType: "core.set-value",
    initiator: { kind: "system" },
    payload: {},
    preconditions: [
      {
        contractVersion: conditionContractVersion,
        schemaId: "condition",
        schemaVersion: 1,
        type: "constant",
        value: false
      }
    ]
  };
}

describe("Transaction manager reference implementation", () => {
  it("inspects a valid transaction envelope", () => {
    expect(inspectTransaction(makeTransaction())).toEqual([]);
  });

  it("commits a valid transaction and keeps the input unchanged", () => {
    const state = makeState();
    const transaction = makeTransaction();
    const beforeTransaction = JSON.stringify(transaction);
    const beforeState = JSON.stringify(state);

    const result = runTransaction(transaction, state);

    expect(result.status).toBe("committed");
    if (result.status !== "committed") {
      throw new Error("expected committed");
    }
    expect(result.baseRevision).toBe(42);
    expect(result.newRevision).toBe(43);
    expect(result.changes).toEqual([
      {
        path: "/doors/main/state",
        before: "closed",
        after: "open"
      }
    ]);
    expect(Object.keys(result).sort()).toEqual(["baseRevision", "changes", "newRevision", "status"]);
    expect(JSON.stringify(transaction)).toBe(beforeTransaction);
    expect(JSON.stringify(state)).toBe(beforeState);
  });

  it("returns no-op when the canonical state does not change", () => {
    const transaction = makeTransaction({
      effects: [
        {
          contractVersion: "effect@0.1.0",
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "closed"
        }
      ]
    });

    const result = runTransaction(transaction, makeState());

    expect(result.status).toBe("no-op");
    if (result.status !== "no-op") {
      throw new Error("expected no-op");
    }
    expect(result.baseRevision).toBe(42);
    expect(result.newRevision).toBe(42);
    expect(result.changes).toEqual([]);
  });

  it("rejects no-op transactions when the source forbids them", () => {
    const transaction = makeTransaction({
      source: {
        kind: "command-plan",
        commandId: "command.runtime.open-main-door",
        commandType: "core.set-value",
        allowNoOp: false
      },
      effects: [
        {
          contractVersion: "effect@0.1.0",
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "closed"
        }
      ]
    });

    const result = runTransaction(transaction, makeState());

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected rejected");
    }
    expect(result.reason).toBe("no-op-not-allowed");
    expect(result.diagnostics[0]?.code).toBe("NO_OP_NOT_ALLOWED");
  });

  it("reports revision conflicts before applying effects", () => {
    const result = runTransaction(
      makeTransaction({ baseRevision: 41 }),
      makeState()
    );

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected rejected");
    }
    expect(result.reason).toBe("revision-conflict");
    expect(result.diagnostics[0]?.path).toBe("/baseRevision");
  });

  it("rolls back if the committed revision changes before the final commit check", () => {
    const result = runTransaction(makeTransaction(), makeState(), { finalRevision: 99 });

    expect(result.status).toBe("rolled-back");
    if (result.status !== "rolled-back") {
      throw new Error("expected rolled-back");
    }
    expect(result.reason).toBe("revision-conflict");
    expect(result.diagnostics[0]?.phase).toBe("commit");
  });

  it("rolls back when effect application fails", () => {
    const result = runTransaction(
      makeTransaction({
        effects: [
          {
            contractVersion: "effect@0.1.0",
            schemaId: "effect",
            schemaVersion: 1,
            type: "increment",
            target: {
              domainId: "state-domain.core.world",
              path: "/doors/main/state"
            },
            delta: 1
          }
        ]
      }),
      makeState()
    );

    expect(result.status).toBe("rolled-back");
    if (result.status !== "rolled-back") {
      throw new Error("expected rolled-back");
    }
    expect(result.reason).toBe("effect-error");
    expect(result.diagnostics[0]?.path).toBe("/effects/0/delta");
  });

  it("rolls back when the candidate state becomes invalid", () => {
    const transaction = makeTransaction({
      effects: [
        {
          contractVersion: "effect@0.1.0",
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/entities"
          },
          value: [
            {
              contractVersion: "entity-identity@0.1.0",
              id: "npc.example.guard",
              entityType: "npc",
              namespace: "example",
              schemaVersion: 1
            },
            {
              contractVersion: "entity-identity@0.1.0",
              id: "npc.example.guard",
              entityType: "npc",
              namespace: "example",
              schemaVersion: 1
            }
          ]
        }
      ]
    });

    const result = runTransaction(transaction, makeState());

    expect(result.status).toBe("rolled-back");
    if (result.status !== "rolled-back") {
      throw new Error("expected rolled-back");
    }
    expect(result.reason).toBe("candidate-validation");
    expect(result.diagnostics[0]?.code).toBe("CANDIDATE_STATE_INVALID");
  });

  it("rejects invalid transaction shapes and preserves stable paths", () => {
    expect(runTransaction(null, makeState()).status).toBe("error");

    const invalid = runTransaction(
      makeTransaction({ schemaVersion: 2 }),
      makeState()
    );

    expect(invalid.status).toBe("error");
    if (invalid.status !== "error") {
      throw new Error("expected error");
    }
    expect(invalid.diagnostics[0]?.code).toBe("SCHEMA_VERSION_UNSUPPORTED");
    expect(invalid.diagnostics[0]?.path).toBe("/schemaVersion");
  });

  it("rejects invalid, non-JSON, forbidden-key, and cyclic transactions", () => {
    expect(runTransaction(makeForbiddenTransaction(), makeState()).status).toBe("error");
    expect(runTransaction(makeCyclicTransaction(), makeState()).status).toBe("error");
  });

  it("detects duplicate transaction IDs and idempotency conflicts", () => {
    const history: TransactionHistory = {
      transactions: new Map(),
      idempotencyKeys: new Map()
    };
    const first = runTransaction(makeTransaction(), makeState(), { history });
    const second = runTransaction(cloneJson(makeTransaction()), cloneJson(makeState()), { history });

    expect(first.status).toBe("committed");
    expect(second).toEqual(first);

    const conflict = runTransaction(
      makeTransaction({
        effects: [
          {
            contractVersion: "effect@0.1.0",
            schemaId: "effect",
            schemaVersion: 1,
            type: "set",
            target: {
              domainId: "state-domain.core.world",
              path: "/doors/main/state"
            },
            value: "ajar"
          }
        ]
      }),
      makeState(),
      { history }
    );

    expect(conflict.status).toBe("error");
    if (conflict.status !== "error") {
      throw new Error("expected error");
    }
    expect(conflict.diagnostics[0]?.code).toBe("DUPLICATE_TRANSACTION_ID");

    const idempotencyHistory: TransactionHistory = {
      transactions: new Map(),
      idempotencyKeys: new Map()
    };
    const firstIdempotent = makeTransaction({ idempotencyKey: "transaction.runtime.open-main-door" });
    delete firstIdempotent.transactionId;
    const firstIdempotentResult = runTransaction(firstIdempotent, makeState(), { history: idempotencyHistory });
    expect(firstIdempotentResult.status).toBe("committed");
    const idempotencyConflict = runTransaction(
      makeTransaction({
        transactionId: "transaction.runtime.open-main-door-2",
        idempotencyKey: "transaction.runtime.open-main-door"
      }),
      makeState(),
      { history: idempotencyHistory }
    );
    expect(idempotencyConflict.status).toBe("error");
    if (idempotencyConflict.status !== "error") {
      throw new Error("expected error");
    }
    expect(idempotencyConflict.diagnostics[0]?.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("plans and commits a command transaction", () => {
    const result = runCommandTransaction(
      {
        contractVersion: "command@0.1.0",
        schemaId: "command",
        schemaVersion: 1,
        commandType: "core.set-value",
        initiator: { kind: "system" },
        payload: { value: "open" }
      },
      makeState()
    );

    expect(result.status).toBe("committed");
  });

  it("rejects a command transaction with false preconditions", () => {
    const result = runCommandTransaction(
      makeInvalidCommand(),
      makeState()
    );

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected rejected");
    }
    expect(result.reason).toBe("precondition-false");
  });

  it("keeps diagnostics paths stable for rejected transactions", () => {
    const result = runTransaction(makeTransaction({ baseRevision: 41 }), makeState());

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected rejected");
    }
    expect(result.diagnostics[0]?.path).toBe("/baseRevision");
  });
});
