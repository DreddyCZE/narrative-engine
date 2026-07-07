import { canonicalizeJson, type JsonPath, type JsonValue } from "@narrative-engine/core";
import {
  createStorageOperationResult,
  inspectPersistenceEventEnvelope,
  inspectPersistenceSnapshotRecord,
  inspectStorageAppendEventsInput,
  inspectStorageLoadSnapshotInput,
  inspectStorageReadEventsInput,
  inspectStorageSaveSnapshotInput,
  type PersistenceEventEnvelope,
  type PersistenceEventRecord,
  type PersistenceSnapshotRecord,
  type StorageAdapterCapability,
  type StorageAdapterContract,
  type StorageAdapterDiagnostic,
  type StorageAppendEventsInput,
  type StorageLoadSnapshotInput,
  type StorageOperationResult,
  type StorageReadEventsInput,
  type StorageSaveSnapshotInput
} from "@narrative-engine/engine-contracts";

const STORAGE_SCHEMA_VERSION = 1;

export type MemoryStorageAdapterOptions = {
  readonly adapterId?: string;
  readonly initialEventRecords?: readonly PersistenceEventRecord[];
  readonly initialSnapshots?: readonly PersistenceSnapshotRecord[];
};

export type MemoryStorageAdapter = StorageAdapterContract & {
  readonly adapterId: string;
  appendEventRecords: (input: StorageAppendEventsInput) => Promise<StorageOperationResult>;
  readEventRecords: (input: StorageReadEventsInput) => Promise<StorageOperationResult>;
  listEventRecords: (input: StorageReadEventsInput) => Promise<StorageOperationResult>;
  saveSnapshot: (input: StorageSaveSnapshotInput) => Promise<StorageOperationResult>;
  loadSnapshot: (input: StorageLoadSnapshotInput) => Promise<StorageOperationResult>;
};

type MemoryStorageState = {
  readonly eventRecords: Map<string, PersistenceEventRecord>;
  readonly eventOrder: string[];
  readonly snapshots: Map<string, PersistenceSnapshotRecord>;
};

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function createDiagnostic(
  code: string,
  path: JsonPath,
  message: string,
  details?: JsonValue
): StorageAdapterDiagnostic {
  return {
    code,
    path: [...path],
    message,
    ...(details === undefined ? {} : { details: cloneValue(details) })
  };
}

function createRejectedResult(
  operation: StorageOperationResult["metadata"]["operation"],
  diagnostics: readonly StorageAdapterDiagnostic[],
  overrides: Partial<StorageOperationResult["metadata"]> = {}
): StorageOperationResult {
  return createStorageOperationResult({
    status: "rejected",
    diagnostics,
    metadata: {
      deterministic: true,
      adapterKind: "memory",
      operation,
      persistent: false,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      ...overrides
    }
  });
}

function createBlockedResult(
  operation: StorageOperationResult["metadata"]["operation"],
  diagnostics: readonly StorageAdapterDiagnostic[],
  overrides: Partial<StorageOperationResult["metadata"]> = {}
): StorageOperationResult {
  return createStorageOperationResult({
    status: "blocked",
    diagnostics,
    metadata: {
      deterministic: true,
      adapterKind: "memory",
      operation,
      persistent: false,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      ...overrides
    }
  });
}

function normalizeEventRecord(record: PersistenceEventRecord): PersistenceEventRecord {
  return {
    ...cloneValue(record),
    metadata: {
      ...cloneValue(record.metadata),
      persistence: "memory"
    }
  };
}

function normalizeEventEnvelope(envelope: PersistenceEventEnvelope): PersistenceEventEnvelope {
  return {
    records: Object.freeze(envelope.records.map((record) => normalizeEventRecord(record))),
    metadata: {
      ...cloneValue(envelope.metadata),
      persistence: "memory"
    }
  };
}

