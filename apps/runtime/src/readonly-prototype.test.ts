import { canonicalizeJson, inspectJsonSafety } from "@narrative-engine/core";
import { describe, expect, it } from "vitest";

import * as engineContracts from "@narrative-engine/engine-contracts";

import {
  READONLY_PROTOTYPE_ACTIONS,
  createReadonlyPrototypeController,
  createReadonlyPrototypeState
} from "./readonly-prototype.js";

type RuntimePlayerState = engineContracts.RuntimePlayerState;

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

function assertStateSnapshots(outcome: {
  readonly playerStateBefore?: RuntimePlayerState;
  readonly playerStateAfter?: RuntimePlayerState;
}): {
  readonly before: RuntimePlayerState;
  readonly after: RuntimePlayerState;
} {
  const before = outcome.playerStateBefore;
  const after = outcome.playerStateAfter;

  if (before === undefined || after === undefined) {
    throw new Error("Expected readonly interaction snapshots to be present.");
  }

  return { before, after };
}

describe("readonly browser prototype", () => {
  it("builds deterministic initial state from the public presentation snapshot", () => {
    const first = createReadonlyPrototypeState();
    const second = createReadonlyPrototypeState();

    expect(first.location?.title).toBe("Smoke Test Airlock");
    expect(first.inventory?.items.map((item) => item.title)).toEqual(["Smoke Test Keycard"]);
    expect(first.availableActions).toEqual(["look", "inventory"]);
    expect(first.output.kind).toBe("transcript-preview");
    expect(first.output.lines.length).toBeGreaterThan(0);
    expect(first.diagnostics).toEqual([]);
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expectJsonSafe(first);
  });

  it("routes look through the readonly interaction boundary without mutating player state", () => {
    const controller = createReadonlyPrototypeController();

    const outcome = controller.runAction("look");
    const state = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.interaction.status).toBe("executed");
    expect(outcome.interaction.execution?.view?.kind).toBe("look");
    expect(outcome.output.title).toBe("Smoke Test Airlock");
    expect(outcome.output.lines.some((line) => line.includes("Location: Smoke Test Airlock"))).toBe(true);
    expect(state.location?.title).toBe("Smoke Test Airlock");
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(outcome.playerStateUnchanged).toBe(true);
    expectJsonSafe(outcome);
  });

  it("routes inventory through the readonly interaction boundary without mutating player state", () => {
    const controller = createReadonlyPrototypeController();

    const outcome = controller.runAction("inventory");
    const state = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.interaction.status).toBe("executed");
    expect(outcome.interaction.execution?.view?.kind).toBe("inventory");
    expect(outcome.output.lines).toContain("Smoke Test Keycard");
    expect(state.inventory?.items.map((item) => item.title)).toContain("Smoke Test Keycard");
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(outcome.playerStateUnchanged).toBe(true);
    expectJsonSafe(outcome);
  });

  it("exposes only safe readonly actions", () => {
    const state = createReadonlyPrototypeState();

    expect(READONLY_PROTOTYPE_ACTIONS).toEqual(["look", "inventory"]);
    expect(state.availableActions).toEqual(["look", "inventory"]);
    expect(state.availableActions).not.toContain("go");
    expect(state.availableActions).not.toContain("talk");
    expect(state.availableActions).not.toContain("take");
    expect(state.availableActions).not.toContain("use");
    expect(state.availableActions).not.toContain("save");
    expect(state.availableActions).not.toContain("load");
  });

  it("returns JSON-safe deterministic read-only interaction payloads with no next-state or storage outputs", () => {
    const controller = createReadonlyPrototypeController();

    const first = controller.runAction("look");
    const secondController = createReadonlyPrototypeController();
    const second = secondController.runAction("look");

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect("nextState" in first).toBe(false);
    expect("statePatch" in first).toBe(false);
    expect("events" in first).toBe(false);
    expect("runtimeDomainEventValues" in first).toBe(false);
    expect("transaction" in first).toBe(false);
    expect("saveResult" in first).toBe(false);
    expect("loadResult" in first).toBe(false);
    expect("nextState" in first.interaction).toBe(false);
    expect("statePatch" in first.interaction).toBe(false);
    expect("events" in first.interaction).toBe(false);
    expect("runtimeDomainEventValues" in first.interaction).toBe(false);
    expect("transaction" in first.interaction).toBe(false);
    expect("saveResult" in first.interaction).toBe(false);
    expect("loadResult" in first.interaction).toBe(false);
    expectJsonSafe(first);
  });

  it("does not add generic execution APIs", () => {
    expect("executeCommand" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("applyCommand" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("talkToNpc" in engineContracts).toBe(false);
    expect("applyEffectToRuntimePlayerState" in engineContracts).toBe(false);
  });
});
