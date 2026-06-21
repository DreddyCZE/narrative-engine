import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { applyEffect, evaluateCondition } from "../packages/engine-contracts/src/index.js";
import { materializeDomainEvents, planCommand, runTransaction } from "../packages/engine-kernel/src/index.js";

type ContentPackageFixture = {
  manifest: {
    id: string;
    declaredSections: string[];
  };
  sections: {
    systems: Array<{ id: string; stateDomainId: string }>;
    commands: Array<{
      id: string;
      commandType: string;
      conditionRefs: string[];
      effectRefs: string[];
      targetLocationId: string;
      labelKey: string;
    }>;
    conditions: Array<{
      contractVersion: "condition@0.1.0";
      schemaId: "condition";
      schemaVersion: 1;
      conditionId: string;
      type: string;
      value?: boolean;
    }>;
    effects: Array<{
      contractVersion?: "effect@0.1.0";
      schemaId?: "effect";
      schemaVersion?: 1;
      effectId?: string;
      type: string;
      target: { path: string };
      value: unknown;
    }>;
    eventMappings: Array<{
      id: string;
      eventType: string;
      commandId: string;
      titleKey: string;
    }>;
  };
};

type IntegrationDiagnostic = {
  code: string;
  path: string;
  message: string;
};

const fixturePath = "tests/fixtures/content/minimal-neutral-content-package/content-package.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as ContentPackageFixture;

function makeState() {
  return {
    contractVersion: "engine-state@0.1.0" as const,
    schemaId: "engine-state" as const,
    schemaVersion: 1 as const,
    stateId: "state.runtime.current",
    revision: 7,
    requiredDomains: ["state-domain.core.world"],
    run: {
      seed: "seed-35",
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
              }
            },
            facts: {
              "location.demo.start": {
                inspected: false
              }
            }
          }
        }
      ]
    }
  };
}

function buildIntegrationMaps(source: ContentPackageFixture) {
  return {
    commandById: new Map(source.sections.commands.map((entry) => [entry.id, entry])),
    conditionById: new Map(source.sections.conditions.map((entry) => [entry.conditionId, entry])),
    effectById: new Map(source.sections.effects.flatMap((entry) => (entry.effectId ? [[entry.effectId, entry] as const] : []))),
    eventMappingByCommandId: new Map(source.sections.eventMappings.map((entry) => [entry.commandId, entry])),
    systemDomainId: "state-domain.core.world"
  };
}

function adaptContentCommandToM2Command(source: ContentPackageFixture, commandId: string) {
  const maps = buildIntegrationMaps(source);
  const command = maps.commandById.get(commandId);
  if (!command) {
    return {
      status: "error" as const,
      diagnostics: [
        {
          code: "CONTENT_BINDING_UNSUPPORTED_COMMAND_KIND",
          path: "/sections/commands/0/id",
          message: "Content command record is missing."
        }
      ]
    };
  }

  const conditionId = command.conditionRefs[0];
  const effectId = command.effectRefs[0];
  const condition = conditionId ? maps.conditionById.get(conditionId) : undefined;
  const effect = effectId ? maps.effectById.get(effectId) : undefined;

  const diagnostics: IntegrationDiagnostic[] = [];
  if (!conditionId || !condition) {
    diagnostics.push({
      code: "CONTENT_BINDING_MISSING_CONDITION",
      path: "/sections/commands/0/conditionRefs/0",
      message: "Content command is missing a resolvable condition binding."
    });
  }
  if (!effectId || !effect) {
    diagnostics.push({
      code: "CONTENT_BINDING_MISSING_EFFECT",
      path: "/sections/commands/0/effectRefs/0",
      message: "Content command is missing a resolvable effect binding."
    });
  }
  if (command.commandType !== "demo.inspect") {
    diagnostics.push({
      code: "CONTENT_BINDING_UNSUPPORTED_COMMAND_KIND",
      path: "/sections/commands/0/commandType",
      message: "Content commandType is not supported by the integration adapter."
    });
  }

  if (diagnostics.length > 0 || !condition || !effect) {
    return {
      status: "error" as const,
      diagnostics
    };
  }

  const m2Command = {
    contractVersion: "command@0.1.0" as const,
    schemaId: "command" as const,
    schemaVersion: 1 as const,
    commandId: "command.runtime.demo-inspect",
    commandType: "core.set-value",
    expectedRevision: 7,
    initiator: {
      kind: "system" as const
    },
    targets: [
      {
        id: "device.example.main-door",
        entityType: "device"
      }
    ],
    preconditions: [condition],
    payload: {
      value: "open"
    },
    correlationId: "corr.runtime.demo-inspect",
    causationId: "cause.runtime.demo-inspect"
  };

  const m2Effect = {
    contractVersion: "effect@0.1.0" as const,
    schemaId: "effect" as const,
    schemaVersion: 1 as const,
    effectId: effect.effectId ?? "effect.runtime.demo.inspect",
    type: "set" as const,
    target: {
      domainId: maps.systemDomainId,
      path: effect.target.path
    },
    value: effect.value
  };

  return {
    status: "ok" as const,
    command: m2Command,
    condition,
    effect: m2Effect
  };
}

