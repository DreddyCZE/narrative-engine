import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";

import { canonicalizeJson, type JsonPath, type JsonValue } from "@narrative-engine/core";
import {
  createStorageOperationResult,
  inspectPersistenceEventEnvelope,
  inspectPersistenceSnapshotRecord,
  inspectSerializationEnvelope,
  inspectStorageAppendEventsInput,
  inspectStorageLoadSnapshotInput,
  inspectStorageReadEventsInput,
  inspectStorageSaveSnapshotInput,
  type PersistenceEventEnvelope,
  type PersistenceEventRecord,
  type PersistenceSnapshotRecord,
  type SerializationEnvelope,
  type SerializationMetadata,
  type StorageAdapterCapability,
  type StorageAdapterContract,
  type StorageAdapterDiagnostic,
  type StorageLoadSnapshotInput,
  type StorageOperationResult,
  type StorageReadEventsInput,
  type StorageSaveSnapshotInput,
  type StorageAppendEventsInput
} from "@narrative-engine/engine-contracts";

const STORAGE_SCHEMA_VERSION = 1;
const EVENT_RECORD_SCHEMA_ID = "persistence-event-record";
const SNAPSHOT_RECORD_SCHEMA_ID = "persistence-snapshot-record";
const ORDER_SCHEMA_ID = "file-storage-event-order";

type EventOrderPayload = {
  readonly eventIds: readonly string[];
};

export type FileStorageAdapterOptions = {
  readonly rootDirectory: string;
  readonly adapterId?: string;
};

export type FileStorageAdapter = StorageAdapterContract & {
  readonly rootDirectory: string;
  readonly adapterId: string;
  appendEventRecords: (input: StorageAppendEventsInput) => Promise<StorageOperationResult>;
  readEventRecords: (input: StorageReadEventsInput) => Promise<StorageOperationResult>;
  listEventRecords: (input: StorageReadEventsInput) => Promise<StorageOperationResult>;
  saveSnapshot: (input: StorageSaveSnapshotInput) => Promise<StorageOperationResult>;
  loadSnapshot: (input: StorageLoadSnapshotInput) => Promise<StorageOperationResult>;
};

type FileStorageLayout = {
  readonly rootDirectory: string;
  readonly eventsDirectory: string;
  readonly eventRecordsDirectory: string;
  readonly snapshotsDirectory: string;
  readonly orderFilePath: string;
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
      adapterKind: "file",
      operation,
      persistent: true,
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
      adapterKind: "file",
      operation,
      persistent: true,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      ...overrides
    }
  });
}

function createErrorResult(
  operation: StorageOperationResult["metadata"]["operation"],
  diagnostics: readonly StorageAdapterDiagnostic[],
  overrides: Partial<StorageOperationResult["metadata"]> = {}
): StorageOperationResult {
  return createStorageOperationResult({
    status: "error",
    diagnostics,
    metadata: {
      deterministic: true,
      adapterKind: "file",
      operation,
      persistent: true,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      ...overrides
    }
  });
}

function hasTraversalSegment(value: string): boolean {
  return value.includes("../") || value.includes("..\\") || value.startsWith("/") || value.startsWith("\\") || value.includes(":");
}

function encodeIdentifier(value: string): string {
  return encodeURIComponent(value);
}

function normalizeEventRecord(record: PersistenceEventRecord): PersistenceEventRecord {
  return {
    ...cloneValue(record),
    metadata: {
      ...cloneValue(record.metadata),
      persistence: "future-storage"
    }
  };
}

function normalizeEventEnvelope(envelope: PersistenceEventEnvelope): PersistenceEventEnvelope {
  return {
    records: Object.freeze(envelope.records.map((record) => normalizeEventRecord(record))),
    metadata: {
      ...cloneValue(envelope.metadata),
      persistence: "future-storage"
    }
  };
}

function normalizeSnapshot(snapshot: PersistenceSnapshotRecord): PersistenceSnapshotRecord {
  return {
    ...cloneValue(snapshot),
    metadata: {
      ...cloneValue(snapshot.metadata),
      persistence: "future-storage"
    }
  };
}

function createSerializationMetadata(schemaId: string, version: number): SerializationMetadata {
  return {
    deterministic: true,
    format: "json",
    lineEndings: "lf",
    indentation: "none",
    contentType: "application/json",
    schemaVersion: {
      schemaId,
      version
    },
    checksum: {
      algorithm: "none"
    }
  };
}

