import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  createReadonlyRuntimeSmokeScenarioPackage,
  loadContentPackageFromObject,
  runReadonlyRuntimeSmokeScenario,
  READONLY_RUNTIME_SMOKE_SCENARIO_CONTRACT_VERSION
} = engineContracts;

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime readonly smoke scenario", () => {
  it("creates a valid JSON-safe smoke package", () => {
    const contentPackage = createReadonlyRuntimeSmokeScenarioPackage();
    const loadResult = loadContentPackageFromObject({
      rawPackage: contentPackage,
      source: {
        sourceId: "fixture:content.runtime-smoke.readonly",
        sourceKind: "provided-object",
        packageId: "content.runtime-smoke.readonly",
        description: "public readonly runtime smoke scenario fixture"
      }
    });

    expect(contentPackage.packageId).toBe("content.runtime-smoke.readonly");
    expect(loadResult.status).toBe("valid");
    expect(loadResult.diagnostics).toEqual([]);
    expectJsonSafe(contentPackage);
  });

  it("runs the smoke scenario end-to-end", () => {
    const result = runReadonlyRuntimeSmokeScenario();

    expect(result.scenarioId).toBe("runtime-smoke.readonly");
    expect(result.packageId).toBe("content.runtime-smoke.readonly");
    expect(result.steps).toHaveLength(2);
    expect(result.steps.map((step) => step.commandId)).toEqual(["look", "inventory"]);
    expect(result.steps.map((step) => step.planStatus)).toEqual(["planned", "planned"]);
    expect(result.steps.map((step) => step.executionStatus)).toEqual(["executed", "executed"]);
    expect(result.steps.map((step) => step.diagnostics)).toEqual([[], []]);
    expect(result.steps[0]?.view).toEqual({
      kind: "look",
      look: {
        locationId: "location.smoke.start",
        title: "Smoke Test Airlock",
        description: "A clean, pressurized airlock used for neutral runtime smoke checks.",
        exits: [
          {
            exitId: "exit.smoke.to-corridor",
            label: "Open corridor door",
            targetLocationId: "location.smoke.corridor"
          }
        ],
        items: [],
        npcs: [
          {
            npcId: "npc.smoke.observer",
            name: "Smoke Observer",
            dialogueId: "dialogue.smoke.observer"
          }
        ],
        availableActions: ["look", "inventory"]
      }
    });
    expect(result.steps[1]?.view).toEqual({
      kind: "inventory",
      inventory: {
        itemCount: 1,
        items: [
          {
            itemId: "item.smoke.keycard",
            title: "Smoke Test Keycard",
            description: "A neutral portable item used to verify read-only inventory rendering.",
            portable: true
          }
        ],
        unresolvedItemIds: []
      }
    });
    expect(result.metadata).toEqual({
      deterministic: true,
      scenarioVersion: READONLY_RUNTIME_SMOKE_SCENARIO_CONTRACT_VERSION,
      stepsCount: 2,
      diagnosticsCount: 0
    });
    expectJsonSafe(result);
  });

  it("is deterministic", () => {
    const first = runReadonlyRuntimeSmokeScenario();
    const second = runReadonlyRuntimeSmokeScenario();

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("does not mutate player state", () => {
    const result = runReadonlyRuntimeSmokeScenario();

    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
    expect(result.finalPlayerState.currentLocationId).toBe("location.smoke.start");
    expect(result.finalPlayerState.inventoryItemIds).toEqual(["item.smoke.keycard"]);
  });

  it("does not include next-state, event, transaction, or storage outputs", () => {
    const result = runReadonlyRuntimeSmokeScenario();

    expect("nextState" in result).toBe(false);
    expect("statePatch" in result).toBe(false);
    expect("events" in result).toBe(false);
    expect("runtimeDomainEventValues" in result).toBe(false);
    expect("transaction" in result).toBe(false);
    expect("saveResult" in result).toBe(false);
    expect("loadResult" in result).toBe(false);
  });

  it("executes only read-only commands", () => {
    const result = runReadonlyRuntimeSmokeScenario();

    expect(result.steps.map((step) => step.commandId)).toEqual(["look", "inventory"]);
    expect(result.steps.some((step) => ["go", "talk", "take", "use", "save", "load"].includes(step.commandId))).toBe(false);
  });

  it("does not introduce generic execution APIs", () => {
    expect("executeCommand" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("applyCommand" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("talkToNpc" in engineContracts).toBe(false);
    expect("applyEffectToRuntimePlayerState" in engineContracts).toBe(false);
  });
});