function normalizeSnapshot(snapshot: PersistenceSnapshotRecord): PersistenceSnapshotRecord {
  return {
    ...cloneValue(snapshot),
    metadata: {
      ...cloneValue(snapshot.metadata),
      persistence: "memory"
    }
  };
}

function buildCapabilities(): readonly StorageAdapterCapability[] {
  return Object.freeze([
    { operation: "append-events", batch: true, idempotent: true },
    { operation: "list-events" },
    { operation: "read-events" },
    { operation: "save-snapshot", idempotent: true },
    { operation: "load-snapshot" },
    { operation: "health-check" }
  ]);
}

function createState(options: MemoryStorageAdapterOptions): MemoryStorageState {
  const eventRecords = new Map<string, PersistenceEventRecord>();
  const eventOrder: string[] = [];
  const snapshots = new Map<string, PersistenceSnapshotRecord>();

  const initialEventEnvelope: PersistenceEventEnvelope = {
    records: Object.freeze((options.initialEventRecords ?? []).map((record) => normalizeEventRecord(record))),
    metadata: {
      deterministic: true,
      persistence: "memory",
      source: "event-store"
    }
  };
  const initialEventDiagnostics = inspectPersistenceEventEnvelope(initialEventEnvelope);
  if (initialEventDiagnostics.length > 0) {
    throw new Error(initialEventDiagnostics[0]?.message ?? "Initial event records are invalid.");
  }

  for (const record of initialEventEnvelope.records) {
    if (!eventRecords.has(record.eventId)) {
      eventOrder.push(record.eventId);
    }
    eventRecords.set(record.eventId, cloneValue(record));
  }

  for (const snapshot of options.initialSnapshots ?? []) {
    const normalizedSnapshot = normalizeSnapshot(snapshot);
    const diagnostics = inspectPersistenceSnapshotRecord(normalizedSnapshot);
    if (diagnostics.length > 0) {
      throw new Error(diagnostics[0]?.message ?? "Initial snapshots are invalid.");
    }
    snapshots.set(normalizedSnapshot.snapshotId, cloneValue(normalizedSnapshot));
  }

  return {
    eventRecords,
    eventOrder,
    snapshots
  };
}

