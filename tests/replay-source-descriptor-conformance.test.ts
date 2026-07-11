import { canonicalizeJson } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import {
  assertReplayInput,
  createReplayPlan,
  formatReplayValidationMessage,
  inspectReplayInput,
  inspectReplayPlan,
  isReplaySourceKind,
  REPLAY_SOURCE_KINDS,
  type ReplayDeterminismPolicy,
  type ReplayDiagnostic,
  type ReplayEventStreamSource,
  type ReplayInput,
  type ReplayPlan,
  type ReplaySnapshotAndEventsSource,
  type ReplaySnapshotSource,
  type ReplaySourceDescriptor,
  type ReplayStorageAdapterSource
} from "../packages/engine-contracts/src/index.js";

const determinismPolicy: ReplayDeterminismPolicy = {
  timestamps: "logical-only",
  eventOrdering: "revision-and-sequence-ascending",
  schemaMismatch: "reject",
  sourceMutation: "forbidden"
};

function expectAcceptedReplayInput(input: ReplayInput): void {
  const jsonSafeInput = JSON.parse(canonicalizeJson(input)) as ReplayInput;

  expect(inspectReplayInput(jsonSafeInput)).toEqual([]);
  expect(() => {
    assertReplayInput(jsonSafeInput);
  }).not.toThrow();
}

function createConformancePlan(source: ReplaySourceDescriptor): ReplayPlan {
  return createReplayPlan({
    source,
    determinismPolicy,
    steps: [
      {
        stepId: "replay.load-records",
        phase: "load-records",
        description: "Load replay records through a future replay boundary.",
        required: true
      },
      {
        stepId: "replay.produce-diagnostics",
        phase: "produce-diagnostics",
        description: "Produce deterministic contract diagnostics without runtime execution.",
        required: true
      }
    ]
  });
}

function expectRejectedReplayInput(value: unknown, expectedCode: string): readonly ReplayDiagnostic[] {
  const diagnostics = inspectReplayInput(value);

  expect(diagnostics.length).toBeGreaterThan(0);
  expect(diagnostics.some((diagnostic) => diagnostic.code === expectedCode)).toBe(true);
  expect(formatReplayValidationMessage(diagnostics)).toContain(expectedCode);

  return diagnostics;
}

