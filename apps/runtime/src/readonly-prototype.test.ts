import { canonicalizeJson, inspectJsonSafety } from "@narrative-engine/core";
import { describe, expect, it } from "vitest";

import * as engineContracts from "@narrative-engine/engine-contracts";

import {
  DISABLED_PROTOTYPE_ACTIONS,
  EXECUTABLE_PROTOTYPE_ACTIONS,
  PROTOTYPE_COMMAND_IDS,
  createReadonlyPrototypeController,
  createReadonlyPrototypeState
} from "./readonly-prototype.js";

type RuntimePlayerState = engineContracts.RuntimePlayerState;

type ReadonlyPrototypeActionOutcome = ReturnType<
  ReturnType<typeof createReadonlyPrototypeController>["runAction"]
>;

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

function assertStateSnapshots(outcome: {
  readonly playerStateBefore: RuntimePlayerState;
  readonly playerStateAfter: RuntimePlayerState;
}): {
  readonly before: RuntimePlayerState;
  readonly after: RuntimePlayerState;
} {
  return {
    before: outcome.playerStateBefore,
    after: outcome.playerStateAfter
  };
}

function expectDisabledOutcome(
  outcome: ReadonlyPrototypeActionOutcome,
  reason: string
): void {
  const snapshots = assertStateSnapshots(outcome);

  expect(outcome.status).toBe("disabled");
  expect(outcome.disabledReason).toBe(reason);
  expect(outcome.interaction).toBeUndefined();
  expect(outcome.output.lines).toContain(reason);
  expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
  expect(outcome.playerStateUnchanged).toBe(true);
  expectJsonSafe(outcome);
}

describe("readonly browser prototype command palette", () => {
  it("builds deterministic initial state from the public presentation snapshot", () => {
    const first = createReadonlyPrototypeState();
    const second = createReadonlyPrototypeState();

    expect(first.location?.title).toBe("Smoke Test Airlock");
    expect(first.inventory?.items.map((item) => item.title)).toEqual(["Smoke Test Keycard"]);
    expect(first.availableActions).toEqual(["look", "inventory"]);
    expect(first.commandPalette.map((item) => item.commandId)).toEqual([
      "look",
      "inventory",
      "go",
      "talk",
      "take",
      "use",
      "save",
      "load"
    ]);
    expect(first.output.kind).toBe("transcript-preview");
    expect(first.output.lines.length).toBeGreaterThan(0);
    expect(first.diagnostics).toEqual([]);
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expectJsonSafe(first);
  });

  it("marks only look and inventory as enabled in the palette", () => {
    const state = createReadonlyPrototypeState();
    const palette = state.commandPalette;

    expect(PROTOTYPE_COMMAND_IDS).toEqual([
      "look",
      "inventory",
      "go",
      "talk",
      "take",
      "use",
      "save",
      "load"
    ]);
    expect(EXECUTABLE_PROTOTYPE_ACTIONS).toEqual(["look", "inventory"]);
    expect(DISABLED_PROTOTYPE_ACTIONS).toEqual(["go", "talk", "take", "use", "save", "load"]);
    expect(palette.find((item) => item.commandId === "look")?.enabled).toBe(true);
    expect(palette.find((item) => item.commandId === "inventory")?.enabled).toBe(true);

    for (const commandId of DISABLED_PROTOTYPE_ACTIONS) {
      const item = palette.find((paletteItem) => paletteItem.commandId === commandId);
      expect(item?.enabled).toBe(false);
      expect(item?.disabledReason?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("routes look through the readonly interaction boundary without mutating player state", () => {
    const controller = createReadonlyPrototypeController();

    const outcome = controller.runAction("look");
    const state = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.status).toBe("executed");
    expect(outcome.interaction?.status).toBe("executed");
    expect(outcome.interaction?.execution?.view?.kind).toBe("look");
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

    expect(outcome.status).toBe("executed");
    expect(outcome.interaction?.status).toBe("executed");
    expect(outcome.interaction?.execution?.view?.kind).toBe("inventory");
    expect(outcome.output.lines).toContain("Smoke Test Keycard");
    expect(state.inventory?.items.map((item) => item.title)).toContain("Smoke Test Keycard");
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(outcome.playerStateUnchanged).toBe(true);
    expectJsonSafe(outcome);
  });

  it("keeps disabled actions local and never executes runtime interaction", () => {
    const controller = createReadonlyPrototypeController();
    const disabledActionReasons = {
      go: "Movement execution is not implemented yet.",
      talk: "Dialogue execution is not implemented yet.",
      take: "Inventory mutation is not implemented yet.",
      use: "Use/effect execution is not implemented yet.",
      save: "Save UI/storage integration is not implemented yet.",
      load: "Load UI/storage integration is not implemented yet."
    } as const;

    for (const commandId of DISABLED_PROTOTYPE_ACTIONS) {
      const outcome = controller.runAction(commandId);
      expectDisabledOutcome(outcome, disabledActionReasons[commandId]);
    }
  });

  it("returns JSON-safe deterministic state for disabled actions with no next-state or storage outputs", () => {
    const firstController = createReadonlyPrototypeController();
    const secondController = createReadonlyPrototypeController();

    const first = firstController.runAction("go");
    const second = secondController.runAction("go");

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect("nextState" in first).toBe(false);
    expect("statePatch" in first).toBe(false);
    expect("events" in first).toBe(false);
    expect("runtimeDomainEventValues" in first).toBe(false);
    expect("transaction" in first).toBe(false);
    expect("saveResult" in first).toBe(false);
    expect("loadResult" in first).toBe(false);
    expect(first.interaction).toBeUndefined();
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