function adaptEventCandidate(source: ContentPackageFixture, commandId: string) {
  const eventMapping = buildIntegrationMaps(source).eventMappingByCommandId.get(commandId);
  if (!eventMapping) {
    return {
      status: "error" as const,
      diagnostics: [
        {
          code: "CONTENT_BINDING_EVENT_SOURCE_REQUIRED",
          path: "/sections/eventMappings/0/commandId",
          message: "Content event mapping is missing a resolvable command source."
        }
      ]
    };
  }

  return {
    status: "ok" as const,
    candidate: {
      contractVersion: "domain-event@0.1.0" as const,
      schemaId: "domain-event" as const,
      schemaVersion: 1 as const,
      eventId: "domain-event.demo.inspect-complete-0",
      eventType: "core.door-opened",
      transactionId: "transaction.runtime.demo-inspect",
      previousRevision: 7,
      revision: 8,
      sequence: 0,
      commandId: "command.runtime.demo-inspect",
      correlationId: "corr.runtime.demo-inspect",
      causationKind: "command" as const,
      causationId: "cause.runtime.demo-inspect",
      payload: {
        door: {
          id: "device.example.main-door",
          entityType: "device"
        },
        state: "open"
      }
    }
  };
}

function readInspectedFlag(state: ReturnType<typeof makeState>): unknown {
  return state.run.domains[0]?.data.facts &&
    (state.run.domains[0].data.facts as Record<string, unknown>)["location.demo.start"]
    ? (((state.run.domains[0].data.facts as Record<string, unknown>)["location.demo.start"] as Record<string, unknown>).inspected)
    : undefined;
}

describe("content package integration with M2 primitives", () => {
  it("integrates fixture command bindings with public M2 primitives on the success path", () => {
    const source = canonicalizeJson(fixture);
    const state = makeState();
    const beforeState = canonicalizeJson(state);
    const adapted = adaptContentCommandToM2Command(fixture, "command.demo.inspect");
    expect(adapted.status).toBe("ok");
    if (adapted.status !== "ok") {
      throw new Error("expected successful content adaptation");
    }

    const conditionResult = evaluateCondition(adapted.condition, state);
    expect(conditionResult.matched).toBe(true);
    expect(conditionResult.issues).toEqual([]);

    const planned = planCommand(adapted.command, state);
    expect(planned.status).toBe("accepted");
    if (planned.status !== "accepted") {
      throw new Error("expected accepted M2 command plan");
    }

    const applied = applyEffect(adapted.effect, state);
    expect(applied.status).toBe("applied");
    expect(readInspectedFlag(applied.state as ReturnType<typeof makeState>)).toBe(true);
    expect(readInspectedFlag(state)).toBe(false);

    const transaction = runTransaction(
      {
        contractVersion: "transaction@0.1.0" as const,
        schemaId: "transaction" as const,
        schemaVersion: 1 as const,
        transactionId: "transaction.runtime.demo-inspect",
        baseRevision: 7,
        source: {
          kind: "command-plan" as const,
          commandId: adapted.command.commandId,
          commandType: adapted.command.commandType,
          allowNoOp: false
        },
        effects: [adapted.effect]
      },
      state
    );

    expect(transaction.status).toBe("committed");
    if (transaction.status !== "committed") {
      throw new Error("expected committed transaction");
    }

    const eventCandidate = adaptEventCandidate(fixture, "command.demo.inspect");
    expect(eventCandidate.status).toBe("ok");
    if (eventCandidate.status !== "ok") {
      throw new Error("expected event candidate adaptation");
    }

    const materialized = materializeDomainEvents({
      transaction: {
        status: transaction.status,
        transactionId: "transaction.runtime.demo-inspect",
        baseRevision: transaction.baseRevision,
        newRevision: transaction.newRevision,
        source: {
          kind: "command-plan",
          commandId: adapted.command.commandId
        },
        commandId: adapted.command.commandId,
        correlationId: adapted.command.correlationId,
        causationKind: "command",
        causationId: adapted.command.causationId
      },
      candidate: eventCandidate.candidate
    });

    expect(materialized.status).toBe("materialized");
    if (materialized.status !== "materialized") {
      throw new Error("expected materialized domain event batch");
    }

    expect(materialized.events[0]?.eventType).toBe("core.door-opened");
    expect(materialized.events[0]?.sequence).toBe(0);
    expect(canonicalizeJson(materialized.batch)).toBe(
      canonicalizeJson({
        ...materialized.batch,
        events: [...materialized.events]
      })
    );

    expect(canonicalizeJson(fixture)).toBe(source);
    expect(canonicalizeJson(state)).toBe(beforeState);
  });

  it("returns deterministic diagnostics when a required content binding is missing", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as ContentPackageFixture;
    const command = brokenFixture.sections.commands[0];
    if (!command) {
      throw new Error("fixture command is missing");
    }
    command.conditionRefs = [];

    const beforeFixture = canonicalizeJson(brokenFixture);
    const state = makeState();
    const beforeState = canonicalizeJson(state);
    const adapted = adaptContentCommandToM2Command(brokenFixture, "command.demo.inspect");

    expect(adapted).toEqual({
      status: "error",
      diagnostics: [
        {
          code: "CONTENT_BINDING_MISSING_CONDITION",
          path: "/sections/commands/0/conditionRefs/0",
          message: "Content command is missing a resolvable condition binding."
        }
      ]
    });
    expect(canonicalizeJson(brokenFixture)).toBe(beforeFixture);
    expect(canonicalizeJson(state)).toBe(beforeState);
  });

  it("keeps the integration boundary test-only and runtime-clean", () => {
    const productionFiles = [
      "packages/engine-contracts/src/index.ts",
      "packages/engine-kernel/src/index.ts",
      "packages/engine-kernel/src/command/command.ts",
      "packages/engine-kernel/src/transaction/transaction.ts",
      "packages/engine-kernel/src/domain-event/domain-event.ts"
    ];

    for (const file of productionFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/from\s+["'][^"']*(fixtures|tests)[^"']*["']/u);
      expect(source).not.toMatch(/from\s+["']node:(fs|path|os|http|https|net)["']/u);
      expect(source).not.toContain("EventStore");
      expect(source).not.toContain("Save system");
      expect(source).not.toContain("plugin runtime");
    }
  });
});
