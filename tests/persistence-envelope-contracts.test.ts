import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import {
  ENGINE_STATE_CONTRACT_VERSION,
  PERSISTENCE_STATUSES,
  createPersistenceResult,
  inspectPersistenceEventEnvelope,
  inspectPersistenceSnapshotRecord,
  isPersistenceStatus,
  type PersistenceAppendEventsInput,
  type PersistenceEventEnvelope,
  type PersistenceSaveSnapshotInput,
  type PersistenceSnapshotRecord
} from "../packages/engine-contracts/src/index.js";

const eventEnvelope: PersistenceEventEnvelope = {
  records: [
    {
      eventId: "runtime-event.command.demo.inspect.01",
      eventType: "demo.inspected",
      sourceCommandId: "command.demo.inspect",
      transactionId: "transaction.runtime.inspect-demo",
      revision: 8,
      schemaVersion: 1,
      payload: {
        eventMappingId: "event-mapping.demo.inspect",
        packageId: "content.demo.minimal"
      },
      metadata: {
        deterministic: true,
        persistence: "memory",
        source: "runtime-host",
        createdAtPolicy: "logical",
        runtimeVersion: "runtime-host@0.1.0",
        contentPackageId: "content.demo.minimal",
        idempotencyKey: "append.demo.inspect.01"
      }
    }
  ],
  metadata: {
    deterministic: true,
    persistence: "memory",
    source: "event-store",
    batchId: "batch.demo.inspect.01"
  }
};

const snapshotRecord: PersistenceSnapshotRecord = {
  snapshotId: "snapshot.demo.slot-1",
  stateId: "state.runtime.current",
  revision: 8,
  contentPackageId: "content.demo.minimal",
  sourceEventRange: {
    fromRevision: 7,
    toRevision: 8
  },
  checksum: "sha256:demo-snapshot-8",
  state: {
    contractVersion: ENGINE_STATE_CONTRACT_VERSION,
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.runtime.current",
    revision: 8,
    run: {
      activeModules: [],
      domains: []
    }
  },
  metadata: {
    deterministic: true,
    persistence: "memory",
    source: "save-snapshot-store",
    runtimeVersion: "runtime-host@0.1.0",
    contentPackageVersion: "content.demo.minimal@1.0.0"
  }
};

describe("persistence envelope contracts", () => {
  it("exports persistence statuses and status guard", () => {
    expect(PERSISTENCE_STATUSES).toEqual(["saved", "appended", "loaded", "rejected", "blocked", "error"]);
    expect(isPersistenceStatus("saved")).toBe(true);
    expect(isPersistenceStatus("appended")).toBe(true);
    expect(isPersistenceStatus("loaded")).toBe(true);
    expect(isPersistenceStatus("rejected")).toBe(true);
    expect(isPersistenceStatus("blocked")).toBe(true);
    expect(isPersistenceStatus("error")).toBe(true);
    expect(isPersistenceStatus("unknown")).toBe(false);
  });

  it("supports JSON-safe event append and snapshot save inputs", () => {
    const appendInput: PersistenceAppendEventsInput = {
      envelope: eventEnvelope
    };
    const saveInput: PersistenceSaveSnapshotInput = {
      snapshot: snapshotRecord
    };

    expect(inspectPersistenceEventEnvelope(appendInput.envelope)).toEqual([]);
    expect(inspectPersistenceSnapshotRecord(saveInput.snapshot)).toEqual([]);
    expect(canonicalizeJson(appendInput)).toContain("runtime-event.command.demo.inspect.01");
    expect(canonicalizeJson(saveInput)).toContain("snapshot.demo.slot-1");
  });

  it("builds deterministic persistence results", () => {
    const first = createPersistenceResult({
      status: "saved",
      metadata: {
        deterministic: true,
        persistence: "memory",
        source: "save-snapshot-store",
        operation: "save-snapshot",
        snapshotId: "snapshot.demo.slot-1"
      },
      snapshot: snapshotRecord
    });
    const second = createPersistenceResult({
      status: "saved",
      metadata: {
        deterministic: true,
        persistence: "memory",
        source: "save-snapshot-store",
        operation: "save-snapshot",
        snapshotId: "snapshot.demo.slot-1"
      },
      snapshot: JSON.parse(canonicalizeJson(snapshotRecord)) as PersistenceSnapshotRecord
    });

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("reports invalid event and snapshot envelope diagnostics deterministically", () => {
    const invalidEventDiagnostics = inspectPersistenceEventEnvelope({
      records: [{ ...eventEnvelope.records[0], eventId: "bad" }],
      metadata: eventEnvelope.metadata
    });
    const invalidSnapshotDiagnostics = inspectPersistenceSnapshotRecord({
      ...snapshotRecord,
      snapshotId: "bad",
      state: {
        ...snapshotRecord.state,
        revision: 9
      }
    });

    expect(invalidEventDiagnostics.map((diagnostic) => diagnostic.code)).toContain("PERSISTENCE_EVENT_RECORD_INVALID");
    expect(invalidSnapshotDiagnostics.map((diagnostic) => diagnostic.code)).toContain("PERSISTENCE_SNAPSHOT_RECORD_INVALID");
  });

  it("keeps persistence contracts free of runtime execution, file IO, and storage adapter code", () => {
    const source = readFileSync("packages/engine-contracts/src/persistence/persistence-types.ts", "utf8");

    expect(source).not.toMatch(/readFileSync|writeFileSync|appendFileSync|node:fs|fetch\(/u);
    expect(source).not.toContain("database adapter");
    expect(source).not.toContain("external storage adapter implementation");
    expect(source).not.toMatch(/function\s+(execute|runTransaction|applyEffect|materialize)/u);
  });
});