function createSerializationEnvelope(schemaId: string, version: number, payload: JsonValue): SerializationEnvelope {
  return {
    metadata: createSerializationMetadata(schemaId, version),
    payload
  };
}

function ensureSerializationEnvelope(
  envelope: SerializationEnvelope,
  path: JsonPath
): readonly StorageAdapterDiagnostic[] {
  return inspectSerializationEnvelope(envelope).map((diagnostic) =>
    createDiagnostic(diagnostic.code, [...path, ...diagnostic.path], diagnostic.message, diagnostic.details)
  );
}

function createLayout(rootDirectory: string): FileStorageLayout {
  const absoluteRoot = resolve(rootDirectory);
  return {
    rootDirectory: absoluteRoot,
    eventsDirectory: resolve(absoluteRoot, "events"),
    eventRecordsDirectory: resolve(absoluteRoot, "events", "records"),
    snapshotsDirectory: resolve(absoluteRoot, "snapshots"),
    orderFilePath: resolve(absoluteRoot, "events", "order.json")
  };
}

function resolveWithinRoot(rootDirectory: string, targetPath: string): string | undefined {
  const resolvedPath = resolve(targetPath);
  const normalizedRoot = rootDirectory.endsWith(sep) ? rootDirectory : `${rootDirectory}${sep}`;
  if (resolvedPath === rootDirectory || resolvedPath.startsWith(normalizedRoot)) {
    return resolvedPath;
  }
  return undefined;
}

function eventRecordFilePath(layout: FileStorageLayout, eventId: string): string | undefined {
  return resolveWithinRoot(layout.rootDirectory, join(layout.eventRecordsDirectory, `${encodeIdentifier(eventId)}.json`));
}

function snapshotFilePath(layout: FileStorageLayout, snapshotId: string): string | undefined {
  return resolveWithinRoot(layout.rootDirectory, join(layout.snapshotsDirectory, `${encodeIdentifier(snapshotId)}.json`));
}

async function ensureLayout(layout: FileStorageLayout): Promise<void> {
  await mkdir(layout.eventRecordsDirectory, { recursive: true });
  await mkdir(layout.snapshotsDirectory, { recursive: true });
}

async function writeCanonicalJson(filePath: string, value: JsonValue): Promise<void> {
  await writeFile(filePath, canonicalizeJson(value), "utf8");
}

async function tryReadJson(filePath: string): Promise<{ readonly found: false } | { readonly found: true; readonly value: unknown } | { readonly found: true; readonly parseError: true }> {
  try {
    const raw = await readFile(filePath, "utf8");
    return { found: true, value: JSON.parse(raw) as unknown };
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;
    if (maybeNodeError.code === "ENOENT") {
      return { found: false };
    }
    if (error instanceof SyntaxError) {
      return { found: true, parseError: true };
    }
    throw error;
  }
}

async function loadEventOrder(layout: FileStorageLayout): Promise<
  | { readonly ok: true; readonly eventIds: readonly string[] }
  | { readonly ok: false; readonly result: StorageOperationResult }
> {
  const readResult = await tryReadJson(layout.orderFilePath);
  if (!readResult.found) {
    return { ok: true, eventIds: [] };
  }
  if ("parseError" in readResult) {
    return {
      ok: false,
      result: createErrorResult("list-events", [createDiagnostic("FILE_STORAGE_JSON_INVALID", ["order"], "event order file contains invalid JSON.")])
    };
  }

  const envelope = readResult.value;
  if (typeof envelope !== "object" || envelope === null) {
    return {
      ok: false,
      result: createErrorResult("list-events", [createDiagnostic("FILE_STORAGE_ORDER_INVALID", ["order"], "event order file must contain an object envelope.")])
    };
  }

  const diagnostics = ensureSerializationEnvelope(envelope as SerializationEnvelope, ["order"]);
  if (diagnostics.length > 0) {
    return { ok: false, result: createErrorResult("list-events", diagnostics) };
  }

  const payload = (envelope as SerializationEnvelope).payload;
  const eventIds = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).eventIds : undefined;
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray(eventIds) ||
    !eventIds.every((value: unknown) => typeof value === "string")
  ) {
    return {
      ok: false,
      result: createErrorResult("list-events", [createDiagnostic("FILE_STORAGE_ORDER_INVALID", ["order", "payload"], "event order payload is invalid.")])
    };
  }

  return { ok: true, eventIds: Object.freeze([...(payload as EventOrderPayload).eventIds]) };
}

