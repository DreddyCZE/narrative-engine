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

describe("readonly browser prototype map layout panel", () => {
  it("builds deterministic initial state with a readonly map panel", () => {
    const first = createReadonlyPrototypeState();
    const second = createReadonlyPrototypeState();
    const currentTile = first.mapPanel.tiles.find((tile) => tile.locationId === first.mapPanel.currentLocationId);

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
    expect(first.mapPanel.tiles.length).toBeGreaterThanOrEqual(2);
    expect(first.mapPanel.currentLocationId).toBe(first.location?.locationId);
    expect(currentTile?.label).toBe("Smoke Test Airlock");
    expect(first.mapPanel.tiles.some((tile) => tile.label === "Smoke Test Corridor")).toBe(true);
    expect(first.mapPanel.connections.length).toBeGreaterThanOrEqual(1);
    expect(first.mapPanel.legend).toEqual(["Current", "Known location", "Connection", "Disabled movement"]);
    expect(first.output.kind).toBe("transcript-preview");
    expect(first.output.lines.length).toBeGreaterThan(0);
    expect(first.diagnostics).toEqual([]);
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expectJsonSafe(first);
  });

  it("keeps the accepted command palette unchanged", () => {
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
    expect(palette.find((item) => item.commandId === "go")?.enabled).toBe(false);

    for (const commandId of DISABLED_PROTOTYPE_ACTIONS) {
      const item = palette.find((paletteItem) => paletteItem.commandId === commandId);
      expect(item?.enabled).toBe(false);
      expect(item?.disabledReason?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("keeps the map and player state unchanged during look", () => {
    const controller = createReadonlyPrototypeController();
    const beforeState = controller.getState();

    const outcome = controller.runAction("look");
    const afterState = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.status).toBe("executed");
    expect(outcome.interaction?.status).toBe("executed");
    expect(outcome.interaction?.execution?.view?.kind).toBe("look");
    expect(outcome.output.title).toBe("Smoke Test Airlock");
    expect(afterState.mapPanel.currentLocationId).toBe(beforeState.mapPanel.currentLocationId);
    expect(afterState.mapPanel.tiles.length).toBe(beforeState.mapPanel.tiles.length);
    expect(canonicalizeJson(afterState.mapPanel)).toBe(canonicalizeJson(beforeState.mapPanel));
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(outcome.playerStateUnchanged).toBe(true);
    expectJsonSafe(outcome);
  });

  it("keeps disabled go local and never moves or executes runtime interaction", () => {
    const controller = createReadonlyPrototypeController();
    const beforeState = controller.getState();

    const outcome = controller.runAction("go");
    const afterState = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.status).toBe("disabled");
    expect(outcome.disabledReason).toBe("Movement execution is not implemented yet.");
    expect(outcome.interaction).toBeUndefined();
    expect(outcome.output.lines).toContain("Movement execution is not implemented yet.");
    expect(afterState.mapPanel.currentLocationId).toBe(beforeState.mapPanel.currentLocationId);
    expect(canonicalizeJson(afterState.mapPanel)).toBe(canonicalizeJson(beforeState.mapPanel));
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(outcome.playerStateUnchanged).toBe(true);
    expectJsonSafe(outcome);
  });

  it("keeps map layout data out of engine contracts", () => {
    expect("RuntimeMap" in engineContracts).toBe(false);
    expect("MapTile" in engineContracts).toBe(false);
    expect("MapRenderer" in engineContracts).toBe(false);
    expect("MapEditor" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
  });

  it("returns JSON-safe deterministic outcomes with no next-state or storage outputs", () => {
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
});