describe("replay source descriptor conformance", () => {
  it("keeps the replay source kind registry deterministic", () => {
    expect(REPLAY_SOURCE_KINDS).toEqual([
      "snapshot-only",
      "event-stream-only",
      "snapshot-and-events",
      "storage-adapter"
    ]);

    for (const sourceKind of REPLAY_SOURCE_KINDS) {
      expect(isReplaySourceKind(sourceKind)).toBe(true);
    }

    expect(isReplaySourceKind("runtime-host")).toBe(false);
    expect(isReplaySourceKind("snapshot")).toBe(false);
    expect([...REPLAY_SOURCE_KINDS]).toEqual(REPLAY_SOURCE_KINDS);
  });

  it("accepts snapshot source descriptors and preserves snapshot metadata", () => {
    const source: ReplaySnapshotSource = {
      kind: "snapshot-only",
      snapshotId: "snapshot.runtime.slot-1",
      stateId: "state.runtime.current",
      schemaVersion: {
        schemaId: "persistence-snapshot-record",
        version: 1
      },
      storage: {
        adapterKind: "memory",
        snapshotRecordRef: "snapshots.snapshot.runtime.slot-1"
      }
    };

    const input: ReplayInput = {
      source,
      expectedStateId: "state.runtime.current",
      expectedRevision: 12,
      determinismPolicy
    };

    expectAcceptedReplayInput(input);

    const plan = createConformancePlan(source);
    expect(plan.source).toEqual(source);
    expect(inspectReplayPlan(plan)).toEqual([]);
  });

  it("accepts event stream source descriptors and preserves event metadata", () => {
    const source: ReplayEventStreamSource = {
      kind: "event-stream-only",
      eventRange: {
        fromRevision: 4,
        toRevision: 9
      },
      eventIds: ["runtime-event.command.inspect.04", "runtime-event.command.inspect.09"],
      schemaVersion: {
        schemaId: "persistence-event-record",
        version: 1
      },
      storage: {
        adapterKind: "file",
        eventOrderRef: "events.order.runtime",
        eventRecordRefs: [
          "events.records.runtime-event.command.inspect.04",
          "events.records.runtime-event.command.inspect.09"
        ]
      }
    };

    const input: ReplayInput = {
      source,
      determinismPolicy
    };

    expectAcceptedReplayInput(input);

    const plan = createConformancePlan(source);
    expect(plan.source).toEqual(source);
    expect(plan.source.kind).toBe("event-stream-only");
    expect(inspectReplayPlan(plan)).toEqual([]);
  });

  it("accepts snapshot and events source descriptors and preserves deterministic boundaries", () => {
    const source: ReplaySnapshotAndEventsSource = {
      kind: "snapshot-and-events",
      snapshotId: "snapshot.runtime.slot-2",
      stateId: "state.runtime.branch-a",
      subsequentEventRange: {
        fromRevision: 10,
        toRevision: 14
      },
      schemaVersion: {
        schemaId: "replay-plan",
        version: 1
      },
      storage: {
        adapterKind: "file",
        snapshotRecordRef: "snapshots.snapshot.runtime.slot-2",
        eventRecordRefs: ["events.records.runtime-event.command.inspect.14"]
      }
    };

    const input: ReplayInput = {
      source,
      expectedStateId: "state.runtime.branch-a",
      expectedRevision: 14,
      determinismPolicy
    };

    expectAcceptedReplayInput(input);

    const plan = createConformancePlan(source);
    expect(plan.source).toEqual(source);
    expect(plan.source.kind).toBe("snapshot-and-events");
    expect(inspectReplayPlan(plan)).toEqual([]);
  });

  it("accepts storage adapter source descriptors without invoking real storage", () => {
    const source: ReplayStorageAdapterSource = {
      kind: "storage-adapter",
      adapterKind: "memory",
      snapshotId: "snapshot.runtime.slot-3",
      stateId: "state.runtime.adapter",
      eventRange: {
        fromRevision: 15,
        toRevision: 18
      },
      eventIds: ["runtime-event.command.inspect.15"],
      schemaVersion: {
        schemaId: "replay-plan",
        version: 1
      },
      storage: {
        adapterKind: "memory",
        snapshotRecordRef: "snapshots.snapshot.runtime.slot-3",
        eventOrderRef: "events.order.runtime",
        eventRecordRefs: ["events.records.runtime-event.command.inspect.15"],
        fileAdapterRootRef: "adapter-root.runtime"
      }
    };

    const input: ReplayInput = {
      source,
      expectedStateId: "state.runtime.adapter",
      expectedRevision: 18,
      determinismPolicy
    };

    expectAcceptedReplayInput(input);

    const plan = createConformancePlan(source);
    expect(plan.source).toEqual(source);
    expect(plan.source.kind).toBe("storage-adapter");
    expect(inspectReplayPlan(plan)).toEqual([]);
  });

  it("rejects invalid replay source descriptors with stable diagnostics", () => {
    const unknownSourceKind = expectRejectedReplayInput(
      {
        source: {
          kind: "runtime-host",
          schemaVersion: {
            schemaId: "replay-plan",
            version: 1
          }
        },
        determinismPolicy
      },
      "REPLAY_SOURCE_INVALID"
    );

    expect(unknownSourceKind[0]?.path).toEqual(["source", "kind"]);

    expectRejectedReplayInput(
      {
        source: {
          kind: "event-stream-only",
          schemaVersion: {
            schemaId: "persistence-event-record",
            version: 1
          }
        },
        determinismPolicy
      },
      "REPLAY_SOURCE_INVALID"
    );

    expectRejectedReplayInput(
      {
        source: {
          kind: "storage-adapter",
          adapterKind: "memory",
          schemaVersion: {
            schemaId: "replay-plan",
            version: 1
          },
          storage: {
            adapterKind: "not-an-adapter",
            eventRecordRefs: "events.records.invalid"
          }
        },
        determinismPolicy
      },
      "REPLAY_STORAGE_REFERENCE_INVALID"
    );

    expectRejectedReplayInput(
      {
        source: {
          kind: "snapshot-and-events",
          snapshotId: "snapshot.runtime.slot-4",
          subsequentEventRange: {
            fromRevision: 9,
            toRevision: 3
          },
          schemaVersion: {
            schemaId: "replay-plan",
            version: 1
          }
        },
        determinismPolicy
      },
      "REPLAY_SOURCE_INVALID"
    );

    expectRejectedReplayInput(
      {
        source: {
          kind: "snapshot-only",
          schemaVersion: {
            schemaId: "persistence-snapshot-record",
            version: 1
          }
        },
        determinismPolicy
      },
      "REPLAY_SOURCE_INVALID"
    );
  });

  it("formats deterministic diagnostics for invalid plan inspection without implying runtime execution", () => {
    const diagnostics = inspectReplayPlan({
      source: {
        kind: "storage-adapter",
        adapterKind: "file",
        schemaVersion: {
          schemaId: "replay-plan",
          version: 1
        }
      },
      determinismPolicy,
      steps: [
        {
          stepId: "bad",
          phase: "execute-runtime",
          description: "",
          required: false
        }
      ]
    });

    expect(diagnostics.some((diagnostic) => diagnostic.code === "REPLAY_PLAN_INVALID")).toBe(true);
    expect(formatReplayValidationMessage(diagnostics)).toContain("REPLAY_PLAN_INVALID");
  });
});