async function saveEventOrder(layout: FileStorageLayout, eventIds: readonly string[]): Promise<void> {
  const envelope = createSerializationEnvelope(ORDER_SCHEMA_ID, STORAGE_SCHEMA_VERSION, { eventIds: [...eventIds] });
  await writeCanonicalJson(layout.orderFilePath, envelope);
}

async function loadStoredEventRecord(
  layout: FileStorageLayout,
  eventId: string,
  operation: StorageOperationResult["metadata"]["operation"]
): Promise<
  | { readonly ok: true; readonly found: false }
  | { readonly ok: true; readonly found: true; readonly record: PersistenceEventRecord }
  | { readonly ok: false; readonly result: StorageOperationResult }
> {
  if (hasTraversalSegment(eventId)) {
    return {
      ok: false,
      result: createRejectedResult(operation, [createDiagnostic("FILE_STORAGE_PATH_TRAVERSAL", ["eventId"], "eventId would escape the adapter root.")])
    };
  }

  const filePath = eventRecordFilePath(layout, eventId);
  if (filePath === undefined) {
    return {
      ok: false,
      result: createRejectedResult(operation, [createDiagnostic("FILE_STORAGE_ROOT_ESCAPE", ["eventId"], "event record path would escape the adapter root.")])
    };
  }

  const readResult = await tryReadJson(filePath);
  if (!readResult.found) {
    return { ok: true, found: false };
  }
  if ("parseError" in readResult) {
    return {
      ok: false,
      result: createErrorResult(operation, [createDiagnostic("FILE_STORAGE_JSON_INVALID", ["eventId"], `event record "${eventId}" contains invalid JSON.`)])
    };
  }

  const serializationEnvelope = readResult.value as SerializationEnvelope;
  const serializationDiagnostics = ensureSerializationEnvelope(serializationEnvelope, ["eventId"]);
  if (serializationDiagnostics.length > 0) {
    return { ok: false, result: createErrorResult(operation, serializationDiagnostics) };
  }

  const eventDiagnostics = inspectPersistenceEventEnvelope({
    records: [serializationEnvelope.payload],
    metadata: {
      deterministic: true,
      persistence: "future-storage",
      source: "event-store"
    }
  }).map((diagnostic) => createDiagnostic(diagnostic.code, ["eventId", ...diagnostic.path], diagnostic.message, diagnostic.details));

  if (eventDiagnostics.length > 0) {
    return { ok: false, result: createErrorResult(operation, eventDiagnostics) };
  }

  return { ok: true, found: true, record: cloneValue(serializationEnvelope.payload as PersistenceEventRecord) };
}

async function loadStoredSnapshot(
  layout: FileStorageLayout,
  snapshotId: string,
  operation: StorageOperationResult["metadata"]["operation"]
): Promise<
  | { readonly ok: true; readonly found: false }
  | { readonly ok: true; readonly found: true; readonly snapshot: PersistenceSnapshotRecord }
  | { readonly ok: false; readonly result: StorageOperationResult }
