import { readFileSync } from "node:fs";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import {
  createReplayPlan,
  createReplayResult,
  formatReplayValidationMessage,
  inspectReplayInput,
  inspectReplayPlan,
  isReplaySourceKind,
  isReplayStatus,
  REPLAY_SOURCE_KINDS,
  REPLAY_STATUSES,
  type ReplayInput,
  type ReplayPlan,
  type ReplayResult
} from "../packages/engine-contracts/src/index.js";

describe("replay contracts", () => {
  it("exports replay statuses and status guard", () => {
    expect(REPLAY_STATUSES).toEqual(["planned", "replayed", "blocked", "rejected", "error"]);
    expect(isReplayStatus("planned")).toBe(true);
    expect(isReplayStatus("rejected")).toBe(true);
    expect(isReplayStatus("completed")).toBe(false);
  });

  it("exports replay source kinds and source kind guard", () => {
    expect(REPLAY_SOURCE_KINDS).toEqual(["snapshot-only", "event-stream-only", "snapshot-and-events", "storage-adapter"]);
    expect(isReplaySourceKind("snapshot-only")).toBe(true);
    expect(isReplaySourceKind("storage-adapter")).toBe(true);
    expect(isReplaySourceKind("runtime-host")).toBe(false);
  });

  it("accepts JSON-safe replay inputs for snapshot, event stream, and snapshot plus events sources", () => {
    const snapshotInput: ReplayInput = {
      source: {
        kind: "snapshot-only",
        snapshotId: "snapshot.demo.slot-1",
        stateId: "state.runtime.current",
        schemaVersion: {
          schemaId: "persistence-snapshot-record",
          version: 1
        },
        storage: {
          adapterKind: "file",
          snapshotRecordRef: "snapshots.snapshot.demo.slot-1"
        }
      },
      expectedStateId: "state.runtime.current",
      expectedRevision: 8,
      determinismPolicy: {
        timestamps: "logical-only",
        eventOrdering: "revision-and-sequence-ascending",
        schemaMismatch: "reject",
        sourceMutation: "forbidden"
      }
    };

    const eventStreamInput: ReplayInput = {
      source: {
        kind: "event-stream-only",
        eventRange: {
          fromRevision: 7,
          toRevision: 8
        },
        eventIds: ["runtime-event.command.demo.inspect.01"],
        schemaVersion: {
          schemaId: "persistence-event-record",
          version: 1
        },
        storage: {
          adapterKind: "file",
          eventOrderRef: "events.order",
          eventRecordRefs: ["events.records.runtime-event.command.demo.inspect.01"]
        }
      },
      determinismPolicy: {
        timestamps: "logical-only",
        eventOrdering: "revision-ascending",
        schemaMismatch: "reject",
        sourceMutation: "forbidden"
      }
    };

    const combinedInput: ReplayInput = {
      source: {
        kind: "snapshot-and-events",
        snapshotId: "snapshot.demo.slot-1",
        stateId: "state.runtime.current",
        subsequentEventRange: {
          fromRevision: 9,
          toRevision: 12
        },
        schemaVersion: {
          schemaId: "replay-plan",
          version: 1
        },
        storage: {
          adapterKind: "file",
          snapshotRecordRef: "snapshots.snapshot.demo.slot-1",
          eventRecordRefs: ["events.records.runtime-event.command.demo.inspect.02"]
        }
      },
      expectedStateId: "state.runtime.current",
      determinismPolicy: {
        timestamps: "logical-only",
        eventOrdering: "revision-and-sequence-ascending",
        schemaMismatch: "reject",
        sourceMutation: "forbidden"
      }
    };

    expect(inspectReplayInput(JSON.parse(canonicalizeJson(snapshotInput)))).toEqual([]);
    expect(inspectReplayInput(JSON.parse(canonicalizeJson(eventStreamInput)))).toEqual([]);
    expect(inspectReplayInput(JSON.parse(canonicalizeJson(combinedInput)))).toEqual([]);
  });

  it("creates deterministic replay plans and replay results as data-only values", () => {
    const plan: ReplayPlan = createReplayPlan({
      source: {
        kind: "storage-adapter",
        adapterKind: "file",
        snapshotId: "snapshot.demo.slot-1",
        eventRange: {
          fromRevision: 9,
          toRevision: 12
        },
        schemaVersion: {
          schemaId: "replay-plan",
          version: 1
        },
        storage: {
          adapterKind: "file",
          snapshotRecordRef: "snapshots.snapshot.demo.slot-1",
          eventOrderRef: "events.order"
        }
      },
      determinismPolicy: {
        timestamps: "logical-only",
        eventOrdering: "revision-and-sequence-ascending",
        schemaMismatch: "reject",
        sourceMutation: "forbidden"
      },
      steps: [
        {
          stepId: "replay.load-records",
          phase: "load-records",
          description: "Load snapshot and event records through a future replay boundary.",
          required: true
        },
        {
          stepId: "replay.rebuild-state",
          phase: "rebuild-state",
          description: "Rebuild state only in a future replay implementation.",
          required: true
        }
      ]
    });

    expect(inspectReplayPlan(plan)).toEqual([]);

    const result: ReplayResult = createReplayResult({
      status: "planned",
      diagnostics: [],
      metadata: {
        deterministic: true,
        planOnly: true,
        sourceKind: "storage-adapter",
        schemaVersion: 1,
        storageAdapterKind: "file",
        stepCount: 2
      },
      plan
    });

    expect(result.status).toBe("planned");
    expect(result.metadata.planOnly).toBe(true);
    expect(result.plan?.steps).toHaveLength(2);
    expect(JSON.parse(canonicalizeJson(result))).toEqual(result);
  });

  it("returns deterministic diagnostics for invalid replay input and plan values", () => {
    const diagnostics = inspectReplayInput({
      source: {
        kind: "event-stream-only",
        schemaVersion: {
          schemaId: "Replay",
          version: 0
        }
      },
      expectedRevision: -1,
      determinismPolicy: {
        timestamps: "wall-clock",
        eventOrdering: "random",
        schemaMismatch: "migrate",
        sourceMutation: "allowed"
      }
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(formatReplayValidationMessage(diagnostics)).toContain(diagnostics[0]?.code ?? "");

    const planDiagnostics = inspectReplayPlan({
      source: {
        kind: "snapshot-only",
        snapshotId: "bad",
        schemaVersion: {
          schemaId: "replay-plan",
          version: 1
        }
      },
      determinismPolicy: {
        timestamps: "logical-only",
        eventOrdering: "revision-ascending",
        schemaMismatch: "reject",
        sourceMutation: "forbidden"
      },
      steps: [
        {
          stepId: "bad",
          phase: "execute-runtime",
          description: "",
          required: false
        }
      ]
    });

    expect(planDiagnostics.some((diagnostic) => diagnostic.code === "REPLAY_PLAN_INVALID")).toBe(true);
  });

  it("keeps replay contracts free of replay execution, file IO, and storage adapter invocation", () => {
    const source = readFileSync("packages/engine-contracts/src/replay/replay-types.ts", "utf8");
    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|appendFileSync|fetch\(/u);
    expect(source).not.toMatch(/createFileStorageAdapter|appendEventRecords|loadSnapshot\(|saveSnapshot\(|executeInMemoryCommand/u);
  });
});