import { canonicalizeJson } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import {
  assertReplayInput,
  createReplayPlan,
  formatReplayValidationMessage,
  inspectReplayInput,
  inspectReplayPlan,
  type ReplayDiagnostic,
  type ReplayDeterminismPolicy,
  type ReplayInput,
  type ReplayPlan
} from "../packages/engine-contracts/src/index.js";

const revisionAscendingPolicy: ReplayDeterminismPolicy = {
  timestamps: "logical-only",
  eventOrdering: "revision-ascending",
  schemaMismatch: "reject",
  sourceMutation: "forbidden"
};

const sequenceAwarePolicy: ReplayDeterminismPolicy = {
  timestamps: "logical-only",
  eventOrdering: "revision-and-sequence-ascending",
  schemaMismatch: "reject",
  sourceMutation: "forbidden"
};

function expectAcceptedInput(input: ReplayInput): void {
  const jsonSafeInput = JSON.parse(canonicalizeJson(input)) as ReplayInput;
  expect(inspectReplayInput(jsonSafeInput)).toEqual([]);
  expect(() => {
    assertReplayInput(jsonSafeInput);
  }).not.toThrow();
}

function expectDiagnostic(
  diagnostics: readonly ReplayDiagnostic[],
  code: string,
  path: readonly (string | number)[]
): void {
  expect(diagnostics.some((diagnostic) => diagnostic.code === code && JSON.stringify(diagnostic.path) === JSON.stringify(path))).toBe(true);
}

