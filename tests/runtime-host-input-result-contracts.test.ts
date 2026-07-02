import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson, type JsonValue } from "../packages/core/src/index.js";
import {
  ENGINE_STATE_CONTRACT_VERSION,
  RUNTIME_HOST_STATUSES,
  createValidationDiagnostic,
  isRuntimeHostStatus,
  type RuntimeCommandRequest,
  type RuntimeHostInput,
  type RuntimeHostResult,
  type ValidatedContentGraph
} from "../packages/engine-contracts/src/index.js";

function isJsonSafe(value: unknown): boolean {
  try {
    const serialized = canonicalizeJson(value);
    return typeof serialized === "string" && serialized.length > 0;
  } catch {
    return false;
  }
}

const currentState: RuntimeHostInput["currentState"] = {
  contractVersion: ENGINE_STATE_CONTRACT_VERSION,
  schemaId: "engine-state",
  schemaVersion: 1,
  stateId: "state.runtime.current",
  revision: 7,
  run: {
    domains: []
  }
};

const validatedContentGraph: ValidatedContentGraph = {
  packageId: "content.demo.minimal",
  manifest: {
    id: "content.demo.minimal",
    schemaVersion: 1
  },
  sections: {
    commands: [
      {
        id: "command.demo.inspect",
        commandType: "demo.inspect"
      }
    ] as JsonValue
  },
  referenceIndex: {
    "command.demo.inspect": ["demo.condition.has-key", "demo.effect.mark-inspected"]
  },
  dependencySummary: [],
  primitiveBindingSummary: [
    {
      commandId: "command.demo.inspect",
      conditionRefs: ["demo.condition.has-key"],
      effectRefs: ["demo.effect.mark-inspected"]
    }
  ],
  localizationKeyIndex: ["demo.command.inspect.label"],
  assetReferenceIndex: [],
  diagnosticsSummary: {
    total: 0,
    blocking: 0
  }
};

const commandRequest: RuntimeCommandRequest = {
  commandId: "command.demo.inspect",
  actorId: "actor.demo.player",
  targetId: "item.demo.key",
  payload: {
    mode: "inspect"
  }
};

describe("runtime host input/result contracts", () => {
  it("exports runtime host statuses and status guard", () => {
    expect(RUNTIME_HOST_STATUSES).toEqual(["committed", "rejected", "blocked", "error"]);
    expect(isRuntimeHostStatus("committed")).toBe(true);
    expect(isRuntimeHostStatus("rejected")).toBe(true);
    expect(isRuntimeHostStatus("blocked")).toBe(true);
    expect(isRuntimeHostStatus("error")).toBe(true);
    expect(isRuntimeHostStatus("valid")).toBe(false);
    expect(isRuntimeHostStatus(1)).toBe(false);
    expect(isRuntimeHostStatus(undefined)).toBe(false);
  });

  it("supports a JSON-safe runtime host input with caller-provided graph and state", () => {
    const beforeState = canonicalizeJson(currentState);
    const beforeGraph = canonicalizeJson(validatedContentGraph);

    const input: RuntimeHostInput = {
      request: commandRequest,
      currentState,
      validatedContentGraph,
      context: {
        requestId: "request.demo.inspect.1",
        correlationId: "correlation.demo.run.1",
        deterministic: true,
        source: "test"
      },
      metadata: {
        requestId: "request.demo.inspect.1",
        deterministic: true,
        source: "test"
      }
    };

    expect(input.request.commandId).toBe("command.demo.inspect");
    expect(input.currentState.revision).toBe(7);
    expect(input.validatedContentGraph.packageId).toBe("content.demo.minimal");
    expect(isJsonSafe(input)).toBe(true);
    expect(canonicalizeJson(currentState)).toBe(beforeState);
    expect(canonicalizeJson(validatedContentGraph)).toBe(beforeGraph);
  });

  it("supports a committed runtime host result as return-only data", () => {
    const result: RuntimeHostResult = {
      status: "committed",
      nextState: {
        ...currentState,
        revision: 8
      },
      diagnostics: [],
      commandPlan: {
        commandId: "command.demo.inspect",
        status: "accepted",
        diagnosticsCount: 0
      },
      transaction: {
        status: "committed",
        previousRevision: 7,
        nextRevision: 8
      },
      domainEvents: {
        count: 1,
        eventTypes: ["demo.inspected"]
      },
      runtimeDomainEventValues: [
        {
          eventId: "runtime-event.command.demo.inspect.01",
          eventType: "demo.inspected",
          sourceCommandId: "command.demo.inspect",
          payload: {
            eventMappingId: "event-mapping.demo.inspect",
            packageId: "content.demo.minimal",
            transactionStatus: "committed",
            revision: 8
          },
          metadata: {
            deterministic: true,
            persistence: "none",
            source: "runtime-host"
          }
        }
      ],
      metadata: {
        deterministic: true,
        runtimeHostVersion: "runtime-host@0.1.0"
      }
    };

    expect(result.status).toBe("committed");
    expect(result.nextState?.revision).toBe(8);
    expect(result.domainEvents?.eventTypes).toEqual(["demo.inspected"]);
    expect(result.runtimeDomainEventValues?.[0]?.metadata.persistence).toBe("none");
    expect(isJsonSafe(result)).toBe(true);
  });

  it("supports rejected, blocked, and error runtime host results", () => {
    const diagnostic = createValidationDiagnostic({
      ownerContract: "runtime-host@0.1.0",
      code: "RUNTIME_HOST_REQUEST_BLOCKED",
      severity: "error",
      category: "validation",
      phase: "shape-validation",
      path: ["request", "commandId"],
      message: "Runtime command request cannot be resolved by this boundary.",
      source: {
        kind: "runtime-host",
        id: "runtime-host-contract-test"
      }
    });

    const results: readonly RuntimeHostResult[] = [
      {
        status: "rejected",
        diagnostics: [diagnostic],
        commandPlan: {
          commandId: "command.demo.inspect",
          status: "rejected",
          diagnosticsCount: 1
        },
        metadata: {
          deterministic: true
        }
      },
      {
        status: "blocked",
        diagnostics: [diagnostic],
        metadata: {
          deterministic: true
        }
      },
      {
        status: "error",
        diagnostics: [diagnostic],
        transaction: {
          status: "error",
          previousRevision: 7
        },
        metadata: {
          deterministic: true
        }
      }
    ];

    expect(results.map((result) => result.status)).toEqual(["rejected", "blocked", "error"]);
    expect(results.every(isJsonSafe)).toBe(true);
  });

  it("keeps the runtime host contract free of runtime execution behavior", () => {
    const source = readFileSync("packages/engine-contracts/src/runtime-host/runtime-host-types.ts", "utf8");

    expect(source).not.toMatch(/function\s+(resolve|execute|run|apply|commit|materialize)/u);
    expect(source).not.toMatch(/class\s+/u);
    expect(source).not.toMatch(/readFileSync|writeFileSync|node:fs|node:path|fetch\(/u);
    expect(source).not.toContain("CommandResolver");
    expect(source).not.toContain("EventStore");
    expect(source).not.toContain("Save system");
    expect(source).not.toContain("plugin runtime");
  });
});
