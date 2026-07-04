import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createPersistenceResult,
  inspectPersistenceEventEnvelope,
  type PersistenceDiagnostic,
  type PersistenceEventEnvelope,
  type PersistenceEventRecord,
  type PersistenceResult,
  type RuntimeHostResult
} from "@narrative-engine/engine-contracts";

import { appendEventRecords, type InMemoryEventStore } from "./in-memory-event-store.js";

const RUNTIME_RESULT_EVENT_STORE_ADAPTER_VERSION = "runtime-result-event-store-adapter@0.1.0" as const;

type AdapterDiagnosticCode =
  | "RUNTIME_RESULT_NOT_COMMITTED"
  | "RUNTIME_RESULT_EVENT_VALUES_MISSING"
  | "RUNTIME_RESULT_REVISION_MISSING"
  | "RUNTIME_EVENT_VALUE_INVALID";

type RuntimeResultEventStoreAdapterInput = {
  readonly runtimeResult: RuntimeHostResult;
};

type AppendRuntimeResultToInMemoryEventStoreInput = RuntimeResultEventStoreAdapterInput & {
  readonly eventStore: InMemoryEventStore;
};

type RuntimeResultEventStoreAdapterResult = {
  readonly persistenceResult: PersistenceResult;
  readonly eventRecords: readonly PersistenceEventRecord[];
};

type NormalizedRuntimeEventValue = {
  readonly eventId: string;
  readonly eventType: string;
  readonly sourceCommandId: string;
  readonly payload?: JsonValue;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalizeJson(value as JsonValue)) as T;
}

