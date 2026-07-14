import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  createRuntimeReadonlyPresentationModel,
  runReadonlyRuntimeTranscriptScenario,
  RUNTIME_READONLY_PRESENTATION_MODEL_CONTRACT_VERSION
} = engineContracts;

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime readonly presentation model", () => {
  it("builds a presentation model from transcript", () => {
    const transcript = runReadonlyRuntimeTranscriptScenario();
    const model = createRuntimeReadonlyPresentationModel({ transcript });

    expect(model.modelId).toBe("runtime-readonly-presentation");
    expect(model.sourceScenarioId).toBe("runtime-transcript.readonly");
    expect(model.packageId).toBe("content.runtime-smoke.readonly");
    expect(model.location).toBeDefined();
    expect(model.inventory).toBeDefined();
    expect(model.transcript).toHaveLength(3);
    expect(model.diagnostics).toEqual([]);
    expect(model.metadata).toEqual({
      deterministic: true,
      presentationVersion: RUNTIME_READONLY_PRESENTATION_MODEL_CONTRACT_VERSION,
      transcriptLineCount: 3,
      diagnosticCount: 0
    });
    expectJsonSafe(model);
  });

  it("derives the location panel from the latest look view", () => {
    const transcript = runReadonlyRuntimeTranscriptScenario();
    const latestLookView = transcript.commands[2]?.view;
    const model = createRuntimeReadonlyPresentationModel({ transcript });

    expect(latestLookView?.kind).toBe("look");
    expect(model.location).toEqual(
      latestLookView?.kind === "look"
        ? {
            locationId: latestLookView.look.locationId,
            title: latestLookView.look.title,
            description: latestLookView.look.description,
            exits: latestLookView.look.exits,
            items: latestLookView.look.items,
            npcs: latestLookView.look.npcs
          }
        : undefined
    );
    expect(model.location?.locationId).toBe("location.smoke.start");
    expect(model.location?.title).toBe("Smoke Test Airlock");
  });

  it("derives the inventory panel from the latest inventory view", () => {
    const transcript = runReadonlyRuntimeTranscriptScenario();
    const inventoryView = transcript.commands[1]?.view;
    const model = createRuntimeReadonlyPresentationModel({ transcript });

    expect(inventoryView?.kind).toBe("inventory");
    expect(model.inventory).toEqual(
      inventoryView?.kind === "inventory"
        ? {
            itemCount: inventoryView.inventory.itemCount,
            items: inventoryView.inventory.items,
            empty: false
          }
        : undefined
    );
    expect(model.inventory?.itemCount).toBe(1);
    expect(model.inventory?.items[0]?.itemId).toBe("item.smoke.keycard");
    expect(model.inventory?.items[0]?.title).toBe("Smoke Test Keycard");
    expect(model.inventory?.empty).toBe(false);
  });

  it("preserves transcript lines", () => {
    const transcript = runReadonlyRuntimeTranscriptScenario();
    const model = createRuntimeReadonlyPresentationModel({ transcript });

    expect(model.transcript).toEqual(transcript.lines);
  });

  it("filters available commands to read-only actions", () => {
    const transcript = runReadonlyRuntimeTranscriptScenario();
    const model = createRuntimeReadonlyPresentationModel({ transcript });

    expect(model.availableCommands).toEqual(["look", "inventory"]);
  });

  it("is deterministic", () => {
    const transcript = runReadonlyRuntimeTranscriptScenario();
    const first = createRuntimeReadonlyPresentationModel({ transcript });
    const second = createRuntimeReadonlyPresentationModel({ transcript });

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("does not mutate the source transcript", () => {
    const transcript = runReadonlyRuntimeTranscriptScenario();
    const before = canonicalizeJson(transcript);

    createRuntimeReadonlyPresentationModel({ transcript });

    expect(canonicalizeJson(transcript)).toBe(before);
  });

  it("does not include next-state, event, transaction, or storage outputs", () => {
    const model = createRuntimeReadonlyPresentationModel({ transcript: runReadonlyRuntimeTranscriptScenario() });

    expect("nextState" in model).toBe(false);
    expect("statePatch" in model).toBe(false);
    expect("events" in model).toBe(false);
    expect("runtimeDomainEventValues" in model).toBe(false);
    expect("transaction" in model).toBe(false);
    expect("saveResult" in model).toBe(false);
    expect("loadResult" in model).toBe(false);
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