> {
  if (hasTraversalSegment(snapshotId)) {
    return {
      ok: false,
      result: createRejectedResult(operation, [createDiagnostic("FILE_STORAGE_PATH_TRAVERSAL", ["snapshotId"], "snapshotId would escape the adapter root.")], { snapshotId })
    };
  }

  const filePath = snapshotFilePath(layout, snapshotId);
  if (filePath === undefined) {
    return {
      ok: false,
      result: createRejectedResult(operation, [createDiagnostic("FILE_STORAGE_ROOT_ESCAPE", ["snapshotId"], "snapshot path would escape the adapter root.")], { snapshotId })
    };
  }

  const readResult = await tryReadJson(filePath);
  if (!readResult.found) {
    return { ok: true, found: false };
  }
  if ("parseError" in readResult) {
    return {
      ok: false,
      result: createErrorResult(operation, [createDiagnostic("FILE_STORAGE_JSON_INVALID", ["snapshotId"], `snapshot "${snapshotId}" contains invalid JSON.`)], { snapshotId })
    };
  }

  const serializationEnvelope = readResult.value as SerializationEnvelope;
  const serializationDiagnostics = ensureSerializationEnvelope(serializationEnvelope, ["snapshotId"]);
  if (serializationDiagnostics.length > 0) {
    return { ok: false, result: createErrorResult(operation, serializationDiagnostics, { snapshotId }) };
  }

  const snapshotDiagnostics = inspectPersistenceSnapshotRecord(serializationEnvelope.payload).map((diagnostic) =>
    createDiagnostic(diagnostic.code, ["snapshotId", ...diagnostic.path], diagnostic.message, diagnostic.details)
  );
  if (snapshotDiagnostics.length > 0) {
    return { ok: false, result: createErrorResult(operation, snapshotDiagnostics, { snapshotId }) };
  }

  return { ok: true, found: true, snapshot: cloneValue(serializationEnvelope.payload as PersistenceSnapshotRecord) };
}

function buildCapabilities(): readonly StorageAdapterCapability[] {
  return Object.freeze([
    { operation: "append-events", batch: true, idempotent: true, persistent: true },
    { operation: "list-events", persistent: true },
    { operation: "read-events", persistent: true },
    { operation: "save-snapshot", idempotent: true, persistent: true },
    { operation: "load-snapshot", persistent: true },
    { operation: "health-check", persistent: true }
  ]);
}