function toDiagnosticDetails(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function freezeRecords(records: readonly PersistenceEventRecord[]): readonly PersistenceEventRecord[] {
  return Object.freeze(records.map((record) => cloneJson(record)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createAdapterDiagnostic(
  code: AdapterDiagnosticCode,
  path: readonly (string | number)[],
  message: string,
  details?: JsonValue
): PersistenceDiagnostic {
  return {
    code,
    path: [...path],
    message,
    ...(details === undefined ? {} : { details })
  };
}

function createAdapterMetadata(recordCount: number, persistence: "memory" | "none"): PersistenceResult["metadata"] {
  return {
    deterministic: true,
    persistence,
    source: "persistence-boundary",
    operation: "append-events",
    recordCount
  };
}

function createEnvelope(records: readonly PersistenceEventRecord[]): PersistenceEventEnvelope {
  return {
    records: freezeRecords(records),
    metadata: {
      deterministic: true,
      persistence: "memory",
      source: "event-store",
      ...(records[0] === undefined ? {} : { batchId: `runtime-result.${records[0].sourceCommandId}` })
    }
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function normalizeRuntimeEventValue(
  value: unknown,
  index: number
): { readonly diagnostics: readonly PersistenceDiagnostic[]; readonly eventValue?: NormalizedRuntimeEventValue } {
  const path = ["runtimeResult", "runtimeDomainEventValues", index] as const;
  if (!isRecord(value)) {
    return {
      diagnostics: [
        createAdapterDiagnostic(
          "RUNTIME_EVENT_VALUE_INVALID",
          path,
          "runtimeDomainEventValues entry must be an object."
        )
      ]
    };
  }

  const diagnostics: PersistenceDiagnostic[] = [];
  const eventId = value.eventId;
  const eventType = value.eventType;
  const sourceCommandId = value.sourceCommandId;

  if (typeof eventId !== "string" || eventId.length === 0) {
    diagnostics.push(
      createAdapterDiagnostic(
        "RUNTIME_EVENT_VALUE_INVALID",
        [...path, "eventId"],
        "runtimeDomainEventValues eventId must be a non-empty string."
      )
    );
  }
  if (typeof eventType !== "string" || eventType.length === 0) {
    diagnostics.push(
      createAdapterDiagnostic(
        "RUNTIME_EVENT_VALUE_INVALID",
        [...path, "eventType"],
        "runtimeDomainEventValues eventType must be a non-empty string."
      )
    );
  }
  if (typeof sourceCommandId !== "string" || sourceCommandId.length === 0) {
    diagnostics.push(
      createAdapterDiagnostic(
        "RUNTIME_EVENT_VALUE_INVALID",
        [...path, "sourceCommandId"],
        "runtimeDomainEventValues sourceCommandId must be a non-empty string."
      )
    );
  }

  const metadata = value.metadata;
  if (!isRecord(metadata)) {
    diagnostics.push(
      createAdapterDiagnostic(
        "RUNTIME_EVENT_VALUE_INVALID",
        [...path, "metadata"],
        "runtimeDomainEventValues metadata must be an object."
      )
    );
  } else {
    if (metadata.deterministic !== true) {
      diagnostics.push(
        createAdapterDiagnostic(
          "RUNTIME_EVENT_VALUE_INVALID",
          [...path, "metadata", "deterministic"],
          "runtimeDomainEventValues metadata.deterministic must be true."
        )
      );
    }
    if (metadata.persistence !== "none") {
      diagnostics.push(
        createAdapterDiagnostic(
          "RUNTIME_EVENT_VALUE_INVALID",
          [...path, "metadata", "persistence"],
          'runtimeDomainEventValues metadata.persistence must be "none".'
        )
      );
    }
    if (metadata.source !== "runtime-host") {
      diagnostics.push(
        createAdapterDiagnostic(
          "RUNTIME_EVENT_VALUE_INVALID",
          [...path, "metadata", "source"],
          'runtimeDomainEventValues metadata.source must be "runtime-host".'
        )
      );
    }
  }

  if (diagnostics.length > 0) {
    return { diagnostics };
  }

  const normalizedEventId = eventId as string;
  const normalizedEventType = eventType as string;
  const normalizedSourceCommandId = sourceCommandId as string;

  return {
    diagnostics: Object.freeze([]),
    eventValue: {
      eventId: normalizedEventId,
      eventType: normalizedEventType,
      sourceCommandId: normalizedSourceCommandId,
      ...(Object.prototype.hasOwnProperty.call(value, "payload") && value.payload !== undefined
        ? { payload: cloneJson(value.payload as JsonValue) }
        : {})
    }
  };
}

function buildEventRecords(runtimeResult: RuntimeHostResult): RuntimeResultEventStoreAdapterResult {
  if (runtimeResult.status !== "committed") {
    return {
      persistenceResult: createPersistenceResult({
        status: "blocked",
        diagnostics: [
          createAdapterDiagnostic(
            "RUNTIME_RESULT_NOT_COMMITTED",
            ["runtimeResult", "status"],
            "Only committed runtime results can be adapted for the Event Store boundary.",
            toDiagnosticDetails({ status: runtimeResult.status, adapter: RUNTIME_RESULT_EVENT_STORE_ADAPTER_VERSION })
          )
        ],
        metadata: createAdapterMetadata(0, "none")
      }),
      eventRecords: Object.freeze([])
    };
  }

  const runtimeDomainEventValues = runtimeResult.runtimeDomainEventValues;
  if (runtimeDomainEventValues === undefined || runtimeDomainEventValues.length === 0) {
    return {
      persistenceResult: createPersistenceResult({
        status: "blocked",
        diagnostics: [
          createAdapterDiagnostic(
            "RUNTIME_RESULT_EVENT_VALUES_MISSING",
            ["runtimeResult", "runtimeDomainEventValues"],
            "Committed runtime result must contain at least one runtimeDomainEventValue.",
            toDiagnosticDetails({ adapter: RUNTIME_RESULT_EVENT_STORE_ADAPTER_VERSION })
          )
        ],
        metadata: createAdapterMetadata(0, "none")
      }),
      eventRecords: Object.freeze([])
    };
  }

  const revision = runtimeResult.transaction?.nextRevision;
  if (!isPositiveInteger(revision)) {
    return {
      persistenceResult: createPersistenceResult({
        status: "blocked",
        diagnostics: [
          createAdapterDiagnostic(
            "RUNTIME_RESULT_REVISION_MISSING",
            ["runtimeResult", "transaction", "nextRevision"],
            "Committed runtime result must provide a positive integer nextRevision for persistence event records.",
            toDiagnosticDetails({ adapter: RUNTIME_RESULT_EVENT_STORE_ADAPTER_VERSION })
          )
        ],
        metadata: createAdapterMetadata(0, "none")
      }),
      eventRecords: Object.freeze([])
    };
  }

  const valueDiagnostics: PersistenceDiagnostic[] = [];
  const normalizedValues: NormalizedRuntimeEventValue[] = [];
  for (let index = 0; index < runtimeDomainEventValues.length; index += 1) {
    const normalized = normalizeRuntimeEventValue(runtimeDomainEventValues[index], index);
    valueDiagnostics.push(...normalized.diagnostics);
    if (normalized.eventValue !== undefined) {
      normalizedValues.push(normalized.eventValue);
    }
  }
  if (valueDiagnostics.length > 0) {
    return {
      persistenceResult: createPersistenceResult({
        status: "rejected",
        diagnostics: valueDiagnostics,
        metadata: createAdapterMetadata(0, "none")
      }),
      eventRecords: Object.freeze([])
    };
  }

  const eventRecords: readonly PersistenceEventRecord[] = normalizedValues.map((eventValue) => ({
    eventId: eventValue.eventId,
    eventType: eventValue.eventType,
    sourceCommandId: eventValue.sourceCommandId,
    revision,
    schemaVersion: 1,
    ...(eventValue.payload === undefined ? {} : { payload: cloneJson(eventValue.payload) }),
    metadata: {
      deterministic: true,
      persistence: "memory",
      source: "runtime-host",
      createdAtPolicy: "logical",
      ...(runtimeResult.metadata.runtimeHostVersion === undefined
        ? {}
        : { runtimeVersion: runtimeResult.metadata.runtimeHostVersion }),
      idempotencyKey: `${eventValue.sourceCommandId}:${eventValue.eventId}`
    }
  }));

  const eventEnvelope = createEnvelope(eventRecords);
  const envelopeDiagnostics = inspectPersistenceEventEnvelope(eventEnvelope);
  if (envelopeDiagnostics.length > 0) {
    return {
      persistenceResult: createPersistenceResult({
        status: "rejected",
        diagnostics: envelopeDiagnostics,
        metadata: createAdapterMetadata(0, "none")
      }),
      eventRecords: Object.freeze([])
    };
  }

  return {
    persistenceResult: createPersistenceResult({
      status: "appended",
      diagnostics: [],
      metadata: createAdapterMetadata(eventRecords.length, "none"),
      eventEnvelope
    }),
    eventRecords: freezeRecords(eventRecords)
  };
}

export function adaptRuntimeResultToEventStoreRecords(
  input: RuntimeResultEventStoreAdapterInput
): RuntimeResultEventStoreAdapterResult {
  return buildEventRecords(input.runtimeResult);
}

export function appendRuntimeResultToInMemoryEventStore(
  input: AppendRuntimeResultToInMemoryEventStoreInput
): RuntimeResultEventStoreAdapterResult {
  const adapted = adaptRuntimeResultToEventStoreRecords({ runtimeResult: input.runtimeResult });
  if (adapted.persistenceResult.status !== "appended" || adapted.persistenceResult.eventEnvelope === undefined) {
    return adapted;
  }

  return {
    persistenceResult: appendEventRecords(input.eventStore, {
      envelope: adapted.persistenceResult.eventEnvelope
    }),
    eventRecords: adapted.eventRecords
  };
}

export type {
  AppendRuntimeResultToInMemoryEventStoreInput,
  RuntimeResultEventStoreAdapterInput,
  RuntimeResultEventStoreAdapterResult
};