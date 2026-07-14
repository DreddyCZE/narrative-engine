import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_CONTRACT_VERSION,
  runReadonlyRuntimePresentationSnapshotScenario
} = engineContracts;

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime readonly presentation snapshot scenario", () => {
  it("builds the public presentation snapshot", () => {
    const result = runReadonlyRuntimePresentationSnapshotScenario();

    expect(result.scenarioId).toBe("runtime-presentation-snapshot.readonly");
    expect(result.packageId).toBe("content.runtime-smoke.readonly");
    expect(result.sourceTranscriptScenarioId).toBe("runtime-transcript.readonly");
    expect(result.presentation.modelId).toBe("runtime-readonly-presentation");
    expect(result.summary).toBeDefined();
    expect(result.metadata).toEqual({
      deterministic: true,
      scenarioVersion: READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_CONTRACT_VERSION,
      transcriptLineCount: 3,
      availableCommandCount: 2,
      diagnosticCount: 0
    });
    expectJsonSafe(result);
  });

  it("derives the summary from the presentation model", () => {
    const result = runReadonlyRuntimePresentationSnapshotScenario();

    expect(result.summary.locationTitle).toBe(result.presentation.location?.title);
    expect(result.summary.inventoryItemCount).toBe(result.presentation.inventory?.itemCount);
    expect(result.summary.availableCommands).toEqual(result.presentation.availableCommands);
    expect(result.summary.transcriptPreview).toEqual(result.presentation.transcript.map((line) => line.text));
  });

  it("keeps the presentation model correct", () => {
    const result = runReadonlyRuntimePresentationSnapshotScenario();

    expect(result.presentation.location?.title).toBe("Smoke Test Airlock");
    expect(result.presentation.inventory?.itemCount).toBe(1);
    expect(result.presentation.availableCommands).toEqual(["look", "inventory"]);
    expect(result.presentation.transcript).toHaveLength(3);
    expect(result.presentation.diagnostics).toEqual([]);
  });

  it("is deterministic", () => {
    const first = runReadonlyRuntimePresentationSnapshotScenario();
    const second = runReadonlyRuntimePresentationSnapshotScenario();

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("does not include next-state, event, transaction, or storage outputs", () => {
    const result = runReadonlyRuntimePresentationSnapshotScenario();

    expect("nextState" in result).toBe(false);
    expect("statePatch" in result).toBe(false);
    expect("events" in result).toBe(false);
    expect("runtimeDomainEventValues" in result).toBe(false);
    expect("transaction" in result).toBe(false);
    expect("saveResult" in result).toBe(false);
    expect("loadResult" in result).toBe(false);
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