export function createMemoryStorageAdapter(options: MemoryStorageAdapterOptions = {}): MemoryStorageAdapter {
  const state = createState(options);
  const contract: StorageAdapterContract = {
    kind: "memory",
    capabilities: buildCapabilities(),
    deterministic: true,
    persistent: false,
    schemaVersion: STORAGE_SCHEMA_VERSION
  };

  return {
    ...contract,
    adapterId: options.adapterId ?? `memory-storage:${String(state.eventOrder.length)}:${String(state.snapshots.size)}`,

    async appendEventRecords(input: StorageAppendEventsInput): Promise<StorageOperationResult> {
      await Promise.resolve();
      const inputDiagnostics = inspectStorageAppendEventsInput(input).map((diagnostic) =>
        createDiagnostic(diagnostic.code, diagnostic.path, diagnostic.message, diagnostic.details)
      );
      if (inputDiagnostics.length > 0) {
        return createRejectedResult("append-events", inputDiagnostics);
      }
      if (input.adapterKind !== "memory") {
        return createRejectedResult("append-events", [createDiagnostic("MEMORY_STORAGE_ADAPTER_KIND_INVALID", ["adapterKind"], 'adapterKind must be "memory".')]);
      }

      const envelope = normalizeEventEnvelope(input.envelope);
      const newRecords: PersistenceEventRecord[] = [];
      const duplicateDiagnostics: StorageAdapterDiagnostic[] = [];
      const conflictingDiagnostics: StorageAdapterDiagnostic[] = [];

      for (let index = 0; index < envelope.records.length; index += 1) {
        const record = envelope.records[index];
        if (record === undefined) {
          continue;
        }

        const existing = state.eventRecords.get(record.eventId);
        if (existing === undefined) {
          newRecords.push(record);
          continue;
        }

        if (canonicalizeJson(existing) === canonicalizeJson(record)) {
          duplicateDiagnostics.push(
            createDiagnostic(
              "MEMORY_STORAGE_EVENT_DUPLICATE_EXISTING",
              ["envelope", "records", index, "eventId"],
              `eventId "${record.eventId}" already exists with identical canonical content.`
            )
          );
          continue;
        }

        conflictingDiagnostics.push(
          createDiagnostic(
            "MEMORY_STORAGE_EVENT_DUPLICATE_CONFLICT",
            ["envelope", "records", index, "eventId"],
            `eventId "${record.eventId}" already exists with conflicting canonical content.`
          )
        );
      }

      if (conflictingDiagnostics.length > 0) {
        return createRejectedResult("append-events", conflictingDiagnostics, { recordCount: 0 });
      }

      for (const record of newRecords) {
        state.eventRecords.set(record.eventId, cloneValue(record));
        state.eventOrder.push(record.eventId);
      }

      return createStorageOperationResult({
        status: "completed",
        diagnostics: duplicateDiagnostics,
        metadata: {
          deterministic: true,
          adapterKind: "memory",
          operation: "append-events",
          persistent: false,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          supportsIdempotency: true,
          recordCount: newRecords.length
        },
        eventEnvelope: {
          records: Object.freeze(newRecords.map((record) => cloneValue(record))),
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "event-store"
          }
        }
      });
    },

    async readEventRecords(input: StorageReadEventsInput): Promise<StorageOperationResult> {
      await Promise.resolve();
      const inputDiagnostics = inspectStorageReadEventsInput(input).map((diagnostic) =>
        createDiagnostic(diagnostic.code, diagnostic.path, diagnostic.message, diagnostic.details)
      );
      if (inputDiagnostics.length > 0) {
        return createRejectedResult("read-events", inputDiagnostics);
      }
      if (input.adapterKind !== "memory") {
        return createRejectedResult("read-events", [createDiagnostic("MEMORY_STORAGE_ADAPTER_KIND_INVALID", ["adapterKind"], 'adapterKind must be "memory".')]);
      }

      const filterIds = input.eventIds === undefined ? undefined : new Set(input.eventIds);
      const records: PersistenceEventRecord[] = [];
      const recordsRead: string[] = [];

      for (const eventId of state.eventOrder) {
        const record = state.eventRecords.get(eventId);
        if (record === undefined) {
          continue;
        }
        if (filterIds !== undefined && !filterIds.has(eventId)) {
          continue;
        }
        if (
          input.revisionRange !== undefined &&
          (record.revision < input.revisionRange.fromRevision || record.revision > input.revisionRange.toRevision)
        ) {
          continue;
        }

        records.push(cloneValue(record));
        recordsRead.push(eventId);
      }

      return createStorageOperationResult({
        status: "completed",
        diagnostics: [],
        metadata: {
          deterministic: true,
          adapterKind: "memory",
          operation: "read-events",
          persistent: false,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          recordCount: records.length
        },
        eventEnvelope: {
          records: Object.freeze(records),
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "event-store"
          }
        },
        recordsRead: Object.freeze(recordsRead)
      });
    },

    async listEventRecords(input: StorageReadEventsInput): Promise<StorageOperationResult> {
      const result = await this.readEventRecords({ ...input, adapterKind: "memory" });
      return createStorageOperationResult({
        ...result,
        metadata: {
          ...result.metadata,
          operation: "list-events"
        }
      });
    },

    async saveSnapshot(input: StorageSaveSnapshotInput): Promise<StorageOperationResult> {
      await Promise.resolve();
      const inputDiagnostics = inspectStorageSaveSnapshotInput(input).map((diagnostic) =>
        createDiagnostic(diagnostic.code, diagnostic.path, diagnostic.message, diagnostic.details)
      );
      if (inputDiagnostics.length > 0) {
        return createRejectedResult("save-snapshot", inputDiagnostics);
      }
      if (input.adapterKind !== "memory") {
        return createRejectedResult("save-snapshot", [createDiagnostic("MEMORY_STORAGE_ADAPTER_KIND_INVALID", ["adapterKind"], 'adapterKind must be "memory".')]);
      }

      const snapshot = normalizeSnapshot(input.snapshot);
      const existing = state.snapshots.get(snapshot.snapshotId);
      if (existing !== undefined) {
        if (canonicalizeJson(toJsonValue(existing)) === canonicalizeJson(toJsonValue(snapshot))) {
          return createStorageOperationResult({
            status: "completed",
            diagnostics: [
              createDiagnostic(
                "MEMORY_STORAGE_SNAPSHOT_DUPLICATE_EXISTING",
                ["snapshot", "snapshotId"],
                `snapshotId "${snapshot.snapshotId}" already exists with identical canonical content.`
              )
            ],
            metadata: {
              deterministic: true,
              adapterKind: "memory",
              operation: "save-snapshot",
              persistent: false,
              schemaVersion: STORAGE_SCHEMA_VERSION,
              supportsIdempotency: true,
              snapshotId: snapshot.snapshotId
            },
            snapshot: cloneValue(existing)
          });
        }

        return createRejectedResult(
          "save-snapshot",
          [
            createDiagnostic(
              "MEMORY_STORAGE_SNAPSHOT_DUPLICATE_CONFLICT",
              ["snapshot", "snapshotId"],
              `snapshotId "${snapshot.snapshotId}" already exists with conflicting canonical content.`
            )
          ],
          { snapshotId: snapshot.snapshotId }
        );
      }

      state.snapshots.set(snapshot.snapshotId, cloneValue(snapshot));

      return createStorageOperationResult({
        status: "completed",
        diagnostics: [],
        metadata: {
          deterministic: true,
          adapterKind: "memory",
          operation: "save-snapshot",
          persistent: false,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          supportsIdempotency: true,
          snapshotId: snapshot.snapshotId
        },
        snapshot: cloneValue(snapshot)
      });
    },

    async loadSnapshot(input: StorageLoadSnapshotInput): Promise<StorageOperationResult> {
      await Promise.resolve();
      const inputDiagnostics = inspectStorageLoadSnapshotInput(input).map((diagnostic) =>
        createDiagnostic(diagnostic.code, diagnostic.path, diagnostic.message, diagnostic.details)
      );
      if (inputDiagnostics.length > 0) {
        return createRejectedResult("load-snapshot", inputDiagnostics, { snapshotId: input.snapshotId });
      }
      if (input.adapterKind !== "memory") {
        return createRejectedResult("load-snapshot", [createDiagnostic("MEMORY_STORAGE_ADAPTER_KIND_INVALID", ["adapterKind"], 'adapterKind must be "memory".')], { snapshotId: input.snapshotId });
      }

      const snapshot = state.snapshots.get(input.snapshotId);
      if (snapshot === undefined) {
        return createBlockedResult(
          "load-snapshot",
          [createDiagnostic("MEMORY_STORAGE_SNAPSHOT_MISSING", ["snapshotId"], `snapshotId "${input.snapshotId}" was not found.`)],
          { snapshotId: input.snapshotId }
        );
      }
      if (input.stateId !== undefined && snapshot.stateId !== input.stateId) {
        return createRejectedResult(
          "load-snapshot",
          [createDiagnostic("MEMORY_STORAGE_STATE_ID_MISMATCH", ["stateId"], "stateId does not match the stored snapshot.")],
          { snapshotId: input.snapshotId }
        );
      }

      return createStorageOperationResult({
        status: "completed",
        diagnostics: [],
        metadata: {
          deterministic: true,
          adapterKind: "memory",
          operation: "load-snapshot",
          persistent: false,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          snapshotId: input.snapshotId
        },
        snapshot: cloneValue(snapshot)
      });
    }
  };
}



