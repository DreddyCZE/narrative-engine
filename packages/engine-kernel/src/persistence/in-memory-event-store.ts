import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createPersistenceResult,
  inspectPersistenceEventEnvelope,
  type PersistenceAppendEventsInput,
  type PersistenceDiagnostic,
  type PersistenceEventEnvelope,
  type PersistenceEventRecord,
  type PersistenceResult
} from "@narrative-engine/engine-contracts";

export type InMemoryEventStore = {
  appendEventRecords: (input: PersistenceAppendEventsInput) => PersistenceResult;
  listEventRecords: () => readonly PersistenceEventRecord[];
  getEventRecordById: (eventId: string) => PersistenceEventRecord | undefined;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalizeJson(value as JsonValue)) as T;
}

function cloneRecord(record: PersistenceEventRecord): PersistenceEventRecord {
  return cloneJson(record);
}

function cloneEnvelope(envelope: PersistenceEventEnvelope): PersistenceEventEnvelope {
  return cloneJson(envelope);
}

function createEnvelope(records: readonly PersistenceEventRecord[]): PersistenceEventEnvelope {
  return {
    records: Object.freeze(records.map((record) => cloneRecord(record))),
    metadata: {
      deterministic: true,
      persistence: "memory",
      source: "event-store"
    }
  };
}

function createDuplicateDiagnostic(
  index: number,
  eventId: string,
  mode: "existing" | "conflict"
): PersistenceDiagnostic {
  return {
    code: mode === "existing" ? "PERSISTENCE_EVENT_DUPLICATE_EXISTING" : "PERSISTENCE_EVENT_DUPLICATE_CONFLICT",
    path: ["envelope", "records", index, "eventId"],
    message:
      mode === "existing"
        ? `eventId "${eventId}" already exists with identical canonical content.`
        : `eventId "${eventId}" already exists with conflicting canonical content.`
  };
}

export function appendEventRecords(store: InMemoryEventStore, input: PersistenceAppendEventsInput): PersistenceResult {
  return store.appendEventRecords(input);
}

export function listEventRecords(store: InMemoryEventStore): readonly PersistenceEventRecord[] {
  return store.listEventRecords();
}

export function getEventRecordById(store: InMemoryEventStore, eventId: string): PersistenceEventRecord | undefined {
  return store.getEventRecordById(eventId);
}

export function createInMemoryEventStore(
  initialRecords: readonly PersistenceEventRecord[] = []
): InMemoryEventStore {
  const initialEnvelope = createEnvelope(initialRecords);
  const initialDiagnostics = inspectPersistenceEventEnvelope(initialEnvelope);
  if (initialDiagnostics.length > 0) {
    throw new Error(initialDiagnostics[0]?.message ?? "Initial event records are invalid.");
  }

  const records = new Map<string, PersistenceEventRecord>();
  const order: string[] = [];

  for (const record of initialEnvelope.records) {
    records.set(record.eventId, cloneRecord(record));
    order.push(record.eventId);
  }

  return {
    appendEventRecords(input: PersistenceAppendEventsInput): PersistenceResult {
      const diagnostics = inspectPersistenceEventEnvelope(input.envelope);
      if (diagnostics.length > 0) {
        return createPersistenceResult({
          status: "rejected",
          diagnostics,
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "event-store",
            operation: "append-events",
            recordCount: 0
          }
        });
      }

      const incoming = cloneEnvelope(input.envelope);
      const newRecords: PersistenceEventRecord[] = [];
      const duplicateDiagnostics: PersistenceDiagnostic[] = [];
      let hasConflict = false;

      for (let index = 0; index < incoming.records.length; index += 1) {
        const record = incoming.records[index];
        if (record === undefined) {
          continue;
        }
        const existing = records.get(record.eventId);
        if (existing === undefined) {
          newRecords.push(record);
          continue;
        }

        if (canonicalizeJson(existing) === canonicalizeJson(record)) {
          duplicateDiagnostics.push(createDuplicateDiagnostic(index, record.eventId, "existing"));
          continue;
        }

        duplicateDiagnostics.push(createDuplicateDiagnostic(index, record.eventId, "conflict"));
        hasConflict = true;
      }

      if (hasConflict) {
        return createPersistenceResult({
          status: "rejected",
          diagnostics: duplicateDiagnostics,
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "event-store",
            operation: "append-events",
            recordCount: 0
          }
        });
      }

      if (newRecords.length === 0) {
        return createPersistenceResult({
          status: "appended",
          diagnostics: duplicateDiagnostics,
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "event-store",
            operation: "append-events",
            recordCount: 0,
            idempotent: true
          },
          eventEnvelope: createEnvelope([])
        });
      }

      for (const record of newRecords) {
        records.set(record.eventId, cloneRecord(record));
        order.push(record.eventId);
      }

      return createPersistenceResult({
        status: "appended",
        diagnostics: duplicateDiagnostics,
        metadata: {
          deterministic: true,
          persistence: "memory",
          source: "event-store",
          operation: "append-events",
          recordCount: newRecords.length,
          ...(duplicateDiagnostics.length > 0 ? { idempotent: true } : {})
        },
        eventEnvelope: createEnvelope(newRecords)
      });
    },

    listEventRecords(): readonly PersistenceEventRecord[] {
      return Object.freeze(
        order
          .map((eventId) => records.get(eventId))
          .filter((record): record is PersistenceEventRecord => record !== undefined)
          .map((record) => cloneRecord(record))
      );
    },

    getEventRecordById(eventId: string): PersistenceEventRecord | undefined {
      const record = records.get(eventId);
      return record === undefined ? undefined : cloneRecord(record);
    }
  };
}
