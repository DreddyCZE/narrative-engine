import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  READONLY_RUNTIME_TRANSCRIPT_SCENARIO_CONTRACT_VERSION,
  runReadonlyRuntimeTranscriptScenario
} = engineContracts;

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime readonly transcript scenario", () => {
  it("runs the transcript scenario end-to-end", () => {
    const result = runReadonlyRuntimeTranscriptScenario();

    expect(result.scenarioId).toBe("runtime-transcript.readonly");
    expect(result.packageId).toBe("content.runtime-smoke.readonly");
    expect(result.commands).toHaveLength(3);
    expect(result.commands.map((step) => step.commandId)).toEqual(["look", "inventory", "look"]);
    expect(result.commands.map((step) => step.status)).toEqual(["executed", "executed", "executed"]);
    expect(result.commands.map((step) => step.planStatus)).toEqual(["planned", "planned", "planned"]);
    expect(result.commands.map((step) => step.diagnostics)).toEqual([[], [], []]);
    expect(result.lines).toHaveLength(3);
    expect(result.metadata).toEqual({
      deterministic: true,
      scenarioVersion: READONLY_RUNTIME_TRANSCRIPT_SCENARIO_CONTRACT_VERSION,
      stepsCount: 3,
      linesCount: 3,
      diagnosticsCount: 0
    });
    expectJsonSafe(result);
  });

  it("derives transcript lines from read-only views", () => {
    const result = runReadonlyRuntimeTranscriptScenario();
    const firstLookStep = result.commands[0];
    const inventoryStep = result.commands[1];
    const thirdLookStep = result.commands[2];

    expect(firstLookStep?.view?.kind).toBe("look");
    expect(inventoryStep?.view?.kind).toBe("inventory");
    expect(thirdLookStep?.view?.kind).toBe("look");
    expect(result.lines[0]?.text).toContain(firstLookStep?.view?.kind === "look" ? firstLookStep.view.look.title : "");
    expect(result.lines[0]?.text).toContain(firstLookStep?.view?.kind === "look" ? firstLookStep.view.look.description : "");
    expect(result.lines[1]?.text).toContain("Smoke Test Keycard");
    expect(result.lines[1]?.text).toBe(
      inventoryStep?.view?.kind === "inventory"
        ? `Inventory: ${inventoryStep.view.inventory.items.map((item) => item.title).join(", ")}.`
        : ""
    );
    expect(result.lines[2]?.text).toBe(result.lines[0]?.text);
    expect(thirdLookStep?.view).toEqual(firstLookStep?.view);
  });

  it("is deterministic", () => {
    const first = runReadonlyRuntimeTranscriptScenario();
    const second = runReadonlyRuntimeTranscriptScenario();

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("does not mutate player state", () => {
    const result = runReadonlyRuntimeTranscriptScenario();

    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
    expect(result.finalPlayerState.currentLocationId).toBe("location.smoke.start");
    expect(result.finalPlayerState.inventoryItemIds).toEqual(["item.smoke.keycard"]);
  });

  it("does not include next-state, event, transaction, or storage outputs", () => {
    const result = runReadonlyRuntimeTranscriptScenario();

    expect("nextState" in result).toBe(false);
    expect("statePatch" in result).toBe(false);
    expect("events" in result).toBe(false);
    expect("runtimeDomainEventValues" in result).toBe(false);
    expect("transaction" in result).toBe(false);
    expect("saveResult" in result).toBe(false);
    expect("loadResult" in result).toBe(false);
  });

  it("executes only read-only requests", () => {
    const result = runReadonlyRuntimeTranscriptScenario();

    expect(result.commands.map((step) => step.commandId)).toEqual(["look", "inventory", "look"]);
    expect(result.commands.some((step) => ["go", "talk", "take", "use", "save", "load"].includes(step.commandId))).toBe(false);
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