describe("replay plan validation hardening", () => {
  it("keeps valid replay inputs accepted across all supported source kinds", () => {
    const inputs: ReplayInput[] = [
      {
        source: {
          kind: "snapshot-only",
          snapshotId: "snapshot.validation.slot-1",
          stateId: "state.validation.snapshot",
          schemaVersion: {
            schemaId: "persistence-snapshot-record",
            version: 1
          },
          storage: {
            adapterKind: "memory",
            snapshotRecordRef: "snapshots.snapshot.validation.slot-1"
          }
        },
        expectedStateId: "state.validation.snapshot",
        expectedRevision: 3,
        determinismPolicy: sequenceAwarePolicy
      },
      {
        source: {
          kind: "event-stream-only",
          eventRange: {
            fromRevision: 3,
            toRevision: 5
          },
          schemaVersion: {
            schemaId: "persistence-event-record",
            version: 1
          },
          storage: {
            adapterKind: "file",
            eventRecordRefs: ["events.records.validation.event-05"]
          }
        },
        determinismPolicy: revisionAscendingPolicy
      },
      {
        source: {
          kind: "snapshot-and-events",
          snapshotId: "snapshot.validation.slot-2",
          stateId: "state.validation.combined",
          subsequentEventRange: {
            fromRevision: 6,
            toRevision: 8
          },
          schemaVersion: {
            schemaId: "replay-plan",
            version: 1
          }
        },
        expectedStateId: "state.validation.combined",
        determinismPolicy: sequenceAwarePolicy
      },
      {
        source: {
          kind: "storage-adapter",
          adapterKind: "memory",
          snapshotId: "snapshot.validation.slot-3",
          eventIds: ["runtime-event.validation.07"],
          schemaVersion: {
            schemaId: "replay-plan",
            version: 1
          },
          storage: {
            adapterKind: "memory",
            snapshotRecordRef: "snapshots.snapshot.validation.slot-3",
            eventRecordRefs: ["events.records.runtime-event.validation.07"]
          }
        },
        expectedRevision: 7,
        determinismPolicy: revisionAscendingPolicy
      }
    ];

    for (const input of inputs) {
      expectAcceptedInput(input);
    }
  });

  it("rejects malformed replay inputs with stable codes and paths", () => {
    const missingSourceDiagnostics = inspectReplayInput({
      determinismPolicy: sequenceAwarePolicy
    });
    expectDiagnostic(missingSourceDiagnostics, "REPLAY_SOURCE_INVALID", ["source"]);

    const malformedInputDiagnostics = inspectReplayInput({
      source: {
        kind: "snapshot-only",
        snapshotId: "snapshot.validation.slot-4",
        schemaVersion: {
          schemaId: "Replay",
          version: 0
        },
        storage: {
          adapterKind: "invalid-adapter",
          eventRecordRefs: "not-an-array"
        }
      },
      expectedStateId: "!",
      expectedRevision: -1,
      determinismPolicy: {
        timestamps: "wall-clock",
        eventOrdering: "random",
        schemaMismatch: "migrate",
        sourceMutation: "allowed"
      }
    });

    expectDiagnostic(malformedInputDiagnostics, "REPLAY_SCHEMA_VERSION_INVALID", ["source", "schemaVersion", "schemaId"]);
    expectDiagnostic(malformedInputDiagnostics, "REPLAY_SCHEMA_VERSION_INVALID", ["source", "schemaVersion", "version"]);
    expectDiagnostic(malformedInputDiagnostics, "REPLAY_STORAGE_REFERENCE_INVALID", ["source", "storage", "adapterKind"]);
    expectDiagnostic(malformedInputDiagnostics, "REPLAY_STORAGE_REFERENCE_INVALID", ["source", "storage", "eventRecordRefs"]);
    expectDiagnostic(malformedInputDiagnostics, "REPLAY_POLICY_INVALID", ["determinismPolicy", "timestamps"]);
    expectDiagnostic(malformedInputDiagnostics, "REPLAY_POLICY_INVALID", ["determinismPolicy", "eventOrdering"]);
    expectDiagnostic(malformedInputDiagnostics, "REPLAY_INPUT_INVALID", ["expectedStateId"]);
    expectDiagnostic(malformedInputDiagnostics, "REPLAY_INPUT_INVALID", ["expectedRevision"]);
  });

  it("accepts valid replay plans and keeps creation separate from validation", () => {
    const plan: ReplayPlan = createReplayPlan({
      source: {
        kind: "snapshot-and-events",
        snapshotId: "snapshot.validation.slot-5",
        stateId: "state.validation.plan",
        subsequentEventRange: {
          fromRevision: 9,
          toRevision: 11
        },
        schemaVersion: {
          schemaId: "replay-plan",
          version: 1
        }
      },
      determinismPolicy: sequenceAwarePolicy,
      steps: [
        {
          stepId: "replay.load-records",
          phase: "load-records",
          description: "Load deterministic replay records.",
          required: true
        },
        {
          stepId: "replay.validate-schema-versions",
          phase: "validate-schema-versions",
          description: "Validate replay schema versions before any future runner exists.",
          required: true
        },
        {
          stepId: "replay.produce-diagnostics",
          phase: "produce-diagnostics",
          description: "Produce developer-facing diagnostics only.",
          required: true
        }
      ]
    });

    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((step) => step.stepId)).toEqual([
      "replay.load-records",
      "replay.validate-schema-versions",
      "replay.produce-diagnostics"
    ]);
    expect(inspectReplayPlan(plan)).toEqual([]);
  });

  it("rejects malformed replay plans including empty step sets and duplicate step ids", () => {
    const missingPolicyDiagnostics = inspectReplayPlan({
      source: {
        kind: "snapshot-only",
        snapshotId: "snapshot.validation.slot-6",
        schemaVersion: {
          schemaId: "replay-plan",
          version: 1
        }
      },
      steps: []
    });

    expectDiagnostic(missingPolicyDiagnostics, "REPLAY_POLICY_INVALID", ["determinismPolicy"]);
    expectDiagnostic(missingPolicyDiagnostics, "REPLAY_PLAN_INVALID", ["steps"]);
    expect(formatReplayValidationMessage(missingPolicyDiagnostics)).toBe(
      'REPLAY_NON_JSON_VALUE @ /determinismPolicy: Value of type undefined is not JSON-safe.'
    );

    const malformedPlanDiagnostics = inspectReplayPlan({
      source: {
        kind: "snapshot-only",
        snapshotId: "snapshot.validation.slot-7",
        schemaVersion: {
          schemaId: "replay-plan",
          version: 1
        }
      },
      determinismPolicy: sequenceAwarePolicy,
      steps: [
        {
          stepId: "replay.load-records",
          phase: "load-records",
          description: "Load records.",
          required: true
        },
        {
          stepId: "replay.load-records",
          phase: "execute-runtime",
          description: "",
          required: false
        }
      ]
    });

    expectDiagnostic(malformedPlanDiagnostics, "REPLAY_PLAN_INVALID", ["steps", 1, "stepId"]);
    expectDiagnostic(malformedPlanDiagnostics, "REPLAY_PLAN_INVALID", ["steps", 1, "phase"]);
    expectDiagnostic(malformedPlanDiagnostics, "REPLAY_PLAN_INVALID", ["steps", 1, "description"]);
    expectDiagnostic(malformedPlanDiagnostics, "REPLAY_PLAN_INVALID", ["steps", 1, "required"]);
  });

  it("keeps diagnostics deterministic and developer-facing", () => {
    const diagnostics = inspectReplayPlan({
      source: {
        kind: "storage-adapter",
        adapterKind: "memory",
        schemaVersion: {
          schemaId: "replay-plan",
          version: 1
        }
      },
      determinismPolicy: revisionAscendingPolicy,
      steps: [
        {
          stepId: "replay.load-records",
          phase: "load-records",
          description: "Load records.",
          required: true
        },
        {
          stepId: "replay.load-records",
          phase: "produce-diagnostics",
          description: "Duplicate id should fail deterministically.",
          required: true
        }
      ]
    });

    expect(diagnostics).toEqual([
      {
        code: "REPLAY_PLAN_INVALID",
        path: ["steps", 1, "stepId"],
        message: "stepId must be unique."
      }
    ]);
    expect(formatReplayValidationMessage(diagnostics)).toBe(
      "REPLAY_PLAN_INVALID @ /steps/1/stepId: stepId must be unique."
    );
    expect(formatReplayValidationMessage(diagnostics)).not.toMatch(/click|button|screen|menu/ui);
  });
});