export function createFileStorageAdapter(options: FileStorageAdapterOptions): FileStorageAdapter {
  const layout = createLayout(options.rootDirectory);
  const contract: StorageAdapterContract = {
    kind: "file",
    capabilities: buildCapabilities(),
    deterministic: true,
    persistent: true,
    schemaVersion: STORAGE_SCHEMA_VERSION
  };

  const adapterId = options.adapterId ?? `file-storage:${basename(layout.rootDirectory)}`;

  return {
    ...contract,
    rootDirectory: layout.rootDirectory,
    adapterId,

    async appendEventRecords(input: StorageAppendEventsInput): Promise<StorageOperationResult> {
      const inputDiagnostics = inspectStorageAppendEventsInput(input).map((diagnostic) =>
        createDiagnostic(diagnostic.code, diagnostic.path, diagnostic.message, diagnostic.details)
      );
      if (inputDiagnostics.length > 0) {
        return createRejectedResult("append-events", inputDiagnostics);
      }
      if (input.adapterKind !== "file") {
        return createRejectedResult("append-events", [createDiagnostic("FILE_STORAGE_ADAPTER_KIND_INVALID", ["adapterKind"], 'adapterKind must be "file".')]);
      }

      await ensureLayout(layout);

      const orderResult = await loadEventOrder(layout);
      if (!orderResult.ok) {
        return orderResult.result;
      }

      const envelope = normalizeEventEnvelope(input.envelope);
      const newRecords: PersistenceEventRecord[] = [];
      const duplicateDiagnostics: StorageAdapterDiagnostic[] = [];
      const conflictingDiagnostics: StorageAdapterDiagnostic[] = [];
      const updatedOrder = [...orderResult.eventIds];

      for (let index = 0; index < envelope.records.length; index += 1) {
        const record = envelope.records[index];
        if (record === undefined) {
          continue;
        }
        const existingResult = await loadStoredEventRecord(layout, record.eventId, "append-events");
        if (!existingResult.ok) {
          return existingResult.result;
        }
        if (!existingResult.found) {
          newRecords.push(record);
          updatedOrder.push(record.eventId);
          continue;
        }

        if (canonicalizeJson(existingResult.record) === canonicalizeJson(record)) {
          duplicateDiagnostics.push(createDiagnostic("FILE_STORAGE_EVENT_DUPLICATE_EXISTING", ["envelope", "records", index, "eventId"], `eventId "${record.eventId}" already exists with identical canonical content.`));
          continue;
        }

        conflictingDiagnostics.push(createDiagnostic("FILE_STORAGE_EVENT_DUPLICATE_CONFLICT", ["envelope", "records", index, "eventId"], `eventId "${record.eventId}" already exists with conflicting canonical content.`));
      }

      if (conflictingDiagnostics.length > 0) {
        return createRejectedResult("append-events", conflictingDiagnostics, { recordCount: 0 });
      }

      for (const record of newRecords) {
        const filePath = eventRecordFilePath(layout, record.eventId);
        if (filePath === undefined) {
          return createRejectedResult("append-events", [createDiagnostic("FILE_STORAGE_ROOT_ESCAPE", ["eventId"], "event record path would escape the adapter root.")]);
        }
        const serialized = createSerializationEnvelope(EVENT_RECORD_SCHEMA_ID, record.schemaVersion, record);
        await writeCanonicalJson(filePath, serialized);
      }

      await saveEventOrder(layout, updatedOrder);

      const resultEnvelope: PersistenceEventEnvelope = {
        records: Object.freeze(newRecords.map((record) => cloneValue(record))),
        metadata: {
          deterministic: true,
          persistence: "future-storage",
          source: "event-store"
        }
      };

      return createStorageOperationResult({
        status: "completed",
        diagnostics: [...duplicateDiagnostics],
        metadata: {
          deterministic: true,
          adapterKind: "file",
          operation: "append-events",
          persistent: true,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          supportsIdempotency: true,
          recordCount: newRecords.length
        },
        eventEnvelope: resultEnvelope
      });
    },

    async readEventRecords(input: StorageReadEventsInput): Promise<StorageOperationResult> {
      const inputDiagnostics = inspectStorageReadEventsInput(input).map((diagnostic) =>
        createDiagnostic(diagnostic.code, diagnostic.path, diagnostic.message, diagnostic.details)
      );
      if (inputDiagnostics.length > 0) {
        return createRejectedResult("read-events", inputDiagnostics);
      }
      if (input.adapterKind !== "file") {
        return createRejectedResult("read-events", [createDiagnostic("FILE_STORAGE_ADAPTER_KIND_INVALID", ["adapterKind"], 'adapterKind must be "file".')]);
      }

      await ensureLayout(layout);
      const orderResult = await loadEventOrder(layout);
      if (!orderResult.ok) {
        return orderResult.result;
      }

      const filterIds = input.eventIds === undefined ? undefined : new Set(input.eventIds);
      const records: PersistenceEventRecord[] = [];
      const recordsRead: string[] = [];

      for (const eventId of orderResult.eventIds) {
        const loaded = await loadStoredEventRecord(layout, eventId, "read-events");
        if (!loaded.ok) {
          return loaded.result;
        }
        if (!loaded.found) {
          return createErrorResult("read-events", [createDiagnostic("FILE_STORAGE_FILE_MISSING", ["eventId"], `event record "${eventId}" is missing.`)]);
        }
        if (filterIds !== undefined && !filterIds.has(eventId)) {
          continue;
        }
        if (
          input.revisionRange !== undefined &&
          (loaded.record.revision < input.revisionRange.fromRevision || loaded.record.revision > input.revisionRange.toRevision)
        ) {
          continue;
        }
        records.push(cloneValue(loaded.record));
        recordsRead.push(eventId);
      }

      return createStorageOperationResult({
        status: "completed",
        diagnostics: [],
        metadata: {
          deterministic: true,
          adapterKind: "file",
          operation: "read-events",
          persistent: true,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          recordCount: records.length
        },
        eventEnvelope: {
          records: Object.freeze(records),
          metadata: {
            deterministic: true,
            persistence: "future-storage",
            source: "event-store"
          }
        },
        recordsRead: Object.freeze(recordsRead)
      });
    },

    async listEventRecords(input: StorageReadEventsInput): Promise<StorageOperationResult> {
      const result = await this.readEventRecords({ ...input, adapterKind: "file" });
      return createStorageOperationResult({
        ...result,
        metadata: {
          ...result.metadata,
          operation: "list-events"
        }
      });
    },

    async saveSnapshot(input: StorageSaveSnapshotInput): Promise<StorageOperationResult> {
      const inputDiagnostics = inspectStorageSaveSnapshotInput(input).map((diagnostic) =>
        createDiagnostic(diagnostic.code, diagnostic.path, diagnostic.message, diagnostic.details)
      );
      if (inputDiagnostics.length > 0) {
        return createRejectedResult("save-snapshot", inputDiagnostics);
      }
      if (input.adapterKind !== "file") {
        return createRejectedResult("save-snapshot", [createDiagnostic("FILE_STORAGE_ADAPTER_KIND_INVALID", ["adapterKind"], 'adapterKind must be "file".')]);
      }

      await ensureLayout(layout);
      const snapshot = normalizeSnapshot(input.snapshot);
      const existingResult = await loadStoredSnapshot(layout, snapshot.snapshotId, "save-snapshot");
      if (!existingResult.ok) {
        return existingResult.result;
      }
      if (existingResult.found) {
        if (canonicalizeJson(existingResult.snapshot as JsonValue) === canonicalizeJson(snapshot as JsonValue)) {
          return createStorageOperationResult({
            status: "completed",
            diagnostics: [createDiagnostic("FILE_STORAGE_SNAPSHOT_DUPLICATE_EXISTING", ["snapshot", "snapshotId"], `snapshotId "${snapshot.snapshotId}" already exists with identical canonical content.`)],
            metadata: {
              deterministic: true,
              adapterKind: "file",
              operation: "save-snapshot",
              persistent: true,
              schemaVersion: STORAGE_SCHEMA_VERSION,
              supportsIdempotency: true,
              snapshotId: snapshot.snapshotId
            },
            snapshot: existingResult.snapshot
          });
        }
        return createRejectedResult("save-snapshot", [createDiagnostic("FILE_STORAGE_SNAPSHOT_DUPLICATE_CONFLICT", ["snapshot", "snapshotId"], `snapshotId "${snapshot.snapshotId}" already exists with conflicting canonical content.`)], { snapshotId: snapshot.snapshotId });
      }

      const filePath = snapshotFilePath(layout, snapshot.snapshotId);
      if (filePath === undefined) {
        return createRejectedResult("save-snapshot", [createDiagnostic("FILE_STORAGE_ROOT_ESCAPE", ["snapshot", "snapshotId"], "snapshot path would escape the adapter root.")], { snapshotId: snapshot.snapshotId });
      }

      const serialized = createSerializationEnvelope(SNAPSHOT_RECORD_SCHEMA_ID, 1, toJsonValue(snapshot));
      await writeCanonicalJson(filePath, serialized);

      return createStorageOperationResult({
        status: "completed",
        diagnostics: [],
        metadata: {
          deterministic: true,
          adapterKind: "file",
          operation: "save-snapshot",
          persistent: true,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          supportsIdempotency: true,
          snapshotId: snapshot.snapshotId
        },
        snapshot
      });
    },

    async loadSnapshot(input: StorageLoadSnapshotInput): Promise<StorageOperationResult> {
      const inputDiagnostics = inspectStorageLoadSnapshotInput(input).map((diagnostic) =>
        createDiagnostic(diagnostic.code, diagnostic.path, diagnostic.message, diagnostic.details)
      );
      if (inputDiagnostics.length > 0) {
        return createRejectedResult("load-snapshot", inputDiagnostics, { snapshotId: input.snapshotId });
      }
      if (input.adapterKind !== "file") {
        return createRejectedResult("load-snapshot", [createDiagnostic("FILE_STORAGE_ADAPTER_KIND_INVALID", ["adapterKind"], 'adapterKind must be "file".')], { snapshotId: input.snapshotId });
      }

      await ensureLayout(layout);
      const loaded = await loadStoredSnapshot(layout, input.snapshotId, "load-snapshot");
      if (!loaded.ok) {
        return loaded.result;
      }
      if (!loaded.found) {
        return createBlockedResult("load-snapshot", [createDiagnostic("FILE_STORAGE_SNAPSHOT_MISSING", ["snapshotId"], `snapshotId "${input.snapshotId}" was not found.`)], { snapshotId: input.snapshotId });
      }
      if (input.stateId !== undefined && loaded.snapshot.stateId !== input.stateId) {
        return createRejectedResult("load-snapshot", [createDiagnostic("FILE_STORAGE_STATE_ID_MISMATCH", ["stateId"], "stateId does not match the stored snapshot.")], { snapshotId: input.snapshotId });
      }

      return createStorageOperationResult({
        status: "completed",
        diagnostics: [],
        metadata: {
          deterministic: true,
          adapterKind: "file",
          operation: "load-snapshot",
          persistent: true,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          snapshotId: input.snapshotId
        },
        snapshot: loaded.snapshot
      });
    }
  };
}



